@echo off
title Impression Automatique - Gestion 982

echo.
echo ========================================
echo   IMPRESSION AUTOMATIQUE GESTION-982
echo ========================================
echo.
echo Demarrage du service d'impression...
echo.

REM Lancer le script PowerShell
powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0Impression-Automatique-COMPLETE.ps1"

pause
