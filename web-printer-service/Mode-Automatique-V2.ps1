# Script PowerShell pour impression automatique
# Utilise l'imprimante par defaut Windows

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "  IMPRESSION AUTOMATIQUE GESTION 982"      -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""

# Verifier l'imprimante par defaut
$defaultPrinter = Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true}

if ($null -eq $defaultPrinter) {
    Write-Host "ERREUR: Aucune imprimante par defaut definie!" -ForegroundColor Red
    Write-Host "Veuillez definir une imprimante par defaut dans Windows" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entree pour quitter"
    exit
}

Write-Host "Imprimante par defaut: $($defaultPrinter.Name)" -ForegroundColor Green
Write-Host ""
Write-Host "Lancement du service d'impression..." -ForegroundColor Yellow
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Une page Chrome va s'ouvrir" -ForegroundColor White
Write-Host "2. Connectez-vous avec votre compte" -ForegroundColor White
Write-Host "3. Quand un PDF apparait, appuyez sur Ctrl+P puis Entree" -ForegroundColor White
Write-Host "4. Le document s'imprimera automatiquement" -ForegroundColor White
Write-Host ""
Start-Sleep -Seconds 3

# Fermer Chrome existant
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Lancer Chrome en mode kiosque
$chromeArgs = @(
    "--kiosk"
    "--disable-print-preview"
    "--no-first-run"
    "--no-default-browser-check"
    "https://gestion-982.web.app/printer.html"
)

Start-Process "chrome.exe" -ArgumentList $chromeArgs

Write-Host ""
Write-Host "Chrome lance! Service d'impression actif." -ForegroundColor Green
Write-Host "Laissez cette fenetre ouverte." -ForegroundColor Yellow
Write-Host ""
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray

# Garder la fenetre ouverte
while ($true) {
    Start-Sleep -Seconds 10
}
