@echo off
setlocal

cd /d "%~dp0"

:: ── Prefer freshly built desktop EXE (electron-packager output) ──────────────
set "EXE_UNPACKED=%~dp0release\win-unpacked\Nebula Havoc.exe"
set "EXE_DESKTOP=%~dp0release\desktop\Nebula Havoc-win32-x64\Nebula Havoc.exe"

if exist "%EXE_DESKTOP%" (
    echo Launching Nebula Havoc (desktop)...
    start "" "%EXE_DESKTOP%"
    exit /b 0
)

if exist "%EXE_UNPACKED%" (
    echo Launching Nebula Havoc (desktop)...
    start "" "%EXE_UNPACKED%"
    exit /b 0
)

:: ── Fallback: build and launch via Electron dev mode ────────────────────────
echo No pre-built EXE found. Falling back to dev launch...

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed.
    echo Install Node.js from https://nodejs.org/ then run this launcher again.
    echo Alternatively, download the desktop EXE from:
    echo   https://github.com/Churst86/nebula-havoc-copy/releases/latest
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo npm is not available.
    echo Reinstall Node.js from https://nodejs.org/ then run this launcher again.
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

echo Building desktop web assets...
call npm run build:desktop:web
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo Starting Electron desktop app...
start "" npx electron .