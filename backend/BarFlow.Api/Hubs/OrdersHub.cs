using BarFlow.Api.Auth;
using BarFlow.Api.Data;
using BarFlow.Api.Domain;
using BarFlow.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Hubs;

/// <summary>
/// Canal em tempo real. Servidor → clientes: "OrderCreated", "OrderUpdated", "MenuChanged", "SettingsChanged".
/// Cozinha → servidor: AcknowledgeOrders, que grava o momento em que o pedido apareceu na tela da cozinha.
/// </summary>
[Authorize]
public class OrdersHub(AppDbContext db, OrderNotifier notifier) : Hub
{
    public const string Path = "/hubs/orders";

    [Authorize(Roles = $"{Roles.Cozinha},{Roles.Gestor}")]
    public async Task<int> AcknowledgeOrders(int[] orderIds)
    {
        if (orderIds.Length == 0) return 0;

        var now = DateTime.UtcNow;
        var orders = await db.Orders
            .Where(o => orderIds.Contains(o.Id) && o.KitchenReceivedAt == null)
            .ToListAsync();
        foreach (var o in orders) o.KitchenReceivedAt = now;
        await db.SaveChangesAsync();

        foreach (var o in orders) await notifier.OrderUpdated(o.Id);
        return orders.Count;
    }
}

/// <summary>Envia eventos do hub a partir dos controllers.</summary>
public class OrderNotifier(IHubContext<OrdersHub> hub, AppDbContext db)
{
    public async Task OrderCreated(int orderId)
    {
        var dto = await Load(orderId);
        if (dto is not null) await hub.Clients.All.SendAsync("OrderCreated", dto);
    }

    public async Task OrderUpdated(int orderId)
    {
        var dto = await Load(orderId);
        if (dto is not null) await hub.Clients.All.SendAsync("OrderUpdated", dto);
    }

    public Task MenuChanged() => hub.Clients.All.SendAsync("MenuChanged");

    public Task SettingsChanged(SettingsDto settings) => hub.Clients.All.SendAsync("SettingsChanged", settings);

    private async Task<OrderDto?> Load(int orderId)
    {
        var order = await db.Orders.AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Waiter)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        return order is null ? null : OrderDto.From(order);
    }
}
