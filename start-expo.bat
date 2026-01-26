@echo off
echo ========================================
echo  DEMARRAGE EXPO - Gestion 982
echo ========================================
echo.

echo [1/5] Nettoyage des processus Node...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Configuration de la memoire...
set NODE_OPTIONS=--max-old-space-size=8192 --max-semi-space-size=128

echo [3/5] Nettoyage des caches...
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul
if exist ".expo" rmdir /s /q ".expo" 2>nul
if exist "%TEMP%\metro-*" del /f /q "%TEMP%\metro-*" 2>nul
if exist "%TEMP%\haste-map-*" del /f /q "%TEMP%\haste-map-*" 2>nul

echo [4/5] Verification de la configuration...
echo NODE_OPTIONS = %NODE_OPTIONS%
echo.

echo [5/5] Demarrage d'Expo (cela peut prendre 1-2 minutes)...
echo.
npx expo start --clear --max-workers 1

pause
