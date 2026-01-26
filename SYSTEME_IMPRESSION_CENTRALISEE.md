# 🖨️ Système d'Impression Centralisée - Gestion 982

## 📐 Architecture du système

```
┌─────────────────────┐
│  Téléphone/Tablette │
│   (Soldat signe)    │
└──────────┬──────────┘
           │ 1. Signature + Génération PDF
           ▼
┌─────────────────────┐
│   Firebase Cloud    │
│  ┌───────────────┐  │
│  │  Storage      │  │ ← PDF stocké
│  │  (PDFs)       │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Firestore    │  │ ← File d'attente
│  │  print_queue  │  │
│  └───────────────┘  │
└──────────┬──────────┘
           │ 2. Notification en temps réel
           ▼
┌─────────────────────┐
│   Ordinateur avec   │
│  Service Node.js    │
│  (Écoute Firebase)  │
└──────────┬──────────┘
           │ 3. Télécharge PDF + Imprime
           ▼
┌─────────────────────┐
│     Imprimante      │
│   📄 Document       │
└─────────────────────┘
```

---

## 🔄 Flux de données détaillé

### 1. **Signature du soldat** (Application mobile)
```typescript
// Dans CombatAssignmentScreen.tsx
const handleSubmit = async () => {
  // ... Sauvegarde de l'assignation ...

  // Génération du PDF
  const html = generatePDFHTML(assignmentData);
  const { base64 } = await Print.printToFileAsync({ html, base64: true });

  // Envoi à la file d'attente centralisée
  await printQueueService.addPrintJob(base64, {
    soldierName,
    soldierPersonalNumber,
    documentType: 'combat',
    createdBy: user.id,
    createdByName: user.displayName,
  });
}
```

### 2. **Stockage dans Firebase**
```
Firebase Storage: print_queue/combat_1234567_1737901234567.pdf
Firebase Firestore: print_queue/doc123
{
  pdfUrl: "https://storage.googleapis.com/...",
  soldierName: "יוסי כהן",
  soldierPersonalNumber: "1234567",
  documentType: "combat",
  status: "pending",
  createdAt: Timestamp,
  createdBy: "user123",
  createdByName: "David Levi",
  metadata: {
    itemsCount: 5,
    company: "א"
  }
}
```

### 3. **Détection et impression** (Service Node.js)
```javascript
// printer-service/index.js
const query = db.collection('print_queue')
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'asc');

query.onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      processPrintJob(change.doc); // ← Impression automatique
    }
  });
});
```

---

## 📦 Composants du système

### 1. **Service Firebase** (`printQueueService.ts`)
**Rôle**: Gestion de la file d'attente d'impression

**Fonctions principales**:
- `addPrintJob()` - Ajoute un PDF à la file
- `listenForPrintJobs()` - Écoute les nouveaux jobs
- `markAsCompleted()` - Marque un job comme imprimé
- `markAsFailed()` - Marque un job comme échoué
- `cleanupOldJobs()` - Nettoie les jobs complétés

**Localisation**: `src/services/printQueueService.ts`

### 2. **Service d'impression** (Node.js)
**Rôle**: Application qui tourne sur l'ordinateur avec l'imprimante

**Fonctionnalités**:
- ✅ Écoute Firebase en temps réel
- ✅ Télécharge automatiquement les PDFs
- ✅ Imprime sur l'imprimante locale
- ✅ Met à jour le statut dans Firebase
- ✅ Nettoie les fichiers temporaires
- ✅ Logs colorés et détaillés

**Localisation**: `printer-service/index.js`

**Technologies**:
- `firebase-admin` - Connexion à Firebase
- `pdf-to-printer` - Impression des PDFs
- `axios` - Téléchargement des fichiers
- `fs-extra` - Gestion des fichiers

### 3. **Intégration mobile** (`CombatAssignmentScreen.tsx`)
**Rôle**: Interface pour envoyer les documents à la file

**Modifications apportées**:
- Import du service `printQueueService`
- Fonction `sendToPrintQueue()` - Envoie le PDF à Firebase
- Fonction `generatePDFHTML()` - Génère le HTML du document
- Options après signature pour choisir le mode d'impression

**Localisation**: `src/screens/arme/CombatAssignmentScreen.tsx`

---

## ⚙️ États d'un job d'impression

```
pending → printing → completed
    ↓
  failed
```

| État | Description | Qui le définit |
|------|-------------|----------------|
| `pending` | En attente d'impression | Application mobile |
| `printing` | En cours d'impression | Service Node.js |
| `completed` | Imprimé avec succès | Service Node.js |
| `failed` | Échec de l'impression | Service Node.js |

---

## 🔧 Configuration requise

### Sur l'ordinateur d'impression

1. **Système d'exploitation**:
   - Windows 10/11
   - macOS 10.14+
   - Linux (Ubuntu, Debian, etc.)

