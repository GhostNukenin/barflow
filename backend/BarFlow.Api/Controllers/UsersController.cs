using BarFlow.Api.Auth;
using BarFlow.Api.Data;
using BarFlow.Api.Domain;
using BarFlow.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = Roles.Gestor)]
public class UsersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<UserDto>> List() =>
        (await db.Users.OrderBy(u => u.Role).ThenBy(u => u.Name).ToListAsync()).Select(UserDto.From).ToList();

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(UserUpsert req)
    {
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 4)
            return BadRequest(new { message = "Informe uma senha com pelo menos 4 caracteres." });

        var username = req.Username.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Username == username))
            return Conflict(new { message = "Já existe um usuário com esse login." });

        var user = new User
        {
            Name = req.Name.Trim(),
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = req.Role,
            Active = req.Active,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return UserDto.From(user);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserDto>> Update(int id, UserUpsert req)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        var username = req.Username.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Username == username && u.Id != id))
            return Conflict(new { message = "Já existe um usuário com esse login." });

        var isSelf = id == User.UserId();
        if (isSelf && (req.Role != UserRole.Gestor || !req.Active))
            return BadRequest(new { message = "Você não pode remover o próprio acesso de gestor." });

        user.Name = req.Name.Trim();
        user.Username = username;
        user.Role = req.Role;
        user.Active = req.Active;
        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            if (req.Password.Length < 4)
                return BadRequest(new { message = "A senha precisa ter pelo menos 4 caracteres." });
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        }
        await db.SaveChangesAsync();
        return UserDto.From(user);
    }
}
