# Guide pratique - Deploiement Gestion-982
# SUIVEZ CES ETAPES UNE PAR UNE

Write-Host "================================" -ForegroundColor Cyan
Write-Host "DEPLOIEMENT GESTION-982" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour afficher les etapes
function Show-Step {
    param($number, $title, $color = "Green")
    Write-Host ""
    Write-Host "[$number] $title" -ForegroundColor $color
    Write-Host ("-" * 50) -ForegroundColor Gray
}

# Fonction pour demander confirmation
function Get-Confirmation {
    param($message)
    $response = Read-Host "$message (o/n)"
    return $response -eq "o" -or $response -eq "O"
}

# ETAPE 1: Verifier TypeScript
Show-Step "1" "VERIFICATION TYPESCRIPT"
Write-Host "Execution de: npx tsc --noEmit" -ForegroundColor White
$tscResult = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK TypeScript - Aucune erreur" -ForegroundColor Green
} else {
    Write-Host "Erreurs TypeScript detectees:" -ForegroundColor Red
    Write-Host $tscResult -ForegroundColor Yellow
    $continue = Get-Confirmation "Continuer malgre les erreurs?"
    if (-not $continue) {
        Write-Host "Deploiement annule." -ForegroundColor Red
        exit 1
    }
}

# ETAPE 2: Verifier Firebase CLI
Show-Step "2" "VERIFICATION FIREBASE CLI"
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if ($firebaseInstalled) {
    Write-Host "OK Firebase CLI installe" -ForegroundColor Green
    $version = firebase --version
    Write-Host "Version: $version" -ForegroundColor Gray
} else {
    Write-Host "Firebase CLI non installe" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTALLATION REQUISE:" -ForegroundColor Yellow
    Write-Host "npm install -g firebase-tools" -ForegroundColor White
    Write-Host ""
    $install = Get-Confirmation "Installer Firebase CLI maintenant?"
    if ($install) {
        npm install -g firebase-tools
    } else {
        Write-Host "Deploiement annule." -ForegroundColor Red
        exit 1
    }
}

# ETAPE 3: Login Firebase
Show-Step "3" "AUTHENTIFICATION FIREBASE"
Write-Host "Verification du login Firebase..." -ForegroundColor White
$loginCheck = firebase projects:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Non authentifie" -ForegroundColor Red
    Write-Host "Ouverture du navigateur pour login..." -ForegroundColor Yellow
    firebase login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Echec de l'authentification" -ForegroundColor Red
        exit 1
    }
}
Write-Host "OK Authentifie avec succes" -ForegroundColor Green

# ETAPE 4: Deployer les Rules
Show-Step "4" "DEPLOIEMENT FIRESTORE RULES" "Yellow"
Write-Host "Fichier: firestore.rules" -ForegroundColor White
if (Test-Path "firestore.rules") {
    Write-Host "OK Fichier firestore.rules trouve" -ForegroundColor Green
    $deployRules = Get-Confirmation "Deployer les Firestore Rules?"
    if ($deployRules) {
        Write-Host "Deploiement en cours..." -ForegroundColor Yellow
        firebase deploy --only firestore:rules
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Rules deployees avec succes!" -ForegroundColor Green
        } else {
            Write-Host "Echec du deploiement des rules" -ForegroundColor Red
        }
    }
} else {
    Write-Host "Fichier firestore.rules introuvable" -ForegroundColor Red
}

# ETAPE 5: Deployer les Index
Show-Step "5" "DEPLOIEMENT FIRESTORE INDEX" "Yellow"
Write-Host "Fichier: firestore.indexes.json" -ForegroundColor White
if (Test-Path "firestore.indexes.json") {
    Write-Host "OK Fichier firestore.indexes.json trouve" -ForegroundColor Green
    $deployIndexes = Get-Confirmation "Deployer les Firestore Index?"
    if ($deployIndexes) {
        Write-Host "Deploiement en cours..." -ForegroundColor Yellow
        firebase deploy --only firestore:indexes
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Index deployes avec succes!" -ForegroundColor Green
            Write-Host ""
            Write-Host "IMPORTANT: Les index peuvent prendre quelques minutes pour etre actifs" -ForegroundColor Yellow
            Write-Host "Verifiez dans Firebase Console -> Firestore -> Index" -ForegroundColor White
        } else {
            Write-Host "Echec du deploiement des index" -ForegroundColor Red
        }
    }
} else {
    Write-Host "Fichier firestore.indexes.json introuvable" -ForegroundColor Red
}

