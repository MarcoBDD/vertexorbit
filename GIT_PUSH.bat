@echo off
title VerteXOrbit - Git Push (Monorepo)
color 0A
echo.
echo  ============================================
echo    VerteXOrbit - Push su GitHub (Monorepo)
echo  ============================================
echo.

set BASE=C:\Users\marco\Desktop\DARKORBIT

cd /d "%BASE%"

:: Prima volta: inizializza il repo monorepo nella root
if not exist ".git" (
    echo  [SETUP] Prima configurazione del repo...
    git init
    git branch -M main
    echo.
    set /p REPO_URL="URL repo GitHub (es: https://github.com/MarcoBDD/vertexorbit.git): "
    git remote add origin %REPO_URL%
    echo.
    echo  [OK] Remote aggiunto.
    echo.
)

:: Messaggio commit
set /p COMMIT_MSG="Messaggio commit (INVIO = 'update'): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=update

echo.
echo  [>>] Aggiungo tutti i file...
git add .

echo  [>>] Commit: %COMMIT_MSG%
git commit -m "%COMMIT_MSG%"

echo.
echo  [>>] Push su GitHub...
git push -u origin main

echo.
echo  ============================================
echo    PUSH COMPLETATO - Monorepo VerteXOrbit
echo  ============================================
echo.
pause
