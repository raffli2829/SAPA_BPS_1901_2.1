@echo off
title SAPA BPS - Stop Ngrok Tunnel
color 0C
cd /d "%~dp0"

echo ===================================================================
echo     SAPA BPS KABUPATEN BANGKA - HENTIKAN NGROK TUNNEL
echo ===================================================================
echo.

taskkill /F /IM ngrok.exe >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Proses ngrok berhasil dihentikan.
) else (
    echo [INFO] Tidak ada proses ngrok yang sedang berjalan.
)

echo.
pause
