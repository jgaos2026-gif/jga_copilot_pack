@echo off
REM Git Installer for Windows
setlocal enabledelayedexpansion

echo Installing Git for Windows...
cd /d "%TEMP%"

REM Download Git installer
powershell -Command "try { Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.45.0.windows.1/Git-2.45.0-64-bit.exe' -OutFile 'git-installer.exe' -ProgressAction SilentlyContinue; Write-Host 'Downloaded successfully' } catch { Write-Host 'Download failed: $_' }"

REM Run installer silently
if exist "git-installer.exe" (
  echo Running Git installer...
  start /wait git-installer.exe /VERYSILENT /NORESTART
  echo Git installation complete
  del git-installer.exe
) else (
  echo Failed to download Git installer
  echo Please download from: https://git-scm.com/download/win
)

pause
