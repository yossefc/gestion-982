@echo off
title Verification de l'Installation - Gestion-982
color 0B

echo.
echo ========================================
echo   VERIFICATION DE L'INSTALLATION
echo   GESTION-982
echo ========================================
echo.

set ERRORS=0

REM Verifier Node.js
echo [1/5] Verification de Node.js...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Node.js est installe
    node --version
) else (
    echo   [ERREUR] Node.js N'EST PAS INSTALLE!
    echo   Installez-le depuis: https://nodejs.org/
    set /a ERRORS+=1
)
echo.

REM Verifier npm
echo [2/5] Verification de npm...
where npm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] npm est installe
    npm --version
) else (
    echo   [ERREUR] npm n'est pas disponible
    set /a ERRORS+=1
)
echo.

REM Verifier les fichiers necessaires
echo [3/5] Verification des fichiers...

set FILES_OK=1

if exist "impression-service.js" (
    echo   [OK] impression-service.js
) else (
    echo   [ERREUR] impression-service.js INTROUVABLE
    set FILES_OK=0
    set /a ERRORS+=1
)

if exist "package.json" (
    echo   [OK] package.json
) else (
    echo   [ERREUR] package.json INTROUVABLE
    set FILES_OK=0
    set /a ERRORS+=1
)

if exist "serviceAccountKey.json" (
    echo   [OK] serviceAccountKey.json
) else (
    if exist "..\serviceAccountKey.json" (
        echo   [OK] serviceAccountKey.json (dossier parent)
    ) else (
        echo   [ERREUR] serviceAccountKey.json INTROUVABLE
        set FILES_OK=0
        set /a ERRORS+=1
    )
)

if exist "DEMARRER-SERVICE.bat" (
    echo   [OK] DEMARRER-SERVICE.bat
) else (
    echo   [ERREUR] DEMARRER-SERVICE.bat INTROUVABLE
    set FILES_OK=0
    set /a ERRORS+=1
)
echo.

REM Verifier l'imprimante par defaut
echo [4/5] Verification de l'imprimante par defaut...
powershell -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object -ExpandProperty Name" > temp_printer.txt
set /p PRINTER_NAME=<temp_printer.txt
del temp_printer.txt

if "%PRINTER_NAME%"=="" (
    echo   [ATTENTION] Aucune imprimante par defaut definie!
    echo   Definissez-en une dans: Windows ^> Parametres ^> Imprimantes
    set /a ERRORS+=1
) else (
    echo   [OK] Imprimante: %PRINTER_NAME%
)
echo.

REM Verifier node_modules
echo [5/5] Verification des dependances...
if exist "node_modules" (
    echo   [OK] Dependances installees
) else (
    echo   [ATTENTION] Dependances NON installees
    echo   Executez: npm install
    set /a ERRORS+=1
)
echo.

REM Resultat final
echo ========================================
if %ERRORS% EQU 0 (
    echo   TOUT EST PRET! ^>^>^>
    echo   Lancez DEMARRER-SERVICE.bat
    color 0A
) else (
    echo   %ERRORS% PROBLEME^(S^) DETECTE^(S^)
    echo   Corrigez les erreurs ci-dessus
    color 0C
)
echo ========================================
echo.

if %ERRORS% GTR 0 (
    echo.
    echo ACTIONS A FAIRE:
    echo.
    if not exist "node_modules" (
        echo   1. Installez les dependances: npm install
    )
    powershell -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true}" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo   2. Definissez une imprimante par defaut
    )
    where node >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo   3. Installez Node.js depuis https://nodejs.org/
    )
    echo.
)

pause
