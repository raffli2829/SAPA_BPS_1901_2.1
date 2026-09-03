@echo off
title SAPA BPS - Ngrok Tunnel Controller
color 0B
cd /d "%~dp0"

echo ===================================================================
echo     SAPA BPS KABUPATEN BANGKA - NGROK TUNNEL CONTROLLER
echo ===================================================================
echo.

set "LAN_IP=127.0.0.1"
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Ethernet' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do (
    set "LAN_IP=%%i"
)

tasklist /FI "IMAGENAME eq ngrok.exe" 2>nul | find /i "ngrok.exe" >nul
if %errorlevel% equ 0 (
    echo [STATUS] Ngrok Tunnel SEDANG BERJALAN di latar belakang!
) else (
    echo [INFO] Menyalakan Ngrok Tunnel...
    if exist "C:\ngrok\ngrok_silent.vbs" (
        start "" wscript.exe "C:\ngrok\ngrok_silent.vbs"
        ping 127.0.0.1 -n 4 >nul
        echo [OK] Ngrok Tunnel dan Watchdog Auto-Recovery berhasil dinyalakan!
    ) else (
        if exist "C:\ngrok\ngrok.exe" (
            start "SAPA BPS - [Ngrok Tunnel]" /min "C:\ngrok\ngrok.exe" http 127.0.0.1:80 --url https://footless-aptitude-caloric.ngrok-free.dev --log C:\ngrok\logs\ngrok.log --log-format logfmt
            ping 127.0.0.1 -n 3 >nul
            echo [OK] Ngrok Tunnel berhasil dinyalakan!
        ) else (
            echo [ERROR] C:\ngrok\ngrok.exe tidak ditemukan.
        )
    )
)

echo.
echo ===================================================================
echo   INFORMASI AKSES JARINGAN BACKEND WHATSAPP:
echo   - Localhost Backend : http://localhost:80
echo   - Ethernet (LAN)    : http://%LAN_IP%:80
echo   - Ngrok Public URL  : https://footless-aptitude-caloric.ngrok-free.dev
echo   - Health Check      : https://footless-aptitude-caloric.ngrok-free.dev/health
echo   - Log File          : C:\ngrok\logs\ngrok.log
echo ===================================================================
echo.
pause
