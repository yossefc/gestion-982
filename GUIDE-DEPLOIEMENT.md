# Guide de Déploiement - Gestion-982

Guide complet pour déployer et configurer l'application Gestion-982.

## Prérequis

- Node.js 18+ installé
- npm ou yarn
- Compte Firebase actif
- Firebase CLI installé (`npm install -g firebase-tools`)

## Étape 1: Configuration Firebase (10 min)

### 1.1 Déployer Rules et Index

**Option A: Script Automatique (Recommandé)**

Windows PowerShell:
```powershell
# Autoriser l'exécution de scripts (une seule fois)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Lancer le script
.\deploy-windows.ps1
```

**Option B: Manuel**

```bash
# 1. Vérifier TypeScript
npm run typecheck

# 2. Login Firebase
firebase login

# 3. Déployer Rules
firebase deploy --only firestore:rules

# 4. Déployer Index
firebase deploy --only firestore:indexes
```

### 1.2 Vérification

1. Ouvrir Firebase Console: https://console.firebase.google.com
2. Sélectionner votre projet
3. Firestore Database → Index
4. Vérifier 5 index créés:
   - soldiers (company + nameLower)
   - assignments (soldierId + timestamp)
   - assignments (type + timestamp)
   - logs (entityType + entityId + performedAt)
   - logs (performedBy + performedAt)
5. Statut: "Enabled" ou "Building..."

⏳ Si "Building...", attendre 5-10 minutes.

## Étape 2: Configuration .env (2 min)

### 2.1 Créer le fichier

```bash
cp .env.example .env
```

### 2.2 Remplir les credentials

Éditer `.env`:
```env
# Firebase Config (Firebase Console → Project Settings → Web App)
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc...

# Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Environnement
NODE_ENV=production
```

**Comment obtenir ces valeurs:**
1. Firebase Console → Project Settings
2. Onglet "General" → Your apps → Web app
3. Copier les valeurs de `firebaseConfig`

## Étape 3: Service Account Key (3 min)

### 3.1 Téléchargement

1. Firebase Console
2. Project Settings → Service Accounts
3. "Generate new private key"
4. Sauvegarder le fichier JSON
5. Renommer en `serviceAccountKey.json`
6. Placer à la racine du projet

### 3.2 Vérification

```bash
ls serviceAccountKey.json
# Doit exister
```

⚠️ **Sécurité:** Ce fichier est dans .gitignore, ne jamais le commiter!

## Étape 4: Configurer les Rôles (5 min)

### 4.1 Interface Interactive

```bash
npm run setup:claims
```

### 4.2 Utilisation

**Rôles disponibles:**
- `admin` - Accès complet
- `arme` - Module arme uniquement
- `vetement` - Module vêtement uniquement
- `both` - Modules arme + vêtement

**Processus:**
1. Choisir "Lister les utilisateurs"
2. Choisir "Attribuer un rôle"
3. Entrer l'email de l'utilisateur
4. Choisir le rôle
5. Répéter pour chaque utilisateur

### 4.3 Vérification

Firebase Console → Authentication → Users → Cliquer sur utilisateur → Custom claims

⚠️ L'utilisateur doit se déconnecter/reconnecter pour activer le rôle!

## Étape 5: Installation (2 min)

```bash
# Installer toutes les dépendances
npm install

# Vérifier que tout compile
npm run typecheck
```

## Étape 6: Tests (5 min)

### 6.1 Lancer l'application

```bash
npm start
```

Puis:
- Android: taper `a`
- iOS: taper `i`
- Web: taper `w`

### 6.2 Tests Essentiels

**Test 1: Login**
- Se connecter avec un utilisateur
- Vérifier l'écran d'accueil s'affiche

**Test 2: Recherche**
- Aller dans "חיפוש חייל"
- Taper un nom
- Vérifier résultats instantanés

**Test 3: Création**
- "הוסף חייל"
- Remplir le formulaire
- Vérifier message de succès

**Test 4: Permissions**
- Se connecter avec user "arme"
- Vérifier accès limité au module arme

**Test 5: Offline**
- Mode avion
- Vérifier bannière "אין חיבור לאינטרנט"

## Problèmes Courants

### "searchKey index missing"
**Solution:** Créer les index Firestore (Étape 1)

### "Permission denied"
**Solution:** Déployer les rules Firestore
```bash
firebase deploy --only firestore:rules
```

### "Aucun résultat de recherche"
**Cause:** Données sans champs de recherche
**Solution:** Les nouveaux soldats créés via l'app auront automatiquement les champs

### "User doesn't have permission"
**Solution:** Configurer les custom claims (Étape 4) + déconnexion/reconnexion

### Erreur compilation TypeScript
**Solution:**
```bash
npm install
npm run typecheck
```

## Build Production

### Android

```bash
# Build APK
eas build --platform android --profile preview

# Build AAB (Play Store)
eas build --platform android --profile production
```

### iOS

```bash
# Build pour TestFlight
eas build --platform ios --profile production
```

### Web

```bash
# Build web
npm run web:build

# Déployer sur Firebase Hosting
firebase deploy --only hosting
```

## Maintenance

### Backup Firestore

```bash
# Via CLI
firebase firestore:export gs://YOUR_BUCKET/backup-$(date +%Y%m%d)

# Ou via Firebase Console
# Firestore → Import/Export
```

### Mise à jour des dépendances

```bash
# Vérifier les mises à jour
npm outdated

# Mettre à jour (avec précaution)
npm update
```

## Checklist Finale

- [ ] Rules Firestore déployées
- [ ] Index Firestore créés (5/5 "Enabled")
- [ ] `.env` configuré
- [ ] `serviceAccountKey.json` téléchargé
- [ ] Rôles utilisateurs configurés
- [ ] Application démarre sans erreur
- [ ] Tests critiques passés
- [ ] Build production réussi

## Support

- Documentation technique: dossier `docs/`
- Guide d'impression: `GUIDE-IMPRESSION.md`
- Problèmes: Créer une issue GitHub
