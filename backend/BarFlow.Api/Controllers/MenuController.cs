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
[Route("api/categories")]
[Authorize]
public class CategoriesController(AppDbContext db, OrderNotifier notifier) : ControllerBase
{
    [HttpGet]
    public Task<List<CategoryDto>> List() =>
        db.Categories
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.SortOrder, c.Products.Count))
            .ToListAsync();

    [HttpPost]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<ActionResult<CategoryDto>> Create(CategoryUpsert req)
    {
        var name = req.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Name == name))
            return Conflict(new { message = "Já existe uma categoria com esse nome." });

        var cat = new Category { Name = name, SortOrder = req.SortOrder };
        db.Categories.Add(cat);
        await db.SaveChangesAsync();
        await notifier.MenuChanged();
        return new CategoryDto(cat.Id, cat.Name, cat.SortOrder, 0);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<ActionResult<CategoryDto>> Update(int id, CategoryUpsert req)
    {
        var cat = await db.Categories.FindAsync(id);
        if (cat is null) return NotFound();

        var name = req.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Name == name && c.Id != id))
            return Conflict(new { message = "Já existe uma categoria com esse nome." });

        cat.Name = name;
        cat.SortOrder = req.SortOrder;
        await db.SaveChangesAsync();
        await notifier.MenuChanged();
        return new CategoryDto(cat.Id, cat.Name, cat.SortOrder, await db.Products.CountAsync(p => p.CategoryId == id));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<IActionResult> Delete(int id)
    {
        var cat = await db.Categories.FindAsync(id);
        if (cat is null) return NotFound();
        if (await db.Products.AnyAsync(p => p.CategoryId == id))
            return Conflict(new { message = "A categoria tem produtos. Mova ou exclua os produtos antes." });

        db.Categories.Remove(cat);
        await db.SaveChangesAsync();
        await notifier.MenuChanged();
        return NoContent();
    }
}

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController(AppDbContext db, OrderNotifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<List<ProductDto>> List([FromQuery] bool includeInactive = false)
    {
        var q = db.Products.Include(p => p.Category).AsQueryable();
        if (!includeInactive) q = q.Where(p => p.Active);
        var list = await q.OrderBy(p => p.Category!.SortOrder).ThenBy(p => p.Name).ToListAsync();
        return list.Select(ProductDto.From).ToList();
    }

    [HttpPost]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<ActionResult<ProductDto>> Create(ProductUpsert req)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId))
            return BadRequest(new { message = "Categoria inválida." });

        var p = new Product
        {
            Name = req.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            Price = req.Price,
            CategoryId = req.CategoryId,
            Active = req.Active,
        };
        db.Products.Add(p);
        await db.SaveChangesAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        await notifier.MenuChanged();
        return ProductDto.From(p);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<ActionResult<ProductDto>> Update(int id, ProductUpsert req)
    {
        var p = await db.Products.FindAsync(id);
        if (p is null) return NotFound();
        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId))
            return BadRequest(new { message = "Categoria inválida." });

        p.Name = req.Name.Trim();
        p.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        p.Price = req.Price;
        p.CategoryId = req.CategoryId;
        p.Active = req.Active;
        await db.SaveChangesAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        await notifier.MenuChanged();
        return ProductDto.From(p);
    }

    /// <summary>Exclui o produto se nunca foi pedido; caso contrário apenas desativa, para preservar o histórico.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await db.Products.FindAsync(id);
        if (p is null) return NotFound();

        if (await db.OrderItems.AnyAsync(i => i.ProductId == id))
        {
            p.Active = false;
            await db.SaveChangesAsync();
            await notifier.MenuChanged();
            return Ok(new { deactivated = true, message = "Produto já tem pedidos no histórico; foi desativado." });
        }

        db.Products.Remove(p);
        await db.SaveChangesAsync();
        await notifier.MenuChanged();
        return NoContent();
    }
}
