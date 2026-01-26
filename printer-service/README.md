# 🖨️ Service d'Impression Centralisé - Gestion 982

Ce service permet d'imprimer automatiquement tous les documents signés depuis n'importe quel appareil (téléphone, tablette) sur une imprimante centrale connectée à un ordinateur.

---

## 📋 Comment ça fonctionne

```
[Téléphone/Tablette]  →  [Firebase]  →  [Ordinateur + Imprimante]
     (Signature)         (File d'attente)     (Impression auto)
```

1. **Un soldat signe** sur un téléphone/tablette
2. **Le document PDF est envoyé** dans Firebase (file d'attente)
3. **L'ordinateur détecte** le nouveau document automatiquement
4. **L'imprimante imprime** le document immédiatement

---

## 🚀 Installation

### Prérequis
- Node.js (version 16 ou supérieure) - [Télécharger](https://nodejs.org/)
- Une imprimante connectée à l'ordinateur
- Le fichier `serviceAccountKey.json` (demandez à l'administrateur)

### Étape 1: Installation des dépendances

```bash
cd printer-service
npm install
```

### Étape 2: Configuration

1. Copiez le fichier `.env.example` en `.env`:
   ```bash
   copy .env.example .env
   ```

2. Éditez le fichier `.env`:
   ```env
   SERVICE_ACCOUNT_PATH=../serviceAccountKey.json
   PRINTER_NAME=
   ```

3. **Configuration de l'imprimante:**

#### Windows:
- Ouvrez **Paramètres** > **Imprimantes et scanners**
- Notez le nom exact de votre imprimante
- Exemple: `HP LaserJet Pro MFP M428fdw`
- Mettez ce nom dans `.env`:
  ```env
  PRINTER_NAME=HP LaserJet Pro MFP M428fdw
  ```
- **OU laissez vide** pour utiliser l'imprimante par défaut

#### Mac:
- Ouvrez **Préférences Système** > **Imprimantes et scanners**
- Notez le nom de votre imprimante
- Exemple: `Canon_TR8500`

#### Linux:
- Listez les imprimantes: `lpstat -p -d`
- Utilisez le nom CUPS de l'imprimante

---

## 🎯 Utilisation

### Démarrer le service

```bash
npm start
```

Vous verrez:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖨️  SERVICE D'IMPRESSION GESTION 982 - DÉMARRÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ID Imprimante: YOUR-COMPUTER-NAME
   Imprimante cible: Par défaut
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👂 En écoute des nouveaux jobs...
```

### Quand un document arrive

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆕 Nouveau job d'impression: abc123
   Soldat: יוסי כהן (1234567)
   Type: combat
   Créé par: David Levi
✓ Job marqué comme "en cours d'impression"
⬇ Téléchargement du PDF...
✓ PDF téléchargé
🖨️  Impression en cours: יוסי כהן...
✓ Document imprimé avec succès!
✓ Job marqué comme "complété"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Arrêter le service

Appuyez sur `Ctrl + C`

---

## 🔧 Démarrage automatique au démarrage de Windows

### Option 1: Tâche planifiée Windows

1. Ouvrez **Planificateur de tâches**
2. Créez une nouvelle tâche:
   - **Nom**: Service Impression Gestion 982
   - **Déclencheur**: À l'ouverture de session
   - **Action**: Démarrer un programme
     - Programme: `node`
     - Arguments: `C:\chemin\vers\gestion-982\printer-service\index.js`
     - Démarrer dans: `C:\chemin\vers\gestion-982\printer-service`

### Option 2: Fichier Batch (.bat)

1. Créez un fichier `start-printer-service.bat`:
```bat
@echo off
cd /d "D:\gestion-982\printer-service"
start node index.js
```

2. Placez un raccourci dans:
   - `C:\Users\VOTRE_NOM\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

---

## 📱 Configuration dans l'application mobile

Pour envoyer les documents à la file d'attente centralisée au lieu d'imprimer localement:

1. Dans l'écran d'assignation de combat, après la signature
2. L'application demandera:
   - **הדפס כאן** (Imprimer ici) - Imprime sur l'appareil local
   - **שלח למדפסת מרכזית** (Envoyer à l'imprimante centrale) - Envoie à l'ordinateur

---

## ⚙️ Dépannage

### L'imprimante n'imprime pas

1. **Vérifiez que l'imprimante est allumée et connectée**
   - Testez avec une impression test Windows

2. **Vérifiez le nom de l'imprimante dans `.env`**
   - Assurez-vous qu'il correspond exactement au nom système
   - Ou laissez vide pour utiliser l'imprimante par défaut

3. **Vérifiez que le service fonctionne**
   - Vous devriez voir "👂 En écoute des nouveaux jobs..."
   - Sinon, vérifiez les erreurs affichées

### Le service ne se connecte pas à Firebase

1. **Vérifiez le fichier `serviceAccountKey.json`**
   - Il doit être dans le dossier parent: `../serviceAccountKey.json`
   - Ou modifiez le chemin dans `.env`

2. **Vérifiez votre connexion internet**
   - Firebase nécessite une connexion internet

### Les jobs restent en "pending"

1. **Redémarrez le service** (Ctrl+C puis `npm start`)
2. **Vérifiez les logs** pour voir les erreurs
3. **Vérifiez Firebase Console** - collection `print_queue`

---

## 📊 Monitoring

### Voir la file d'attente dans Firebase

1. Ouvrez [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. Allez dans **Firestore Database**
4. Collection: `print_queue`

États possibles:
- `pending` - En attente d'impression
- `printing` - En cours d'impression
- `completed` - Imprimé avec succès
- `failed` - Échec de l'impression

---

## 🛠️ Commandes utiles

```bash
# Démarrer en mode développement (redémarre automatiquement)
npm run dev

# Installer uniquement les dépendances
npm install

# Nettoyer le dossier temporaire
rm -rf temp/*  # Linux/Mac
rmdir /s temp  # Windows
```

---

## 📁 Structure des fichiers

```
printer-service/
├── index.js           # Script principal
├── package.json       # Dépendances Node.js
├── .env              # Configuration (créez-le depuis .env.example)
├── .env.example      # Exemple de configuration
├── temp/             # Fichiers PDF temporaires (auto-créé)
└── README.md         # Ce fichier
```

---

## 🔒 Sécurité

- **Ne partagez JAMAIS** le fichier `serviceAccountKey.json`
- **Ne committez PAS** le fichier `.env` dans Git
- Le service doit tourner sur un ordinateur **sécurisé** et **fiable**
- Les PDFs temporaires sont supprimés automatiquement après impression

---

## 💡 Conseils

- ✅ Gardez l'ordinateur allumé en permanence pendant les heures de travail
- ✅ Désactivez la mise en veille automatique
- ✅ Vérifiez régulièrement le niveau d'encre et de papier
- ✅ Testez le système avant de l'utiliser en production
- ✅ Gardez un backup du fichier `.env` et `serviceAccountKey.json`

---

## 📞 Support

En cas de problème:
1. Vérifiez les logs du service (dans le terminal)
2. Consultez cette documentation
3. Contactez l'administrateur système

---

**Version**: 1.0.0
**Dernière mise à jour**: 2026-01-26
