@echo off
title SAPA BPS - Unified Launcher (Frontend & Backend)
color 0A
cd /d "%~dp0"

echo ===================================================================
echo     SAPA BPS KABUPATEN BANGKA - SISTEM TERPADU FRONTEND & BACKEND
echo ===================================================================
echo.

:: 1. Jalankan Backend Express di folder backend
echo [1/3] Menyiapkan Backend Server & NLP Engine (Port 8000)...
start "SAPA BPS - [Backend & NLP Engine]" /D "%~dp0backend" cmd /k "npm run dev"

:: 2. Jalankan Frontend Next.js di folder frontend
echo [2/3] Menyiapkan Frontend Next.js Web Admin (Port 3000)...
start "SAPA BPS - [Frontend Next.js]" /D "%~dp0frontend" cmd /k "npm run dev"

:: 3. Deteksi Alamat IP Wi-Fi Komputer
echo [3/3] Mendeteksi Alamat IP Jaringan Wi-Fi...
set LOCAL_IP=192.168.1.41
for /f "tokens=*" %%i in ('powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress -First 1)"') do (
    if not "%%i"=="" set LOCAL_IP=%%i
)

echo Menunggu server siap dimuat (5 detik)...
timeout /t 5 /nobreak >nul

echo.
echo ===================================================================
echo   SISTEM BERHASIL DIJALANKAN & TERHUBUNG KE JARINGAN LOKAL!
echo.
echo   [1] Akses dari Komputer Ini (Laptop Utama):
echo       * Web Dashboard : http://localhost:3000
echo       * Backend API   : http://localhost:8000
echo.
echo   [2] Akses dari HP / Laptop Lain (Satu Wi-Fi):
echo       * Buka Browser di HP : http://%LOCAL_IP%:3000
echo.
echo   [3] Catatan Penting Akses dari HP:
echo       - Pastikan HP terhubung ke Wi-Fi yang sama: "BPS BANGKA ATAS 5G"
echo       - Jendela "Frontend Next.js" dan "Backend" harus tetap terbuka
echo ===================================================================
echo.
echo Membuka browser Web Admin Dashboard...
start http://localhost:3000

echo.
echo [INFO] Jangan tutup jendela terminal ini jika masih menggunakan aplikasi.
pause
