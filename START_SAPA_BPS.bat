@echo off
title SAPA BPS - Unified Launcher (Frontend & Backend)
color 0A
cd /d "%~dp0"

echo ===================================================================
echo     SAPA BPS KABUPATEN BANGKA - SISTEM TERPADU FRONTEND & BACKEND
echo ===================================================================
echo.
echo [1/3] Menyiapkan Backend Server & NLP Engine (Port 8000)...
start "SAPA BPS - [Backend & NLP Engine]" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo [2/3] Menyiapkan Frontend Next.js Web Admin (Port 3000)...
start "SAPA BPS - [Frontend Next.js]" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Mendeteksi Alamat IP Jaringan Lokal...
set LOCAL_IP=127.0.0.1
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0.*0.0.0.0"') do (
    set LOCAL_IP=%%a
)
:: Fallback to powershell if route print failed
for /f "tokens=*" %%i in ('powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*', 'Ethernet*' -ErrorAction SilentlyContinue | Where-Object IPAddress -notmatch '^(169\.254|127\.)' | Select-Object -ExpandProperty IPAddress -First 1)"') do (
    if not "%%i"=="" set LOCAL_IP=%%i
)

timeout /t 5 /nobreak >nul

echo.
echo ===================================================================
echo   SISTEM BERHASIL DIJALANKAN & TERHUBUNG KE JARINGAN LOKAL!
echo.
echo   [1] Akses dari Komputer Ini (Laptop/PC Utama):
echo       * Web Admin Dashboard : http://localhost:3000
echo       * Backend REST API    : http://localhost:8000
echo.
echo   [2] Akses dari HP / Laptop Lain (Satu Jaringan Wi-Fi):
echo       * Buka Browser di HP : http://%LOCAL_IP%:3000
echo       (Pastikan HP terhubung ke jaringan Wi-Fi yang sama)
echo.
echo   [3] Bot WhatsApp & NLP Engine:
echo       * Status : Siap Membalas Chat Pribadi & Menu Statistik
echo ===================================================================
echo.
echo Membuka browser Web Admin Dashboard...
start http://localhost:3000

echo.
echo [INFO] Jangan tutup jendela terminal ini jika masih menggunakan aplikasi.
pause
