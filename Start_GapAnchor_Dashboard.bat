@echo off
title GapAnchor Ops Local Dashboard
echo =======================================================
echo     Starting GapAnchor Dashboard Local Server...
echo =======================================================
echo.
echo Please leave this window open! The dashboard requires this 
echo server to run in the background.
echo.

:: Change working directory to the directory where this script is located
cd /d "%~dp0"

:: Fallback if %~dp0 is not the dashboard folder
if not exist "package.json" (
    cd /d "C:\Users\ARUL XAVIER\OneDrive - gapanchor\www.gapanchor.com"
)

echo Your browser will automatically open in a few seconds...
echo.

:: Open the browser automatically after 4 seconds
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"

:: Start the Next.js development server
npm run dev

pause
