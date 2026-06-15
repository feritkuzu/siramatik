$host.ui.RawUI.WindowTitle = "SIRAMATİK - SİSTEM BAŞLATILIYOR..."
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "       S I R A M A T I K               " -ForegroundColor Cyan
Write-Host "       Sistem Başlatılıyor...          " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# Kill any existing node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Start dev server in hidden window
$serverJob = Start-Job -ScriptBlock {
    Set-Location -LiteralPath "$using:PWD"
    npm run dev
}

Write-Host "[1/3] Sunucu başlatılıyor..." -ForegroundColor Yellow

# Wait for server to be ready
$timeout = 30
$ready = $false
for ($i = 0; $i -lt $timeout; $i++) {
    Start-Sleep 1
    try {
        $req = [System.Net.WebRequest]::Create("http://localhost:3000/api/trpc/queue.getStats")
        $req.Timeout = 1000
        $resp = $req.GetResponse()
        $resp.Close()
        $ready = $true
        break
    } catch {}
}
if (-not $ready) {
    Write-Host "[!] Sunucu başlatılamadı, port 3000 kontrol edin." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Sunucu hazır! Ekranlar açılıyor..." -ForegroundColor Green

# Detect monitors via .NET
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens

if ($screens.Count -ge 2) {
    # Extended monitor (secondary) - Display Screen fullscreen
    $extScreen = $screens[1]
    $extX = $extScreen.Bounds.X
    $extY = $extScreen.Bounds.Y
    $extW = $extScreen.Bounds.Width
    $extH = $extScreen.Bounds.Height
    
    Write-Host "[!] Genişletilmiş ekran tespit edildi: $($extScreen.DeviceName)" -ForegroundColor Cyan
    
    # Open Edge/Chrome in kiosk mode on extended monitor
    $displayUrl = "http://localhost:3000/display"
    
    # Try Edge first (Windows default), then Chrome
    $browser = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue
    if (-not $browser) {
        $browser = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
    }
    
    if ($browser) {
        $browserPath = $browser."(default)"
        Start-Process -FilePath $browserPath -ArgumentList "--new-window --start-fullscreen --window-position=$extX,$extY --window-size=$extW,$extH `"$displayUrl`""
        Write-Host "  -> Display ekranı genişletilmiş ekranda açıldı" -ForegroundColor Green
    } else {
        Start-Process "ms-edge:$displayUrl"
        Write-Host "  -> Edge ile display açıldı (manuel tam ekran yapın: F11)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[!] Sadece 1 ekran bulundu. Display ana ekranda açılıyor." -ForegroundColor Yellow
    Start-Process "http://localhost:3000/display"
}

# Open Siramatik on primary monitor (Electron or browser)
$electronPath = ".\release\win-unpacked\Siramatik Banko Paneli.exe"
if (Test-Path $electronPath) {
    Start-Process -FilePath $electronPath
    Write-Host "  -> Siramatik Banko Paneli (Electron) açıldı" -ForegroundColor Green
} else {
    Start-Process "http://localhost:3000/"
    Write-Host "  -> Siramatik ana sayfa (tarayıcı) açıldı" -ForegroundColor Green
}

Write-Host "[3/3] Sistem çalışıyor!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Kapatmak için bu pencereyi kapatın." -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Magenta

# Keep script running to maintain npm process
Read-Host "`nÇıkmak için ENTER'a basın..."

# Cleanup
Stop-Job $serverJob -ErrorAction SilentlyContinue
Remove-Job $serverJob -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
