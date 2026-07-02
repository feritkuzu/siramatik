param(
    [string]$InstallDir = "$env:ProgramFiles\Siramatik\Banko",
    [string]$ServerAddress = "192.168.1.100",
    [int]$ServerPort = 3000,
    [switch]$SetupDisplay,
    [switch]$SetupBank,
    [switch]$SetupKiosk,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.Command.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

# Varsayilan olarak Display acilsin (2. ekran)
if (-not $SetupBank -and -not $SetupKiosk) { $SetupDisplay = $true }

$SERVER_URL = "http://${ServerAddress}:${ServerPort}"

if ($Uninstall) {
    Write-Host "Siramatik Banko kaldiriliyor..." -ForegroundColor Yellow
    
    # Stop running processes
    Get-Process -Name "Siramatik*","electron","msedge","chrome" -ErrorAction SilentlyContinue | Stop-Process -Force 2>$null
    
    # Remove scheduled task if exists
    schtasks /End /TN "SiramatikBanko" 2>$null
    schtasks /Delete /TN "SiramatikBanko" /F 2>$null
    
    # Remove install directory
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Host "[OK] $InstallDir temizlendi" -ForegroundColor Green
    }
    
    # Remove shortcuts
    $desktop = [Environment]::GetFolderPath("Desktop")
    @(
        "$desktop\Siramatik Banko.lnk",
        "$desktop\Siramatik Display.lnk",
        "$desktop\Siramatik Kiosk.lnk",
        "$desktop\Siramatik.lnk"
    ) | ForEach-Object {
        if (Test-Path $_) { Remove-Item $_ -Force }
    }
    
    $startup = [Environment]::GetFolderPath("Startup")
    if (Test-Path "$startup\Siramatik Banko.lnk") { Remove-Item "$startup\Siramatik Banko.lnk" -Force }
    
    Write-Host "[OK] Siramatik Banko kaldirildi." -ForegroundColor Green
    exit 0
}

