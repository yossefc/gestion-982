# 📜 Scripts Gestion-982

Ce dossier contient les scripts utilitaires pour déployer et configurer l'application.

---

## 🚀 Scripts Disponibles

### 1. Migration des Soldats

**Fichier** : `migrate-soldiers.ts`

**Description** : Ajoute les champs `searchKey` et `nameLower` aux soldats existants pour activer la recherche performante.

**Prérequis** :
- Configurer `.env` avec les credentials Firebase
- Installer ts-node : `npm install -g ts-node`

**Usage** :
```bash
# Via npm script
npm run migrate:soldiers

# Ou directement
npx ts-node scripts/migrate-soldiers.ts
```

**Ce que fait le script** :
1. Se connecte à Firestore
2. Récupère tous les soldats
3. Calcule `searchKey` et `nameLower` pour chacun
4. Met à jour les documents
5. Affiche un résumé

**Sortie attendue** :
```
🚀 Démarrage de la migration des soldats...
📥 Récupération des soldats...
✅ 150 soldats trouvés

✅ Migré: David Cohen (1234567)
   searchKey: "david cohen 1234567 050-1234567 פלוגה א"
   nameLower: "david cohen"

...

📊 RÉSUMÉ DE LA MIGRATION
✅ Migrés avec succès : 150
⏭️  Déjà migrés (ignorés): 0
❌ Erreurs            : 0
📦 Total             : 150
```

---

### 2. Configuration Custom Claims (Rôles)

**Fichier** : `setup-custom-claims.ts`

**Description** : Interface interactive pour attribuer des rôles aux utilisateurs (admin/arme/vetement/both).

**Prérequis** :
1. Télécharger `serviceAccountKey.json` depuis Firebase Console :
   - Firebase Console → Project Settings → Service Accounts
   - Cliquer "Generate new private key"
2. Définir la variable d'environnement :
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
   ```
3. Installer firebase-admin :
   ```bash
   npm install --save-dev firebase-admin
   ```

**Usage** :
```bash
# Via npm script
npm run setup:claims

# Ou directement
npx ts-node scripts/setup-custom-claims.ts
```

**Interface** :
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

Votre choix (1/2/3): 2
Email de l'utilisateur: user@example.com

Rôles:
1. admin
2. arme
3. vetement
4. both

Choisir un rôle (1/2/3/4): 1
✅ Rôle "admin" attribué à user@example.com (UID: abc123)
```

---

### 3. Script de Déploiement

**Fichier** : `deploy.sh`

**Description** : Script Bash pour déployer les composants Firebase (rules, indexes, functions).

**Prérequis** :
- Firebase CLI installé : `npm install -g firebase-tools`
- Authentifié : `firebase login`
- Fichier `firestore.rules` (copié depuis `docs/firestore-rules.txt`)

**Usage** :
```bash
# Via npm script
npm run deploy

# Ou directement (Linux/Mac)
bash scripts/deploy.sh

# Windows (Git Bash ou WSL)
bash scripts/deploy.sh
```

**Étapes interactives** :
1. ✅ Vérification TypeScript
2. ✅ Vérification Firebase CLI
3. 🔐 Login Firebase
4. 📋 Déploiement Firestore Rules (confirmation)
5. 📊 Déploiement Index Firestore (confirmation)
6. ⚡ Déploiement Cloud Functions (confirmation)

---

## 📋 Checklist de Tests

**Fichier** : `test-checklist.md`

Liste complète des tests à effectuer avant mise en production :
- ✅ Tests fonctionnels (auth, CRUD, recherche, exports)
- ✅ Tests Firestore (index, rules)
- ✅ Tests plateformes (Android, iOS, Web)
- ✅ Tests erreurs et cas limites

**Usage** :
1. Ouvrir `scripts/test-checklist.md`
2. Cocher chaque test au fur et à mesure
3. Documenter les bugs dans `BUGS.md`

---

## 🔧 Configuration

### Variables d'environnement

Créer un fichier `.env` à la racine du projet (voir `.env.example`) :

```env
# Firebase Config
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Environnement
NODE_ENV=production
```

### Index Firestore

Le fichier `firestore.indexes.json` contient tous les index requis.

**Déploiement** :
```bash
firebase deploy --only firestore:indexes
```

**Ou via Firebase Console** :
1. Aller dans Firestore → Index
2. Créer manuellement chaque index selon `docs/firestore-indexes.md`

---

## 🐛 Troubleshooting

### Erreur "Cannot find module 'firebase-admin'"
```bash
npm install --save-dev firebase-admin
```

### Erreur "GOOGLE_APPLICATION_CREDENTIALS not set"
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
```

### Erreur "Permission denied" (Linux/Mac)
```bash
chmod +x scripts/deploy.sh
```

### Erreur de compilation TypeScript dans scripts
Les scripts sont exclus du tsconfig principal. Pour vérifier :
```bash
npx tsc --noEmit --project tsconfig.scripts.json
```

---

## 📚 Ressources

- **Firebase Admin SDK** : https://firebase.google.com/docs/admin/setup
- **Firestore Index** : https://firebase.google.com/docs/firestore/query-data/indexing
- **Custom Claims** : https://firebase.google.com/docs/auth/admin/custom-claims

---

## ✅ Ordre d'Exécution Recommandé

1. **Déployer les rules et index**
   ```bash
   npm run deploy
   ```

2. **Migrer les soldats existants**
   ```bash
   npm run migrate:soldiers
   ```

3. **Configurer les rôles utilisateurs**
   ```bash
   npm run setup:claims
   ```

4. **Tester l'application**
   - Suivre `scripts/test-checklist.md`

---

**Questions ?** Voir `docs/REFACTORING-SUMMARY.md` pour plus de détails.





