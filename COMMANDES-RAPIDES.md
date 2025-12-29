# ⚡ COMMANDES RAPIDES - Copier/Coller

**Utilisez ces commandes une par une dans PowerShell**

---

## 🔥 Option 1: Script Automatique (Recommandé)

### Étape 1: Autoriser les scripts (une seule fois)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Répondre: **O** (Oui)

### Étape 2: Lancer le script
```powershell
.\deploy-windows.ps1
```

Le script va vous guider pour :
- ✅ Deploy rules
- ✅ Deploy index
- ✅ Migration soldats (optionnel)
- ✅ Setup rôles (optionnel)

---

## 🔧 Option 2: Commandes Manuelles

### 1. Installer Firebase CLI (si nécessaire)
```powershell
npm install -g firebase-tools
```

### 2. Login Firebase
```powershell
firebase login
```
→ Navigateur s'ouvre → Connectez-vous

### 3. Déployer Rules
```powershell
firebase deploy --only firestore:rules
```
✅ Attendu: "Deploy complete!"

### 4. Déployer Index
```powershell
firebase deploy --only firestore:indexes
```
✅ Attendu: "Deploy complete!"
⏳ Les index prennent 5-10 min pour être actifs

---

## 📝 Configuration .env

### Créer le fichier
```powershell
copy .env.example .env
code .env
```

### Remplir avec vos valeurs Firebase
```env
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc...
```

**Où trouver ces valeurs?**
→ Firebase Console → ⚙️ Settings → General → Your apps → Web app

---

## 🗄️ Migration Soldats

### Prérequis
- `.env` configuré avec Firebase credentials

### Commande
```powershell
npm run migrate:soldiers
```

✅ Attendu: "✅ X soldats migrés avec succès"

---

## 👥 Configuration Rôles

### Prérequis
1. Télécharger `serviceAccountKey.json` depuis Firebase Console
   - Settings → Service Accounts → Generate new private key
2. Placer dans `D:\gestion-982\`

### Commande
```powershell
npm run setup:claims
```

### Dans l'interface
```
Options:
1. Lister les utilisateurs
2. Attribuer un rôle
3. Quitter
```

Pour chaque utilisateur:
1. Taper `2`
2. Entrer email
3. Choisir rôle (1=admin, 2=arme, 3=vetement, 4=both)
4. Répéter

---

## 🧪 Tester l'App

```powershell
npm start
```
Puis taper: **a** (Android) ou **i** (iOS)

### Tests rapides
1. ✅ Login fonctionne
2. ✅ Recherche soldat → résultats instantanés
3. ✅ Scroll liste → pagination infinie
4. ✅ Créer soldat → succès

---

## 🆘 Problèmes Courants

### Erreur "Firebase CLI not found"
```powershell
npm install -g firebase-tools
```

### Erreur "index missing"
→ Attendre 5-10 minutes que les index soient actifs
→ Vérifier: Firebase Console → Firestore → Index

### Erreur "permission denied"
```powershell
firebase deploy --only firestore:rules
```

### Pas de résultats recherche
```powershell
npm run migrate:soldiers
```

### Script PowerShell bloqué
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## ✅ Vérifications

### Index actifs?
1. Firebase Console
2. Firestore → Index
3. ✅ 5 index "Enabled"

### Rules déployées?
1. Firebase Console
2. Firestore → Rules
3. ✅ Date récente

### Soldats migrés?
1. Firebase Console
2. Firestore → soldiers
3. Ouvrir un doc
4. ✅ Champs `searchKey` et `nameLower`

### Rôles configurés?
1. Firebase Console
2. Authentication → Users
3. Cliquer sur un user
4. ✅ Custom claims: `{ "role": "admin" }`

---

## 📚 Documentation

| Besoin | Fichier |
|--------|---------|
| Vue d'ensemble | `POUR-VOUS.md` |
| Guide complet | `GUIDE-PRATIQUE-DEPLOIEMENT.md` |
| Checklist | `CHECKLIST-VISUELLE.md` |
| Aide rapide | `START-RAPIDE.md` |
| Index | `INDEX-DOCUMENTATION.md` |

---

**🎯 COMMANDE PRINCIPALE**

```powershell
.\deploy-windows.ps1
```

**C'est la commande magique qui fait TOUT ! ✨**

---

**Bon déploiement ! 🚀**




