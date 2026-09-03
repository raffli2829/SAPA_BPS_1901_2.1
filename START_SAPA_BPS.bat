@echo off
title SAPA BPS - Backend WhatsApp Server dan Ngrok Tunnel
color 0A
cd /d "%~dp0"

:: Pastikan Node.js terdaftar di PATH
if exist "C:\Users\Acer\nodejs" (
    set "PATH=C:\Users\Acer\nodejs;%SystemRoot%\System32\WindowsPowerShell\v1.0;%SystemRoot%\system32;%SystemRoot%;%PATH%"
)

echo ===================================================================
echo   SAPA BPS KABUPATEN BANGKA - BACKEND WHATSAPP DAN NGROK SERVER
echo ===================================================================
echo.

:: 1. Deteksi IP Ethernet LAN
set "LAN_IP=127.0.0.1"
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Ethernet' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do (
    set "LAN_IP=%%i"
)

:: 2. Cek dan Auto-Start Ngrok Tunnel (Port 80)
echo [1/2] Memeriksa status Ngrok Tunnel Port 80...
tasklist /FI "IMAGENAME eq ngrok.exe" 2>nul | find /i "ngrok.exe" >nul
if %errorlevel% equ 0 (
    echo [OK] Ngrok Tunnel sudah aktif di latar belakang.
) else (
    echo [INFO] Menyalakan Ngrok Tunnel port 80 dengan Watchdog Auto-Recovery...
    if exist "C:\ngrok\ngrok_silent.vbs" (
        start "" wscript.exe "C:\ngrok\ngrok_silent.vbs"
        echo [OK] Ngrok Tunnel dan Watchdog berhasil dinyalakan.
    ) else (
        if exist "C:\ngrok\ngrok.exe" (
            start "SAPA BPS - [Ngrok Tunnel]" /min "C:\ngrok\ngrok.exe" http 127.0.0.1:80 --url https://footless-aptitude-caloric.ngrok-free.dev --log C:\ngrok\logs\ngrok.log --log-format logfmt
            echo [OK] Ngrok Tunnel berhasil dijalankan di latar belakang.
        ) else (
            echo [WARNING] C:\ngrok\ngrok.exe tidak ditemukan.
        )
    )
)
echo.

echo [2/2] Menyiapkan Backend WhatsApp Server dan NLP Engine pada Port 80...
start "SAPA BPS - [Backend WhatsApp dan NLP]" cmd /k "cd /d "%~dp0backend" && set "PATH=C:\Users\Acer\nodejs;%%PATH%%" && npm run dev"

echo Menunggu Backend siap...
ping 127.0.0.1 -n 4 >nul

echo.
echo ===================================================================
echo   BACKEND WHATSAPP DAN REST API TELAH AKTIF!
echo ===================================================================
echo   - Localhost Windows         : http://localhost:80
echo   - Jaringan Ethernet (LAN)   : http://%LAN_IP%:80
echo   - Public HTTPS (Ngrok Dev)  : https://footless-aptitude-caloric.ngrok-free.dev
echo   - Health Check Endpoint     : https://footless-aptitude-caloric.ngrok-free.dev/health
echo ===================================================================
echo.
echo   INFORMASI UNTUK TEMAN (FRONTEND DEVELOPER):
echo   Kirimkan konfigurasi environment berikut ke teman Anda:
echo   ---------------------------------------------------------------
echo   NEXT_PUBLIC_BACKEND_URL=https://footless-aptitude-caloric.ngrok-free.dev
echo   NEXT_PUBLIC_API_KEY=sapa_bps_secure_token_2026
echo   ---------------------------------------------------------------
echo.
echo Komputer ini bertindak sebagai SERVER BACKEND.
echo Jangan tutup jendela terminal ini jika masih menggunakan bot WhatsApp.
echo.
pause
