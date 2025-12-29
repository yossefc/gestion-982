# 🔄 Refactoring du système זיכוי (Retour d'équipement)

## 📋 Résumé des modifications

Le système de retour d'équipement a été refactoré pour:
1. ✅ Afficher **uniquement** les soldats avec équipements à rendre dans la liste זיכוי
2. ✅ Afficher **uniquement** les équipements pris (pas tout le catalogue)
3. ✅ Détecter automatiquement quand **tout est rendu**
4. 🔨 Gérer la suppression de l'ancien PDF + génération du PDF זיכוי final

---

## 🎯 Modifications effectuées

### 1️⃣ **Modèle de données** (`src/types/index.ts`)

Ajout de champs agrégés au `SoldierHoldings`:

```typescript
export interface SoldierHoldings {
  // ... champs existants ...

  // NOUVEAUX CHAMPS AGRÉGÉS
  outstandingCount: number;        // Nombre total d'items à rendre
  hasSignedEquipment: boolean;     // A déjà signé pour des équipements
  status: 'OPEN' | 'CLOSED';       // OPEN = reste à rendre, CLOSED = tout rendu
  currentPdf?: {
    type: 'SIGNATURE' | 'ZIKUY';   // Type du PDF actuel
    storagePath: string;           // Chemin dans Storage
    url?: string;                  // URL de téléchargement
    updatedAt: Date;
  };
}
```

**Pourquoi?**
- `outstandingCount` permet une requête Firestore efficace
- `status` indique clairement l'état
- `currentPdf` track quel PDF afficher et où il se trouve

---

### 2️⃣ **Service Holdings** (`src/services/firebaseService.ts`)

#### A. Fonction helper `_calculateAggregatedFields()`

Calcule automatiquement:
- `outstandingCount` = somme des quantités de tous les items
- `status` = 'OPEN' si outstandingCount > 0, 'CLOSED' sinon
- `hasSignedEquipment` = true si a des items ou un PDF

#### B. Modification de `addToHoldings()`

```typescript
// Avant de sauvegarder:
this._calculateAggregatedFields(holdings);
await this.updateHoldings(holdings);
```

#### C. Modification de `removeFromHoldings()`

```typescript
// Détecte la transition OPEN -> CLOSED
const wasOpen = holdings.status === 'OPEN';
this._calculateAggregatedFields(holdings);
const nowClosed = holdings.status === 'CLOSED';

if (wasOpen && nowClosed) {
  console.log(`🎉 Soldat a rendu TOUT son équipement!`);
  // L'écran de retour pourra détecter cela et agir
}

return holdings.status; // Retourne le nouveau status
```

#### D. Nouvelle fonction `getAllWithOutstandingItems()`

```typescript
async getAllWithOutstandingItems(
  type: 'combat' | 'clothing'
): Promise<SoldierHoldings[]>
```

**Utilisation:** Requête filtrée pour la liste זיכוי

```typescript
const q = query(
  collection(db, 'soldier_holdings'),
  where('type', '==', type),
  where('outstandingCount', '>', 0),
  orderBy('outstandingCount', 'desc')
);
```

---

### 3️⃣ **Mise à jour de `updateHoldings()`**

Sauvegarde maintenant **tous** les champs agrégés:

```typescript
const data = {
  ...
  outstandingCount: holdings.outstandingCount,
  hasSignedEquipment: holdings.hasSignedEquipment,
  status: holdings.status,
  currentPdf: holdings.currentPdf ? { ... } : undefined,
};

await setDoc(docRef, data, { merge: true });
```

---

## 🔍 Ce qui reste à faire

### **CRITIQUE**: Créer un index Firestore

La requête `getAllWithOutstandingItems()` nécessite un index composite.

**Créer le fichier:** `firestore.indexes.json`
```json
{
  "indexes": [
    {
      "collectionGroup": "soldier_holdings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "outstandingCount", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Déployer:**
```bash
firebase deploy --only firestore:indexes
```

OU cliquer sur le lien dans l'erreur Firestore Console lors du premier appel.

---

### **UI**: Modifier les écrans pour utiliser les nouvelles requêtes

#### A. **Liste זיכוי** (VetementHomeScreen / ArmeHomeScreen)

**Actuellement:**
```typescript
// Probablement utilise soldierService.getAll()
// puis filtre côté client
```

**Nouveau:**
```typescript
import { holdingsService } from '../services/firebaseService';

// Dans loadData():
const soldatsAvecEquipements = await holdingsService.getAllWithOutstandingItems('clothing');

// Afficher seulement ces soldats
setSoldiers(soldatsAvecEquipements.map(h => ({
  id: h.soldierId,
  name: h.soldierName,
  personalNumber: h.soldierPersonalNumber,
  outstandingCount: h.outstandingCount, // Pour affichage
})));
```

#### B. **Écran de retour** (ClothingReturnScreen / CombatReturnScreen)

**Déjà OK:** L'écran charge déjà les holdings, donc il affiche déjà seulement les items pris!

**À ajouter:** Détecter "tout rendu" et gérer les PDFs

```typescript
// Après removeFromHoldings():
const finalStatus = await holdingsService.removeFromHoldings(...);

