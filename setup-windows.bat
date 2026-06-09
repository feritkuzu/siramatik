@echo off
REM Sıramatik Sistemi - Windows Kurulum Scripti
REM Bu script Windows ortamında projeyi çalıştırmak için gerekli adımları yapar

echo.
echo ===================================
echo Siramatik Sistemi - Windows Kurulum
echo ===================================
echo.

REM Node.js ve npm kontrol et
echo Kontrol ediliyor: Node.js ve npm...
node --version >nul 2>&1
if errorlevel 1 (
    echo HATA: Node.js yüklü degil!
    echo Lutfen Node.js'i indir ve kur: https://nodejs.org/
    pause
    exit /b 1
)

REM pnpm kontrol et
echo Kontrol ediliyor: pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo pnpm yükleniyor...
    npm install -g pnpm
)

REM Bağımlılıkları yükle
echo.
echo Bagimliliklar yükleniyor...
call pnpm install

REM Veritabanı migration'larını çalıştır
echo.
echo Veritabani migration'lari çalıstiriliyor...
call pnpm drizzle-kit generate

REM Dev server'ı başlat
echo.
echo Dev server baslatiliyor...
echo Sistem http://localhost:3000 adresinde çalişacak
call pnpm run dev

pause
