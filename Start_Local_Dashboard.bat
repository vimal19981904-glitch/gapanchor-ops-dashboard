@echo off
title GapAnchor Ops Local Dashboard
echo =======================================================
echo     Starting GapAnchor Ops Local Dashboard...
echo =======================================================
echo.

:: Change working directory to the directory where this script is located
cd /d "%~dp0"

:: Fallback if %~dp0 is not the dashboard folder
if not exist "package.json" (
    cd /d "C:\Users\ARUL XAVIER\OneDrive - gapanchor\www.gapanchor.com"
)

echo Starting local dev server on http://localhost:3000...
echo Opening browser in 4 seconds...
echo.

:: Open the browser automatically after 4 seconds
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"

:: Start the Next.js development server
npm run dev

pause