# ETAPE 6: Migrer les soldats
Show-Step "6" "MIGRATION DES SOLDATS" "Yellow"
Write-Host "Cette etape ajoute searchKey et nameLower aux soldats existants" -ForegroundColor White
Write-Host ""
Write-Host "PREREQUIS:" -ForegroundColor Yellow
Write-Host "1. Fichier .env configure avec credentials Firebase" -ForegroundColor White
Write-Host "2. Index Firestore crees (etape precedente)" -ForegroundColor White
Write-Host ""

if (Test-Path ".env") {
    Write-Host "OK Fichier .env trouve" -ForegroundColor Green
} else {
    Write-Host "Fichier .env introuvable" -ForegroundColor Red
    Write-Host "Creez .env a partir de .env.example" -ForegroundColor Yellow
}

$migrate = Get-Confirmation "Lancer la migration des soldats?"
if ($migrate) {
    Write-Host ""
    Write-Host "ATTENTION: Faites un backup Firestore avant!" -ForegroundColor Red
    Write-Host "Commande: firebase firestore:export gs://your-bucket/backup" -ForegroundColor White
    Write-Host ""
    $confirmed = Get-Confirmation "Backup effectue - Continuer la migration?"
    if ($confirmed) {
        Write-Host "Migration en cours..." -ForegroundColor Yellow
        npm run migrate:soldiers
    }
}

# ETAPE 7: Configurer les roles
Show-Step "7" "CONFIGURATION CUSTOM CLAIMS (ROLES)" "Yellow"
Write-Host "Cette etape configure les roles utilisateurs (admin/arme/vetement/both)" -ForegroundColor White
Write-Host ""
Write-Host "PREREQUIS:" -ForegroundColor Yellow
Write-Host "1. Fichier serviceAccountKey.json telecharge depuis Firebase Console" -ForegroundColor White
Write-Host "2. Variable GOOGLE_APPLICATION_CREDENTIALS definie" -ForegroundColor White
Write-Host ""

if (Test-Path "serviceAccountKey.json") {
    Write-Host "OK Fichier serviceAccountKey.json trouve" -ForegroundColor Green
} else {
    Write-Host "Fichier serviceAccountKey.json introuvable" -ForegroundColor Red
    Write-Host ""
    Write-Host "TELECHARGEMENT:" -ForegroundColor Yellow
    Write-Host "1. Aller sur Firebase Console" -ForegroundColor White
    Write-Host "2. Project Settings -> Service Accounts" -ForegroundColor White
    Write-Host "3. Generate new private key" -ForegroundColor White
    Write-Host "4. Sauvegarder dans D:\gestion-982\serviceAccountKey.json" -ForegroundColor White
    Write-Host ""
}

$setupClaims = Get-Confirmation "Lancer la configuration des roles?"
if ($setupClaims) {
    Write-Host "Lancement de l interface interactive..." -ForegroundColor Yellow
    $env:GOOGLE_APPLICATION_CREDENTIALS = ".\serviceAccountKey.json"
    npm run setup:claims
}

# RESUME FINAL
Show-Step "OK" "DEPLOIEMENT TERMINE" "Green"
Write-Host ""
Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Verifier les index dans Firebase Console (doivent etre Ready)" -ForegroundColor White
Write-Host "2. Tester la recherche dans l application" -ForegroundColor White
Write-Host "3. Suivre la checklist: scripts\test-checklist.md" -ForegroundColor White
Write-Host ""
Write-Host "DOCUMENTATION:" -ForegroundColor Yellow
Write-Host "- POST-REFACTORING-CHECKLIST.md" -ForegroundColor White
Write-Host "- QUICK-START.md" -ForegroundColor White
Write-Host "- scripts\README.md" -ForegroundColor White
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Bon deploiement!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
