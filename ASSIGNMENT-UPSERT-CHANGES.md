# 🔄 Modifications: Assignment UPSERT au lieu de CREATE

## 📋 Résumé des changements

Le système a été modifié pour **REMPLACER** les assignments au lieu d'en créer de nouveaux à chaque signature.

### Avant:
- Chaque signature créait un nouveau document Firestore avec ID auto-généré
- Chaque PDF avait un nom unique avec timestamp
- Résultat: Multiples documents + multiples PDFs par soldat

### Après:
- Un seul document par (soldat, type, action)
- Un seul PDF par document (remplacé à chaque signature)
- Résultat: **1 doc + 1 PDF** qui sont mis à jour

---

## 🎯 Fichiers modifiés

### 1. `src/services/assignmentService.ts`

**Changements:**
- ✅ Ajout de l'import `setDoc` de Firestore
- ✅ Modification de `createAssignment()`:
  - Utilise `setDoc()` au lieu de `addDoc()`
  - Génère un ID déterministe: `{soldierId}_{type}_{action}`
  - Exemples d'IDs:
    - `soldier123_clothing_issue` (attribution vêtements)
    - `soldier123_clothing_credit` (retour vêtements)
    - `soldier123_combat_issue` (attribution combat)
  - Mode `merge: false` pour REMPLACER complètement le document
  - Sauvegarde tous les champs optionnels (action, phone, company, etc.)

**Lignes modifiées:** 1-14, 86-150

---

### 2. `src/services/firebaseService.ts` (pdfStorageService)

**Changements:**
- ✅ Modification de `uploadPdf()`:
  - Utilise un chemin FIXE: `pdf/assignments/{assignmentId}.pdf`
  - Plus de timestamp dans le nom de fichier
  - REMPLACE le PDF existant au même chemin
  - Ajout de commentaires expliquant le comportement

**Note importante:**
Le `downloadURL` peut changer à chaque upload car Firebase Storage génère un nouveau token. Pour une URL stable, il faudrait utiliser l'Admin SDK avec un token constant (voir commentaires dans le code).

**Lignes modifiées:** 751-817

---

## 🔍 Comportement détaillé

### Scénario 1: Première signature d'un soldat

```
1. Soldat "A" signe pour des vêtements
   → Crée doc: `soldierA_clothing_issue`
   → Upload PDF: `pdf/assignments/soldierA_clothing_issue.pdf`
   → Firestore: { pdfUrl: "https://...", items: [...], timestamp: T1 }
```

### Scénario 2: Re-signature du même soldat (même type, même action)

```
1. Soldat "A" re-signe pour des vêtements (nouveaux items ou correction)
   → REMPLACE doc: `soldierA_clothing_issue`
   → REMPLACE PDF: `pdf/assignments/soldierA_clothing_issue.pdf`
   → Firestore: { pdfUrl: "https://...", items: [nouveaux], timestamp: T2, updatedAt: T2 }
```

**Résultat:** Toujours 1 seul doc Firestore, 1 seul PDF.

### Scénario 3: Retour d'équipement

```
1. Soldat "A" retourne des vêtements
   → Crée doc SÉPARÉ: `soldierA_clothing_credit`
   → Upload PDF: `pdf/assignments/soldierA_clothing_credit.pdf`
   → Firestore: { action: 'credit', status: 'זוכה', ... }
```

**Important:** Les retours (credit) ont un document séparé des attributions (issue).

### Scénario 4: Combat + Vêtements

```
1. Soldat "A" signe pour combat
   → Doc: `soldierA_combat_issue`
   → PDF: `pdf/assignments/soldierA_combat_issue.pdf`

2. Soldat "A" signe pour vêtements
   → Doc: `soldierA_clothing_issue`
   → PDF: `pdf/assignments/soldierA_clothing_issue.pdf`
```

**Résultat:** Documents séparés par type (combat vs clothing).

---

## 🧪 Plan de test

### Test 1: Attribution initiale
```
1. Signer soldat "123" pour vêtements
2. Vérifier dans Firestore: doc `123_clothing_issue` existe
3. Vérifier dans Storage: PDF `123_clothing_issue.pdf` existe
4. Noter le pdfUrl et le timestamp
```

**Résultat attendu:** ✅ 1 doc, 1 PDF créés

### Test 2: Re-signature (UPDATE)
```
1. Re-signer le même soldat "123" pour vêtements (mêmes ou nouveaux items)
2. Vérifier dans Firestore: toujours le doc `123_clothing_issue`
3. Vérifier le timestamp: doit être plus récent
4. Vérifier le pdfUrl: peut avoir changé (nouveau token)
5. Télécharger le PDF: doit contenir les NOUVEAUX items
```

**Résultat attendu:** ✅ Toujours 1 doc, 1 PDF (remplacés)

### Test 3: Séparation par action
```
1. Signer soldat "123" pour vêtements (issue)
   → Doc: `123_clothing_issue`
2. Faire un retour pour soldat "123" (credit)
   → Doc: `123_clothing_credit`
```

**Résultat attendu:** ✅ 2 docs séparés (issue + credit)

### Test 4: Séparation par type
```
1. Signer soldat "123" pour vêtements
   → Doc: `123_clothing_issue`
2. Signer soldat "123" pour combat
   → Doc: `123_combat_issue`
```

**Résultat attendu:** ✅ 2 docs séparés (clothing + combat)

### Test 5: Multiples soldats
```
1. Signer soldat "123" pour vêtements
2. Signer soldat "456" pour vêtements
3. Re-signer soldat "123"
```

