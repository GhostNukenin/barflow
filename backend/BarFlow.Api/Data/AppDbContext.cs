using BarFlow.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<BarSettings> Settings => Set<BarSettings>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Username).HasMaxLength(50);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Category>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(60);
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<Product>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Description).HasMaxLength(300);
            e.Property(x => x.Price).HasPrecision(10, 2);
            e.HasOne(x => x.Category).WithMany(c => c.Products).HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Order>(e =>
        {
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Notes).HasMaxLength(300);
            e.Ignore(x => x.Total);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => x.TableNumber);
            e.HasOne(x => x.Waiter).WithMany().HasForeignKey(x => x.WaiterId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Payment).WithMany(p => p.Orders).HasForeignKey(x => x.PaymentId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<OrderItem>(e =>
        {
            e.Property(x => x.ProductName).HasMaxLength(100);
            e.Property(x => x.CategoryName).HasMaxLength(60);
            e.Property(x => x.Notes).HasMaxLength(200);
            e.Property(x => x.UnitPrice).HasPrecision(10, 2);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Payment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(10, 2);
            e.Property(x => x.ServiceFee).HasPrecision(10, 2);
            e.Property(x => x.Method).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.Cashier).WithMany().HasForeignKey(x => x.CashierId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<BarSettings>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.BarName).HasMaxLength(100);
            e.Property(x => x.ServiceFeePercent).HasPrecision(5, 2);
        });
    }
}