if (finalStatus === 'CLOSED') {
  // TOUT RENDU!
  console.log('🎉 Tout rendu! Gestion des PDFs...');

  // 1. Récupérer l'ancien PDF signature
  const issueAssignment = await assignmentService.getCurrentAssignment(
    soldierId,
    'clothing',
    'issue'
  );

  // 2. Supprimer l'ancien PDF de Storage
  if (issueAssignment?.pdfUrl) {
    const oldPdfPath = `${soldierId}_clothing_issue.pdf`;
    await pdfStorageService.deletePdf(oldPdfPath);
    console.log('Ancien PDF signature supprimé');
  }

  // 3. Générer PDF זיכוי COMPLET
  const zikuyPdfData = {
    soldierId,
    soldierName: soldier.name,
    type: 'ZIKUY_COMPLETE',
    message: 'כל הציוד הוחזר בהצלחה',
    returnedItems: allReturnedItems, // Historique complet
    date: new Date(),
  };

  const zikuyPdfBytes = await generateZikuyPDF(zikuyPdfData);

  // 4. Upload nouveau PDF
  const zikuyUrl = await pdfStorageService.uploadPdf(
    zikuyPdfBytes,
    `${soldierId}_clothing_zikuy`
  );

  // 5. Mettre à jour holdings avec le nouveau PDF
  const holdings = await holdingsService.getHoldings(soldierId, 'clothing');
  if (holdings) {
    holdings.currentPdf = {
      type: 'ZIKUY',
      storagePath: `${soldierId}_clothing_zikuy.pdf`,
      url: zikuyUrl,
      updatedAt: new Date(),
    };
    await holdingsService.updateHoldings(holdings);
  }

  // 6. Afficher succès
  Alert.alert(
    'זיכוי מלא',
    'כל הציוד הוחזר בהצלחה! מסמך זיכוי נוצר.',
    [{ text: 'שלח ב-WhatsApp', onPress: () => shareZikuyPdf(zikuyUrl) }]
  );
}
```

---

### **Nouveau service**: `generateZikuyPDF()`

**Fichier:** `src/services/pdfService.ts`

```typescript
export async function generateZikuyPDF(data: {
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  type: 'combat' | 'clothing';
  returnedItems: Array<{name: string; quantity: number}>;
  date: Date;
}): Promise<Uint8Array> {
  // Générer HTML pour PDF זיכוי
  const html = `
    <html dir="rtl">
      <head><style>/* styles */</style></head>
      <body>
        <h1>טופס זיכוי מלא - גדוד 982</h1>
        <h2>${data.type === 'combat' ? 'ציוד לחימה' : 'ביגוד וציוד אישי'}</h2>

        <div class="soldier-info">
          <p><strong>שם חייל:</strong> ${data.soldierName}</p>
          <p><strong>מספר אישי:</strong> ${data.soldierPersonalNumber}</p>
        </div>

        <h3>פירוט ציוד שהוחזר:</h3>
        <table>
          ${data.returnedItems.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
            </tr>
          `).join('')}
        </table>

        <div class="confirmation">
          <p><strong>✅ כל הציוד הוחזר במלואו</strong></p>
          <p>תאריך: ${data.date.toLocaleDateString('he-IL')}</p>
        </div>
      </body>
    </html>
  `;

  // Utiliser expo-print pour générer le PDF
  const { uri } = await Print.printToFileAsync({ html });
  const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return base64ToPdf(pdfBase64);
}
```

---

### **Nouveau service**: `pdfStorageService.deletePdf()`

**Fichier:** `src/services/firebaseService.ts`

```typescript
import { ref, deleteObject } from 'firebase/storage';

// Dans pdfStorageService:
async deletePdf(storagePath: string): Promise<void> {
  try {
    const pdfRef = ref(storage, `pdf/assignments/${storagePath}`);
    await deleteObject(pdfRef);
    console.log('PDF deleted:', storagePath);
  } catch (error) {
    console.error('Error deleting PDF:', error);
    // Ne pas throw si le fichier n'existe pas
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
  }
}
```

---

## 🧪 Plan de test

### Test 1: **Filtrage liste זיכוי**

```
1. Créer 3 soldats:
   - Soldat A: a signé + a 3 items à rendre
   - Soldat B: a signé + a 0 items (tout rendu)
   - Soldat C: n'a jamais signé

2. Aller dans l'écran זיכוי

Résultat attendu:
   ✅ Soldat A apparaît (outstandingCount=3)
   ❌ Soldat B n'apparaît PAS (outstandingCount=0)
   ❌ Soldat C n'apparaît PAS (jamais signé)
```

### Test 2: **Affichage items pris seulement**

```
1. Soldat A a pris: קסדה (x2), וסט (x1)
2. Il existe 10 autres équipements dans le catalogue

3. Ouvrir écran retour pour Soldat A

Résultat attendu:
   ✅ Affiche seulement קסדה et וסט
   ❌ Ne montre PAS les 10 autres équipements
```

