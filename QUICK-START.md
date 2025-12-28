# 🚀 Quick Start - Gestion-982

Guide rapide pour démarrer après le refactoring.

---

## 📋 Étape par Étape

### 1️⃣ Installation

```bash
# Cloner le repo
git clone https://github.com/yossefc/gestion-982.git
cd gestion-982

# Installer les dépendances
npm install

# Vérifier la compilation
npm run typecheck
```

### 2️⃣ Configuration Firebase

**a) Créer `.env`** (copier depuis `.env.example`)

```bash
cp .env.example .env
# Éditer .env avec vos credentials Firebase
```

**b) Télécharger Service Account Key**
1. Firebase Console → Project Settings → Service Accounts
2. Generate new private key → `serviceAccountKey.json`
3. Placer le fichier à la racine du projet

### 3️⃣ Déployer les Index et Rules

```bash
# Option 1: Script automatique
npm run deploy

# Option 2: Manuel
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

**Vérifier dans Firebase Console** :
- Firestore → Index → Tous les index "Ready" ✅
- Firestore → Rules → Dernière version déployée

### 4️⃣ Migrer les Données Existantes

```bash
# Ajouter searchKey et nameLower aux soldats
npm run migrate:soldiers
```

**Attendu** : `✅ X soldats migrés`

### 5️⃣ Configurer les Rôles Utilisateurs

```bash
npm run setup:claims
```

**Dans l'interface** :
1. Choisir "Lister les utilisateurs"
2. Choisir "Attribuer un rôle"
3. Entrer l'email + choisir le rôle

**Répéter pour chaque utilisateur**

### 6️⃣ Lancer l'Application

```bash
# Démarrer Expo
npm start

# Ou directement
npm run android  # Android
npm run ios      # iOS
npm run web      # Web
```

### 7️⃣ Tests Critiques

✅ **Login** : Se connecter avec un utilisateur
✅ **Recherche** : Taper un nom → résultats instantanés
✅ **Pagination** : Scroller → "charger plus" fonctionne
✅ **Création** : Ajouter un soldat → succès
✅ **Export PDF** : Exporter une attribution → PDF généré
✅ **Offline** : Mode avion → bannière "offline"

---

## 🔧 Commandes Utiles

```bash
# Vérifier TypeScript
npm run typecheck

# Migrer soldats
npm run migrate:soldiers

# Configurer rôles
npm run setup:claims

# Déployer Firebase
npm run deploy

# Lancer l'app
npm start
```

---

## 📊 Architecture (Résumé)

```
src/
├── components/       # UI réutilisables (StatCard, ModuleCard, etc.)
├── services/
│   ├── firebaseService.ts   # Service principal (CRUD unifié)
│   ├── errors.ts             # Gestion erreurs
│   ├── logService.ts         # Audit logs
│   └── notificationService.ts
├── hooks/
│   └── useSoldierSearch.ts  # Recherche + pagination
├── utils/
│   ├── normalize.ts          # Normalisation recherche
│   ├── notify.ts             # Notifications UI
│   ├── exportPDF.ts          # Export PDF
│   └── exportExcel.ts        # Export CSV
└── screens/
    ├── auth/                 # Login refactorisé
    ├── common/               # Home, Search, Add (migrés)
    ├── arme/
    └── vetement/
```

---

## 🆘 Problèmes Courants

### ❌ "searchKey index missing"
**Solution** : Créer les index Firestore (étape 3)

### ❌ "Permission denied"
**Solution** : Déployer les rules (étape 3)

### ❌ "Aucun résultat de recherche"
**Solution** : Migrer les soldats (étape 4)

### ❌ "User doesn't have permission"
**Solution** : Configurer les custom claims (étape 5)

---

## 📚 Documentation Complète

- **Résumé technique** : `docs/REFACTORING-SUMMARY.md`
- **Index Firestore** : `docs/firestore-indexes.md`
- **Firestore Rules** : `docs/firestore-rules.txt`
- **Notifications FCM** : `docs/notifications-setup.md`
- **Scripts** : `scripts/README.md`
- **Tests** : `scripts/test-checklist.md`

---

## ✅ Checklist Démarrage

- [ ] Installation (`npm install`)
- [ ] Configuration `.env`
- [ ] Service Account Key téléchargé
- [ ] Rules déployées
- [ ] Index créés (tous "Ready")
- [ ] Soldats migrés
- [ ] Rôles configurés
- [ ] App lancée
- [ ] Tests critiques OK

---

## 🎉 Prêt !

Votre app **gestion-982** est maintenant :
- ⚡ **Performante** (recherche server-side)
- 🛡️ **Sécurisée** (RBAC + logs)
- 🎨 **Moderne** (design cohérent)
- ♿ **Accessible** (RTL + labels)

**Bon développement ! 💪🇮🇱**

---

**Support** : Voir `docs/IMPROVEMENTS.md` ou créer une issue GitHub

