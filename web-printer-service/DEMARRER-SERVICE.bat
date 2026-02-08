@echo off
title Service d'Impression Automatique - Gestion 982

echo.
echo ========================================
echo   SERVICE D'IMPRESSION AUTOMATIQUE
echo   GESTION-982
echo ========================================
echo.

REM Verifier si Node.js est installe
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Node.js n'est pas installe!
    echo.
    echo Telechargez Node.js depuis: https://nodejs.org/
    echo Installez la version LTS (recommandee^)
    echo.
    pause
    exit /b 1
)

echo [1/3] Node.js detecte
node --version
echo.

REM Verifier si les dependances sont installees
if not exist "node_modules" (
    echo [2/3] Installation des dependances...
    echo Cela peut prendre quelques minutes...
    echo.
    call npm install
    echo.
    if %ERRORLEVEL% NEQ 0 (
        echo ERREUR lors de l'installation!
        pause
        exit /b 1
    )
    echo Dependances installees avec succes!
    echo.
) else (
    echo [2/3] Dependances deja installees
    echo.
)

echo [3/3] Demarrage du service...
echo.
echo IMPORTANT:
echo - Laissez cette fenetre OUVERTE
echo - Le service imprime automatiquement
echo - Appuyez sur Ctrl+C pour arreter
echo.
timeout /t 3 >nul

REM Lancer le service
node impression-service.js

pause
