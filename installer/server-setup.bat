@echo off
title Siramatik Sunucu Kurulumu
color 0B
setlocal enabledelayedexpansion

echo ============================================
echo     SIRAMATiK SUNUCU KURULUMU
echo ============================================
echo.
echo Hepsi bir arada paket - Internet gerekmez

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

:: ===== 3000 PORT KONTROL =====
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 3000 portu kullanimda! Mevcut uygulamayi durdurun.
    pause & exit /b 1
)

:: ===== VC++ REDIST KONTROL =====
if not exist "%SystemRoot%\System32\vcruntime140.dll" (
    echo.
    echo [!] VC++ Redistributable gerekli, kuruluyor...
    if exist "%~dp0vc_redist.x64.exe" (
        start /wait "" "%~dp0vc_redist.x64.exe" /install /quiet /norestart
        if !errorlevel! equ 0 ( echo [OK] VC++ Redistributable kuruldu
        ) else ( echo [!] VC++ kurulumu uyariyla bitti )
    ) else ( echo [!] vc_redist.x64.exe pakette bulunamadi! )
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
mkdir "%INSTALL_DIR%\node" 2>nul

xcopy /E /I /Y "%~dp0server" "%INSTALL_DIR%\server\" >nul 2>&1 && echo [OK] Sunucu dosyalari
xcopy /E /I /Y "%~dp0client" "%INSTALL_DIR%\client\" >nul 2>&1 && echo [OK] Web arayuz
xcopy /E /I /Y "%~dp0shared" "%INSTALL_DIR%\shared\" >nul 2>&1 && echo [OK] Paylasimli dosyalar
if exist "%~dp0release" (
    xcopy /E /I /Y "%~dp0release" "%INSTALL_DIR%\release\" >nul 2>&1 && echo [OK] Medya dosyalari
)
if exist "%~dp0node" (
    xcopy /E /I /Y "%~dp0node" "%INSTALL_DIR%\node\" >nul 2>&1 && echo [OK] Node.js
)
if exist "%~dp0node_modules" (
    xcopy /E /I /Y "%~dp0node_modules" "%INSTALL_DIR%\node_modules\" >nul 2>&1 && echo [OK] JavaScript paketleri
)
if exist "%~dp0siramatik.db" (
    copy /Y "%~dp0siramatik.db" "%INSTALL_DIR%\" >nul 2>&1 && echo [OK] Veritabani
)
if exist "%~dp0package.json" (
    copy /Y "%~dp0package.json" "%INSTALL_DIR%\" >nul 2>&1 && echo [OK] Paket yapilandirmasi
)

:: ===== BASLATMA DOSYASI =====
echo.
echo --------------------------------------------
echo     YAPILANDIRMA
echo --------------------------------------------
if exist "%INSTALL_DIR%\node\node.exe" (
    set NODE_PATH=%INSTALL_DIR%\node\node.exe
) else (
    set NODE_PATH=node
)

:: .env dosyasi
if not exist "%INSTALL_DIR%\.env" (
    set JWT_SECRET_TMP=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
    (
        echo PORT=3000
        echo NODE_ENV=production
        echo JWT_SECRET=%JWT_SECRET_TMP%
    ) > "%INSTALL_DIR%\.env"
    echo [OK] .env dosyasi olusturuldu
) else ( echo [OK] .env mevcut )

:: baslat.bat
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo set NODE_ENV=production
echo set PATH=%%CD%%\node;%%PATH%%
echo start /B %NODE_PATH% server\index.js
echo echo Siramatik sunucusu calisiyor.
echo echo Admin panel: http://localhost:3000/admin
echo pause
) > "%INSTALL_DIR%\baslat.bat"
echo [OK] baslat.bat olusturuldu

:: Windows gorev zamanlayiciya ekle
schtasks /Create /TN "SiramatikServer" /TR "'%INSTALL_DIR%\baslat.bat'" /SC ONSTART /DELAY 0001:00 /RL HIGHEST /F >nul 2>&1
if %errorlevel% equ 0 ( echo [OK] Bilgisayar acilinca otomatik baslar
) else ( echo [!] Otomatik baslatma ayarlanamadi )

:: Guvenlik duvari
netsh advfirewall firewall add rule name="Siramatik Server" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
echo [OK] Guvenlik duvari izni eklendi

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
echo Internet gerekmeden kurulum yapildi.
echo.
pause
