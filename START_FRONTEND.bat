@echo off
title SAPA BPS - Frontend Web Admin
color 0B
cd /d "%~dp0frontend"

echo ===================================================================
echo   SAPA BPS KABUPATEN BANGKA - FRONTEND WEB ADMIN (Next.js)
echo ===================================================================
echo Menjalankan Frontend Web Admin pada http://localhost:3000 ...
echo.
npm run dev
pause
