# Sıramatik Sistemi - Windows PowerShell Kurulum Scripti

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Siramatik Sistemi - Windows Kurulum" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Node.js kontrol et
Write-Host "Kontrol ediliyor: Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: Node.js yüklü degil!" -ForegroundColor Red
    Write-Host "Lutfen Node.js'i indir ve kur: https://nodejs.org/" -ForegroundColor Red
    Read-Host "Devam etmek için Enter'e bas"
    exit 1
}
Write-Host "Node.js sürümü: $nodeVersion" -ForegroundColor Green

# pnpm kontrol et
Write-Host "Kontrol ediliyor: pnpm..." -ForegroundColor Yellow
$pnpmVersion = pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "pnpm yükleniyor..." -ForegroundColor Yellow
    npm install -g pnpm
}
$pnpmVersion = pnpm --version
Write-Host "pnpm sürümü: $pnpmVersion" -ForegroundColor Green

# Bağımlılıkları yükle
Write-Host ""
Write-Host "Bagimliliklar yükleniyor..." -ForegroundColor Yellow
pnpm install

# Dev server'ı başlat
Write-Host ""
Write-Host "Dev server baslatiliyor..." -ForegroundColor Cyan
Write-Host "Sistem http://localhost:3000 adresinde çalişacak" -ForegroundColor Cyan
Write-Host ""

pnpm run dev

Read-Host "Devam etmek için Enter'e bas"
