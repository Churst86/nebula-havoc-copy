@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed.
    echo Install Node.js from https://nodejs.org/ and run this launcher again.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo npm is not available.
    echo Reinstall Node.js from https://nodejs.org/ and run this launcher again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing project dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

if not exist dist\index.html (
    echo Building the game for local play...
    call npm run build
    if errorlevel 1 (
        echo Build failed.
        pause
        exit /b 1
    )
)

echo Starting local game server...
call npm run preview -- --host 127.0.0.1 --open