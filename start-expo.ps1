# Script pour démarrer Expo avec optimisations mémoire
Write-Host "Nettoyage des processus Node..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Configuration de la mémoire..." -ForegroundColor Yellow
$env:NODE_OPTIONS = "--max-old-space-size=8192"

Write-Host "Nettoyage du cache Expo..." -ForegroundColor Yellow
if (Test-Path "$env:TEMP\metro-*") {
    Remove-Item "$env:TEMP\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path "$env:TEMP\haste-map-*") {
    Remove-Item "$env:TEMP\haste-map-*" -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path "node_modules\.cache") {
    Remove-Item "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path ".expo") {
    Remove-Item ".expo" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Démarrage d'Expo..." -ForegroundColor Green
npx expo start --clear
