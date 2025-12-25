@echo off
:: Code Buddy CLI Wrapper for Windows
:: This script runs Code Buddy using the bundled Node.js runtime

setlocal EnableDelayedExpansion

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

:: Set up Node.js path
set "NODE_EXE=%SCRIPT_DIR%node\node.exe"

:: Check if bundled Node.js exists
if not exist "%NODE_EXE%" (
    :: Fall back to system Node.js
    where node >nul 2>&1
    if errorlevel 1 (
        echo Error: Node.js is not installed. Please install Node.js or reinstall Code Buddy.
        exit /b 1
    )
    set "NODE_EXE=node"
)

:: Set environment variables
set "NODE_ENV=production"
set "CODEBUDDY_HOME=%APPDATA%\codebuddy"

:: Create config directory if it doesn't exist
if not exist "%CODEBUDDY_HOME%" mkdir "%CODEBUDDY_HOME%"

:: Run Code Buddy
"%NODE_EXE%" "%SCRIPT_DIR%dist\index.js" %*
