@echo off
setlocal
cd /d "%~dp0.."

if exist "distribution\build-results\win-unpacked\Trolley Remastered.exe" (
  start "" "distribution\build-results\win-unpacked\Trolley Remastered.exe"
  exit /b 0
)

echo Build not found. Run distribution\build.bat first.
exit /b 1
