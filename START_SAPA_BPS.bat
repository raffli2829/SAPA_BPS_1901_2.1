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

echo [3/3] Menunggu server siap...
timeout /t 5 /nobreak >nul

echo.
echo ===================================================================
echo   SISTEM BERHASIL DIJALANKAN!
echo   - Frontend Web Admin : http://localhost:3000
echo   - Backend REST API   : http://localhost:8000/api/datasets
echo   - Bot WhatsApp & NLP : Terhubung & Aktif
echo ===================================================================
echo Membuka browser Web Admin Dashboard...
start http://localhost:3000

echo.
echo Jangan tutup jendela terminal ini jika masih menggunakan aplikasi.
pause
