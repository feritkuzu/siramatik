; Siramatik Banko Kurulumu - NSIS Installer Script
; Derlemek icin: makensis.exe BankSetup.nsi

Unicode true
RequestExecutionLevel admin

!define PRODUCT_NAME "Siramatik Banko"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Siramatik"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "Siramatik-Banko-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES\Siramatik\Banko"
ShowInstallDetails show

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"

!insertmacro MUI_PAGE_WELCOME
Page custom ServerPage ServerPageLeave
Page custom ModePage ModePageLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Turkish"
!insertmacro MUI_LANGUAGE "English"

; Variables
Var ServerIP
Var ServerIPEdit
Var ServerPort
Var ServerPortEdit
Var Mode
Var ModeRadioDisplay
Var ModeRadioBank
Var ModeRadioKiosk

Function ServerPage
    !insertmacro MUI_HEADER_TEXT "Sunucu Bilgileri" "Siramatik sunucusunun IP adresini girin"
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateLabel} 0 0 100% 12u "Sunucu IP Adresi (ornek: 192.168.1.100):"
    Pop $0
    ${NSD_CreateText} 0 15u 100% 12u "192.168.1.100"
    Pop $ServerIPEdit
    
    ${NSD_CreateLabel} 0 35u 100% 12u "Sunucu Portu (varsayilan: 3000):"
    Pop $0
    ${NSD_CreateNumber} 0 50u 100% 12u "3000"
    Pop $ServerPortEdit
    
    nsDialogs::Show
FunctionEnd

Function ServerPageLeave
    ${NSD_GetText} $ServerIPEdit $ServerIP
    ${NSD_GetText} $ServerPortEdit $ServerPort
    StrCmp $ServerPort "" 0 +2
    StrCpy $ServerPort "3000"
FunctionEnd

Function ModePage
    !insertmacro MUI_HEADER_TEXT "Kullanım Modu" "Banko bilgisayarinin kullanım şeklini secin"
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateLabel} 0 0 100% 12u "Bu bilgisayarin kullanim amacini secin:"
    Pop $0
    
    ${NSD_CreateRadioButton} 0 20u 100% 12u "Display Ekrani (2. monitorde musteri ekrani)"
    Pop $ModeRadioDisplay
    
    ${NSD_CreateRadioButton} 0 38u 100% 12u "Banko Paneli (personel bilgisayari)"
    Pop $ModeRadioBank
    
    ${NSD_CreateRadioButton} 0 56u 100% 12u "Kiosk (sira numarasi alma)"
    Pop $ModeRadioKiosk
    
    ${NSD_Check} $ModeRadioDisplay
    
    nsDialogs::Show
FunctionEnd

Function ModePageLeave
    ${NSD_GetState} $ModeRadioDisplay $0
    ${NSD_GetState} $ModeRadioBank $1
    ${NSD_GetState} $ModeRadioKiosk $2
    
    StrCpy $Mode "display"
    IntCmp $1 1 0 +2 +2
    StrCpy $Mode "bank"
    IntCmp $2 1 0 +2 +2
    StrCpy $Mode "kiosk"
FunctionEnd

Section "Kurulum" SEC01
    SetOutPath "$INSTDIR"
    
    ; Create config
    FileOpen $9 "$INSTDIR\config.json" w
    FileWrite $9 '{$\r$\n'
    FileWrite $9 '  "serverUrl": "http://$ServerIP:$ServerPort",$\r$\n'
    FileWrite $9 '  "mode": "$Mode",$\r$\n'
    FileWrite $9 '  "installDate": "$%DATE% $%TIME%"$\r$\n'
    FileWrite $9 '}$\r$\n'
    FileClose $9
    
    ; Detect browser and create launcher scripts
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" ""
    StrCmp $0 "" 0 +4
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" ""
    StrCmp $0 "" browser_not_found +3
    
    ; Create launcher bat file
    FileOpen $9 "$INSTDIR\launcher.bat" w
    FileWrite $9 '@echo off$\r$\n'
    FileWrite $9 "set URL=http://$ServerIP:$ServerPort/$\r$\n"
    
    StrCmp $Mode "display" create_display
    StrCmp $Mode "bank" create_bank
    StrCmp $Mode "kiosk" create_kiosk
    
create_display:
    FileWrite $9 "set URL=http://$ServerIP:$ServerPort/display$\r$\n"
    goto launcher_end
    
create_bank:
    FileWrite $9 "set URL=http://$ServerIP:$ServerPort/bank$\r$\n"
    goto launcher_end
    
create_kiosk:
    FileWrite $9 "set URL=http://$ServerIP:$ServerPort/kiosk$\r$\n"
    goto launcher_end
    
launcher_end:
    FileWrite $9 '"$0" --no-first-run --no-default-browser-check --disable-extensions --kiosk --edge-kiosk-type=fullscreen --new-window "%%URL%%"$\r$\n'
    FileClose $9
    goto launcher_done
    
browser_not_found:
    FileOpen $9 "$INSTDIR\launcher.bat" w
    FileWrite $9 '@echo off$\r$\n'
    FileWrite $9 "echo Lutfen Microsoft Edge yukleyin!$\r$\n"
    FileWrite $9 "pause$\r$\n"
    FileClose $9
    
launcher_done:
    ; Copy Electron files if in display mode
    StrCmp $Mode "display" 0 skip_electron
    SetOutPath "$INSTDIR\electron"
    File /r "..\electron\*.cjs"
    SetOutPath "$INSTDIR"
    
skip_electron:
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\Siramatik"
    CreateShortCut "$SMPROGRAMS\Siramatik\Siramatik.lnk" "$INSTDIR\launcher.bat" "" "$INSTDIR\launcher.bat" 0
    CreateShortCut "$DESKTOP\Siramatik.lnk" "$INSTDIR\launcher.bat" "" "$INSTDIR\launcher.bat" 0
    
    ; Auto-start for all users
    StrCmp $Mode "display" 0 +2
    CreateShortCut "$SMSTARTUP\Siramatik Display.lnk" "$INSTDIR\launcher.bat" "" "$INSTDIR\launcher.bat" 0
    StrCmp $Mode "bank" 0 +2
    CreateShortCut "$SMSTARTUP\Siramatik Banko.lnk" "$INSTDIR\launcher.bat" "" "$INSTDIR\launcher.bat" 0
    StrCmp $Mode "kiosk" 0 +2
    CreateShortCut "$SMSTARTUP\Siramatik Kiosk.lnk" "$INSTDIR\launcher.bat" "" "$INSTDIR\launcher.bat" 0
    
    ; Registry
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    
SectionEnd

Section "Uninstall"
    ; Stop browser
    nsExec::ExecToStack 'taskkill /f /im msedge.exe 2>nul'
    nsExec::ExecToStack 'taskkill /f /im chrome.exe 2>nul'
    
    ; Remove registry
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    
    ; Remove files
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\Siramatik\*.*"
    RMDir "$SMPROGRAMS\Siramatik"
    Delete "$DESKTOP\Siramatik.lnk"
    Delete "$SMSTARTUP\Siramatik Display.lnk"
    Delete "$SMSTARTUP\Siramatik Banko.lnk"
    Delete "$SMSTARTUP\Siramatik Kiosk.lnk"
    
    SetAutoClose true
SectionEnd
