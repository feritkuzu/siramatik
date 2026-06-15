param([switch]$Setup, [switch]$Kapat)

$SERVER_IP = "192.168.1.5"
$PORT = 3000
$SERVER_URL = "http://${SERVER_IP}:${PORT}"
$DISPLAY_URL = "${SERVER_URL}/display"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Setup) {
    # Install to Windows Startup
    $startupDir = [Environment]::GetFolderPath("Startup")
    $lnkPath = Join-Path $startupDir "Siramatik.lnk"
    
    $wsh = New-Object -ComObject WScript.Shell
    $lnk = $wsh.CreateShortcut($lnkPath)
    $lnk.TargetPath = "powershell.exe"
    $lnk.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$SCRIPT_DIR\baslat.ps1`""
    $lnk.WorkingDirectory = $SCRIPT_DIR
    $lnk.Description = "Siramatik Sistemi - Otomatik Başlat"
    $lnk.Save()
    
    Write-Host "[OK] Başlangıca eklendi. Bir dahaki açılışta otomatik başlar." -ForegroundColor Green
    Write-Host "     Kısayol: $lnkPath" -ForegroundColor Gray
    
    # Also create desktop shortcut for manual start
    $desktop = [Environment]::GetFolderPath("Desktop")
    $desktopLnk = Join-Path $desktop "Siramatik - Elle Başlat.lnk"
    $lnk2 = $wsh.CreateShortcut($desktopLnk)
    $lnk2.TargetPath = "powershell.exe"
    $lnk2.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$SCRIPT_DIR\baslat.ps1`""
    $lnk2.WorkingDirectory = $SCRIPT_DIR
    $lnk2.Description = "Siramatik Sistemi - Elle Başlat"
    $lnk2.Save()
    
    Write-Host "[OK] Masaüstü kısayolu oluşturuldu." -ForegroundColor Green
    exit 0
}

if ($Kapat) {
    Write-Host "Sistem kapatılıyor..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "msedge" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" -or $_.MainWindowTitle -like "*display*" } | Stop-Process -ErrorAction SilentlyContinue
    Write-Host "[OK] Sistem durduruldu." -ForegroundColor Green
    exit 0
}

# Normal start mode
$host.ui.RawUI.WindowTitle = "SIRAMATİK"
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "       S I R A M A T I K               " -ForegroundColor Cyan
Write-Host "       ${SERVER_URL}                    " -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Magenta

# Kill old node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Start server
$serverJob = Start-Job -ScriptBlock {
    Set-Location -LiteralPath "$using:SCRIPT_DIR"
    if (Test-Path "dist/index.js") {
        $env:NODE_ENV = "production"
        node dist/index.js
    } else {
        npm run dev
    }
}

Write-Host "[1/3] Sunucu başlatılıyor..." -ForegroundColor Yellow

$timeout = 40
$ready = $false
for ($i = 0; $i -lt $timeout; $i++) {
    Start-Sleep 1
    try {
        $req = [System.Net.WebRequest]::Create("http://localhost:${PORT}/api/trpc/queue.getStats")
        $req.Timeout = 1000
        $resp = $req.GetResponse()
        $resp.Close()
        $ready = $true
        break
    } catch {}
}
if (-not $ready) {
    Write-Host "[!] Sunucu başlatılamadı." -ForegroundColor Red
    Start-Sleep 5
    exit 1
}

Write-Host "[2/3] Sunucu hazır! Ekranlar açılıyor..." -ForegroundColor Green

# Detect monitors
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens

# Find non-primary screen for display
$displayScreen = $null
foreach ($s in $screens) {
    if (-not $s.Primary) { $displayScreen = $s; break }
}

if ($displayScreen) {
    $dx = $displayScreen.Bounds.X
    $dy = $displayScreen.Bounds.Y
    $dw = $displayScreen.Bounds.Width
    $dh = $displayScreen.Bounds.Height
    
    Write-Host "[!] Display ekranı: $($displayScreen.DeviceName) (${dw}x${dh})" -ForegroundColor Cyan
    
    $browserPath = $null
    $bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue
    if ($bkey) { $browserPath = $bkey."(default)" }
    else {
        $bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
        if ($bkey) { $browserPath = $bkey."(default)" }
    }
    
    if ($browserPath) {
        Start-Process -FilePath $browserPath -ArgumentList "--new-window --start-fullscreen --window-position=$dx,$dy --window-size=$dw,$dh `"$DISPLAY_URL`""
    } else {
        Start-Process "ms-edge:$DISPLAY_URL"
    }
    Write-Host "  -> Display ekranı açıldı" -ForegroundColor Green
} elseif ($screens.Count -eq 1) {
    Write-Host "[!] Tek ekran, display burada açılıyor." -ForegroundColor Yellow
    Start-Process "http://localhost:${PORT}/display"
} else {
    Write-Host "[!] Display ekranı bulunamadı, ana ekranda açılıyor." -ForegroundColor Yellow
    Start-Process "http://localhost:${PORT}/display"
}

# Open Electron app if exists
$electronPath = Join-Path $SCRIPT_DIR "release\win-unpacked\Siramatik Banko Paneli.exe"
if (Test-Path $electronPath) {
    Start-Process -FilePath $electronPath
    Write-Host "  -> Banko Paneli (Electron) açıldı" -ForegroundColor Green
} else {
    Start-Process $SERVER_URL
    Write-Host "  -> Banko Paneli (tarayıcı) açıldı" -ForegroundColor Green
}

Write-Host "[3/3] Sistem çalışıyor!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Kapatmak için: .\baslat.ps1 -Kapat" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Magenta

# Keep running silently (no Read-Host)
while ($true) {
    Start-Sleep 10
    $nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID }
    if (-not $nodeProcess) {
        Write-Host "[!] Sunucu durdu!" -ForegroundColor Red
        Start-Sleep 5
        break
    }
}
