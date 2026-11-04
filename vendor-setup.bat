@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [setup] Node.js 22 or newer is required.
  echo [setup] Install it with: winget install -e --id OpenJS.NodeJS.LTS
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [setup] npm was not found next to Node.js.
  exit /b 1
)

node distribution\utils\setup.mjs %*
if errorlevel 1 exit /b 1
endlocal
