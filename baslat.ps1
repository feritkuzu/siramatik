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
    Get-Process -Name "msedge","chrome","Siramatik*","electron" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" -or $_.MainWindowTitle -like "*display*" -or $_.MainWindowTitle -like "*kiosk*" -or $_.MainWindowTitle -like "*admin*" -or $_.MainWindowTitle -like "*SIRAMATIK*" -or $_.MainWindowTitle -like "*sıramatik*" } | Stop-Process -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:TEMP\siramatik-locks" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:TEMP\siramatik-kiosk-profile" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:TEMP\siramatik-display-profile" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Sistem durduruldu." -ForegroundColor Green
    exit 0
}

# === Lock helpers to prevent duplicate windows ===
$LOCK_DIR = "$env:TEMP\siramatik-locks"
if (-not (Test-Path $LOCK_DIR)) { New-Item -ItemType Directory -Path $LOCK_DIR -Force | Out-Null }

function Is-WindowOpen($name) {
    $lockFile = Join-Path $LOCK_DIR "$name.lock"
    if (Test-Path $lockFile) {
        $lockPid = Get-Content $lockFile -Raw -ErrorAction SilentlyContinue
        if ($lockPid) { $lockPid = $lockPid.Trim() }
        if ($lockPid -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) { return $true }
        else { Remove-Item $lockFile -Force -ErrorAction SilentlyContinue }
    }
    return $false
}

function Set-Lock($name) {
    $lockFile = Join-Path $LOCK_DIR "$name.lock"
    $targetPid = $null
    if ($name -eq "electron") { $targetPid = (Get-Process -Name "Siramatik*" -ErrorAction SilentlyContinue | Select-Object -First 1).Id }
    if (-not $targetPid) { $targetPid = $global:PID }
    Set-Content -Path $lockFile -Value $targetPid -NoNewline
}

# === MAIN START ===
$host.ui.RawUI.WindowTitle = "SIRAMATIK"

# Clean all stale lock files at startup
Remove-Item -Path "$env:TEMP\siramatik-locks\*.lock" -Force -ErrorAction SilentlyContinue

Write-Host "==============================" -ForegroundColor Magenta
Write-Host "     S I R A M A T I K       " -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Magenta

