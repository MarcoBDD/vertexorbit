@echo off
title VerteXOrbit - Fix Remote e Push
color 0E
echo.
echo  ============================================
echo    VerteXOrbit - Fix Remote + Push
echo  ============================================
echo.

set BASE=C:\Users\marco\Desktop\DARKORBIT
cd /d "%BASE%"

:: Rimuovi il remote rotto e ricrealo
echo  [FIX] Rimozione remote vecchio (se esiste)...
git remote remove origin 2>nul
echo  [OK] Remote rimosso.
echo.

:: Aggiungi il remote corretto
git remote add origin "https://github.com/MarcoBDD/vertexorbit.git"
echo  [OK] Remote aggiunto: https://github.com/MarcoBDD/vertexorbit.git
echo.

:: Verifica
echo  [i] Verifica remote:
git remote -v
echo.

:: Messaggio commit
echo  Inserisci il messaggio di commit:
set /p "COMMIT_MSG=Messaggio (INVIO = update): "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=update"

echo.
echo  [>>] Aggiungo tutti i file...
git add .

echo  [>>] Commit: %COMMIT_MSG%
git commit -m "%COMMIT_MSG%" 2>nul || echo  [i] Nessuna modifica da committare, procedo con push.

echo.
echo  [>>] Push su GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo  [!] Provo con --force...
    git push -u origin main --force
)

echo.
echo  ============================================
echo    FATTO! Controlla GitHub.
echo  ============================================
echo.
pause
