# Structure Firebase Optimale pour Gestion-982

## 📊 Collections Nécessaires

### ✅ **1. soldiers**
Données de base des soldats uniquement.

**Structure:**
```typescript
{
  id: string;                    // Auto-généré par Firestore
  name: string;
  personalNumber: string;        // UNIQUE
  phone?: string;
  company: string;
  department?: string;
  nameLower: string;             // Pour la recherche
  searchKey: string;             // Pour la recherche
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Règles:**
- Un document par soldat
- `personalNumber` doit être unique
- Pas d'équipement stocké ici

---

### ✅ **2. combatEquipment**
Catalogue des équipements de combat disponibles.

**Structure:**
```typescript
{
  id: string;                    // Auto-généré
  name: string;
  category: string;              // "נשק", "אופטיקה", etc.
  hasSubEquipment: boolean;
  subEquipments?: Array<{
    id: string;
    name: string;
  }>;
  serial?: string;               // Optionnel
  createdAt: Timestamp;
}
```

**Exemples:**
- M16, M203, MAG, קשת
- Catégories: נשק, אופטיקה, ביגוד לחימה

---

### ✅ **3. clothingEquipment**
Catalogue des équipements vestimentaires disponibles.

**Structure:**
```typescript
{
  id: string;                    // Auto-généré
  name: string;
  yamach: number;                // 0 par défaut
  createdAt?: Timestamp;
}
```

**Exemples:**
- מזרון, תדל, נעליים, כובע צבא, חולצה

---

### ✅ **4. soldier_equipment** ⭐ COLLECTION PRINCIPALE
Tout l'équipement d'un soldat (combat + clothing).

**Structure:**
```typescript
{
  // Document ID = soldierId
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  soldierPhone?: string;
  soldierCompany?: string;

  // TOUS les équipements dans un seul tableau
  items: Array<{
    equipmentId: string;
    equipmentName: string;
    quantity: number;
    serial?: string;
    type: 'combat' | 'clothing';
    category?: string;
    subEquipments?: Array<{ name: string }>;
    issuedAt: Date;
    issuedBy: string;              // User ID qui a attribué
  }>;

  // Signatures par type
  combatSignature?: string;        // base64
  clothingSignature?: string;      // base64

  // URLs des PDFs
  combatPdfUrl?: string;
  clothingPdfUrl?: string;

  // Métadonnées
  lastUpdated: Timestamp;
  createdAt: Timestamp;
}
```

**Règles importantes:**
- **UN document par soldat** (ID du document = `soldierId`)
- Les équipements combat ET clothing sont dans le **même tableau** `items`
- Le champ `type` distingue combat vs clothing
- Les données soldats sont **dupliquées** ici (c'est normal pour ce système)

---

### ✅ **5. assignments**
Historique de toutes les assignations (pour audit).

**Structure:**
```typescript
{
  id: string;                    // Auto-généré ou custom
  soldierId: string;             // Référence au soldat
  type: 'combat' | 'clothing';
  action: 'issue' | 'credit';    // הנפקה ou זיכוי

  items: Array<{
    equipmentId: string;
    equipmentName: string;
    quantity: number;
    serial?: string;
  }>;

  signature: string;             // base64
  pdfUrl?: string;

  assignedBy: string;            // User ID
  assignedByName: string;
  assignedByEmail: string;

  status: string;
  timestamp: Timestamp;
  updatedAt: Timestamp;
}
```

**Règles:**
- Historique en lecture seule (ne pas modifier)
- Utilisé pour l'audit et les rapports

---

### ✅ **6. manot** (si utilisé)
Gestion des מנות (rations/kits).

**Structure:**
```typescript
{
  id: string;
  name: string;
  equipment: Array<{
    equipmentId: string;
    quantity: number;
  }>;
  createdAt: Timestamp;
}
```

---

### ✅ **7. users**
Utilisateurs de l'application.

**Structure:**
```typescript
{
  id: string;                    // UID Firebase Auth
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Timestamp;
}
```

---

## ❌ Collections À SUPPRIMER

### ❌ **equipment_clothing**
- **Raison:** Doublon de `clothingEquipment`
- **Action:** SUPPRIMER complètement

### ❌ **soldier_holdings**
- **Raison:** Ancien système, remplacé par `soldier_equipment`
- **Action:** SUPPRIMER après migration

---

## 🔄 Flux de Données

### Attribution d'équipement (הנפקה):
1. User sélectionne un soldat
2. User choisit des équipements du catalogue (`combatEquipment` ou `clothingEquipment`)
3. User signe
4. Système crée/met à jour `soldier_equipment/{soldierId}`
   - Ajoute les items au tableau
   - Stocke la signature
5. Système crée un document dans `assignments` pour l'historique

### Retour d'équipement (זיכוי):
1. User sélectionne un soldat
2. Système affiche les équipements depuis `soldier_equipment/{soldierId}`
3. User choisit quoi retourner
4. User signe
5. Système met à jour `soldier_equipment/{soldierId}`
   - Réduit ou supprime les items
6. Système crée un document dans `assignments` (action: 'credit')

---

## 📝 Notes Importantes

### Duplication des données soldats
**C'est NORMAL et VOULU** dans ce système:
- Les données de base sont dans `soldiers/`
- Les données sont **dupliquées** dans `soldier_equipment/` pour faciliter les queries
- Si un soldat change de nom/téléphone, il faut mettre à jour les 2 endroits

**Alternative (plus complexe):**
- Ne stocker que `soldierId` dans `soldier_equipment`
- Faire des joins applicatifs pour récupérer les données soldats
- **Pas recommandé** car plus lent et complexe

### Pourquoi `soldier_equipment` et pas `soldier_holdings`?
- `soldier_equipment` est le **nouveau système** (plus simple)
- `soldier_holdings` était l'ancien système (plus complexe)
- Votre code utilise les deux, mais privilégiez `soldier_equipment`

---

## ✅ Checklist Structure Propre

- [ ] Collection `soldiers` existe avec données de base uniquement
- [ ] Collection `combatEquipment` existe avec le catalogue combat
- [ ] Collection `clothingEquipment` existe avec le catalogue vêtements
- [ ] Collection `soldier_equipment` existe (un doc par soldat avec tout l'équipement)
- [ ] Collection `assignments` existe pour l'historique
- [ ] Collection `users` existe
- [ ] Collection `equipment_clothing` SUPPRIMÉE (doublon)
- [ ] Collection `soldier_holdings` SUPPRIMÉE (ancien système)
- [ ] Aucune donnée de test qui pollue

---

## 🚀 Pour Démarrer avec une Base Propre

1. Exécuter le script de nettoyage
2. Vérifier que seules les bonnes collections existent
3. Peupler les catalogues (`combatEquipment`, `clothingEquipment`)
4. Commencer à utiliser l'application normalement
