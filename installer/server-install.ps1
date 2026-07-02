param(
    [string]$InstallDir = "$env:ProgramFiles\Siramatik\Server",
    [int]$Port = 3000,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

if ($Uninstall) {
    Write-Host "Siramatik Sunucu kaldiriliyor..." -ForegroundColor Yellow
    
    # Remove firewall rule
    netsh advfirewall firewall delete rule name="Siramatik Server (TCP $Port)" > $null 2>&1
    
    # Stop and remove scheduled task
    schtasks /End /TN "SiramatikServer" 2>$null
    schtasks /Delete /TN "SiramatikServer" /F 2>$null
    
    # Kill any running processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force 2>$null
    
    # Remove install directory
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Host "[OK] $InstallDir temizlendi" -ForegroundColor Green
    }
    
    # Remove shortcuts
    $desktop = [Environment]::GetFolderPath("Desktop")
    $startup = [Environment]::GetFolderPath("Startup")
    @("$desktop\Siramatik (Admin).lnk", "$desktop\Siramatik Sunucu.lnk", "$startup\Siramatik Server.lnk") | ForEach-Object {
        if (Test-Path $_) { Remove-Item $_ -Force }
    }
    
    Write-Host "[OK] Siramatik Sunucu kaldirildi." -ForegroundColor Green
    exit 0
}

Write-Host "==============================" -ForegroundColor Magenta
Write-Host "  SIRAMATIK SUNUCU KURULUMU  " -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Magenta
Write-Host "Hedef: $InstallDir" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "[!] Node.js bulunamadi!" -ForegroundColor Red
    Write-Host "    Lutfen https://nodejs.org adresinden Node.js 20+ yukleyin." -ForegroundColor Yellow
    Write-Host "    Kurulumdan sonra bu scripti tekrar calistirin." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

# Create directory structure
@(
    "$InstallDir\server",
    "$InstallDir\client",
    "$InstallDir\release\Media\Notification",
    "$InstallDir\electron",
    "$InstallDir\shared"
) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}

# Build client (Vite production build)
Write-Host "[1/4] Client build aliniyor..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR
npx vite build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Build basarisiz!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Client build tamam" -ForegroundColor Green

# Copy files
Write-Host "[2/4] Dosyalar kopyalaniyor..." -ForegroundColor Yellow

# Server files
Copy-Item -Path "$PROJECT_DIR\server\*" -Destination "$InstallDir\server\" -Recurse -Force -Exclude "node_modules","*.ts","tsconfig*"

# Client build
Copy-Item -Path "$PROJECT_DIR\dist\public\*" -Destination "$InstallDir\client\" -Recurse -Force

# Media files
if (Test-Path "$PROJECT_DIR\release\Media") {
    Copy-Item -Path "$PROJECT_DIR\release\Media\*" -Destination "$InstallDir\release\Media\" -Recurse -Force
}

# Shared files
Copy-Item -Path "$PROJECT_DIR\shared\*" -Destination "$InstallDir\shared\" -Recurse -Force

# Electron files
Copy-Item -Path "$PROJECT_DIR\electron\main.cjs" -Destination "$InstallDir\electron\"
Copy-Item -Path "$PROJECT_DIR\electron\preload.cjs" -Destination "$InstallDir\electron\"

# Root files
Copy-Item -Path "$PROJECT_DIR\package.json" -Destination "$InstallDir\"
Copy-Item -Path "$PROJECT_DIR\baslat.ps1" -Destination "$InstallDir\" 2>$null

# Database file
if (Test-Path "$PROJECT_DIR\siramatik.db") {
    Copy-Item -Path "$PROJECT_DIR\siramatik.db" -Destination "$InstallDir\" -Force
}

Write-Host "[OK] Dosyalar kopyalandi" -ForegroundColor Green

# Install production dependencies
Write-Host "[3/4] Bagimliliklar yukleniyor..." -ForegroundColor Yellow
Set-Location $InstallDir
npm install --production 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] npm install basarisiz!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Bagimliliklar yuklendi" -ForegroundColor Green

# Create startup script
$startScript = @"
`$env:NODE_ENV = "production"
Set-Location "$InstallDir"
node server/index.js
"@
Set-Content -Path "$InstallDir\start-server.ps1" -Value $startScript -Encoding ASCII

# Create start-server.bat for direct launch
$batContent = "@echo off`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\start-server.ps1`"`r`npause"
Set-Content -Path "$InstallDir\start-server.bat" -Value $batContent -Encoding ASCII

# Register as scheduled task (auto-start on boot)
Write-Host "[4/4] Otomatik baslatma ayarlaniyor..." -ForegroundColor Yellow
$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\start-server.ps1`"" -WorkingDirectory "$InstallDir"
$taskTrigger = New-ScheduledTaskTrigger -AtStartup -RandomDelay (New-TimeSpan -Minutes 1)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
try {
    Register-ScheduledTask -TaskName "SiramatikServer" -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Force 2>$null | Out-Null
    Write-Host "[OK] Otomatik baslatma eklendi (Gorev Zamanlayici)" -ForegroundColor Green
} catch {
    Write-Host "[!] Otomatik baslatma eklenemedi: $_" -ForegroundColor Yellow
    Write-Host "    Yuksek yetki ile calistirmayi deneyin veya manuel ekleyin." -ForegroundColor Yellow
}

# Add firewall rule
try {
    netsh advfirewall firewall add rule name="Siramatik Server (TCP $Port)" dir=in action=allow protocol=TCP localport=$Port 2>$null | Out-Null
    Write-Host "[OK] Guvenlik duvari kurali eklendi (TCP $Port)" -ForegroundColor Green
} catch {
    Write-Host "[!] Guvenlik duvari kurali eklenemedi" -ForegroundColor Yellow
}

# Create shortcuts
$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")

# Admin Panel shortcut
$lnk = $wsh.CreateShortcut("$desktop\Siramatik (Admin).lnk")
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"Start-Process 'ms-edge.exe' -ArgumentList '--new-window', '--kiosk', 'http://localhost:$Port/admin'`""
$lnk.WorkingDirectory = $InstallDir
$lnk.Description = "Siramatik Admin Paneli"
$lnk.Save()

# Server start shortcut
$lnk2 = $wsh.CreateShortcut("$desktop\Siramatik Sunucu.lnk")
$lnk2.TargetPath = "powershell.exe"
$lnk2.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\start-server.ps1`""
$lnk2.WorkingDirectory = $InstallDir
$lnk2.Description = "Siramatik Sunucu Baslat"
$lnk2.IconLocation = "%SystemRoot%\System32\imageres.dll,179"
$lnk2.Save()

Write-Host ""
Write-Host "==============================" -ForegroundColor Magenta
Write-Host "  KURULUM TAMAMLANDI!         " -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Sunucu baslatmak icin:" -ForegroundColor Cyan
Write-Host "  .\start-server.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Admin panel icin:" -ForegroundColor Cyan
Write-Host "  http://localhost:$Port/admin" -ForegroundColor White
Write-Host ""
Write-Host "Kaldirmak icin:" -ForegroundColor Cyan
Write-Host "  .\server-install.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
