@echo off
chcp 65001 >nul
title Déploiement Firebase Hosting - Gestion 982

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🚀 DÉPLOIEMENT FIREBASE HOSTING                     ║
echo ║        Système d'Impression - Gestion 982              ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Vérifier si Firebase CLI est installé
echo [1/4] Vérification de Firebase CLI...
where firebase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Firebase CLI n'est pas installé!
    echo.
    echo Installation en cours...
    echo.
    call npm install -g firebase-tools
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ❌ Erreur lors de l'installation de Firebase CLI
        echo.
        echo Essaye manuellement:
        echo   npm install -g firebase-tools
        echo.
        pause
        exit /b 1
    )
    echo.
    echo ✅ Firebase CLI installé avec succès!
) else (
    echo ✅ Firebase CLI est installé
)

echo.
echo [2/4] Vérification de la connexion Firebase...
firebase projects:list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Tu n'es pas connecté à Firebase
    echo.
    echo Connexion en cours...
    echo Une page de navigateur va s'ouvrir...
    echo.
    call firebase login
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ❌ Erreur de connexion
        echo.
        pause
        exit /b 1
    )
)
echo ✅ Connecté à Firebase

echo.
echo [3/4] Sélection du projet...
call firebase use gestion-982
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Impossible de sélectionner le projet gestion-982
    echo.
    echo Liste des projets disponibles:
    call firebase projects:list
    echo.
    pause
    exit /b 1
)
echo ✅ Projet gestion-982 sélectionné

echo.
echo [4/4] Déploiement en cours...
echo.
echo ⏳ Téléchargement des fichiers...
echo ⏳ Cela peut prendre 1-2 minutes...
echo.

call firebase deploy --only hosting

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔══════════════════════════════════════════════════════════╗
    echo ║                                                          ║
    echo ║     ✅ DÉPLOIEMENT RÉUSSI!                              ║
    echo ║                                                          ║
    echo ╚══════════════════════════════════════════════════════════╝
    echo.
    echo 🌐 Ton site est maintenant en ligne!
    echo.
    echo URLs disponibles:
    echo   • https://gestion-982.web.app/printer
    echo   • https://gestion-982.web.app/printer.html
    echo   • https://gestion-982.firebaseapp.com/printer
    echo.
    echo 📱 Partage ces URLs à qui tu veux!
    echo.
    echo 🔄 Pour mettre à jour le site:
    echo    Lance ce fichier à nouveau
    echo.
) else (
    echo.
    echo ╔══════════════════════════════════════════════════════════╗
    echo ║                                                          ║
    echo ║     ❌ ERREUR DE DÉPLOIEMENT                            ║
    echo ║                                                          ║
    echo ╚══════════════════════════════════════════════════════════╝
    echo.
    echo Vérifie:
    echo   1. Connexion internet
    echo   2. Permissions Firebase
    echo   3. Fichier firebase.json existe
    echo.
    echo Essaye manuellement:
    echo   firebase deploy --only hosting --debug
    echo.
)

echo.
pause
