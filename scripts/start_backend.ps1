# ===================================================================
# SAPA BPS KABUPATEN BANGKA - BACKEND AUTO-START & WATCHDOG
# ===================================================================

$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$LogDir = Join-Path $BackendDir "logs"
$LogFile = Join-Path $LogDir "backend.log"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Cek apakah port 80 sudah aktif
$conns = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    exit 0
}

# Pastikan Node.js ada di PATH
$env:PATH = "C:\Program Files\nodejs;C:\Users\Acer\nodejs;C:\Users\Acer\AppData\Roaming\npm;" + $env:PATH

Set-Location $BackendDir

$Stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $LogFile -Value "`n======================================================="
Add-Content -Path $LogFile -Value "SAPA BPS BACKEND BACKGROUND SERVICE STARTED AT $Stamp"
Add-Content -Path $LogFile -Value "=======================================================`n"

while ($true) {
    & cmd.exe /c "npm run dev >> `"$LogFile`" 2>&1"
    Start-Sleep -Seconds 3
}
