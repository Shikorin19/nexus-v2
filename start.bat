@echo off
cd /d "%~dp0"
title NEXUS v2

echo.
echo  NEXUS v2 - React + Three.js
echo.

:: Liberation du port 5173 si deja occupe
echo [0/3] Verification port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
  echo  ^ Port 5173 occupe par PID %%a - liberation...
  taskkill /F /PID %%a >nul 2>&1
)

:: Vite dans une fenetre separee
echo [1/3] Demarrage Vite sur :5173...
start "Vite" cmd /k node_modules\.bin\vite.cmd

:: Attente simple
echo [2/3] Attente 5 secondes...
timeout /t 5 /nobreak >nul

:: Electron
echo [3/3] Lancement Electron...
set NODE_ENV=development
set ELECTRON_RUN_AS_NODE=
node_modules\electron\dist\electron.exe .
