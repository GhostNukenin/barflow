using BarFlow.Api.Auth;
using BarFlow.Api.Data;
using BarFlow.Api.Domain;
using BarFlow.Api.Dtos;
using BarFlow.Api.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController(AppDbContext db, OrderNotifier notifier) : ControllerBase
{
    private static readonly OrderStatus[] ActiveStatuses = [OrderStatus.Pendente, OrderStatus.EmPreparo, OrderStatus.Pronto];

    private IQueryable<Order> Query() => db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Waiter);

    /// <summary>Pedidos em andamento, mais os entregues/cancelados recentemente (para o garçom acompanhar).</summary>
    [HttpGet("active")]
    public async Task<List<OrderDto>> Active([FromQuery] bool mine = false, [FromQuery] int recentMinutes = 30)
    {
        var since = DateTime.UtcNow.AddMinutes(-Math.Clamp(recentMinutes, 0, 720));
        var q = Query().Where(o =>
            ActiveStatuses.Contains(o.Status)
            || (o.Status == OrderStatus.Entregue && o.DeliveredAt >= since)
            || (o.Status == OrderStatus.Cancelado && o.CanceledAt >= since));
        if (mine) q = q.Where(o => o.WaiterId == User.UserId());

        var list = await q.OrderBy(o => o.CreatedAt).ToListAsync();
        return list.Select(OrderDto.From).ToList();
    }

    /// <summary>Histórico paginado com filtros.</summary>
    [HttpGet]
    public async Task<PagedResult<OrderDto>> History(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] OrderStatus? status,
        [FromQuery] int? table,
        [FromQuery] int? waiterId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = Query();
        if (from is not null) q = q.Where(o => o.CreatedAt >= from.Value.ToUniversalTime());
        if (to is not null) q = q.Where(o => o.CreatedAt < to.Value.ToUniversalTime());
        if (status is not null) q = q.Where(o => o.Status == status);
        if (table is not null) q = q.Where(o => o.TableNumber == table);
        if (waiterId is not null) q = q.Where(o => o.WaiterId == waiterId);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        return new PagedResult<OrderDto>(items.Select(OrderDto.From).ToList(), total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> Get(int id)
    {
        var o = await Query().FirstOrDefaultAsync(x => x.Id == id);
        return o is null ? NotFound() : OrderDto.From(o);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.Garcom},{Roles.Gestor}")]
    public async Task<ActionResult<OrderDto>> Create(CreateOrderRequest req)
    {
        var settings = await db.Settings.FirstAsync();
        if (req.TableNumber > settings.TableCount)
            return BadRequest(new { message = $"Mesa inválida. O bar tem {settings.TableCount} mesas." });

        var ids = req.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.Include(p => p.Category)
            .Where(p => ids.Contains(p.Id) && p.Active)
            .ToDictionaryAsync(p => p.Id);
        var missing = ids.Where(id => !products.ContainsKey(id)).ToList();
        if (missing.Count > 0)
            return BadRequest(new { message = "Um ou mais produtos não estão disponíveis no cardápio." });

        var now = DateTime.UtcNow;
        // Momento em que o garçom abriu o pedido no aparelho; ignorado se o relógio do aparelho estiver muito fora.
        DateTime? startedAt = req.StartedAt?.ToUniversalTime();
        if (startedAt is not null && (startedAt > now.AddSeconds(5) || startedAt < now.AddHours(-2)))
            startedAt = null;

        var order = new Order
        {
            TableNumber = req.TableNumber,
            WaiterId = User.UserId(),
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
            StartedAt = startedAt is not null && startedAt > now ? now : startedAt,
            CreatedAt = now,
            Items = req.Items.Select(i =>
            {
                var p = products[i.ProductId];
                return new OrderItem
                {
                    ProductId = p.Id,
                    ProductName = p.Name,
                    CategoryName = p.Category?.Name ?? "",
                    UnitPrice = p.Price,
                    Quantity = i.Quantity,
                    Notes = string.IsNullOrWhiteSpace(i.Notes) ? null : i.Notes.Trim(),
                };
            }).ToList(),
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        await notifier.OrderCreated(order.Id);
        var dto = await Query().FirstAsync(o => o.Id == order.Id);
        return CreatedAtAction(nameof(Get), new { id = order.Id }, OrderDto.From(dto));
    }

    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<OrderDto>> UpdateStatus(int id, UpdateStatusRequest req)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();

        var role = User.Role();
        var error = ApplyTransition(order, req.Status, role, User.UserId());
        if (error is not null) return BadRequest(new { message = error });

        await db.SaveChangesAsync();
        await notifier.OrderUpdated(order.Id);
        return OrderDto.From(await Query().FirstAsync(o => o.Id == id));
    }

    /// <summary>Regras de mudança de status por perfil. Retorna mensagem de erro ou null.</summary>
    private static string? ApplyTransition(Order o, OrderStatus target, UserRole role, int userId)
    {
        var from = o.Status;
        if (from == target) return null;
        if (o.PaymentId is not null) return "Pedido já foi pago e não pode mais ser alterado.";

        var kitchen = role is UserRole.Cozinha or UserRole.Gestor;
        var now = DateTime.UtcNow;

        switch (from, target)
        {
            case (OrderStatus.Pendente, OrderStatus.EmPreparo) when kitchen:
                o.KitchenReceivedAt ??= now;
                o.PreparationStartedAt = now;
                break;

            case (OrderStatus.Pendente, OrderStatus.Pronto) when kitchen:
            case (OrderStatus.EmPreparo, OrderStatus.Pronto) when kitchen:
                o.KitchenReceivedAt ??= now;
                o.PreparationStartedAt ??= now;
                o.ReadyAt = now;
                break;

            // "Desfazer" na cozinha
            case (OrderStatus.EmPreparo, OrderStatus.Pendente) when kitchen:
                o.PreparationStartedAt = null;
                break;
            case (OrderStatus.Pronto, OrderStatus.EmPreparo) when kitchen:
                o.ReadyAt = null;
                break;

            case (OrderStatus.Pronto, OrderStatus.Entregue) when role is UserRole.Garcom or UserRole.Gestor:
                o.DeliveredAt = now;
                break;
            case (OrderStatus.Entregue, OrderStatus.Pronto) when role is UserRole.Garcom or UserRole.Gestor:
                o.DeliveredAt = null;
                break;

            case (OrderStatus.Pendente, OrderStatus.Cancelado) when role == UserRole.Garcom && o.WaiterId == userId:
            case (not OrderStatus.Cancelado, OrderStatus.Cancelado) when role == UserRole.Gestor:
                o.CanceledAt = now;
                break;

            default:
                return $"Seu perfil não pode mudar o pedido de \"{Label(from)}\" para \"{Label(target)}\".";
        }

        o.Status = target;
        return null;
    }

    private static string Label(OrderStatus s) => s switch
    {
        OrderStatus.Pendente => "Pendente",
        OrderStatus.EmPreparo => "Em preparo",
        OrderStatus.Pronto => "Pronto",
        OrderStatus.Entregue => "Entregue",
        OrderStatus.Cancelado => "Cancelado",
        _ => s.ToString(),
    };
}