# Kill old node
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Start server
$serverJob = Start-Job -Name "ServerJob" -ScriptBlock {
    Set-Location -LiteralPath "C:\wamp64\www\siramatik"
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
        $req = [System.Net.WebRequest]::Create("http://127.0.0.1:${PORT}/api/trpc/queue.getStats")
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
$primaryScreen = $screens | Where-Object { $_.Primary }

# Find the extended (non-primary) display with largest area
$extendedScreen = $null
foreach ($s in $screens) {
    if ($s.Primary) { continue }
    $area = $s.Bounds.Width * $s.Bounds.Height
    if (-not $extendedScreen -or $area -gt ($extendedScreen.Bounds.Width * $extendedScreen.Bounds.Height)) {
        $extendedScreen = $s
    }
}

# Fallback: if only one screen, use it for both
if (-not $extendedScreen) { $extendedScreen = $primaryScreen }

Write-Host "[!] 1.Ekran (Kiosk): $($primaryScreen.DeviceName) $($primaryScreen.Bounds.Width)x$($primaryScreen.Bounds.Height)" -ForegroundColor Cyan
Write-Host "[!] 2.Ekran (Display): $($extendedScreen.DeviceName) $($extendedScreen.Bounds.Width)x$($extendedScreen.Bounds.Height) @$($extendedScreen.Bounds.X),$($extendedScreen.Bounds.Y)" -ForegroundColor Cyan

# Find browser
$browserPath = $null
$bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue
if ($bkey) { $browserPath = $bkey."(default)" }
else {
    $bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
    if ($bkey) { $browserPath = $bkey."(default)" }
}

# 1. Kiosk panel on PRIMARY monitor - full screen
$EDGE_FLAGS = "--no-first-run --no-default-browser-check --disable-extensions --disable-background-networking --no-experiments --disable-component-extensions-with-background-pages --disable-notifications --disable-infobars --disable-sync --disable-signin-promo --disable-translate --disable-features=Translate,msTranslate,msEdgeTranslate,DownloadBubble,DownloadBubbleV2,MsEdgeUpdate,EdgeShoppingAssistant,EdgeSidebar,msUndersideButton,msHubApps,msPageHun,msShortcuts,msRecommendedExtensions,ExtensionsMenu"

# Clean old profiles once to remove any cached extension data
Remove-Item -Path "$env:TEMP\siramatik-kiosk-profile" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\siramatik-display-profile" -Recurse -Force -ErrorAction SilentlyContinue
$kioskUrl = "http://localhost:${PORT}/kiosk"
    if (-not (Is-WindowOpen "kiosk")) {
    if ($browserPath) {
        $tempProfileKiosk = Join-Path $env:TEMP "siramatik-kiosk-profile"
        $pkx = $primaryScreen.Bounds.X
        $pky = $primaryScreen.Bounds.Y
        $pkw = $primaryScreen.Bounds.Width
        $pkh = $primaryScreen.Bounds.Height
        $proc = Start-Process -FilePath $browserPath -ArgumentList "--user-data-dir=`"$tempProfileKiosk`" $EDGE_FLAGS --new-window --kiosk --edge-kiosk-type=fullscreen --window-position=$pkx,$pky --window-size=$pkw,$pkh `"$kioskUrl`"" -PassThru
        Set-Content -Path (Join-Path $LOCK_DIR "kiosk.lock") -Value $proc.Id -NoNewline
        Write-Host "  -> Kiosk (1.Ekran) acildi - tam ekran" -ForegroundColor Green
    } else {
        Start-Process "ms-edge:$kioskUrl"
        Set-Lock "kiosk"
        Write-Host "  -> Kiosk Edge ile acildi (F11 ile tam ekran yapin)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  -> Kiosk penceresi zaten acik, yenisi acilmadi" -ForegroundColor Cyan
}

# 2. Display panel on EXTENDED monitor - Electron ile (autoplay politikası bypass)
if (-not (Is-WindowOpen "display")) {
    $electronPath = Join-Path $PSScriptRoot "node_modules\.pnpm\electron@42.3.3\node_modules\electron\dist\electron.exe"
    if (Test-Path $electronPath) {
        $proc2 = Start-Process -FilePath $electronPath -ArgumentList "`"$(Join-Path $PSScriptRoot 'electron\main.cjs')`" --display" -PassThru
        Set-Content -Path (Join-Path $LOCK_DIR "display.lock") -Value $proc2.Id -NoNewline
        Write-Host "  -> Display (Electron) acildi - tam ekran, otomatik ses" -ForegroundColor Green
    } else {
        Write-Host "  -> Electron bulunamadi, Edge ile aciliyor..." -ForegroundColor Yellow
        $dex = $extendedScreen.Bounds.X
        $dey = $extendedScreen.Bounds.Y
        $dew = $extendedScreen.Bounds.Width
        $deh = $extendedScreen.Bounds.Height
        $proc2 = Start-Process -FilePath $browserPath -ArgumentList "--user-data-dir=`"$env:TEMP\siramatik-display-profile`" $EDGE_FLAGS --new-window --kiosk --edge-kiosk-type=fullscreen --window-position=$dex,$dey --window-size=$dew,$deh `"$displayUrl`"" -PassThru
        Set-Content -Path (Join-Path $LOCK_DIR "display.lock") -Value $proc2.Id -NoNewline
        Write-Host "  -> Display (Edge) acildi - tam ekran" -ForegroundColor Green
    }
} else {
    Write-Host "  -> Display penceresi zaten acik, yenisi acilmadi" -ForegroundColor Cyan
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