**Résultat attendu:**
- ✅ Soldat 123: doc remplacé
- ✅ Soldat 456: doc indépendant, non affecté

---

## ⚠️ Points de vigilance en production

### 1. Migration des données existantes

**Problème:** Les anciens assignments ont des IDs auto-générés (ex: `MTLxsTu9eZEdkFrrJOux`).

**Impact:**
- Les anciens docs restent dans Firestore
- Les nouveaux docs utilisent le nouveau format
- Pas de conflit, mais duplication temporaire

**Solution recommandée:**
- Option A: Laisser les anciens docs (historique)
- Option B: Script de migration pour supprimer les doublons
- Option C: Ajouter un champ `isLatest: true` aux nouveaux docs

### 2. URL de téléchargement PDF

**Problème:** Le `downloadURL` contient un token Firebase qui change à chaque upload.

**Impact:**
- Les anciens liens PDF peuvent devenir invalides
- Si le lien est envoyé par WhatsApp, il peut expirer

**Solutions:**
- ✅ Actuel: Stocker `pdfUrl` en DB, recalculer si besoin
- 🔧 Avancé: Cloud Function pour forcer un token constant (Admin SDK)
- 📱 UX: Toujours télécharger le PDF frais au moment du partage

### 3. Concurrence (2 signatures simultanées)

**Problème:** Si 2 admins signent le même soldat en même temps.

**Impact:** Le dernier écrase le premier (last-write-wins).

**Solutions:**
- ✅ Acceptable: En pratique, peu probable
- 🔧 Si critique: Ajouter un champ `version` et utiliser une transaction
- 📱 UX: Afficher un warning si `updatedAt` est récent (<5 min)

### 4. Rollback en cas d'erreur

**Ordre actuel:**
1. `createAssignment()` → Écrit dans Firestore
2. `uploadPdf()` → Upload le PDF
3. `assignmentService.update()` → Met à jour le pdfUrl

**Scénarios d'échec:**
- ❌ Si étape 2 échoue: Doc existe sans PDF (acceptable, retry à la prochaine signature)
- ❌ Si étape 3 échoue: PDF uploadé mais pdfUrl pas à jour (sera corrigé au prochain upload)

**Amélioration possible:**
- Ajouter un try-catch global dans les écrans
- En cas d'erreur upload PDF: supprimer le doc Firestore (rollback)
- Ou: marquer le doc comme `pdfStatus: 'pending'`

---

## 📊 Structure Firestore finale

### Collection: `assignments`

```
assignments/
  ├─ soldier123_clothing_issue/
  │    ├─ soldierId: "soldier123"
  │    ├─ type: "clothing"
  │    ├─ action: "issue"
  │    ├─ items: [...]
  │    ├─ signature: "https://..."
  │    ├─ pdfUrl: "https://storage.../soldier123_clothing_issue.pdf"
  │    ├─ status: "נופק לחייל"
  │    ├─ timestamp: 2025-12-29T10:00:00Z
  │    └─ updatedAt: 2025-12-29T10:00:00Z
  │
  ├─ soldier123_clothing_credit/
  │    └─ (retour d'équipement)
  │
  ├─ soldier123_combat_issue/
  │    └─ (attribution combat)
  │
  └─ soldier456_clothing_issue/
       └─ (autre soldat)
```

### Storage: `pdf/assignments/`

```
pdf/assignments/
  ├─ soldier123_clothing_issue.pdf
  ├─ soldier123_clothing_credit.pdf
  ├─ soldier123_combat_issue.pdf
  └─ soldier456_clothing_issue.pdf
```

---

## ✅ Checklist de déploiement

Avant de déployer en production:

- [ ] **Activer Firebase Storage** dans la console Firebase
- [ ] **Déployer les règles Storage:** `firebase deploy --only storage`
- [ ] **Tester** tous les scénarios (voir "Plan de test" ci-dessus)
- [ ] **Vérifier** que les PDFs s'ouvrent correctement
- [ ] **Vérifier** que le partage WhatsApp fonctionne
- [ ] **Nettoyer** les anciens PDFs si nécessaire (optionnel)
- [ ] **Documenter** pour l'équipe le nouveau comportement
- [ ] **Monitorer** les logs pendant 24-48h après déploiement

---

## 🚀 Prochaines étapes (optionnelles)

### Améliorations futures:

1. **Cloud Function pour token PDF stable**
   ```typescript
   // functions/src/index.ts
   export const onPdfUpload = functions.storage.object().onFinalize(async (object) => {
     // Force un token constant via metadata
     // Permet d'avoir une URL stable même après re-upload
   });
   ```

2. **Versioning des assignments**
   - Garder un historique des modifications
   - Collection `assignments/{id}/history/{timestamp}`

3. **Soft delete au lieu de replace**
   - Ajouter un champ `isActive: true/false`
   - Les anciennes versions deviennent `isActive: false`

4. **Notifications de modification**
   - Alerter si un assignment est modifié moins de X heures après création
   - Log des modifications pour audit

---

## 📞 Support

En cas de problème après déploiement:

1. **Vérifier les logs**: `npx expo start` ou Firebase Console > Logs
2. **Vérifier Firestore**: Console Firebase > Firestore
3. **Vérifier Storage**: Console Firebase > Storage
4. **Rollback**: Revenir au commit précédent si nécessaire

---

*Document généré automatiquement le 2025-12-29*
*Système: Gestion 982 - Firebase + React Native*