### Test 3: **Détection "tout rendu"**

```
1. Soldat A a: קסדה (x2), וסט (x1)
2. Il rend קסדה (x2)
   → Status reste OPEN, outstandingCount=1

3. Il rend וסט (x1)
   → Status passe à CLOSED, outstandingCount=0
   → Log: "🎉 Soldat a rendu TOUT son équipement!"

Résultat attendu:
   ✅ holdings.status = 'CLOSED'
   ✅ outstandingCount = 0
   ✅ Soldat disparaît de la liste זיכוי
```

### Test 4: **Gestion PDFs (TODO)**

```
1. Soldat A rend tout
2. Vérifier dans Storage:
   ✅ `soldier123_clothing_issue.pdf` supprimé
   ✅ `soldier123_clothing_zikuy.pdf` créé

3. Vérifier dans holdings:
   ✅ currentPdf.type = 'ZIKUY'
   ✅ currentPdf.storagePath = 'soldier123_clothing_zikuy.pdf'
   ✅ currentPdf.url existe

4. Ouvrir le PDF:
   ✅ Affiche "טופס זיכוי מלא"
   ✅ Liste les items rendus
   ✅ Mention "כל הציוד הוחזר"
```

---

## 📊 Structure Firestore finale

### Collection: `soldier_holdings`

```
soldier_holdings/
  ├─ soldier123_clothing/
  │    ├─ soldierId: "soldier123"
  │    ├─ type: "clothing"
  │    ├─ items: [{equipmentId, equipmentName, quantity, serials}]
  │    ├─ lastUpdated: Timestamp
  │    ├─ outstandingCount: 3          ← NOUVEAU
  │    ├─ hasSignedEquipment: true     ← NOUVEAU
  │    ├─ status: "OPEN"                ← NOUVEAU
  │    └─ currentPdf: {                 ← NOUVEAU
  │         type: "SIGNATURE",
  │         storagePath: "soldier123_clothing_issue.pdf",
  │         url: "https://...",
  │         updatedAt: Timestamp
  │       }
  │
  ├─ soldier456_clothing/
  │    ├─ outstandingCount: 0
  │    ├─ status: "CLOSED"
  │    └─ currentPdf: {
  │         type: "ZIKUY",              ← Tout rendu!
  │         storagePath: "soldier456_clothing_zikuy.pdf",
  │         ...
  │       }
```

---

## ✅ Checklist de déploiement

- [x] **Modèle mis à jour** (types/index.ts)
- [x] **Backend modifié** (firebaseService.ts)
- [x] **Fonctions agrégées** (_calculateAggregatedFields)
- [x] **Requête filtrée** (getAllWithOutstandingItems)
- [ ] **Index Firestore créé** (firestore.indexes.json + deploy)
- [ ] **UI liste זיכוי** (utilise getAllWithOutstandingItems)
- [ ] **Fonction generateZikuyPDF()** créée
- [ ] **Fonction deletePdf()** créée
- [ ] **Écran retour** (détecte CLOSED + gère PDFs)
- [ ] **Tests d'acceptation** (4 scénarios)
- [ ] **Documentation utilisateur**

---

## 🚀 Prochaines étapes

### Étape 1: Créer l'index Firestore ⚠️ CRITIQUE
```bash
firebase deploy --only firestore:indexes
```

### Étape 2: Implémenter generateZikuyPDF()
Créer la fonction dans `pdfService.ts`

### Étape 3: Implémenter deletePdf()
Ajouter dans `pdfStorageService`

### Étape 4: Modifier l'écran de retour
Ajouter la détection CLOSED + logique PDFs

### Étape 5: Tester
Exécuter les 4 tests d'acceptation

---

## 📝 Notes importantes

1. **Backward compatibility**: Les anciens holdings sans champs agrégés seront calculés à la volée lors du premier getHoldings()

2. **Migration des données existantes**: Exécuter un script pour recalculer tous les holdings:
   ```typescript
   // Script de migration (à exécuter une fois)
   async function migrateAllHoldings() {
     const allHoldings = await getDocs(collection(db, 'soldier_holdings'));
     for (const doc of allHoldings.docs) {
       const holdings = doc.data() as SoldierHoldings;
       holdingsService._calculateAggregatedFields(holdings);
       await holdingsService.updateHoldings(holdings);
     }
   }
   ```

3. **Performance**: L'index sur `outstandingCount` rend la requête **très rapide** même avec 1000+ soldats

4. **Cloud Functions (optionnel)**: Pour une architecture plus robuste, implémenter la logique "tout rendu" dans une Cloud Function Firestore trigger:
   ```typescript
   export const onHoldingsClosed = functions.firestore
     .document('soldier_holdings/{holdingId}')
     .onUpdate(async (change, context) => {
       const before = change.before.data();
       const after = change.after.data();

       if (before.status === 'OPEN' && after.status === 'CLOSED') {
         // Supprimer ancien PDF + générer זיכוי
         // ...
       }
     });
   ```

---

*Document généré automatiquement le 2025-12-29*
*Système: Gestion 982 - Refactoring זיכוי*
