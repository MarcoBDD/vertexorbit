@echo off
title VerteXOrbit - Pulizia repo GitHub
color 0C
echo.
echo  ============================================
echo    VerteXOrbit - Rimozione file indesiderati
echo  ============================================
echo.

set BASE=C:\Users\marco\Desktop\DARKORBIT
cd /d "%BASE%"

echo  [1] Rimuovo file dal tracking Git (git rm --cached)...
git rm --cached BACKUP.bat 2>nul
git rm --cached FIX_AND_PUSH.bat 2>nul
git rm --cached backup.py 2>nul
git rm --cached rename.ps1 2>nul
git rm --cached cleanup.ps1 2>nul
git rm --cached GIT_PUSH.bat 2>nul
git rm --cached CLEANUP_REPO.bat 2>nul
git rm --cached "]" 2>nul
git rm --cached "vertexorbit-client/]" 2>nul
git rm --cached "vertexorbit-server/]" 2>nul

echo.
echo  [2] Elimino fisicamente i file non necessari dal disco...
del /f /q "%BASE%\rename.ps1" 2>nul
del /f /q "%BASE%\cleanup.ps1" 2>nul
del /f /q "%BASE%\]" 2>nul
del /f /q "%BASE%\vertexorbit-client\]" 2>nul
del /f /q "%BASE%\vertexorbit-server\]" 2>nul

echo.
echo  [3] Commit pulizia...
git add .gitignore
git add .
git commit -m "chore: clean repo - remove local-only and junk files"

echo.
echo  [4] Push su GitHub...
git push origin main

echo.
echo  ============================================
echo    PULIZIA COMPLETATA
echo  ============================================
echo.
pause
