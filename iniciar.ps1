# Sobe o BarFlow completo: banco (Docker) + frontend compilado + API.
# Uso: clique com o botão direito > "Executar com o PowerShell", ou rode .\iniciar.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "`n== BarFlow · Bahia Resenha & Bar ==`n" -ForegroundColor Cyan

# ---------- Segredos locais (não vão para o Git) ----------
function New-Secret([int]$bytes) {
    $b = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    ([Convert]::ToBase64String($b) -replace '[+/=]', '')
}
$envFile = "$root\.env"
$localSettings = "$root\backend\BarFlow.Api\appsettings.Local.json"

if (-not (Test-Path $envFile)) {
    Set-Content -Path $envFile -Encoding ascii -Value "POSTGRES_PASSWORD=$(New-Secret 18)"
    Write-Host "Criado .env com senha aleatória do banco." -ForegroundColor DarkGray
}
$dbPassword = ((Get-Content $envFile | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', '').Trim()

if (-not (Test-Path $localSettings)) {
    $seedPassword = New-Secret 9
    @{
        ConnectionStrings = @{ Default = "Host=localhost;Port=5433;Database=barflow;Username=barflow;Password=$dbPassword" }
        Jwt               = @{ Key = (New-Secret 48) }
        Seed              = @{ DefaultPassword = $seedPassword }
    } | ConvertTo-Json -Depth 3 | Set-Content -Path $localSettings -Encoding utf8
    Write-Host "Criado appsettings.Local.json com chave e senhas aleatórias." -ForegroundColor DarkGray
    Write-Host "  Senha inicial dos usuários (gestor, garcom, cozinha, caixa): $seedPassword" -ForegroundColor Magenta
    Write-Host "  Anote! Ela também fica salva em backend\BarFlow.Api\appsettings.Local.json`n" -ForegroundColor Magenta
}

Write-Host "1/3 Subindo o banco de dados..." -ForegroundColor Yellow
docker compose -f "$root\docker-compose.yml" up -d --wait

Write-Host "2/3 Compilando o frontend..." -ForegroundColor Yellow
Push-Location "$root\frontend"
if (-not (Test-Path node_modules)) { npm install }
npx ng build
Pop-Location

# IPs das placas ligadas ao roteador (com gateway), ignorando WSL, VPN e redes virtuais.
$ips = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    Sort-Object { if ($_.InterfaceAlias -match 'Wi-?Fi') { 0 } else { 1 } } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Where-Object { $_ -match '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)' }

Write-Host "3/3 Iniciando a API..." -ForegroundColor Yellow
Write-Host "`n  Neste computador:  http://localhost:5204" -ForegroundColor Green
foreach ($ip in $ips) { Write-Host "  Celulares na rede: http://${ip}:5204" -ForegroundColor Green }
Write-Host ""
Write-Host "  (Ctrl+C para parar)`n"

Push-Location "$root\backend\BarFlow.Api"
dotnet run --launch-profile lan
Pop-Location
