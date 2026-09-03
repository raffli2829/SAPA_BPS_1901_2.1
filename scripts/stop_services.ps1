# ===================================================================
# SAPA BPS KABUPATEN BANGKA - STOP SERVICES SCRIPT
# Menghentikan seluruh proses Backend WhatsApp, Node, dan Ngrok
# ===================================================================

$RootDir = Split-Path -Parent $PSScriptRoot

Write-Host "Menghentikan semua proses SAPA BPS..." -ForegroundColor Cyan

# 1. Hentikan proses yang mendengarkan Port 80
$conns = Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue
if ($conns) {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        try {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            Write-Host "  [OK] Proses port 80 (PID: $p) dihentikan." -ForegroundColor Green
        } catch {}
    }
}

# 2. Hentikan semua node.exe yang menjalankan tsx / backend SAPA BPS
try {
    $nodeProcs = Get-CimInstance Win32_Process | Where-Object { 
        $_.Name -eq 'node.exe' -and (
            $_.CommandLine -like "*SAPA_BPS*" -or 
            $_.CommandLine -like "*tsx*src/index.ts*" -or
            $_.CommandLine -like "*npm*run*dev*"
        )
    }
    foreach ($proc in $nodeProcs) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Proses Node Backend (PID: $($proc.ProcessId)) dihentikan." -ForegroundColor Green
    }
} catch {}

# 3. Hentikan Ngrok Tunnel
$ngrokProcs = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrokProcs) {
    foreach ($ng in $ngrokProcs) {
        Stop-Process -Id $ng.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Proses Ngrok (PID: $($ng.Id)) dihentikan." -ForegroundColor Green
    }
} else {
    Write-Host "  [INFO] Ngrok tidak sedang berjalan." -ForegroundColor Gray
}

# 4. Hentikan script watchdog / background
try {
    $scripts = Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -like "*start_hidden.ps1*" -or $_.CommandLine -like "*start.ps1*"
    }
    foreach ($s in $scripts) {
        Stop-Process -Id $s.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {}

Write-Host "`n[SELESAI] Seluruh layanan Backend dan Ngrok telah dihentikan." -ForegroundColor Yellow
