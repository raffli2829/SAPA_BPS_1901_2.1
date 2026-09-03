' ===================================================================
' SAPA BPS KABUPATEN BANGKA - MASTER SILENT LAUNCHER
' Menjalankan Backend WhatsApp dan Ngrok di Latar Belakang (Hidden)
' ===================================================================
Option Explicit

Dim WshShell, fso, strRootDir, strScriptsDir

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strRootDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScriptsDir = strRootDir & "\scripts"

' 1. Jalankan Ngrok Tunnel Silent Launcher
If fso.FileExists("C:\ngrok\ngrok_silent.vbs") Then
    WshShell.Run "wscript.exe ""C:\ngrok\ngrok_silent.vbs""", 0, False
ElseIf fso.FileExists("C:\ngrok\ngrok.exe") Then
    WshShell.Run """C:\ngrok\ngrok.exe"" http 127.0.0.1:80 --url https://footless-aptitude-caloric.ngrok-free.dev --log C:\ngrok\logs\ngrok.log --log-format logfmt", 0, False
End If

' Pindah ke direktori scripts agar tidak terkendala path dengan spasi
WshShell.CurrentDirectory = strScriptsDir

' 2. Jalankan Backend WhatsApp & NLP Server secara Hidden
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File .\start_backend.ps1", 0, False

' 3. Tampilkan Notifikasi Desktop Windows Tray
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File .\notify.ps1", 0, False
