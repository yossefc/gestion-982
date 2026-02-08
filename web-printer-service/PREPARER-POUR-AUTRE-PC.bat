@echo off
title Preparation pour Installation sur Autre PC
color 0B

echo.
echo ========================================
echo   PREPARATION POUR AUTRE PC
echo   GESTION-982
echo ========================================
echo.
echo Ce script va preparer un dossier avec tous
echo les fichiers necessaires pour installer le
echo service d'impression sur un autre ordinateur.
echo.
pause

REM Creer le dossier de destination sur le Bureau
set "DEST=%USERPROFILE%\Desktop\Impression-Gestion-982"

echo.
echo Creation du dossier sur le Bureau...
if exist "%DEST%" (
    echo Le dossier existe deja, suppression...
    rmdir /s /q "%DEST%"
)
mkdir "%DEST%"

echo.
echo Copie des fichiers necessaires...

REM Copier les fichiers du service
echo [1/5] impression-service.js
copy "%~dp0impression-service.js" "%DEST%\" >nul

echo [2/5] package.json
copy "%~dp0package.json" "%DEST%\" >nul

echo [3/5] Scripts batch
copy "%~dp0DEMARRER-SERVICE.bat" "%DEST%\" >nul
copy "%~dp0VERIFIER-INSTALLATION.bat" "%DEST%\" >nul

echo [4/5] Guides et documentation
copy "%~dp0GUIDE-SERVICE-NODE.md" "%DEST%\" >nul
copy "%~dp0INSTALLATION-NOUVEAU-PC.md" "%DEST%\" >nul
copy "%~dp0LISEZ-MOI.txt" "%DEST%\" >nul

echo [5/5] serviceAccountKey.json
if exist "%~dp0..\serviceAccountKey.json" (
    copy "%~dp0..\serviceAccountKey.json" "%DEST%\" >nul
    echo   serviceAccountKey.json copie avec succes
) else (
    echo   ATTENTION: serviceAccountKey.json INTROUVABLE!
    echo   Vous devrez le copier manuellement.
    echo   Emplacement attendu: %~dp0..\serviceAccountKey.json
)

echo.
echo ========================================
echo   PREPARATION TERMINEE!
echo ========================================
echo.
echo Dossier cree sur le Bureau:
echo %DEST%
echo.
echo ETAPES SUIVANTES:
echo.
echo 1. Copiez ce dossier sur une cle USB
echo.
echo 2. Sur l'autre ordinateur:
echo    - Installez Node.js (https://nodejs.org/)
echo    - Copiez le dossier vers C:\Impression-Gestion-982\
echo    - Ouvrez CMD dans ce dossier
echo    - Executez: npm install
echo    - Lancez: DEMARRER-SERVICE.bat
echo.
echo 3. Consultez INSTALLATION-NOUVEAU-PC.md pour details
echo.
echo Voulez-vous ouvrir le dossier maintenant? (O/N)
set /p OPEN=

if /i "%OPEN%"=="O" (
    explorer "%DEST%"
)

echo.
echo Terminé!
pause
