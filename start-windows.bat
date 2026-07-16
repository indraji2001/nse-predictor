@echo off
REM ============================================================
REM   NSE Stock Predictor - Windows One-Click Start Script
REM ============================================================
REM
REM   Just double-click this file to start the app.
REM
REM   First run takes 2-3 minutes (installs dependencies).
REM   Subsequent runs take ~5 seconds.
REM
REM   To stop: close this window or press Ctrl+C
REM
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   NSE Stock Predictor - Starting...
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo.
    echo Please install Node.js 18+ from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found:
call node --version
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo [SETUP] Creating .env file...
    echo DATABASE_URL="file:./db/custom.db" > .env
    echo [OK] .env created.
    echo.
)

REM Install dependencies on first run
if not exist "node_modules" (
    echo [SETUP] First run - installing dependencies...
    echo [SETUP] This will take 2-3 minutes. Please be patient.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        echo Try running: npm install
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
    echo.
)

REM Set up the database on first run
if not exist "db\custom.db" (
    echo [SETUP] Setting up local database...
    if not exist "db" mkdir db
    call npx prisma generate
    call npx prisma db push
    echo.
    echo [OK] Database ready.
    echo.
)

REM Create data folder for NSE bhavcopy uploads
if not exist "data\bhavcopy" mkdir data\bhavcopy

REM Start the app
echo ============================================================
echo   Starting the predictor...
echo   Your browser will open automatically at:
echo   http://localhost:3000
echo.
echo   To stop the app: close this window or press Ctrl+C
echo ============================================================
echo.

REM Open browser after 5 seconds
start "" /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

REM Run the dev server (this keeps running until window closes)
call npm run dev

pause
