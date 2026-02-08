# 🖥️ INSTALLATION SUR UN NOUVEL ORDINATEUR

## Guide complet pour installer le service d'impression sur un PC sans le projet

---

## 📦 CE DONT VOUS AVEZ BESOIN

### Fichiers à copier depuis l'ordinateur de développement:

**Copiez ce dossier complet:**
```
D:\gestion-982\web-printer-service\
```

**ET ce fichier (important!):**
```
D:\gestion-982\serviceAccountKey.json
```

---

## 💾 OPTION 1: Copie par clé USB

### Sur l'ordinateur de développement:

1. **Créez un dossier** sur votre bureau: `Impression-Gestion-982`

2. **Copiez ces fichiers dedans:**
   ```
   web-printer-service/
   ├── impression-service.js
   ├── package.json
   ├── DEMARRER-SERVICE.bat
   └── GUIDE-SERVICE-NODE.md

   serviceAccountKey.json (à la racine du dossier)
   ```

3. **Structure finale:**
   ```
   Impression-Gestion-982/
   ├── impression-service.js
   ├── package.json
   ├── DEMARRER-SERVICE.bat
   ├── GUIDE-SERVICE-NODE.md
   └── serviceAccountKey.json
   ```

4. **Copiez** ce dossier sur une **clé USB**

### Sur le nouvel ordinateur (près de l'imprimante):

1. **Copiez** le dossier depuis la clé USB vers:
   ```
   C:\Impression-Gestion-982\
   ```

---

## 💾 OPTION 2: Via GitHub (si le projet est sur GitHub)

### Sur le nouvel ordinateur:

1. **Clonez le repo:**
   ```bash
   git clone https://github.com/yossefc/gestion-982.git
   cd gestion-982/web-printer-service
   ```

2. **Copiez serviceAccountKey.json** depuis la clé USB vers le dossier parent

---

## 💾 OPTION 3: Fichiers individuels (le plus simple)

Je vais créer un package ZIP avec juste les fichiers nécessaires...

---

## 🔧 INSTALLATION SUR LE NOUVEAU PC

### Étape 1: Installer Node.js

1. **Téléchargez** Node.js: https://nodejs.org/
2. Choisissez **LTS** (version stable)
3. **Installez** (suivez l'assistant, laissez les options par défaut)
4. **Redémarrez** l'ordinateur

**Vérifiez l'installation:**
```bash
node --version
npm --version
```

### Étape 2: Configurer l'imprimante

1. **Connectez** votre imprimante à l'ordinateur
2. **Installez** les pilotes si nécessaire
3. **Définissez comme imprimante par défaut:**
   - Windows → Paramètres → Périphériques → Imprimantes
   - Clic droit sur votre imprimante → "Définir comme imprimante par défaut"

**Vérifiez:**
```powershell
Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true}
```

### Étape 3: Vérifier les fichiers

**Allez dans le dossier:**
```
C:\Impression-Gestion-982\
```

**Vous devez avoir:**
- ✅ impression-service.js
- ✅ package.json
- ✅ DEMARRER-SERVICE.bat
- ✅ serviceAccountKey.json

**IMPORTANT:** Le fichier `serviceAccountKey.json` doit être **dans le dossier parent** du dossier web-printer-service!

Structure correcte:
```
C:\Impression-Gestion-982\
├── impression-service.js
├── package.json
├── DEMARRER-SERVICE.bat
└── serviceAccountKey.json
```

### Étape 4: Installer les dépendances

**Ouvrez PowerShell ou CMD dans le dossier:**
```bash
cd C:\Impression-Gestion-982
npm install
```

**Patientez 2-3 minutes** (télécharge firebase-admin)

### Étape 5: Lancer le service!

**Double-cliquez sur:**
```
DEMARRER-SERVICE.bat
```

**Vous devriez voir:**
```
========================================
  SERVICE D'IMPRESSION AUTOMATIQUE
  GESTION-982
========================================

[1/3] Node.js detecte
v20.x.x

[2/3] Dependances deja installees

[3/3] Demarrage du service...

========================================
  SERVICE ACTIF!
========================================

📡 En attente de tâches d'impression...
```

**C'est prêt!** 🎉

---

## ✅ TEST

1. **Gardez la fenêtre ouverte**
2. **Sur l'app mobile**, créez une attribution
3. **Le soldat signe**
4. **Regardez la console** - le PDF s'imprime automatiquement!

---

## 🔄 DÉMARRAGE AUTOMATIQUE (optionnel)

Pour que le service démarre automatiquement au démarrage de Windows:

### Méthode 1: Raccourci dans le dossier Démarrage

1. **Appuyez sur** `Win + R`
2. **Tapez:** `shell:startup`
3. **Créez un raccourci** vers `DEMARRER-SERVICE.bat` dans ce dossier

### Méthode 2: Tâche planifiée (plus avancé)

1. **Ouvrez** "Planificateur de tâches"
2. **Créez une tâche basique**
   - Nom: "Service Impression Gestion-982"
   - Déclencheur: Au démarrage
   - Action: Démarrer un programme
   - Programme: `C:\Impression-Gestion-982\DEMARRER-SERVICE.bat`

---

## 🔐 SÉCURITÉ

**⚠️ IMPORTANT:**

Le fichier `serviceAccountKey.json` contient des **identifiants sensibles**!

**Protégez-le:**
1. Ne le partagez jamais
2. Ne le mettez jamais sur GitHub
3. Gardez-le uniquement sur l'ordinateur d'impression

---

## 🆘 DÉPANNAGE

### "Node.js n'est pas installé"
→ Installez Node.js: https://nodejs.org/
→ Redémarrez l'ordinateur

### "serviceAccountKey.json introuvable"
→ Vérifiez que le fichier est au bon endroit
→ Le chemin doit être: `C:\Impression-Gestion-982\serviceAccountKey.json`

### "npm install" échoue
→ Vérifiez votre connexion internet
→ Essayez: `npm install --force`

### Rien ne s'imprime
→ Vérifiez l'imprimante par défaut
→ Testez une impression manuelle
→ Regardez les erreurs dans la console

---

## 📝 CHECKLIST D'INSTALLATION

- [ ] Node.js installé (https://nodejs.org/)
- [ ] Ordinateur redémarré après installation Node.js
- [ ] Fichiers copiés dans `C:\Impression-Gestion-982\`
- [ ] serviceAccountKey.json présent
- [ ] Imprimante connectée et définie par défaut
- [ ] `npm install` exécuté avec succès
- [ ] Service démarré avec `DEMARRER-SERVICE.bat`
- [ ] Test réussi avec l'app mobile

---

## 🎊 UTILISATION QUOTIDIENNE

**Chaque matin:**
1. Allumez l'ordinateur
2. Allumez l'imprimante
3. Lancez `DEMARRER-SERVICE.bat`
4. Laissez tourner toute la journée

**Chaque soir:**
- Fermez la fenêtre (Ctrl+C ou cliquez sur X)
- Éteignez l'ordinateur

---

**Vous êtes prêt! Le service d'impression est maintenant opérationnel sur le nouvel ordinateur! 🖨️✨**
