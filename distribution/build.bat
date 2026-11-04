@echo off
setlocal
cd /d "%~dp0.."
node distribution\utils\build.mjs %*
if errorlevel 1 exit /b 1
endlocal
