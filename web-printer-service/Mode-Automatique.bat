@echo off
echo ========================================
echo   IMPRIMANTE AUTOMATIQUE GESTION 982
echo ========================================
echo.
echo Configuration requise:
echo 1. Definir l'imprimante par defaut dans Windows
echo 2. Ce script va lancer Chrome en mode kiosque
echo.
echo L'impression se fera automatiquement sur l'imprimante par defaut.
echo.
timeout /t 3

REM Fermer toutes les instances de Chrome
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 >nul

REM Lancer Chrome avec options pour impression automatique
REM --kiosk : Mode kiosque plein ecran
REM --kiosk-printing : imprime sans boite de dialogue
REM --disable-print-preview : desactive l'apercu avant impression
REM --auto-open-devtools-for-tabs : pour voir les logs (optionnel)
start "" "chrome.exe" --kiosk --kiosk-printing --disable-print-preview --no-first-run --no-default-browser-check "https://gestion-982.web.app/printer.html"

echo.
echo Chrome lance ! Les impressions seront automatiques.
echo Laissez cette fenetre ouverte pour surveiller.
echo.
pause
