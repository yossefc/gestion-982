# 📋 GUIDE ÉTAPE PAR ÉTAPE - Actions Critiques

Suivez ce guide **EXACTEMENT** dans l'ordre. Durée totale : ~30 minutes.

---

## 🔴 ÉTAPE 1 : Déployer Firestore Rules & Index (10 min)

### Option A : Script Automatique (Recommandé) ✨

**Windows PowerShell** :
```powershell
# Autoriser l'exécution de scripts (une seule fois)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Lancer le script
.\deploy-windows.ps1
```

Le script va :
1. ✅ Vérifier TypeScript
2. ✅ Vérifier Firebase CLI
3. ✅ Login Firebase (ouvre navigateur)
4. ✅ Déployer rules
5. ✅ Déployer index
6. ✅ (Optionnel) Migration + rôles

### Option B : Manuel (Si script ne marche pas)

```powershell
# 1. Vérifier TypeScript
npm run typecheck
# ✅ Attendu: Pas d'erreur

# 2. Login Firebase
firebase login
# ✅ Ouvre navigateur → Se connecter avec compte Firebase

# 3. Déployer Rules
firebase deploy --only firestore:rules
# ✅ Attendu: "Deploy complete!"

# 4. Déployer Index
firebase deploy --only firestore:indexes
# ✅ Attendu: "Deploy complete!"
```

### ✅ Vérification

1. Ouvrir **Firebase Console** : https://console.firebase.google.com
2. Sélectionner votre projet
3. Aller dans **Firestore Database** → **Index**
4. Vérifier que vous voyez **5 index** :
   - ✅ `soldiers` (company + nameLower)
   - ✅ `assignments` (soldierId + timestamp)
   - ✅ `assignments` (type + timestamp)
   - ✅ `logs` (entityType + entityId + performedAt)
   - ✅ `logs` (performedBy + performedAt)
5. Status de chaque index : **🟢 Enabled** ou **🟡 Building...**

⏳ **Si "Building..."** : Attendre 5-10 minutes qu'ils deviennent "Enabled"

---

## 🟠 ÉTAPE 2 : Configurer .env (2 min)

### Créer le fichier .env

```powershell
# Copier le template
copy .env.example .env

# Ouvrir dans VS Code
code .env
```

### Remplir avec vos credentials Firebase

```env
# Firebase Config (depuis Firebase Console → Project Settings → Web App)
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

**Comment obtenir ces valeurs ?**
1. Firebase Console → ⚙️ Project Settings
2. Onglet "General" → Votre apps → Web app
3. Copier les valeurs de `firebaseConfig`

### ✅ Vérification
```powershell
cat .env
# ✅ Doit afficher vos valeurs (pas d'exemple)
```

---

## 🟠 ÉTAPE 3 : Télécharger Service Account Key (3 min)

### Téléchargement

1. Aller sur **Firebase Console**
2. ⚙️ **Project Settings** → **Service Accounts**
3. Cliquer **"Generate new private key"**
4. Sauvegarder le fichier JSON téléchargé
5. **Renommer en** : `serviceAccountKey.json`
6. **Placer dans** : `D:\gestion-982\serviceAccountKey.json`

### ✅ Vérification
```powershell
Test-Path .\serviceAccountKey.json
# ✅ Doit retourner: True
```

⚠️ **SÉCURITÉ** : Ne jamais commiter ce fichier ! (déjà dans .gitignore)

---

## 🟠 ÉTAPE 4 : Migrer les Soldats (5 min)

### ⚠️ IMPORTANT : Backup d'abord !

```powershell
# Backup Firestore (remplacer YOUR_BUCKET)
firebase firestore:export gs://YOUR_BUCKET/backup-$(Get-Date -Format 'yyyyMMdd')
```

Ou dans Firebase Console → Firestore → Import/Export

### Lancer la migration

```powershell
npm run migrate:soldiers
```

### 📊 Sortie attendue

```
🚀 Démarrage de la migration des soldats...
📥 Récupération des soldats...
✅ 50 soldats trouvés

✅ Migré: David Cohen (1234567)
   searchKey: "david cohen 1234567 050-1234567 פלוגה א"
   nameLower: "david cohen"

✅ Migré: Sarah Levy (2345678)
   searchKey: "sarah levy 2345678 050-2345678 פלוגה ב"
   nameLower: "sarah levy"

...

==================================================
📊 RÉSUMÉ DE LA MIGRATION
==================================================
✅ Migrés avec succès : 50
⏭️  Déjà migrés (ignorés): 0
❌ Erreurs            : 0
📦 Total             : 50
==================================================

🎉 Migration terminée avec succès !

