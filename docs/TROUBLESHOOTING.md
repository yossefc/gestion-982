# 🔧 Guide de Dépannage - Gestion 982

Ce document explique les problèmes courants rencontrés dans l'application et leurs solutions.

---

## 📝 Problème 1: Signature ne trace que des points (pas des traits)

### 🐛 Symptôme
Lorsque l'utilisateur dessine sur le canvas de signature, seuls des points isolés apparaissent au lieu de lignes continues.

### 🔍 Cause
Le composant `react-native-signature-canvas` (basé sur WebView) est placé dans un `ScrollView`. Par défaut, le `ScrollView` intercepte les gestes tactiles pour gérer le scroll, empêchant le canvas de recevoir les événements de mouvement (`onMove`). Résultat: seuls les événements `onBegin` et `onEnd` sont capturés, créant des points isolés.

**Références:**
- [NPM: react-native-signature-canvas - Example inside ScrollView](https://www.npmjs.com/package/react-native-signature-canvas/v/4.5.1)
- [GitHub: react-native-signature-canvas - Props](https://github.com/YanYuanFE/react-native-signature-canvas)

### ✅ Solution Appliquée

**Méthode: Désactivation dynamique du ScrollView pendant le dessin**

1. **État pour contrôler le scroll:**
   ```typescript
   const [scrollEnabled, setScrollEnabled] = useState(true);
   ```

2. **Modification du ScrollView:**
   ```typescript
   <ScrollView scrollEnabled={scrollEnabled}>
   ```

3. **Handlers pour gérer le scroll:**
   ```typescript
   const handleBegin = () => {
     setScrollEnabled(false); // Désactiver le scroll pendant le dessin
   };

   const handleEnd = () => {
     signatureRef.current?.readSignature();
     setScrollEnabled(true); // Réactiver le scroll après le dessin
   };
   ```

4. **Configuration du SignatureCanvas:**
   ```typescript
   <SignatureCanvas
     ref={signatureRef}
     onBegin={handleBegin}
     onEnd={handleEnd}
     onOK={handleOK}
     // ... autres props
   />
   ```

### 🎯 Résultat
- Les traits sont maintenant dessinés correctement en continu
- Le scroll est temporairement désactivé pendant le dessin
- Le scroll se réactive automatiquement une fois le trait terminé

### 📂 Fichiers Modifiés
- `src/screens/vetement/ClothingSignatureScreen.tsx`

---

## 📝 Problème 2: Warning Firebase Auth AsyncStorage

### 🐛 Symptôme
Warning dans la console:
```
[Warning] AsyncStorage has been extracted from react-native core and will be removed in a future release.
Firebase Auth is initializing without providing AsyncStorage.
```

### 🔍 Cause
En React Native, Firebase Auth (SDK JavaScript) a besoin d'un système de stockage persistant pour sauvegarder les sessions utilisateur. Sans configuration explicite, Firebase:
1. Cherche `AsyncStorage` dans `react-native` (ancien emplacement, déprécié)
2. Ne le trouve pas (car il a été externalisé dans `@react-native-async-storage/async-storage`)
3. Se replie sur un stockage non-persistant (session perdue au redémarrage de l'app)

**Références:**
- [Firebase Blog: Which React Native Firebase SDK to use](https://firebase.blog/posts/2023/03/which-react-native-firebase-sdk-to-use)
- [GitHub Issue: firebase-js-sdk #8798](https://github.com/firebase/firebase-js-sdk/issues/8798)

### ✅ Solution Appliquée

**Utilisation de `initializeAuth` avec `getReactNativePersistence`:**

**Avant:**
```typescript
import { getAuth } from 'firebase/auth';
const auth = getAuth(app);
```

**Après:**
```typescript
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
```

### 🎯 Résultat
- Le warning disparaît
- Les sessions utilisateur persistent entre les redémarrages de l'app
- Firebase utilise correctement AsyncStorage pour le stockage

### 📦 Dépendances
- `@react-native-async-storage/async-storage`: déjà installé (v2.2.0)

### 📂 Fichiers Modifiés
- `src/config/firebase.ts`

---

## 📝 Problème 3: "Missing or insufficient permissions" (Firestore)

### 🐛 Symptôme
Erreurs lors du chargement des données:
```
ERROR Error getting combat equipment: [FirebaseError: Missing or insufficient permissions.]
ERROR Error initializing default data: [FirebaseError: Missing or insufficient permissions.]
ERROR Error initializing app: [FirebaseError: Missing or insufficient permissions.]
```

### 🔍 Causes Principales

#### Cause 1: Requêtes avant que l'authentification soit prête
L'application charge des données Firestore **avant** que Firebase Auth ait confirmé l'état de connexion de l'utilisateur.

**Séquence problématique:**
1. App démarre → `AuthContext` commence à vérifier l'auth (`loading: true`)
2. Les écrans se montent → `useEffect(() => { loadData() }, [])` s'exécute immédiatement
3. Les requêtes Firestore partent **sans** `request.auth` (car l'auth n'est pas encore prête)
4. Firestore rejette les requêtes → `Missing or insufficient permissions`

#### Cause 2: Règles Firestore trop strictes
Les règles Firestore peuvent bloquer les opérations légitimes si elles ne sont pas correctement configurées.

**Références:**
- [Firebase Docs: Rules and Auth](https://firebase.google.com/docs/rules/rules-and-auth)
- [Firebase Docs: Security Rules Conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase Docs: Rules and Queries](https://firebase.google.com/docs/firestore/security/rules-query)

### ✅ Solutions Appliquées

#### Solution 1: Attendre la fin de l'authentification

**Modification des écrans pour attendre `authLoading`:**

**Avant:**
```typescript
const { user } = useAuth();

useEffect(() => {
  loadData(); // ❌ Exécuté immédiatement, même si auth pas prête
}, []);
```

**Après:**
```typescript
const { user, loading: authLoading } = useAuth();

useEffect(() => {
  // ✅ Attendre que l'auth soit prête
  if (!authLoading && user) {
    loadData();
  } else if (!authLoading && !user) {
    // Utilisateur non connecté
    Alert.alert('שגיאה', 'יש להתחבר כדי להמשיך');
    navigation.goBack();
  }
}, [authLoading, user]);
```

**Écrans modifiés:**
- `src/screens/vetement/ClothingSignatureScreen.tsx`
- `src/screens/arme/ArmeHomeScreen.tsx`
- `src/screens/admin/AdminPanelScreen.tsx`
- `App.tsx` (suppression de l'init au démarrage)

#### Solution 2: Règles Firestore avec authentification

**Fichier `firestore.rules` créé avec deux configurations:**

**Configuration TEMPORAIRE (développement):**
```javascript
match /{document=**} {
  allow read, write: if request.auth != null;
}
```
✅ Simple, permet toutes les opérations pour utilisateurs connectés
⚠️ Ne pas utiliser en production (pas de contrôle d'accès par rôle)

**Configuration RBAC (production - commentée):**
```javascript
function hasRole(role) {
  return request.auth != null && request.auth.token.role == role;
}

match /soldiers/{soldierId} {
  allow read: if isAuthenticated();
  allow write: if hasRole('admin') || hasRole('both') || hasRole('arme') || hasRole('vetement');
}

match /equipment_combat/{equipmentId} {
  allow read, write: if hasRole('admin') || hasRole('both') || hasRole('arme');
}

match /equipment_clothing/{equipmentId} {
  allow read, write: if hasRole('admin') || hasRole('both') || hasRole('vetement');
}

// ... etc
```
✅ Contrôle d'accès granulaire par rôle
⚠️ Nécessite la configuration des **custom claims** via Firebase Admin SDK

### 🎯 Résultat
- Les erreurs "Missing or insufficient permissions" disparaissent
- L'app attend que l'utilisateur soit authentifié avant de charger des données
- Les règles Firestore sont clairement documentées

### 📋 Déploiement des Règles Firestore

**Option 1: Console Firebase (recommandée pour test):**
1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Projet: **gestion-982**
3. Menu: **Firestore Database** → **Règles**
4. Copier le contenu de `firestore.rules`
5. Cliquer sur **Publier**

**Option 2: Firebase CLI:**
```bash
firebase deploy --only firestore:rules
```

### 🔐 Configuration des Custom Claims (pour RBAC)

Pour utiliser les règles RBAC (production), il faut configurer les custom claims via le script:

```bash
npm run setup:claims
```

Ce script ajoute le champ `role` aux tokens Firebase de chaque utilisateur, permettant aux règles Firestore de vérifier `request.auth.token.role`.

### 📂 Fichiers Modifiés
- `src/screens/vetement/ClothingSignatureScreen.tsx`
- `firestore.rules` (nouveau fichier)

---

## 📝 Problème 4: "Unsupported field value: undefined" (Firestore)

### 🐛 Symptôme
Erreur lors de la création d'assignments:
```
ERROR Error creating assignment: [FirebaseError: Function addDoc() called with invalid data.
Unsupported field value: undefined (found in document assignments/xxx)]
```

### 🔍 Cause
Firestore n'accepte pas les champs avec la valeur `undefined`. Causes courantes:
1. **Spread operator incluant tous les champs**: `...assignmentData` inclut même les champs optionnels undefined
2. **Construction explicite avec undefined**: `serial: item.serial || undefined` crée toujours le champ

**Exemple problématique:**
```typescript
const item = {
  id: '1',
  name: 'Casque',
  serial: item.serial || undefined  // ❌ Crée toujours serial, même si undefined
};

await addDoc(collection(db, 'assignments'), {
  ...assignmentData,  // ❌ Inclut tous les champs, même undefined
  timestamp: Timestamp.now()
});
```

### ✅ Solutions Appliquées

#### Solution 1: Construction conditionnelle des items

**Avant:**
```typescript
const assignmentItems = selectedItems.map(item => ({
  equipmentId: item.id,
  equipmentName: item.name,
  quantity: item.quantity,
  serial: item.serial || undefined,  // ❌ Toujours présent
}));
```

**Après:**
```typescript
const assignmentItems = selectedItems.map(item => {
  const itemData: any = {
    equipmentId: item.id,
    equipmentName: item.name,
    quantity: item.quantity,
  };

  // ✅ N'ajouter serial que s'il existe
  if (item.serial) {
    itemData.serial = item.serial;
  }

  return itemData;
});
```

#### Solution 2: Filtrage explicite dans le service

**Avant (assignmentService.create):**
```typescript
const docRef = await addDoc(collection(db, COLLECTIONS.ASSIGNMENTS), {
  ...assignmentData,  // ❌ Inclut signature, pdfUrl même si undefined
  timestamp: Timestamp.now(),
});
```

**Après:**
```typescript
// ✅ Construire l'objet explicitement
const cleanData: any = {
  soldierId: assignmentData.soldierId,
  soldierName: assignmentData.soldierName,
  soldierPersonalNumber: assignmentData.soldierPersonalNumber,
  type: assignmentData.type,
  items: assignmentData.items || [],
  status: assignmentData.status,
  assignedBy: assignmentData.assignedBy,
  timestamp: Timestamp.now(),
};

// ✅ Ajouter les champs optionnels seulement s'ils existent
if (assignmentData.signature) {
  cleanData.signature = assignmentData.signature;
}
if (assignmentData.pdfUrl) {
  cleanData.pdfUrl = assignmentData.pdfUrl;
}

const docRef = await addDoc(collection(db, COLLECTIONS.ASSIGNMENTS), cleanData);
```

### 🎯 Résultat
- Plus d'erreurs "Unsupported field value: undefined"
- Les assignments se créent correctement
- Les champs optionnels ne sont ajoutés que s'ils ont une valeur

### 📂 Fichiers Modifiés
- `src/screens/vetement/ClothingSignatureScreen.tsx`
- `src/services/firebaseService.ts` (assignmentService.create)

---

## 🚀 Checklist de Vérification

Après avoir appliqué les corrections:

- [ ] **Signature:** Dessiner rapidement produit des traits continus (pas des points)
- [ ] **AsyncStorage:** Aucun warning Firebase Auth dans la console
- [ ] **Permissions:** Aucune erreur "Missing or insufficient permissions" lors du chargement des données
- [ ] **Undefined:** Aucune erreur "Unsupported field value: undefined" lors création d'assignments
- [ ] **Session:** La session utilisateur persiste après un redémarrage de l'app
- [ ] **Règles Firestore:** Les règles sont déployées dans Firebase Console

---

## 📚 Ressources Supplémentaires

### Firebase Auth - React Native
- [Firebase Blog: Which React Native SDK](https://firebase.blog/posts/2023/03/which-react-native-firebase-sdk-to-use)
- [Firebase Docs: Web Auth avec React Native](https://firebase.google.com/docs/auth/web/start)

### Firestore Security Rules
- [Rules and Auth](https://firebase.google.com/docs/rules/rules-and-auth)
- [Security Rules Conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Rules Query Matching](https://firebase.google.com/docs/firestore/security/rules-query)

### react-native-signature-canvas
- [NPM Package](https://www.npmjs.com/package/react-native-signature-canvas)
- [GitHub Repository](https://github.com/YanYuanFE/react-native-signature-canvas)

---

## 🆘 Support

Si vous rencontrez d'autres problèmes:

1. Vérifier les logs de la console (Metro bundler + console navigateur dans React Native Debugger)
2. Vérifier l'état de l'auth dans `AuthContext`
3. Vérifier les règles Firestore dans la console Firebase
4. Créer un issue sur le dépôt GitHub avec les détails de l'erreur

---

*Dernière mise à jour: 2025-12-28*
