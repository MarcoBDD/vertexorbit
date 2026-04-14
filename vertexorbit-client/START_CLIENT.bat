@echo off
title VerteXOrbit - Client
color 0B

echo ============================================
echo   VerteXOrbit Client - Avvio locale
echo ============================================
echo.

cd /d "%~dp0"

:: Prova con npx serve (non richiede installazione globale)
where npx >nul 2>nul
if %errorlevel%==0 (
    echo [>>] Avvio server locale con npx serve...
    echo [>>] Apri il browser su: http://localhost:3000
    echo.
    npx serve . -p 3000
    goto :end
)

:: Fallback: apre direttamente index.html nel browser predefinito
echo [!] npx non trovato. Apro index.html direttamente nel browser...
echo [!] Nota: alcune funzioni WebSocket potrebbero non funzionare senza server HTTP.
echo.
start "" "index.html"

:end
echo.
pause
