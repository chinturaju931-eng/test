@echo off
title CommuteAds Marketing Studio
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 or newer, then reopen this file.
  pause
  exit /b 1
)
echo Starting CommuteAds...
echo.
echo Keep this window open while using the app.
echo Once you see "CommuteAds listening on port 3000", open your browser
echo and type this address: http://127.0.0.1:3000
echo.
node server.js
echo.
echo The app has stopped. If an error appeared above, share it for help.
pause
