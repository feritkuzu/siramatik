param([switch]$Server, [switch]$Bank)
if (-not $Server -and -not $Bank) { $Server = $true; $Bank = $true }

$ErrorActionPreference = "Continue"
$PROJECT_DIR = Split-Path -Parent $PSScriptRoot
$OUTPUT_DIR = "$PROJECT_DIR\dist\installers"

# Ensure output dir exists
if (-not (Test-Path $OUTPUT_DIR)) { New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null }

function Copy-Dir {
    param($Source, $Dest, $Exclude = @())
    if (-not (Test-Path $Source)) { Write-Host "  [!] Source not found: $Source" -ForegroundColor Yellow; return }
    if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
    Get-ChildItem -Path $Source | ForEach-Object {
        $name = $_.Name
        $skip = $false
        foreach ($ex in $Exclude) { if ($name -like $ex) { $skip = $true; break } }
        if (-not $skip) {
            if ($_.PSIsContainer) {
                Copy-Item -Path $_.FullName -Destination "$Dest\$name" -Recurse -Force
            } else {
                Copy-Item -Path $_.FullName -Destination "$Dest\$name" -Force
            }
        }
    }
}

function Build-ServerPackage {
    Write-Host "=== SUNUCU PAKETI ===" -ForegroundColor Cyan
    $pkgDir = "$OUTPUT_DIR\siramatik-server"
    if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
    New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null

    Write-Host "  Copying server files..." -ForegroundColor Yellow
    Copy-Dir -Source "$PROJECT_DIR\server" -Dest "$pkgDir\server" -Exclude @("node_modules","*.ts")

    Write-Host "  Copying shared files..." -ForegroundColor Yellow
    Copy-Dir -Source "$PROJECT_DIR\shared" -Dest "$pkgDir\shared"

    Write-Host "  Copying electron files..." -ForegroundColor Yellow
    Copy-Dir -Source "$PROJECT_DIR\electron" -Dest "$pkgDir\electron"

    Write-Host "  Copying media files..." -ForegroundColor Yellow
    Copy-Dir -Source "$PROJECT_DIR\release" -Dest "$pkgDir\release"

    Write-Host "  Copying client build..." -ForegroundColor Yellow
    Copy-Dir -Source "$PROJECT_DIR\dist\public" -Dest "$pkgDir\client"

    Write-Host "  Copying root files..." -ForegroundColor Yellow
    Copy-Item -Path "$PROJECT_DIR\package.json" -Destination "$pkgDir\" -Force
    Copy-Item -Path "$PROJECT_DIR\baslat.ps1" -Destination "$pkgDir\" -Force

    Write-Host "  Copying installer scripts..." -ForegroundColor Yellow
    Copy-Item -Path "$PSScriptRoot\server-install.ps1" -Destination "$pkgDir\" -Force
    Copy-Item -Path "$PSScriptRoot\ServerSetup.nsi" -Destination "$pkgDir\" -Force

    $lines = @(
        "Siramatik Sunucu Kurulumu",
        "=========================",
        "",
        "Sistem: Windows 10/11, Node.js 20+, 4GB RAM",
        "",
        "Hizli Kurulum (PowerShell Yonetici):",
        "  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass",
        "  .\server-install.ps1",
        "",
        "Manuel:",
        "  npm install --production",
        "  set NODE_ENV=production",
        "  node server/index.js",
        "",
        "Kaldirma: .\server-install.ps1 -Uninstall",
        "Admin: http://localhost:3000/admin"
    )
    Set-Content -Path "$pkgDir\KURULUM.txt" -Value ($lines -join "`r`n") -Encoding ASCII

    Write-Host "  Creating ZIP..." -ForegroundColor Yellow
    $zipPath = "$OUTPUT_DIR\siramatik-server-package.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path "$pkgDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
    $size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "  [OK] $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB" -ForegroundColor Green
}

function Build-BankPackage {
    Write-Host "=== BANKO PAKETI ===" -ForegroundColor Cyan
    $pkgDir = "$OUTPUT_DIR\siramatik-banko"
    if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
    New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null

    Write-Host "  Copying electron files..." -ForegroundColor Yellow
    Copy-Dir -Source "$PROJECT_DIR\electron" -Dest "$pkgDir\electron"

    Write-Host "  Copying installer scripts..." -ForegroundColor Yellow
    Copy-Item -Path "$PSScriptRoot\bank-install.ps1" -Destination "$pkgDir\" -Force
    Copy-Item -Path "$PSScriptRoot\BankSetup.nsi" -Destination "$pkgDir\" -Force

    $config = @{ serverUrl = "http://192.168.1.100:3000"; mode = "display" } | ConvertTo-Json
    Set-Content -Path "$pkgDir\config-template.json" -Value $config -Encoding UTF8

    $lines = @(
        "Siramatik Banko Kurulumu",
        "========================",
        "",
        "Kurulum (PowerShell Yonetici):",
        "  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass",
        "  .\bank-install.ps1 -ServerAddress 192.168.1.100 -SetupDisplay",
        "",
        "Parametreler:",
        "  -ServerAddress : Sunucu IP (zorunlu)",
        "  -SetupDisplay  : Display modu",
        "  -SetupBank     : Banko paneli modu",
        "  -SetupKiosk    : Kiosk modu",
        "  -ServerPort    : Port (3000)",
        "",
        "Kaldirma: .\bank-install.ps1 -Uninstall"
    )
    Set-Content -Path "$pkgDir\KURULUM.txt" -Value ($lines -join "`r`n") -Encoding ASCII

    Write-Host "  Creating ZIP..." -ForegroundColor Yellow
    $zipPath = "$OUTPUT_DIR\siramatik-banko-package.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path "$pkgDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "  [OK] $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB" -ForegroundColor Green
}

# Main
Write-Host "======================================" -ForegroundColor Magenta
Write-Host "  SIRAMATIK INSTALLER BUILDER" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Magenta
Write-Host ""

if ($Server) { Build-ServerPackage; Write-Host "" }
if ($Bank) { Build-BankPackage; Write-Host "" }

Write-Host "=== TUM PAKETLER HAZIR ===" -ForegroundColor Green
Get-ChildItem -Path $OUTPUT_DIR -Filter "*.zip" | ForEach-Object {
    Write-Host ("  " + $_.Name + " (" + [math]::Round($_.Length / 1MB, 1) + " MB)") -ForegroundColor White
}
Write-Host ""
Write-Host "Kullanim:" -ForegroundColor Gray
Write-Host "  build-installers.ps1 -Server  (sadece sunucu)" -ForegroundColor Gray
Write-Host "  build-installers.ps1 -Bank    (sadece banko)" -ForegroundColor Gray
Write-Host "  build-installers.ps1         (her ikisi)" -ForegroundColor Gray
