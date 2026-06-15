param([switch]$Setup, [switch]$Kapat)

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PORT = 3000

if ($Setup) {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $lnkPath = Join-Path $startupDir "Siramatik.lnk"
    $wsh = New-Object -ComObject WScript.Shell
    $lnk = $wsh.CreateShortcut($lnkPath)
    $lnk.TargetPath = "powershell.exe"
    $lnk.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$SCRIPT_DIR\baslat.ps1`""
    $lnk.WorkingDirectory = $SCRIPT_DIR
    $lnk.Description = "Siramatik Sistemi - Otomatik Başlat"
    $lnk.Save()
    Write-Host "[OK] Baslangica eklendi. Bir dahaki acilista otomatik baslar." -ForegroundColor Green

    $desktop = [Environment]::GetFolderPath("Desktop")
    $desktopLnk = Join-Path $desktop "Siramatik.lnk"
    $lnk2 = $wsh.CreateShortcut($desktopLnk)
    $lnk2.TargetPath = "powershell.exe"
    $lnk2.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$SCRIPT_DIR\baslat.ps1`""
    $lnk2.WorkingDirectory = $SCRIPT_DIR
    $lnk2.Description = "Siramatik Sistemi"
    $lnk2.Save()
    Write-Host "[OK] Masaustu kısayolu olusturuldu." -ForegroundColor Green
    exit 0
}

if ($Kapat) {
    Write-Host "Sistem kapatiliyor..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force
    Get-Process -Name "msedge","chrome","Siramatik*" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" -or $_.MainWindowTitle -like "*display*" -or $_.MainWindowTitle -like "*SIRAMATIK*" } | Stop-Process -ErrorAction SilentlyContinue
    Write-Host "[OK] Sistem durduruldu." -ForegroundColor Green
    exit 0
}

# === MAIN START ===
$host.ui.RawUI.WindowTitle = "SIRAMATIK"
Write-Host "==============================" -ForegroundColor Magenta
Write-Host "     S I R A M A T I K       " -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Magenta

# Kill old node
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

Write-Host "[1/3] Sunucu baslatiliyor..." -ForegroundColor Yellow

# Wait for server
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
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
    Write-Host "[!] Sunucu baslatilamadi." -ForegroundColor Red
    Start-Sleep 5; exit 1
}

Write-Host "[2/3] Sunucu hazir! Ekranlar aciliyor..." -ForegroundColor Green

# === Detect displays ===
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens

# Find the display screen (non-primary with largest area)
$displayScreen = $null
foreach ($s in $screens) {
    if ($s.Primary) { continue }
    $area = $s.Bounds.Width * $s.Bounds.Height
    if (-not $displayScreen -or $area -gt ($displayScreen.Bounds.Width * $displayScreen.Bounds.Height)) {
        $displayScreen = $s
    }
}

# Fallback: if only one screen or no extended found, use primary
if (-not $displayScreen) { $displayScreen = $screens[0] }

$dx = $displayScreen.Bounds.X
$dy = $displayScreen.Bounds.Y
$dw = $displayScreen.Bounds.Width
$dh = $displayScreen.Bounds.Height

Write-Host "[!] Display: $($displayScreen.DeviceName) (${dw}x${dh} @${dx},${dy})" -ForegroundColor Cyan

# Find browser
$browserPath = $null
$bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue
if ($bkey) { $browserPath = $bkey."(default)" }
else {
    $bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
    if ($bkey) { $browserPath = $bkey."(default)" }
}

# Open display on the target monitor using kiosk mode
$displayUrl = "http://localhost:${PORT}/display"
if ($browserPath) {
    $browserDir = Split-Path -Parent $browserPath
    $tempProfile = Join-Path $env:TEMP "siramatik-display-profile"
    if (Test-Path $tempProfile) { Remove-Item -Path $tempProfile -Recurse -Force -ErrorAction SilentlyContinue }
    Start-Process -FilePath $browserPath -ArgumentList "--user-data-dir=`"$tempProfile`" --no-first-run --no-default-browser-check --new-window --kiosk --window-position=$dx,$dy --window-size=$dw,$dh `"$displayUrl`""
    Write-Host "  -> Display acildi (kiosk mod)" -ForegroundColor Green
} else {
    Start-Process "ms-edge:$displayUrl"
    Write-Host "  -> Display Edge ile acildi (F11 ile tam ekran yapin)" -ForegroundColor Yellow
}

# Open Siramatik on primary monitor (manage/admin panel)
$electronPath = Join-Path $SCRIPT_DIR "release\win-unpacked\Siramatik Banko Paneli.exe"
if (Test-Path $electronPath) {
    Start-Process -FilePath $electronPath
    Write-Host "  -> Banko Paneli (Electron) acildi" -ForegroundColor Green
    Start-Sleep 2
    # Also open browser on primary monitor for admin
    $adminUrl = "http://localhost:${PORT}/admin"
    if ($browserPath) {
        $tempProfile2 = Join-Path $env:TEMP "siramatik-admin-profile"
        if (Test-Path $tempProfile2) { Remove-Item $tempProfile2 -Recurse -Force -ErrorAction SilentlyContinue }
        Start-Process -FilePath $browserPath -ArgumentList "--user-data-dir=`"$tempProfile2`" --no-first-run --new-window `"$adminUrl`""
        Write-Host "  -> Admin panel (tarayici) acildi" -ForegroundColor Green
    }
} else {
    Start-Process "http://localhost:${PORT}/"
    Write-Host "  -> Ana sayfa (tarayici) acildi" -ForegroundColor Green
}

Write-Host "[3/3] Sistem calisiyor!" -ForegroundColor Green
Write-Host "Kapatmak icin: .\baslat.ps1 -Kapat" -ForegroundColor Gray

# Keep alive
while ($true) {
    Start-Sleep 10
    $alive = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID }
    if (-not $alive) {
        Write-Host "[!] Sunucu durdu!" -ForegroundColor Red
        Start-Sleep 5; break
    }
}
