@echo off
title SAPA BPS - Live Log Monitor
color 0E
cd /d "%~dp0"

echo ===================================================================
echo     SAPA BPS KABUPATEN BANGKA - LIVE LOG MONITOR (REAL-TIME)
echo ===================================================================
echo  Menampilkan log aktivitas Backend WhatsApp & REST API.
echo  Tekan Ctrl + C untuk keluar dari monitor log kapan saja.
echo ===================================================================
echo.

if not exist "%~dp0backend\logs\backend.log" (
    echo [INFO] File log belum ditemukan. Menyiapkan folder log...
    if not exist "%~dp0backend\logs" mkdir "%~dp0backend\logs"
    echo Belum ada aktivitas yang dicatat. > "%~dp0backend\logs\backend.log"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path '%~dp0backend\logs\backend.log' -Wait -Tail 60"

pause
