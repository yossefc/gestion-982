@echo off
echo Ouuverture de l'imprimante automatique...
echo.
echo IMPORTANT:
echo 1. Cela va fermer toutes les fenetres Chrome ouvertes.
echo 2. L'impression se fera sans fenetre de confirmation.
echo.
timeout /t 3

taskkill /F /IM chrome.exe >nul 2>&1

start chrome.exe --kiosk-printing "https://gestion-982.web.app/printer.html"

echo Termine !
pause
