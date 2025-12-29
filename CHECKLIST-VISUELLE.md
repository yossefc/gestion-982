# ✅ CHECKLIST RAPIDE - À COCHER

Imprimez ou suivez cette liste. Cochez au fur et à mesure. ⏱️ **30 minutes**

---

## 📋 PRÉPARATION (5 min)

- [ ] **1.1** Ouvrir PowerShell dans `D:\gestion-982`
- [ ] **1.2** Vérifier que vous êtes sur la branche `main`
      ```powershell
      git branch
      ```
- [ ] **1.3** Vérifier compilation
      ```powershell
      npm run typecheck
      ```
      ✅ Attendu : Pas d'erreur

---

## 🔴 FIREBASE DEPLOYMENT (10 min)

### Option Automatique (Recommandé)

- [ ] **2.1** Autoriser scripts PowerShell (une seule fois)
      ```powershell
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
      ```
      Répondre : **O** (Oui)

- [ ] **2.2** Lancer le script
      ```powershell
      .\deploy-windows.ps1
      ```

- [ ] **2.3** Login Firebase (navigateur s'ouvre)
      ✅ Se connecter avec votre compte Google

- [ ] **2.4** Déployer Rules
      ✅ Répondre **o** quand demandé

- [ ] **2.5** Déployer Index
      ✅ Répondre **o** quand demandé

- [ ] **2.6** Vérifier dans Firebase Console
      - Aller sur https://console.firebase.google.com
      - Firestore → Index
      - ✅ 5 index visibles (status "Enabled" ou "Building")

---

## 🟠 CONFIGURATION .env (3 min)

- [ ] **3.1** Copier le template
      ```powershell
      copy .env.example .env
      ```

- [ ] **3.2** Ouvrir dans éditeur
      ```powershell
      code .env
      ```

- [ ] **3.3** Remplir les valeurs Firebase
      - Firebase Console → ⚙️ Settings → General → Your apps
      - Copier `firebaseConfig` values
      - Coller dans `.env`

- [ ] **3.4** Sauvegarder le fichier

---

## 🟠 SERVICE ACCOUNT KEY (3 min)

- [ ] **4.1** Aller sur Firebase Console
      https://console.firebase.google.com

- [ ] **4.2** Project Settings → Service Accounts

- [ ] **4.3** Cliquer "Generate new private key"

- [ ] **4.4** Télécharger le fichier JSON

- [ ] **4.5** Renommer en `serviceAccountKey.json`

- [ ] **4.6** Placer dans `D:\gestion-982\`

- [ ] **4.7** Vérifier
      ```powershell
      Test-Path .\serviceAccountKey.json
      ```
      ✅ Doit retourner : **True**

---

## 🟠 MIGRATION SOLDATS (3 min)

- [ ] **5.1** (Optionnel) Backup Firestore
      ```powershell
      firebase firestore:export gs://YOUR_BUCKET/backup
      ```
      Ou via Firebase Console

- [ ] **5.2** Lancer migration
      ```powershell
      npm run migrate:soldiers
      ```

- [ ] **5.3** Vérifier sortie
      ✅ Doit afficher : "✅ X soldats migrés avec succès"

- [ ] **5.4** Vérifier dans Firestore
      - Console → Firestore → soldiers
      - Ouvrir un document
      - ✅ Champs `searchKey` et `nameLower` présents

---

## 🟠 CONFIGURATION RÔLES (5 min)

- [ ] **6.1** Lancer l'interface
      ```powershell
      npm run setup:claims
      ```

- [ ] **6.2** Lister les utilisateurs
      Taper : **1** puis Enter

- [ ] **6.3** Noter les emails de chaque utilisateur

- [ ] **6.4** Attribuer les rôles
      Taper : **2** puis Enter
      
      Pour chaque utilisateur :
      - [ ] Email : `___________________`  Rôle : ______ (admin/arme/vetement/both)
      - [ ] Email : `___________________`  Rôle : ______ 
      - [ ] Email : `___________________`  Rôle : ______
      - [ ] Email : `___________________`  Rôle : ______

- [ ] **6.5** Quitter
      Taper : **3**

---

## 🎯 TESTS (5 min)

- [ ] **7.1** Lancer l'app
      ```powershell
      npm start
      ```
      Puis taper : **a** (Android) ou **i** (iOS)

- [ ] **7.2** LOGIN
      - Se connecter avec un utilisateur
      - ✅ Connexion réussie

- [ ] **7.3** RECHERCHE
      - Aller dans "חיפוש חייל"
      - Taper un nom
      - ✅ Résultats instantanés

- [ ] **7.4** PAGINATION
      - Scroller vers le bas
      - ✅ "charger plus" fonctionne

- [ ] **7.5** CRÉATION
      - Cliquer "הוסף חייל"
      - Remplir formulaire
      - ✅ Message "החייל נוסף בהצלחה"

- [ ] **7.6** PERMISSIONS
      - Vérifier modules selon rôle
      - ✅ Admin voit tout
      - ✅ Arme voit module נשקייה
      - ✅ Vetement voit module אפסנאות

---

## 🎉 TERMINÉ !

- [ ] **8.1** Tous les tests passent ✅

- [ ] **8.2** Documenter problèmes (si présents)
      Dans fichier : `BUGS.md`

- [ ] **8.3** Commit les changements
      ```powershell
      git add .
      git commit -m "chore: déploiement v2.0.0 avec index et rules"
      ```

---

## 📊 RÉSUMÉ

| Étape | Status | Durée |
|-------|--------|-------|
| Préparation | ⬜ | 5 min |
| Firebase Deploy | ⬜ | 10 min |
| Config .env | ⬜ | 3 min |
| Service Account | ⬜ | 3 min |
| Migration | ⬜ | 3 min |
| Rôles | ⬜ | 5 min |
| Tests | ⬜ | 5 min |
| **TOTAL** | **⬜** | **34 min** |

---

## 🆘 AIDE

**Problème ?** Ouvrir : `GUIDE-PRATIQUE-DEPLOIEMENT.md`

**Erreur ?** Chercher dans : Section "🆘 Problèmes ?"

**Questions ?** Lire : `docs/REFACTORING-SUMMARY.md`

---

**Date de complétion** : ________________  
**Effectué par** : ________________  
**Problèmes rencontrés** : ________________

---

✨ **Bon déploiement !** ✨




