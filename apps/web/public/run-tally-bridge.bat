@echo off
title FrePilot Tally Bridge
color 0A
echo.
echo  ==============================================
echo    FrePilot Tally Bridge - Starting...
echo  ==============================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
  color 0C
  echo  ERROR: Node.js is not installed.
  echo.
  echo  Please download and install Node.js from:
  echo  https://nodejs.org
  echo.
  echo  After installing, close this window and
  echo  double-click run-tally-bridge.bat again.
  echo.
  pause
  exit /b 1
)

:: Run the bridge script from the same folder as this .bat file
node "%~dp0tally-bridge.js"

echo.
echo  Bridge stopped.
pause
