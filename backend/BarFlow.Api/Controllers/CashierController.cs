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
[Route("api/cashier")]
[Authorize(Roles = $"{Roles.Caixa},{Roles.Gestor}")]
public class CashierController(AppDbContext db, OrderNotifier notifier) : ControllerBase
{
    /// <summary>Mesas com pedidos não pagos (exceto cancelados).</summary>
    [HttpGet("tables")]
    public async Task<List<OpenTableDto>> OpenTables()
    {
        var orders = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.Waiter)
            .Where(o => o.PaymentId == null && o.Status != OrderStatus.Cancelado)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        return orders
            .GroupBy(o => o.TableNumber)
            .OrderBy(g => g.Key)
            .Select(g => new OpenTableDto(
                g.Key,
                g.Count(),
                g.Sum(o => o.Total),
                g.Min(o => o.CreatedAt),
                g.All(o => o.Status == OrderStatus.Entregue),
                g.Select(OrderDto.From).ToList()))
            .ToList();
    }

    [HttpPost("payments")]
    public async Task<ActionResult<PaymentDto>> Pay(PaymentRequest req)
    {
        var orders = await db.Orders.Include(o => o.Items)
            .Where(o => o.TableNumber == req.TableNumber && o.PaymentId == null && o.Status != OrderStatus.Cancelado)
            .ToListAsync();
        if (orders.Count == 0)
            return BadRequest(new { message = "Essa mesa não tem pedidos em aberto." });

        var settings = await db.Settings.FirstAsync();
        var subtotal = orders.Sum(o => o.Total);
        var fee = req.IncludeServiceFee ? Math.Round(subtotal * settings.ServiceFeePercent / 100m, 2) : 0m;

        var now = DateTime.UtcNow;
        var payment = new Payment
        {
            TableNumber = req.TableNumber,
            Amount = subtotal + fee,
            ServiceFee = fee,
            Method = req.Method,
            CashierId = User.UserId(),
            CreatedAt = now,
            Orders = orders,
        };
        // Ao fechar a conta, o que ainda não foi marcado como entregue passa a ser considerado entregue.
        foreach (var o in orders.Where(o => o.Status != OrderStatus.Entregue))
        {
            o.KitchenReceivedAt ??= now;
            o.PreparationStartedAt ??= now;
            o.ReadyAt ??= now;
            o.DeliveredAt = now;
            o.Status = OrderStatus.Entregue;
        }
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        foreach (var o in orders) await notifier.OrderUpdated(o.Id);

        var cashier = await db.Users.FindAsync(payment.CashierId);
        return new PaymentDto(payment.Id, payment.TableNumber, payment.Amount, payment.ServiceFee, payment.Method,
            cashier?.Name ?? "", payment.CreatedAt, orders.Count);
    }

    [HttpGet("payments")]
    public async Task<List<PaymentDto>> Payments([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var start = from?.ToUniversalTime() ?? DateTime.UtcNow.Date;
        var end = to?.ToUniversalTime() ?? DateTime.UtcNow.AddDays(1);
        return await db.Payments.AsNoTracking()
            .Where(p => p.CreatedAt >= start && p.CreatedAt < end)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentDto(p.Id, p.TableNumber, p.Amount, p.ServiceFee, p.Method,
                p.Cashier!.Name, p.CreatedAt, p.Orders.Count))
            .ToListAsync();
    }
}