Write-Host "==============================" -ForegroundColor Magenta
Write-Host "  SIRAMATIK BANKO KURULUMU    " -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Magenta
Write-Host "Hedef: $InstallDir" -ForegroundColor Gray
Write-Host "Sunucu: $SERVER_URL" -ForegroundColor Gray
if ($SetupDisplay) { Write-Host "Mod: DISPLAY (2. Ekran)" -ForegroundColor Cyan }
if ($SetupBank) { Write-Host "Mod: BANKO PANELI" -ForegroundColor Cyan }
if ($SetupKiosk) { Write-Host "Mod: KIOSK" -ForegroundColor Cyan }
Write-Host ""

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Create config file
$config = @{
    serverUrl = $SERVER_URL
    installDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json
Set-Content -Path "$InstallDir\config.json" -Value $config -Encoding UTF8

# Detect available browser
$browserPath = $null
$bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue
if ($bkey) { $browserPath = $bkey."(default)" }
else {
    $bkey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
    if ($bkey) { $browserPath = $bkey."(default)" }
}

if (-not $browserPath) {
    Write-Host "[!] Edge veya Chrome bulunamadi!" -ForegroundColor Red
    Write-Host "    Lutfen Microsoft Edge yukleyin." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Tarayici: $browserPath" -ForegroundColor Green

# Copy Electron files (for Display)
if (Test-Path "$PROJECT_DIR\electron") {
    Copy-Item -Path "$PROJECT_DIR\electron\main.cjs" -Destination "$InstallDir\electron\" -Force
    Copy-Item -Path "$PROJECT_DIR\electron\preload.cjs" -Destination "$InstallDir\electron\" -Force
    Write-Host "[OK] Electron dosyalari kopyalandi" -ForegroundColor Green
}

# === Create launcher scripts ===

# Bank panel launcher
$bankLauncher = @"
`$browser = "$browserPath"
`$url = "${SERVER_URL}/bank"
`$EDGE_FLAGS = "--no-first-run --no-default-browser-check --disable-extensions --disable-background-networking --no-experiments --disable-component-extensions-with-background-pages --disable-notifications --disable-infobars --disable-sync --disable-signin-promo --disable-translate --kiosk --edge-kiosk-type=fullscreen"
Start-Process -FilePath `$browser -ArgumentList "`$EDGE_FLAGS --new-window `"`$url`""
"@
Set-Content -Path "$InstallDir\banko-ac.ps1" -Value $bankLauncher -Encoding ASCII

# Display launcher using Electron (if available)
$displayLauncher = @"
`$electronPath = "$InstallDir\electron.exe"
if (Test-Path `$electronPath) {
    Start-Process -FilePath `$electronPath -ArgumentList "`"$InstallDir\electron\main.cjs`" --display"
} else {
    `$browser = "$browserPath"
    `$url = "${SERVER_URL}/display"
    `$EDGE_FLAGS = "--no-first-run --no-default-browser-check --disable-extensions --disable-background-networking --no-experiments --disable-component-extensions-with-background-pages --disable-notifications --disable-infobars --disable-sync --disable-signin-promo --disable-translate --kiosk --edge-kiosk-type=fullscreen"
    Start-Process -FilePath `$browser -ArgumentList "`$EDGE_FLAGS --new-window `"`$url`""
}
"@
Set-Content -Path "$InstallDir\display-ac.ps1" -Value $displayLauncher -Encoding ASCII

# Kiosk launcher
$kioskLauncher = @"
`$browser = "$browserPath"
`$url = "${SERVER_URL}/kiosk"
`$EDGE_FLAGS = "--no-first-run --no-default-browser-check --disable-extensions --disable-background-networking --no-experiments --disable-component-extensions-with-background-pages --disable-notifications --disable-infobars --disable-sync --disable-signin-promo --disable-translate --kiosk --edge-kiosk-type=fullscreen"
Start-Process -FilePath `$browser -ArgumentList "`$EDGE_FLAGS --new-window `"`$url`""
"@
Set-Content -Path "$InstallDir\kiosk-ac.ps1" -Value $kioskLauncher -Encoding ASCII

Write-Host "[OK] Baslatma scriptleri olusturuldu" -ForegroundColor Green

# Create desktop shortcuts
$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$startup = [Environment]::GetFolderPath("Startup")

# Banko shortcut
$lnk = $wsh.CreateShortcut("$desktop\Siramatik Banko.lnk")
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\banko-ac.ps1`""
$lnk.WorkingDirectory = $InstallDir
$lnk.Description = "Siramatik Banko Panelini ac"
$lnk.Save()

# Display shortcut
$lnk2 = $wsh.CreateShortcut("$desktop\Siramatik Display.lnk")
$lnk2.TargetPath = "powershell.exe"
$lnk2.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\display-ac.ps1`""
$lnk2.WorkingDirectory = $InstallDir
$lnk2.Description = "Siramatik Display Ekrani"
$lnk2.Save()

# Kiosk shortcut
$lnk3 = $wsh.CreateShortcut("$desktop\Siramatik Kiosk.lnk")
$lnk3.TargetPath = "powershell.exe"
$lnk3.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\kiosk-ac.ps1`""
$lnk3.WorkingDirectory = $InstallDir
$lnk3.Description = "Siramatik Kiosk"
$lnk3.Save()

Write-Host "[OK] Masaustu kisa yollari olusturuldu" -ForegroundColor Green

# Auto-start for the selected mode
if ($SetupDisplay) {
    $lnkAuto = $wsh.CreateShortcut("$startup\Siramatik Display.lnk")
    $lnkAuto.TargetPath = "powershell.exe"
    $lnkAuto.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\display-ac.ps1`""
    $lnkAuto.WorkingDirectory = $InstallDir
    $lnkAuto.Save()
    Write-Host "[OK] Display otomatik baslatmaya eklendi (Windows acilisi)" -ForegroundColor Green
}
if ($SetupBank) {
    $lnkAuto = $wsh.CreateShortcut("$startup\Siramatik Banko.lnk")
    $lnkAuto.TargetPath = "powershell.exe"
    $lnkAuto.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\banko-ac.ps1`""
    $lnkAuto.WorkingDirectory = $InstallDir
    $lnkAuto.Save()
    Write-Host "[OK] Banko otomatik baslatmaya eklendi (Windows acilisi)" -ForegroundColor Green
}
if ($SetupKiosk) {
    $lnkAuto = $wsh.CreateShortcut("$startup\Siramatik Kiosk.lnk")
    $lnkAuto.TargetPath = "powershell.exe"
    $lnkAuto.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\kiosk-ac.ps1`""
    $lnkAuto.WorkingDirectory = $InstallDir
    $lnkAuto.Save()
    Write-Host "[OK] Kiosk otomatik baslatmaya eklendi (Windows acilisi)" -ForegroundColor Green
}

# Create uninstall script
$uninstallScript = @"
`$scriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
& "`$scriptDir\bank-install.ps1" -Uninstall
"@
Set-Content -Path "$InstallDir\kaldir.ps1" -Value $uninstallScript -Encoding ASCII

Write-Host ""
Write-Host "==============================" -ForegroundColor Magenta
Write-Host "  KURULUM TAMAMLANDI!         " -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Sunucu adresini degistirmek icin:" -ForegroundColor Cyan
Write-Host "  $InstallDir\config.json dosyasini duzenleyin" -ForegroundColor White
Write-Host ""
Write-Host "Kaldirmak icin:" -ForegroundColor Cyan
Write-Host "  $InstallDir\kaldir.ps1" -ForegroundColor White
Write-Host ""
