; Siramatik Sunucu Kurulumu - NSIS Installer Script
; Derlemek icin: makensis.exe ServerSetup.nsi

Unicode true
RequestExecutionLevel admin

!define PRODUCT_NAME "Siramatik Sunucu"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Siramatik"
!define PRODUCT_WEB_SITE "http://localhost:3000"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\SiramatikServer.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "Siramatik-Server-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES\Siramatik\Server"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstallDetails show

; Includes
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "TextFunc.nsh"
!include "WordFunc.nsh"
!include "nsDialogs.nsh"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE" ; Will be created if not exists
Page custom PortPage PortPageLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "Turkish"
!insertmacro MUI_LANGUAGE "English"

; Variables
Var Port
Var PortEdit

Function PortPage
    !insertmacro MUI_HEADER_TEXT "Port Ayarlari" "Siramatik sunucu port numarasini girin"
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateLabel} 0 0 100% 12u "Sunucu Port Numarasi (varsayilan: 3000):"
    Pop $0
    
    ${NSD_CreateNumber} 0 15u 100% 12u "3000"
    Pop $PortEdit
    
    nsDialogs::Show
FunctionEnd

Function PortPageLeave
    ${NSD_GetText} $PortEdit $Port
    IntCmp $Port 1 0 +2 +2
    StrCpy $Port "3000"
FunctionEnd

Section "Kurulum" SEC01
    SetOutPath "$INSTDIR"
    
    ; Copy server files
    File /r "..\server\*.js"
    File /r "..\server\*.json"
    
    ; Copy client build
    SetOutPath "$INSTDIR\client"
    File /r "..\dist\public\*.*"
    
    ; Copy release media
    SetOutPath "$INSTDIR\release"
    File /r "..\release\*.*"
    
    ; Copy shared 
    SetOutPath "$INSTDIR\shared"
    File /r "..\shared\*.*"
    
    ; Copy root files
    SetOutPath "$INSTDIR"
    File "..\package.json"
    File "..\baslat.ps1"
    
    ; Copy database if exists
    IfFileExists "..\siramatik.db" 0 +2
    File "..\siramatik.db"
    
    ; Copy start script
    FileOpen $9 "$INSTDIR\start-server.bat" w
    FileWrite $9 "@echo off$\r$\n"
    FileWrite $9 "cd /d $INSTDIR$\r$\n"
    FileWrite $9 "npm install --production$\r$\n"
    FileWrite $9 "set NODE_ENV=production$\r$\n"
    FileWrite $9 "node server/index.js$\r$\n"
    FileWrite $9 "pause$\r$\n"
    FileClose $9
    
    ; Create start.bat with port config
    FileOpen $9 "$INSTDIR\start.bat" w
    FileWrite $9 "@echo off$\r$\n"
    FileWrite $9 "set PORT=$Port$\r$\n"
    FileWrite $9 "cd /d $INSTDIR$\r$\n"
    FileWrite $9 "set NODE_ENV=production$\r$\n"
    FileWrite $9 "npm install --production 2>nul$\r$\n"
    FileWrite $9 "node server/index.js$\r$\n"
    FileClose $9
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\Siramatik"
    CreateShortCut "$SMPROGRAMS\Siramatik\Admin Panel.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\start.bat" 0
    CreateShortCut "$DESKTOP\Siramatik Admin Panel.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\start.bat" 0
    
    ; Registry
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\start.bat"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    
    ; Firewall rule
    SimpleFC::AddPort "$Port" "Siramatik Server TCP" 6 1 "" 1
    Pop $0
    
SectionEnd

Section "Gorev Zamanlayici" SEC02
    ; Add scheduled task for auto-start on boot
    nsExec::ExecToStack 'schtasks /Create /TN "SiramatikServer" /TR "cmd.exe /c start.bat" /SC ONSTART /RL HIGHEST /F'
SectionEnd

Section "Uninstall"
    ; Stop processes
    nsExec::ExecToStack 'taskkill /f /im node.exe 2>nul'
    
    ; Remove scheduled task
    nsExec::ExecToStack 'schtasks /Delete /TN "SiramatikServer" /F 2>nul'
    
    ; Remove firewall rule
    SimpleFC::RemovePort "3000" 6
    
    ; Remove registry
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    
    ; Remove files
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\Siramatik\*.*"
    RMDir "$SMPROGRAMS\Siramatik"
    Delete "$DESKTOP\Siramatik Admin Panel.lnk"
    
    SetAutoClose true
SectionEnd
