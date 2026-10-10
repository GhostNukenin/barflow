using BarFlow.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Data;

/// <summary>Cria configuração, usuários iniciais e o cardápio de exemplo quando o banco está vazio.</summary>
public static class Seed
{
    public static async Task RunAsync(AppDbContext db, IConfiguration config)
    {
        if (!await db.Settings.AnyAsync())
        {
            db.Settings.Add(new BarSettings());
        }

        if (!await db.Users.AnyAsync())
        {
            var password = config["Seed:DefaultPassword"];
            if (string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException(
                    "Configure Seed:DefaultPassword em appsettings.Local.json (senha inicial dos usuários) ou rode iniciar.ps1.");
            var hash = BCrypt.Net.BCrypt.HashPassword(password);
            db.Users.AddRange(
                new User { Name = "Gestor", Username = "gestor", PasswordHash = hash, Role = UserRole.Gestor },
                new User { Name = "Garçom", Username = "garcom", PasswordHash = hash, Role = UserRole.Garcom },
                new User { Name = "Cozinha", Username = "cozinha", PasswordHash = hash, Role = UserRole.Cozinha },
                new User { Name = "Caixa", Username = "caixa", PasswordHash = hash, Role = UserRole.Caixa });
        }

        if (!await db.Categories.AnyAsync())
        {
            var petiscos = new Category { Name = "Petiscos", SortOrder = 1 };
            var pratos = new Category { Name = "Pratos", SortOrder = 2 };
            var cervejas = new Category { Name = "Cervejas", SortOrder = 3 };
            var drinks = new Category { Name = "Drinks", SortOrder = 4 };
            var semAlcool = new Category { Name = "Sem álcool", SortOrder = 5 };
            var sobremesas = new Category { Name = "Sobremesas", SortOrder = 6 };

            db.Categories.AddRange(petiscos, pratos, cervejas, drinks, semAlcool, sobremesas);
            db.Products.AddRange(
                P("Acarajé completo", 18.00m, petiscos, "Com vatapá, caruru, camarão seco e vinagrete"),
                P("Abará", 16.00m, petiscos, "Cozido na folha de bananeira"),
                P("Casquinha de siri", 24.00m, petiscos),
                P("Isca de peixe", 42.00m, petiscos, "Porção com molho tártaro"),
                P("Bolinho de estudante (6 un.)", 15.00m, petiscos),
                P("Aipim frito", 22.00m, petiscos),
                P("Moqueca de peixe (2 pessoas)", 98.00m, pratos, "Acompanha arroz, pirão e farofa de dendê"),
                P("Moqueca de camarão (2 pessoas)", 118.00m, pratos, "Acompanha arroz, pirão e farofa de dendê"),
                P("Bobó de camarão", 79.00m, pratos),
                P("Escondidinho de carne de sol", 54.00m, pratos),
                P("Cerveja 600 ml", 14.00m, cervejas),
                P("Cerveja long neck", 10.00m, cervejas),
                P("Chopp 300 ml", 11.00m, cervejas),
                P("Caipirinha de limão", 20.00m, drinks),
                P("Caipiroska de cajá", 24.00m, drinks),
                P("Batida de coco", 18.00m, drinks),
                P("Água de coco", 9.00m, semAlcool),
                P("Suco de cajá", 10.00m, semAlcool),
                P("Refrigerante lata", 7.00m, semAlcool),
                P("Água mineral", 5.00m, semAlcool),
                P("Cocada de forno", 12.00m, sobremesas),
                P("Mousse de maracujá", 14.00m, sobremesas));
        }

        await db.SaveChangesAsync();
    }

    private static Product P(string name, decimal price, Category category, string? description = null) =>
        new() { Name = name, Price = price, Category = category, Description = description };
}
