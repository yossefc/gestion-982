# Index Firestore Requis

Ce document liste les index Firestore composites nécessaires pour les queries de l'application.

## Collection: `soldiers`

### Index 1: Recherche par searchKey
```
Collection: soldiers
Fields:
  - searchKey (Ascending)
Mode: Single-field index (automatique)
```

### Index 2: Tri par nameLower
```
Collection: soldiers
Fields:
  - nameLower (Ascending)
Mode: Single-field index (automatique)
```

### Index 3: Recherche par company + nameLower
```
Collection: soldiers
Fields:
  - company (Ascending)
  - nameLower (Ascending)
Mode: Composite index
```

**À créer via Firebase Console :**
- Allez dans Firestore > Index
- Créez l'index composite : `company (ASC) + nameLower (ASC)`

### Champs requis dans les documents `soldiers`

Chaque document soldat doit contenir :
- `personalNumber` (string, unique)
- `name` (string)
- `phone` (string, optionnel)
- `company` (string)
- `department` (string, optionnel)
- `searchKey` (string, généré automatiquement) - clé de recherche normalisée
- `nameLower` (string, généré automatiquement) - nom en lowercase pour tri
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## Collection: `assignments`

### Index existants nécessaires

```
Collection: assignments
Fields:
  - soldierId (Ascending)
  - timestamp (Descending)
Mode: Composite index
```

```
Collection: assignments
Fields:
  - type (Ascending)
  - timestamp (Descending)
Mode: Composite index
```

## Migration des données existantes

Pour les soldats existants sans `searchKey` et `nameLower`, exécuter un script de migration :

```javascript
// Script à exécuter dans Firebase Console ou Cloud Functions
const soldiers = await db.collection('soldiers').get();
const batch = db.batch();

soldiers.forEach(doc => {
  const data = doc.data();
  const searchKey = buildSoldierSearchKey(data);
  const nameLower = data.name.toLowerCase().trim();
  
  batch.update(doc.ref, {
    searchKey,
    nameLower,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

await batch.commit();
```

## Notes de performance

- Les queries avec `searchKey` permettent la recherche full-text côté serveur
- La pagination réduit la charge réseau et améliore les performances
- Les index composites doivent être créés AVANT de déployer les queries qui les utilisent





