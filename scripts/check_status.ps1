# ===================================================================
# SAPA BPS KABUPATEN BANGKA - STATUS CHECK SCRIPT
# ===================================================================

$RootDir = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $RootDir "backend\logs\backend.log"

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "    SAPA BPS KABUPATEN BANGKA - STATUS MONITOR LAYANAN" -ForegroundColor Cyan
Write-Host "===================================================================`n" -ForegroundColor Cyan

# 1. Backend WhatsApp Server (Port 80)
Write-Host "--- [1/2] STATUS BACKEND WHATSAPP (PORT 80) ---" -ForegroundColor Yellow
$conns = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    $pidNum = ($conns | Select-Object -First 1).OwningProcess
    Write-Host "  [AKTIF] Port 80 mendengarkan (PID: $pidNum)" -ForegroundColor Green
    try {
        $res = Invoke-RestMethod -Uri "http://localhost/health" -TimeoutSec 3
        Write-Host "  - Service     : $($res.service)"
        $stateColor = if ($res.botState -eq "connected") { "Green" } else { "Yellow" }
        Write-Host "  - Status Bot  : $($res.botState)" -ForegroundColor $stateColor
        Write-Host "  - Nomor WA    : $(if ($res.phoneNumber) { $res.phoneNumber } else { 'Belum terhubung / scan QR' })"
        Write-Host "  - Server Up   : $([math]::Round($res.uptime)) detik"
    } catch {
        Write-Host "  [WARNING] Port 80 terbuka, namun /health belum merespon." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [NONAKTIF] Backend WhatsApp Server belum berjalan di port 80." -ForegroundColor Red
}

Write-Host "`n--- [2/2] STATUS NGROK TUNNEL ---" -ForegroundColor Yellow
$ng = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ng) {
    Write-Host "  [AKTIF] Tunnel Ngrok berjalan di latar belakang (PID: $($ng.Id))" -ForegroundColor Green
    Write-Host "  - Public URL  : https://footless-aptitude-caloric.ngrok-free.dev"
    try {
        $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
        Write-Host "  - Forwarding  : $($tunnels.tunnels[0].config.addr)"
    } catch {}
} else {
    Write-Host "  [NONAKTIF] Ngrok Tunnel tidak sedang berjalan." -ForegroundColor Red
}

# 3. Cuplikan Log Terakhir
if (Test-Path $LogFile) {
    Write-Host "`n--- [LOG TERAKHIR BACKEND] ---" -ForegroundColor Gray
    $tailLines = Get-Content -Path $LogFile -Tail 6
    foreach ($line in $tailLines) {
        Write-Host "  $line" -ForegroundColor DarkGray
    }
}
Write-Host ""
