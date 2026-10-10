using System.ComponentModel.DataAnnotations;
using BarFlow.Api.Domain;

namespace BarFlow.Api.Dtos;

// ---------- Auth / usuários ----------

public record LoginRequest([Required] string Username, [Required] string Password);

public record UserDto(int Id, string Name, string Username, UserRole Role, bool Active)
{
    public static UserDto From(User u) => new(u.Id, u.Name, u.Username, u.Role, u.Active);
}

public record LoginResponse(string Token, UserDto User);

public record UserUpsert(
    [Required, MaxLength(100)] string Name,
    [Required, MaxLength(50)] string Username,
    string? Password,
    UserRole Role,
    bool Active = true);

// ---------- Cardápio ----------

public record CategoryDto(int Id, string Name, int SortOrder, int ProductCount);

public record CategoryUpsert([Required, MaxLength(60)] string Name, int SortOrder);

public record ProductDto(int Id, string Name, string? Description, decimal Price, int CategoryId, string CategoryName, bool Active)
{
    public static ProductDto From(Product p) =>
        new(p.Id, p.Name, p.Description, p.Price, p.CategoryId, p.Category?.Name ?? "", p.Active);
}

public record ProductUpsert(
    [Required, MaxLength(100)] string Name,
    [MaxLength(300)] string? Description,
    [Range(0, 100000)] decimal Price,
    int CategoryId,
    bool Active = true);

// ---------- Pedidos ----------

public record OrderItemInput(int ProductId, [Range(1, 99)] int Quantity, [MaxLength(200)] string? Notes);

public record CreateOrderRequest(
    [Range(1, 999)] int TableNumber,
    [MaxLength(300)] string? Notes,
    DateTime? StartedAt,
    [Required, MinLength(1)] List<OrderItemInput> Items);

public record UpdateStatusRequest(OrderStatus Status);

public record OrderItemDto(int Id, int ProductId, string ProductName, string CategoryName, decimal UnitPrice, int Quantity, string? Notes);

public record OrderDto(
    int Id,
    int TableNumber,
    int WaiterId,
    string WaiterName,
    OrderStatus Status,
    string? Notes,
    DateTime? StartedAt,
    DateTime CreatedAt,
    DateTime? KitchenReceivedAt,
    DateTime? PreparationStartedAt,
    DateTime? ReadyAt,
    DateTime? DeliveredAt,
    DateTime? CanceledAt,
    int? PaymentId,
    decimal Total,
    List<OrderItemDto> Items)
{
    public static OrderDto From(Order o) => new(
        o.Id, o.TableNumber, o.WaiterId, o.Waiter?.Name ?? "", o.Status, o.Notes,
        o.StartedAt, o.CreatedAt, o.KitchenReceivedAt, o.PreparationStartedAt, o.ReadyAt, o.DeliveredAt, o.CanceledAt,
        o.PaymentId, o.Total,
        o.Items.OrderBy(i => i.Id)
            .Select(i => new OrderItemDto(i.Id, i.ProductId, i.ProductName, i.CategoryName, i.UnitPrice, i.Quantity, i.Notes))
            .ToList());
}

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);

// ---------- Caixa ----------

public record OpenTableDto(int TableNumber, int OrderCount, decimal Subtotal, DateTime OpenedAt, bool AllDelivered, List<OrderDto> Orders);

public record PaymentRequest([Range(1, 999)] int TableNumber, PaymentMethod Method, bool IncludeServiceFee = true);

public record PaymentDto(int Id, int TableNumber, decimal Amount, decimal ServiceFee, PaymentMethod Method, string CashierName, DateTime CreatedAt, int OrderCount);

// ---------- Configurações ----------

public record SettingsDto(string BarName, int TableCount, decimal ServiceFeePercent, int BaselineSeconds);

public record SettingsUpdate(
    [Required, MaxLength(100)] string BarName,
    [Range(1, 999)] int TableCount,
    [Range(0, 30)] decimal ServiceFeePercent,
    [Range(0, 36000)] int BaselineSeconds);

// ---------- Indicadores ----------

public record IndicatorsDto(
    DateTime From,
    DateTime To,
    int TotalOrders,
    int CanceledOrders,
    int DeliveredOrders,
    decimal Revenue,
    decimal AverageTicket,
    double? AvgToKitchenSeconds,
    double? AvgComposeSeconds,
    double? AvgQueueSeconds,
    double? AvgPrepSeconds,
    double? AvgPickupSeconds,
    double? AvgTotalSeconds,
    int BaselineSeconds,
    List<HourBucket> OrdersByHour,
    List<TopProduct> TopProducts,
    List<DailyPoint> Daily,
    List<WaiterStat> Waiters);

public record HourBucket(int Hour, int Orders);

public record TopProduct(string Name, int Quantity, decimal Revenue);

public record DailyPoint(DateOnly Date, int Orders, double? AvgToKitchenSeconds, decimal Revenue);

public record WaiterStat(string Name, int Orders, decimal Revenue);
