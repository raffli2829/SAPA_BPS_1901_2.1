@echo off
title SAPA BPS - Hentikan Layanan Backend dan Ngrok
color 0C
cd /d "%~dp0"

echo ===================================================================
echo     SAPA BPS KABUPATEN BANGKA - HENTIKAN SEMUA LAYANAN
echo ===================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop_services.ps1"

echo.
pause
