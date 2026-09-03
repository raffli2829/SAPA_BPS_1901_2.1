@echo off
title SAPA BPS - Status Monitor Layanan
color 0B
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check_status.ps1"

echo ===================================================================
echo  Pilihan Cepat:
echo   [1] Buka Dashboard Web Admin (http://localhost/admin)
echo   [2] Lihat Live Log Bot (LIHAT_LOG_SAPA_BPS.bat)
echo   [3] Tutup Jendela Ini
echo ===================================================================
choice /c 123 /n /m "Pilih menu (1, 2, atau 3): "

if errorlevel 3 goto :END
if errorlevel 2 goto :OPEN_LOG
if errorlevel 1 goto :OPEN_ADMIN

:OPEN_ADMIN
start "" "http://localhost/admin"
goto :END

:OPEN_LOG
start "" "%~dp0LIHAT_LOG_SAPA_BPS.bat"
goto :END

:END
