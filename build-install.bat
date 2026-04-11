@echo off
title Code Buddy - Build & Install
cd /d "%~dp0"

echo.
echo  ========================================
echo   Code Buddy - Build ^& Global Install
echo  ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo FAILED: npm install
    pause
    exit /b 1
)

echo.
echo [2/3] Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo FAILED: npm run build
    pause
    exit /b 1
)

echo.
echo [3/3] Installing globally...
call npm install -g .
if %errorlevel% neq 0 (
    echo FAILED: npm install -g
    echo Try running as Administrator.
    pause
    exit /b 1
)

echo.
echo  ========================================
echo   Done! Run "buddy" to start.
echo  ========================================
echo.
pause
