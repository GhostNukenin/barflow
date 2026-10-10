using BarFlow.Api.Auth;
using BarFlow.Api.Data;
using BarFlow.Api.Domain;
using BarFlow.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = Roles.Gestor)]
public class ReportsController(AppDbContext db, TimeZoneInfo barZone) : ControllerBase
{
    /// <summary>
    /// Indicadores do período. O principal é AvgToKitchenSeconds: tempo entre o garçom enviar o pedido
    /// e ele aparecer na tela da cozinha, para comparar com BaselineSeconds (processo no papel).
    /// </summary>
    [HttpGet("indicators")]
    public async Task<IndicatorsDto> Indicators([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var start = from?.ToUniversalTime() ?? DateTime.UtcNow.AddDays(-7);
        var end = to?.ToUniversalTime() ?? DateTime.UtcNow;

        var orders = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.Waiter)
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end)
            .ToListAsync();
        var settings = await db.Settings.AsNoTracking().FirstAsync();

        var valid = orders.Where(o => o.Status != OrderStatus.Cancelado).ToList();
        var revenue = valid.Sum(o => o.Total);

        DateTime Local(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), barZone);

        return new IndicatorsDto(
            start, end,
            TotalOrders: orders.Count,
            CanceledOrders: orders.Count - valid.Count,
            DeliveredOrders: valid.Count(o => o.Status == OrderStatus.Entregue),
            Revenue: revenue,
            AverageTicket: valid.Count == 0 ? 0 : Math.Round(revenue / valid.Count, 2),
            AvgToKitchenSeconds: Avg(valid, o => o.KitchenReceivedAt - o.CreatedAt),
            AvgComposeSeconds: Avg(valid, o => o.CreatedAt - o.StartedAt),
            AvgQueueSeconds: Avg(valid, o => o.PreparationStartedAt - o.KitchenReceivedAt),
            AvgPrepSeconds: Avg(valid, o => o.ReadyAt - o.PreparationStartedAt),
            AvgPickupSeconds: Avg(valid, o => o.DeliveredAt - o.ReadyAt),
            AvgTotalSeconds: Avg(valid, o => o.DeliveredAt - o.CreatedAt),
            BaselineSeconds: settings.BaselineSeconds,
            OrdersByHour: valid
                .GroupBy(o => Local(o.CreatedAt).Hour)
                .Select(g => new HourBucket(g.Key, g.Count()))
                .OrderBy(h => h.Hour).ToList(),
            TopProducts: valid.SelectMany(o => o.Items)
                .GroupBy(i => i.ProductName)
                .Select(g => new TopProduct(g.Key, g.Sum(i => i.Quantity), g.Sum(i => i.Quantity * i.UnitPrice)))
                .OrderByDescending(p => p.Quantity).Take(10).ToList(),
            Daily: valid
                .GroupBy(o => DateOnly.FromDateTime(Local(o.CreatedAt)))
                .Select(g => new DailyPoint(g.Key, g.Count(), Avg(g, o => o.KitchenReceivedAt - o.CreatedAt), g.Sum(o => o.Total)))
                .OrderBy(d => d.Date).ToList(),
            Waiters: valid
                .GroupBy(o => o.Waiter?.Name ?? "?")
                .Select(g => new WaiterStat(g.Key, g.Count(), g.Sum(o => o.Total)))
                .OrderByDescending(w => w.Orders).ToList());
    }

    private static double? Avg(IEnumerable<Order> orders, Func<Order, TimeSpan?> span)
    {
        var values = orders.Select(span)
            .Where(t => t is not null && t.Value >= TimeSpan.Zero)
            .Select(t => t!.Value.TotalSeconds)
            .ToList();
        return values.Count == 0 ? null : Math.Round(values.Average(), 1);
    }
}
