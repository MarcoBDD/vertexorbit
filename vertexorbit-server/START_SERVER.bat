@echo off
title VerteXOrbit - Server
color 0A

echo ============================================
echo   VerteXOrbit Server - Avvio
echo ============================================
echo.

cd /d "%~dp0"

if not exist "node_modules\" (
    echo [!] node_modules non trovato. Installo le dipendenze...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERRORE] npm install fallito. Verifica che Node.js sia installato.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dipendenze installate.
    echo.
)

echo [>>] Avvio server su porta 8080...
echo.
node server.js

echo.
echo [!] Server terminato.
pause