2. **Logiciels**:
   - Node.js 16+ ([télécharger](https://nodejs.org/))
   - Pilotes d'imprimante installés

3. **Réseau**:
   - Connexion internet stable
   - Accès à Firebase

4. **Fichiers**:
   - `serviceAccountKey.json` (clé Firebase Admin)
   - Configuration `.env`

### Sur les appareils mobiles

1. **Application Gestion 982** installée
2. Connexion à Firebase
3. Permissions de stockage (pour générer les PDFs)

---

## 📋 Installation complète

### Étape 1: Configuration Firebase

1. Créez la collection `print_queue` dans Firestore
2. Configurez les règles de sécurité:
```javascript
match /print_queue/{document} {
  // Lecture/écriture pour les utilisateurs authentifiés
  allow read, write: if request.auth != null;
}
```

3. Créez le dossier `print_queue/` dans Storage

### Étape 2: Installation du service Node.js

```bash
cd printer-service
npm install
copy .env.example .env
# Éditez .env avec vos paramètres
npm start
```

### Étape 3: Configuration de l'application mobile

Le code est déjà intégré, aucune action nécessaire!

---

## 🧪 Test du système

### Test manuel complet

1. **Démarrez le service d'impression**:
   ```bash
   cd printer-service
   npm start
   ```
   Vous devriez voir: "👂 En écoute des nouveaux jobs..."

2. **Faites signer un soldat** dans l'application mobile

3. **Observez les logs** dans le terminal:
   ```
   🆕 Nouveau job d'impression: abc123
   ⬇ Téléchargement du PDF...
   🖨️  Impression en cours...
   ✓ Document imprimé avec succès!
   ```

4. **Vérifiez l'imprimante** - Le document devrait sortir!

5. **Vérifiez Firebase Console**:
   - Collection `print_queue`
   - Le document devrait avoir `status: "completed"`

### Test de charge

Pour tester avec plusieurs documents:

1. Faites signer 5-10 soldats rapidement
2. Observez que le service traite les jobs **dans l'ordre** (FIFO)
3. Vérifiez qu'aucun document n'est perdu

---

## 🔍 Monitoring et maintenance

### Vérifier la file d'attente

**Firebase Console**:
1. Firestore Database → `print_queue`
2. Filtrez par `status == "pending"` pour voir les jobs en attente
3. Filtrez par `status == "failed"` pour voir les échecs

**Requête programmatique**:
```typescript
const pendingJobs = await printQueueService.getPendingJobs();
console.log(`${pendingJobs.length} jobs en attente`);
```

### Nettoyer les anciens jobs

Automatiquement (service Node.js):
```javascript
// Ajouter dans index.js
setInterval(async () => {
  const count = await printQueueService.cleanupOldJobs();
  log(`✓ ${count} anciens jobs nettoyés`, 'green');
}, 24 * 60 * 60 * 1000); // Tous les jours
```

Manuellement (Firebase Console):
- Supprimez les documents avec `status == "completed"` et `printedAt` > 7 jours

---

## 🚨 Gestion des erreurs

### Problèmes courants et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| Jobs restent en "pending" | Service Node.js arrêté | Redémarrer le service |
| "Failed to print" | Imprimante hors ligne | Vérifier l'imprimante |
| "Firebase connection error" | Pas d'internet | Vérifier la connexion |
| "Permission denied" | Règles Firestore | Vérifier les permissions |
| PDF ne se télécharge pas | Storage Rules | Configurer les règles Storage |

### Logs détaillés

Le service Node.js affiche des logs colorés:
- 🟢 **Vert**: Succès
- 🔵 **Bleu**: Informations
- 🟡 **Jaune**: Avertissements
- 🔴 **Rouge**: Erreurs

### Retry automatique

En cas d'échec, le job est marqué comme "failed" mais reste dans la collection.
Pour réessayer:
```javascript
// Dans Firebase Console ou via script
await db.collection('print_queue').doc('job123').update({
  status: 'pending',
  error: null,
});
```

---

## 📊 Métriques et statistiques

### KPIs à surveiller

1. **Temps moyen d'impression**:
   - `printedAt - createdAt`
   - Objectif: < 10 secondes

2. **Taux de succès**:
   - `completed / (completed + failed)`
   - Objectif: > 95%

3. **Jobs en attente**:
   - Count de `status == "pending"`
   - Objectif: < 5

4. **Âge moyen des jobs pending**:
   - `now - createdAt` pour status == "pending"
   - Objectif: < 30 secondes

---

## 🔐 Sécurité et bonnes pratiques

### ✅ À FAIRE

- ✅ Garder `serviceAccountKey.json` **secret**
- ✅ Ne PAS committer `.env` dans Git
- ✅ Utiliser un ordinateur **sécurisé** pour le service
- ✅ Activer l'authentification Firebase
- ✅ Limiter les permissions Firestore au minimum
- ✅ Faire des backups réguliers
- ✅ Nettoyer les anciens jobs (>7 jours)

### ❌ À NE PAS FAIRE

- ❌ Partager `serviceAccountKey.json`
- ❌ Laisser l'ordinateur accessible à tous
- ❌ Utiliser le WiFi public pour le service
- ❌ Désactiver les règles de sécurité Firebase
- ❌ Stocker les PDFs indéfiniment

---

## 🎯 Avantages du système centralisé

| Avantage | Description |
|----------|-------------|
| 📱 **Multi-appareils** | N'importe quel appareil peut imprimer |
| 🔄 **Automatique** | Aucune intervention manuelle requise |
| 📊 **Traçable** | Tous les jobs sont enregistrés dans Firebase |
| 🛡️ **Fiable** | Les jobs ne sont jamais perdus |
| 🚀 **Rapide** | Impression en <10 secondes |
| 💰 **Économique** | Une seule imprimante pour tout le monde |
| 🔧 **Maintenable** | Centralisation = maintenance facile |

---

## 📞 Support et contact

Pour toute question ou problème:

1. **Documentation**: Consultez ce fichier et `printer-service/README.md`
2. **Logs**: Vérifiez les logs du service Node.js
3. **Firebase Console**: Inspectez la collection `print_queue`
4. **Administrateur système**: Contactez l'équipe technique

---

**Version du système**: 1.0.0
**Date de création**: 2026-01-26
**Auteur**: Gestion 982 Team
