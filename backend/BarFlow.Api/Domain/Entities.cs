namespace BarFlow.Api.Domain;

public enum UserRole
{
    Garcom,
    Cozinha,
    Caixa,
    Gestor
}

public enum OrderStatus
{
    Pendente,
    EmPreparo,
    Pronto,
    Entregue,
    Cancelado
}

public enum PaymentMethod
{
    Dinheiro,
    Pix,
    Debito,
    Credito
}

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }
    public List<Product> Products { get; set; } = [];
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public bool Active { get; set; } = true;
}

public class Order
{
    public int Id { get; set; }
    public int TableNumber { get; set; }
    public int WaiterId { get; set; }
    public User? Waiter { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pendente;
    public string? Notes { get; set; }

    /// <summary>Quando o garçom começou a montar o pedido no aparelho (informado pelo cliente).</summary>
    public DateTime? StartedAt { get; set; }
    /// <summary>Quando o servidor registrou o pedido.</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Quando a primeira tela da cozinha confirmou o recebimento (via SignalR).</summary>
    public DateTime? KitchenReceivedAt { get; set; }
    public DateTime? PreparationStartedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? CanceledAt { get; set; }

    public int? PaymentId { get; set; }
    public Payment? Payment { get; set; }

    public List<OrderItem> Items { get; set; } = [];

    public decimal Total => Items.Sum(i => i.UnitPrice * i.Quantity);
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    /// <summary>Nome e preço copiados no momento do pedido, para o histórico não mudar se o cardápio mudar.</summary>
    public string ProductName { get; set; } = "";
    public string CategoryName { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int TableNumber { get; set; }
    public decimal Amount { get; set; }
    public decimal ServiceFee { get; set; }
    public PaymentMethod Method { get; set; }
    public int CashierId { get; set; }
    public User? Cashier { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Order> Orders { get; set; } = [];
}

/// <summary>Configurações gerais do bar (linha única, Id = 1).</summary>
public class BarSettings
{
    public int Id { get; set; } = 1;
    public string BarName { get; set; } = "Bahia Resenha & Bar";
    public int TableCount { get; set; } = 20;
    /// <summary>Taxa de serviço sugerida no fechamento da conta (ex.: 10 = 10%).</summary>
    public decimal ServiceFeePercent { get; set; } = 10;
    /// <summary>Tempo médio (em segundos) do processo antigo, no papel, para comparar com o sistema.</summary>
    public int BaselineSeconds { get; set; } = 180;
}
