using BarFlow.Api.Auth;
using BarFlow.Api.Data;
using BarFlow.Api.Dtos;
using BarFlow.Api.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarFlow.Api.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController(AppDbContext db, OrderNotifier notifier) : ControllerBase
{
    /// <summary>Público: a tela de login mostra o nome do bar.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<SettingsDto> Get()
    {
        var s = await db.Settings.AsNoTracking().FirstAsync();
        return new SettingsDto(s.BarName, s.TableCount, s.ServiceFeePercent, s.BaselineSeconds);
    }

    [HttpPut]
    [Authorize(Roles = Roles.Gestor)]
    public async Task<SettingsDto> Update(SettingsUpdate req)
    {
        var s = await db.Settings.FirstAsync();
        s.BarName = req.BarName.Trim();
        s.TableCount = req.TableCount;
        s.ServiceFeePercent = req.ServiceFeePercent;
        s.BaselineSeconds = req.BaselineSeconds;
        await db.SaveChangesAsync();

        var dto = new SettingsDto(s.BarName, s.TableCount, s.ServiceFeePercent, s.BaselineSeconds);
        await notifier.SettingsChanged(dto);
        return dto;
    }
}
