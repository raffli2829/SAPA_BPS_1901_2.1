# ===================================================================
# SAPA BPS KABUPATEN BANGKA - DESKTOP NOTIFICATION TOAST
# ===================================================================

Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

$bal = New-Object System.Windows.Forms.NotifyIcon
$bal.Icon = [System.Drawing.SystemIcons]::Information
$bal.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$bal.BalloonTipTitle = "SAPA BPS Aktif di Latar Belakang"
$bal.BalloonTipText = "Backend WhatsApp (Port 80) dan Ngrok Tunnel telah aktif secara tersembunyi (tanpa jendela CMD).`nKlik kanan atau buka STATUS_SAPA_BPS.bat untuk memantau."
$bal.Visible = $true
$bal.ShowBalloonTip(3500)
Start-Sleep -Seconds 4
$bal.Dispose()
