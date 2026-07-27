@echo off
title Siramatik Sunucu Kurulumu
color 0B
setlocal enabledelayedexpansion

set NODE_VERSION=v22.14.0
set NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip

echo ============================================
echo     SIRAMATiK SUNUCU KURULUMU
echo ============================================
echo.
echo Bu program sunucu bilgisayarina kurulum yapar.

:: ===== ADMIN KONTROL =====
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Yonetici olarak calistirin!
    echo     Dosyaya sag tiklayip "Yonetici olarak calistir" secin.
    pause & exit /b 1
)
echo [OK] Yonetici yetkisi mevcut

:: ===== KURULUM KLASORU =====
set INSTALL_DIR=C:\Siramatik\Server
echo.
echo Kurulum klasoru: %INSTALL_DIR%
set /p USER_DIR=Degistirmek icin yazin (bos=birak): 
if not "%USER_DIR%"=="" set INSTALL_DIR=%USER_DIR%

:: ===== NODE.JS KONTROL ve INDIRME =====
echo.
echo --------------------------------------------
echo     NODE.JS KONTROLU
echo --------------------------------------------

set NODE_CMD=node
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VER=%%a
    for /f "tokens=1 delims=." %%a in ("!NODE_VER!") do set NODE_MAJOR=%%a
    if !NODE_MAJOR! GEQ 18 (
        echo [OK] Node.js !NODE_VER! mevcut
        goto node_ok
    ) else (
        echo [!] Node.js surumu cok eski: !NODE_VER!
    )
)

echo [!] Node.js bulunamadi veya cok eski!
echo.
echo Node.js %NODE_VERSION% otomatik indirilecek.
echo Indirme adresi: %NODE_URL%
echo.
echo Internet baglantisi gerekiyor.
set /p DOWNLOAD_NODE=Indirilsin mi? (E/H): 
if /i "!DOWNLOAD_NODE!"=="H" (
    echo Lutfen https://nodejs.org adresinden Node.js 18+ kurun.
    pause & exit /b 1
)

echo.
echo Node.js indiriliyor...
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%TEMP%\node.zip' -UseBasicParsing; Write-Host '[OK] Indirme tamam' } catch { Write-Host '[!] Indirme hatasi: ' + $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [!] Indirme basarisiz! Internet baglantinizi kontrol edin.
    pause & exit /b 1
)

echo Node.js aciliyor...
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('%TEMP%\node.zip', '%TEMP%\node-extract')"
if exist "%TEMP%\node-extract\node-%NODE_VERSION%-win-x64" (
    mkdir "%INSTALL_DIR%\node" 2>nul
    xcopy /E /I /Y "%TEMP%\node-extract\node-%NODE_VERSION%-win-x64\*" "%INSTALL_DIR%\node\" >nul
    set NODE_CMD="%INSTALL_DIR%\node\node.exe"
    echo [OK] Node.js %NODE_VERSION% kuruldu
) else (
    echo [!] Node.js dosyalari bulunamadi!
    pause & exit /b 1
)
rmdir /s /q "%TEMP%\node-extract" 2>nul
del "%TEMP%\node.zip" 2>nul

:node_ok

:: ===== 3000 PORT KONTROL =====
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 3000 portu kullanimda! Mevcut uygulamayi durdurun.
    pause & exit /b 1
)

:: ===== KLASORLERI OLUSTUR =====
echo.
echo --------------------------------------------
echo     DOSYALAR KOPYALANIYOR
echo --------------------------------------------
mkdir "%INSTALL_DIR%\server" 2>nul
mkdir "%INSTALL_DIR%\client" 2>nul
mkdir "%INSTALL_DIR%\release\Media\Notification" 2>nul
mkdir "%INSTALL_DIR%\shared" 2>nul

