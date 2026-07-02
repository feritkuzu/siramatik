@echo off
title Siramatik Banko Kurulumu
color 0B
setlocal enabledelayedexpansion

echo ============================================
echo    SIRAMATiK BANKO KURULUMU
echo ============================================
echo.

:: Admin kontrol
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Yonetici olarak calistirin!
    pause & exit /b 1
)

:: Edge/Chrome kontrol
set BROWSER=msedge
where msedge >nul 2>&1 || (
    where chrome >nul 2>&1 && set BROWSER=chrome || (
        echo [!] Microsoft Edge veya Chrome gerekli!
        pause & exit /b 1
    )
)
echo [OK] Tarayici: %BROWSER%

:: Sunucu bilgileri
echo.
echo --------------------------------------------
echo     SUNUCU BILGILERI
echo --------------------------------------------
set /p SERVER_IP=Sunucu IP adresi: 
if "!SERVER_IP!"=="" set SERVER_IP=192.168.1.100

set /p PORT=Port (varsayilan 3000): 
if "!PORT!"=="" set PORT=3000

:: Kullanim sekli
echo.
echo --------------------------------------------
echo     KULLANIM SEKLI
echo --------------------------------------------
echo 1 - Display Ekrani (musteri ekrani, 2.monitor - SESLI)
echo 2 - Banko Paneli (personel bilgisayari)
echo 3 - Kiosk (sira numarasi alma)
set /p MODE=Secim (1-3): 
if "!MODE!"=="" set MODE=1

if "!MODE!"=="1" set MODE_NAME=Display & set NEED_ELECTRON=1
if "!MODE!"=="2" set MODE_NAME=Banko & set NEED_ELECTRON=0
if "!MODE!"=="3" set MODE_NAME=Kiosk & set NEED_ELECTRON=0

set INSTALL_DIR=C:\Siramatik\!MODE_NAME!
set SERVER_URL=http://!SERVER_IP!:!PORT!

if "!MODE!"=="1" set PAGE=/display
if "!MODE!"=="2" set PAGE=/bank
if "!MODE!"=="3" set PAGE=/kiosk

:: Display modu icin Electron indir
if "!NEED_ELECTRON!"=="1" (
    echo.
    echo --------------------------------------------
    echo     DISPLAY EKRANI ICIN ELECTRON
    echo --------------------------------------------
    echo Display modunda sesin calismasi icin
    echo Electron tarayici gereklidir.
    echo.
    
    set ELECTRON_DIR=!INSTALL_DIR!\electron
    if exist "!ELECTRON_DIR!\electron.exe" (
        echo [OK] Electron zaten mevcut
    ) else (
        echo Electron indiriliyor...
        mkdir "!ELECTRON_DIR!" 2>nul
        
        :: Once paketteki electron dosyalarini kopyala
        if exist "%~dp0electron" (
            xcopy /E /I /Y "%~dp0electron" "!ELECTRON_DIR!\" >nul 2>&1
        )
        
        :: Electron binary'sini indir (~65 MB)
        set ELECTRON_URL=https://github.com/electron/electron/releases/download/v33.2.1/electron-v33.2.1-win32-x64.zip
        echo Indirme adresi: !ELECTRON_URL!
        powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Indiriliyor...'; Invoke-WebRequest -Uri '!ELECTRON_URL!' -OutFile '%TEMP%\electron.zip' -UseBasicParsing } catch { Write-Host 'Hata: ' + $_.Exception.Message; exit 1 }"
        if !errorlevel! equ 0 (
            echo Electron dosyalari aciliyor...
            powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('%TEMP%\electron.zip', '!ELECTRON_DIR!')" >nul 2>&1
            del "%TEMP%\electron.zip" 2>nul
            echo [OK] Electron indirildi
        ) else (
            echo [!] Indirme basarisiz!
            set NEED_ELECTRON=0
        )
    )
)

:: Klasoru olustur
mkdir "!INSTALL_DIR!" 2>nul

:: Launcher script
if "!NEED_ELECTRON!"=="1" (
    :: Display modu - Electron ile
    (
    echo @echo off
    echo set ELECTRON=!INSTALL_DIR!\electron\electron.exe
    echo if not exist "!ELECTRON!" goto use_browser
    echo start "" "!ELECTRON!" "!INSTALL_DIR!\electron\main.cjs" --display
    echo goto end
    echo :use_browser
    echo start "" "!BROWSER!" --new-window --kiosk --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-extensions "!SERVER_URL!!PAGE!"
    echo :end
    ) > "!INSTALL_DIR!\baslat.bat"
) else (
    :: Banko/Kiosk modu - Edge ile
    (
    echo @echo off
    echo start "" "!BROWSER!" --new-window --kiosk --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-extensions "!SERVER_URL!!PAGE!"
    ) > "!INSTALL_DIR!\baslat.bat"
)
echo [OK] Baslatma dosyasi olusturuldu

:: Otomatik baslatma (Windows Startup)
powershell -Command "$s=[Environment]::GetFolderPath('Startup');$WS=New-Object -ComObject WScript.Shell;$lnk=$WS.CreateShortcut([System.IO.Path]::Combine($s,'Siramatik !MODE_NAME!.lnk'));$lnk.TargetPath='!INSTALL_DIR!\baslat.bat';$lnk.Description='Siramatik !MODE_NAME!';$lnk.Save()" >nul 2>&1
echo [OK] Windows acilinca otomatik baslar

:: Masaustu kisa yolu
powershell -Command "$WS=New-Object -ComObject WScript.Shell;$lnk=$WS.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Siramatik !MODE_NAME!.lnk');$lnk.TargetPath='!INSTALL_DIR!\baslat.bat';$lnk.Description='Siramatik !MODE_NAME!';$lnk.Save()" >nul 2>&1
echo [OK] Masaustu kisa yolu olusturuldu

:: Kaldirma scripti
(
echo @echo off
echo echo Siramatik !MODE_NAME! kaldiriliyor...
echo taskkill /f /im electron.exe /im msedge.exe /im chrome.exe 2^>nul
echo rmdir /s /q "!INSTALL_DIR!"
echo del "%USERPROFILE%\Desktop\Siramatik !MODE_NAME!.lnk" 2^>nul
echo del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Siramatik !MODE_NAME!.lnk" 2^>nul
echo echo Kaldirma tamamlandi.
echo pause
) > "!INSTALL_DIR!\kaldir.bat"
echo [OK] Kaldirma scripti: !INSTALL_DIR!\kaldir.bat

echo.
echo ============================================
echo    KURULUM TAMAMLANDI!
echo ============================================
echo.
echo Mod: !MODE_NAME!
echo Sunucu: !SERVER_URL!
echo Klasor: !INSTALL_DIR!
echo.
echo Bilgisayar her acildiginda otomatik baslar.
echo Kaldirmak icin: !INSTALL_DIR!\kaldir.bat
echo.
pause
