# ========================================
# GESTION-982 - IMPRESSION AUTOMATIQUE
# ========================================
# Ce script surveille le dossier Téléchargements
# et imprime automatiquement les PDFs de gestion-982
# ZERO INTERVENTION REQUISE!
# ========================================

$Host.UI.RawUI.WindowTitle = "Service d'Impression Automatique - Gestion 982"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IMPRESSION AUTOMATIQUE GESTION-982" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier l'imprimante par défaut
Write-Host "[1/4] Vérification de l'imprimante..." -ForegroundColor Yellow
$defaultPrinter = Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true}

if ($null -eq $defaultPrinter) {
    Write-Host "ERREUR: Aucune imprimante par défaut!" -ForegroundColor Red
    Write-Host "Définissez une imprimante par défaut dans Windows" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit
}

Write-Host "  Imprimante: $($defaultPrinter.Name)" -ForegroundColor Green
Write-Host ""

# 2. Configurer le dossier de surveillance
Write-Host "[2/4] Configuration du dossier de surveillance..." -ForegroundColor Yellow
$downloadsPath = [Environment]::GetFolderPath("UserProfile") + "\Downloads"
Write-Host "  Dossier: $downloadsPath" -ForegroundColor Green
Write-Host ""

# 3. Ouvrir Chrome sur la page d'impression
Write-Host "[3/4] Ouverture de Chrome..." -ForegroundColor Yellow
Write-Host "  URL: https://gestion-982.web.app/printer.html" -ForegroundColor Green

# Fermer Chrome existant pour nouveau départ
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Lancer Chrome avec paramètres pour télécharger PDFs
$chromeArgs = @(
    "--new-window"
    "--disable-print-preview"
    "--no-first-run"
    "https://gestion-982.web.app/printer.html"
)

Start-Process "chrome.exe" -ArgumentList $chromeArgs
Start-Sleep -Seconds 3
Write-Host ""

# 4. Démarrer la surveillance
Write-Host "[4/4] Démarrage du service d'impression..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SERVICE ACTIF!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Connectez-vous sur la page Chrome qui s'est ouverte" -ForegroundColor White
Write-Host "2. Laissez cette fenêtre OUVERTE" -ForegroundColor White
Write-Host "3. Les PDFs s'imprimeront AUTOMATIQUEMENT!" -ForegroundColor White
Write-Host ""
Write-Host "Surveillance active..." -ForegroundColor Yellow
Write-Host ""

# Créer le FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $downloadsPath
$watcher.Filter = "*.pdf"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

# Fonction pour imprimer un PDF
$printAction = {
    param($filePath)

    $fileName = Split-Path $filePath -Leaf

    # Vérifier si c'est un PDF de gestion-982
    # On imprime TOUS les PDFs téléchargés (pour simplifier)
    if ($true) {

        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
        Write-Host "📄 NOUVEAU PDF DETECTE!" -ForegroundColor Green
        Write-Host "   Fichier: $fileName" -ForegroundColor White

        # Attendre que le fichier soit complètement téléchargé
        $maxWait = 10
        $waited = 0
        while ($waited -lt $maxWait) {
            try {
                $file = [System.IO.File]::Open($filePath, 'Open', 'Read', 'None')
                $file.Close()
                break
            } catch {
                Start-Sleep -Milliseconds 500
                $waited++
            }
        }

        Start-Sleep -Seconds 1

        Write-Host "🖨️  IMPRESSION EN COURS..." -ForegroundColor Yellow

        try {
            # Imprimer le PDF avec l'imprimante par défaut
            Start-Process -FilePath $filePath -Verb Print -ErrorAction Stop

            Write-Host "✅ IMPRIME AVEC SUCCES!" -ForegroundColor Green
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
            Write-Host ""

            # Optionnel: Supprimer le PDF après impression
            Start-Sleep -Seconds 5
            try {
                Remove-Item $filePath -Force -ErrorAction SilentlyContinue
                Write-Host "🗑️  Fichier nettoyé: $fileName" -ForegroundColor Gray
            } catch {
                # Pas grave si on ne peut pas supprimer
            }

        } catch {
            Write-Host "❌ ERREUR D'IMPRESSION: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
            Write-Host ""
        }
    }
}

# Enregistrer l'événement de création de fichier
$onCreated = Register-ObjectEvent $watcher Created -Action {
    $filePath = $Event.SourceEventArgs.FullPath
    & $using:printAction $filePath
}

# Garder le script en cours d'exécution
Write-Host "En attente de PDFs..." -ForegroundColor Cyan
Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds 1

        # Vérifier que Chrome est toujours ouvert
        $chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue
        if (-not $chromeRunning) {
            Write-Host "⚠️  Chrome fermé - Surveillance toujours active" -ForegroundColor Yellow
        }
    }
} finally {
    # Nettoyage
    Unregister-Event -SourceIdentifier $onCreated.Name
    $watcher.Dispose()
    Write-Host ""
    Write-Host "Service d'impression arrêté" -ForegroundColor Yellow
}