xcopy /E /I /Y "%~dp0server" "%INSTALL_DIR%\server\" >nul 2>&1 && echo [OK] Sunucu dosyalari
xcopy /E /I /Y "%~dp0client" "%INSTALL_DIR%\client\" >nul 2>&1 && echo [OK] Web arayuz
xcopy /E /I /Y "%~dp0shared" "%INSTALL_DIR%\shared\" >nul 2>&1 && echo [OK] Paylasimli dosyalar
if exist "%~dp0release" (
    xcopy /E /I /Y "%~dp0release" "%INSTALL_DIR%\release\" >nul 2>&1 && echo [OK] Medya dosyalari
)
if exist "%~dp0siramatik.db" (
    copy /Y "%~dp0siramatik.db" "%INSTALL_DIR%\" >nul 2>&1 && echo [OK] Veritabani
)
if exist "%~dp0package.json" (
    copy /Y "%~dp0package.json" "%INSTALL_DIR%\" >nul 2>&1 && echo [OK] Paket yapilandirmasi
)

:: ===== BAGIMLILIKLARI YUKLE =====
echo.
echo --------------------------------------------
echo     BAGIMLILIKLAR YUKLENIYOR
echo --------------------------------------------
echo Bu islem internet gerektirir, bir kac dakika surebilir...
cd /d "%INSTALL_DIR%"
if exist "!NODE_CMD!" (
    set "PATH=!INSTALL_DIR!\node;!PATH!"
    "!NODE_CMD!" "!INSTALL_DIR!\node\node_modules\npm\bin\npm-cli.js" install --production --legacy-peer-deps --ignore-scripts
) else (
    call npm install --production --legacy-peer-deps --ignore-scripts
)
if %errorlevel% neq 0 (
    echo [!] Bagimliliklar yuklenemedi!
    pause & exit /b 1
)
echo [OK] Bagimliliklar yuklendi

:: ===== BASLATMA DOSYASI =====
echo.
echo --------------------------------------------
echo     OTOMATIK BASLATMA
echo --------------------------------------------
if exist "%INSTALL_DIR%\node\node.exe" (
    set NODE_PATH=%INSTALL_DIR%\node\node.exe
) else (
    set NODE_PATH=node
)

(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo set NODE_ENV=production
echo set PATH=%%CD%%\node;%%PATH%%
echo for /f "tokens=*" %%%%a in ('type .env') do set "%%%%a" 2^>nul
echo start /B %NODE_PATH% server\index.js
echo echo Siramatik sunucusu calisiyor.
echo echo Admin panel: http://localhost:3000/admin
echo pause
) > "%INSTALL_DIR%\baslat.bat"

:: Windows gorev zamanlayiciya ekle
schtasks /Create /TN "SiramatikServer" /TR "'%INSTALL_DIR%\baslat.bat'" /SC ONSTART /DELAY 0001:00 /RL HIGHEST /F >nul 2>&1
if %errorlevel% equ 0 ( echo [OK] Bilgisayar acilinca otomatik baslar
) else ( echo [!] Otomatik baslatma ayarlanamadi )

:: Guvenlik duvari
netsh advfirewall firewall add rule name="Siramatik Server" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
echo [OK] Guvenlik duvari izni eklendi

:: .env dosyasi
if not exist "%INSTALL_DIR%\.env" (
    set JWT_SECRET_TMP=%RANDOM%%RANDOM%%RANDOM%
    (
        echo PORT=3000
        echo NODE_ENV=production
        echo JWT_SECRET=%JWT_SECRET_TMP%
    ) > "%INSTALL_DIR%\.env"
    echo [OK] .env dosyasi olusturuldu
) else ( echo [OK] .env mevcut )

:: Masaustu kisa yolu
powershell -Command "$WS=New-Object -ComObject WScript.Shell;$WS=New-Object -ComObject WScript.Shell;$lnk=$WS.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Siramatik Admin.lnk');$lnk.TargetPath='%INSTALL_DIR%\baslat.bat';$lnk.Description='Siramatik Admin Paneli';$lnk.Save()" >nul 2>&1
echo [OK] Masaustu kisa yolu olusturuldu

echo.
echo ============================================
echo       KURULUM TAMAMLANDI!
echo ============================================
echo.
echo Sunucu: %INSTALL_DIR%
echo Admin: http://localhost:3000/admin
echo Baslat: %INSTALL_DIR%\baslat.bat
echo.
echo NOT: Her Windows acilista otomatik baslar.
echo.
pause
