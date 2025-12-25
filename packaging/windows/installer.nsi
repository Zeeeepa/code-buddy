; Code Buddy Windows Installer Script (NSIS)
; This script creates an installer for Code Buddy CLI

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "EnvVarUpdate.nsh"

; Basic installer configuration
!define PRODUCT_NAME "Code Buddy"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Code Buddy Team"
!define PRODUCT_WEB_SITE "https://github.com/phuetz/code-buddy"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\codebuddy.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"

; Welcome page
!insertmacro MUI_PAGE_WELCOME
; License page
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
; Directory page
!insertmacro MUI_PAGE_DIRECTORY
; Components page
!insertmacro MUI_PAGE_COMPONENTS
; Instfiles page
!insertmacro MUI_PAGE_INSTFILES
; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\codebuddy.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Code Buddy"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language files
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "Spanish"

; Installer attributes
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "CodeBuddy-${PRODUCT_VERSION}-setup.exe"
InstallDir "$PROGRAMFILES\Code Buddy"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

; Sections
Section "Core Files" SEC01
  SectionIn RO ; Required section

  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  ; Main application files
  File /r "..\..\dist\*.*"
  File "..\..\package.json"

  ; Node.js runtime (bundled)
  SetOutPath "$INSTDIR\node"
  File /r "node\*.*"

  ; Wrapper scripts
  SetOutPath "$INSTDIR"
  File "codebuddy.cmd"
  File "codebuddy.exe"

  ; Create config directory
  CreateDirectory "$APPDATA\codebuddy"
SectionEnd

Section "Add to PATH" SEC02
  ; Add to system PATH
  ${EnvVarUpdate} $0 "PATH" "A" "HKLM" "$INSTDIR"
SectionEnd

Section "Desktop Shortcut" SEC03
  CreateShortCut "$DESKTOP\Code Buddy.lnk" "$INSTDIR\codebuddy.exe" "" "$INSTDIR\codebuddy.exe" 0
SectionEnd

Section "Start Menu Shortcuts" SEC04
  CreateDirectory "$SMPROGRAMS\Code Buddy"
  CreateShortCut "$SMPROGRAMS\Code Buddy\Code Buddy.lnk" "$INSTDIR\codebuddy.exe" "" "$INSTDIR\codebuddy.exe" 0
  CreateShortCut "$SMPROGRAMS\Code Buddy\Uninstall.lnk" "$INSTDIR\uninst.exe"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"

  ; Write registry keys
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\codebuddy.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\codebuddy.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"

  ; Calculate and store install size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC01} "Core Code Buddy files (required)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC02} "Add Code Buddy to system PATH for command-line access"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC03} "Create a desktop shortcut"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC04} "Create Start Menu shortcuts"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; Uninstaller
Section Uninstall
  ; Remove from PATH
  ${un.EnvVarUpdate} $0 "PATH" "R" "HKLM" "$INSTDIR"

  ; Remove shortcuts
  Delete "$DESKTOP\Code Buddy.lnk"
  RMDir /r "$SMPROGRAMS\Code Buddy"

  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

  ; Note: Don't remove user config directory
  ; Users may want to keep their settings

  SetAutoClose true
SectionEnd

; Installer Functions
Function .onInit
  ; Check for previous installation
  ReadRegStr $R0 ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString"
  StrCmp $R0 "" done

  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    "${PRODUCT_NAME} is already installed. $\n$\nClick 'OK' to remove the previous version or 'Cancel' to cancel this upgrade." \
    IDOK uninst
  Abort

uninst:
  ClearErrors
  ExecWait '$R0 _?=$INSTDIR'

done:
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd
