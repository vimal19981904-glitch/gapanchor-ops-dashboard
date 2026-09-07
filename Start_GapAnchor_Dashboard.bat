@echo off
echo =======================================================
echo     Starting GapAnchor Dashboard Local Server...
echo =======================================================
echo.
echo Please leave this window open! The dashboard requires this 
echo server to run in the background to sync your Outlook emails.
echo.
echo Your browser will automatically open in a few seconds...

cd /d "C:\Users\ARUL XAVIER\OneDrive - gapanchor\dashboard"

:: Open the browser automatically after 5 seconds to give the server time to start
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3001/enquiries'"

:: Start the Next.js development server
npm run dev

pause
