@echo off
cd /d "%~dp0"
title NEXUS v2

echo.
echo  NEXUS v2 - React + Three.js
echo.

:: Vite build --watch dans une fenetre separee (rebuild auto sur sauvegarde)
echo [1/3] Demarrage Vite build --watch...
start "Vite Build" cmd /k node_modules\.bin\vite.cmd build --watch

:: Attente que le premier build soit termine (dist/renderer/index.html)
echo [2/3] Attente du premier build Vite...
:waitbuild
if exist "dist\renderer\index.html" goto :launch
timeout /t 2 /nobreak >nul
goto :waitbuild

:launch
:: Petite pause supplementaire pour que les assets soient bien ecrits
timeout /t 1 /nobreak >nul
echo [3/3] Lancement Electron...
set NODE_ENV=development
set ELECTRON_RUN_AS_NODE=
node_modules\electron\dist\electron.exe .
