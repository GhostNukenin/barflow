using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BarFlow.Api.Domain;
using Microsoft.IdentityModel.Tokens;

namespace BarFlow.Api.Auth;

public class JwtOptions
{
    public string Issuer { get; set; } = "BarFlow";
    public string Audience { get; set; } = "BarFlow";
    public string Key { get; set; } = "";
    public int ExpirationHours { get; set; } = 14;
}

public class TokenService(JwtOptions options)
{
    public string Create(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim("username", user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
        var token = new JwtSecurityToken(
            options.Issuer,
            options.Audience,
            claims,
            expires: DateTime.UtcNow.AddHours(options.ExpirationHours),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class Roles
{
    public const string Garcom = nameof(UserRole.Garcom);
    public const string Cozinha = nameof(UserRole.Cozinha);
    public const string Caixa = nameof(UserRole.Caixa);
    public const string Gestor = nameof(UserRole.Gestor);
}

public static class ClaimsPrincipalExtensions
{
    public static int UserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static UserRole Role(this ClaimsPrincipal user) =>
        Enum.Parse<UserRole>(user.FindFirstValue(ClaimTypes.Role)!);
}