⚠️  PROCHAINES ÉTAPES:
1. Créer les index Firestore (voir docs/firestore-indexes.md)
2. Tester la recherche dans l'application
```

### ✅ Vérification

1. Ouvrir Firebase Console → Firestore
2. Ouvrir collection `soldiers`
3. Cliquer sur un document
4. Vérifier qu'il a les champs :
   - ✅ `searchKey` (string, ex: "david cohen 1234567...")
   - ✅ `nameLower` (string, ex: "david cohen")
   - ✅ `updatedAt` (timestamp)

---

## 🟠 ÉTAPE 5 : Configurer les Rôles (5 min)

### Lancer l'interface

```powershell
npm run setup:claims
```

### 📱 Interface Interactive

```
🔐 CONFIGURATION DES RÔLES UTILISATEURS - Gestion-982

Rôles disponibles:
  - admin    : Accès complet (users, arme, vetement)
  - arme     : Module arme uniquement
  - vetement : Module vêtement uniquement
  - both     : Modules arme + vêtement (pas admin)

Options:
1. Lister les utilisateurs
2. Attribuer un rôle
3. Quitter

Votre choix (1/2/3):
```

### Utilisation

**1. Lister les utilisateurs**
```
Votre choix: 1

👥 LISTE DES UTILISATEURS:

1. admin@gestion982.com
   UID: abc123...
   Rôle: aucun
   Créé: 2024-12-01

2. user1@gestion982.com
   UID: def456...
   Rôle: aucun
   Créé: 2024-12-15
```

**2. Attribuer des rôles**
```
Votre choix: 2
Email de l'utilisateur: admin@gestion982.com

Rôles:
1. admin
2. arme
3. vetement
4. both

Choisir un rôle (1/2/3/4): 1

⚙️  Attribution du rôle "admin" à admin@gestion982.com...
✅ Rôle "admin" attribué à admin@gestion982.com (UID: abc123...)
📋 Custom claims: { role: 'admin' }
```

**Répéter pour chaque utilisateur**

### ✅ Vérification

1. Firebase Console → Authentication → Users
2. Cliquer sur un utilisateur
3. Onglet "Custom claims" → Devrait afficher `{ "role": "admin" }`

⚠️ **NOTE** : L'utilisateur doit se **déconnecter/reconnecter** pour que le rôle soit actif !

---

## 🎯 ÉTAPE 6 : Tests Critiques (5 min)

### Lancer l'application

```powershell
npm start
```

Ouvrir sur appareil/émulateur :
- Android : `a`
- iOS : `i`
- Web : `w`

### Tests essentiels

#### ✅ Test 1 : Login
1. Se connecter avec un utilisateur
2. ✅ Connexion réussie
3. ✅ Écran d'accueil affiché

#### ✅ Test 2 : Recherche
1. Aller dans "חיפוש חייל" (Recherche soldat)
2. Taper un nom dans la barre de recherche
3. ✅ Résultats instantanés (< 500ms)
4. ✅ Pagination fonctionne (scroll infini)

#### ✅ Test 3 : Création soldat
1. Cliquer "הוסף חייל" (Ajouter soldat)
2. Remplir le formulaire
3. Sauvegarder
4. ✅ Message "החייל נוסף בהצלחה"
5. ✅ Soldat apparaît dans la recherche

#### ✅ Test 4 : Permissions
1. Se connecter avec user "arme"
2. ✅ Module "נשקייה" accessible
3. ✅ Module "אפסנאות" grisé/bloqué

#### ✅ Test 5 : Offline
1. Activer mode avion
2. ✅ Bannière orange "אין חיבור לאינטרנט"
3. ✅ Message d'erreur clair si action

---

## 🎉 TERMINÉ !

### ✅ Checklist Finale

- [x] Rules Firestore déployées
- [x] Index Firestore créés (5/5)
- [x] Fichier .env configuré
- [x] Service Account Key téléchargé
- [x] Soldats migrés (searchKey ajouté)
- [x] Rôles utilisateurs configurés
- [x] Tests critiques OK

### 📝 Prochaines étapes

**Court terme** (optionnel) :
- [ ] Tests complets (`scripts/test-checklist.md`)
- [ ] Build Android/iOS pour test réel
- [ ] Intégrer logs dans assignmentService

**Moyen terme** :
- [ ] Notifications FCM
- [ ] Écran visualisation logs
- [ ] Améliorer UI restante

---

## 🆘 Problèmes ?

### Erreur "index missing"
- ✅ Solution : Attendre que les index soient "Enabled" dans Firebase Console

### Erreur "permission denied"
- ✅ Solution : Rules pas déployées → `firebase deploy --only firestore:rules`

### Pas de résultats de recherche
- ✅ Solution : Soldats pas migrés → `npm run migrate:soldiers`

### Utilisateur n'a pas les permissions
- ✅ Solution : Rôles pas configurés → `npm run setup:claims`
- ⚠️ User doit se **déconnecter/reconnecter**

---

## 📚 Documentation

- **Détails techniques** : `docs/REFACTORING-SUMMARY.md`
- **Guide rapide** : `QUICK-START.md`
- **Tests complets** : `scripts/test-checklist.md`
- **Scripts** : `scripts/README.md`

---

**🎊 Félicitations ! Votre application est déployée et fonctionnelle ! 🚀**




