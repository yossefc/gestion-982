# Guide Mode Offline - Gestion 982

## Architecture Implémentée

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │OfflineContext│  │ DataContext │  │   Écrans/Composants │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │            │
│         ▼                ▼                      ▼            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │offlineService│  │ cacheService│  │transactionalService │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │            │
│         ▼                ▼                      ▼            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AsyncStorage                          ││
│  │  • Queue des opérations offline                         ││
│  │  • Cache persisté des données                           ││
│  └─────────────────────────────────────────────────────────┘│
│         │                                        │            │
│         ▼                                        ▼            │
│  ┌─────────────┐                        ┌─────────────────┐  │
│  │   NetInfo   │                        │    Firebase     │  │
│  └─────────────┘                        └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Fichiers Créés/Modifiés

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `src/services/offlineService.ts` | Queue de synchronisation offline |
| `src/hooks/useNetworkStatus.ts` | Hook de détection réseau |
| `src/contexts/OfflineContext.tsx` | Context React pour l'état offline |
| `src/components/OfflineBanner.tsx` | Composant UI indicateur offline |

### Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `src/services/cacheService.ts` | Ajout persistence AsyncStorage |
| `src/services/transactionalAssignmentService.ts` | Wrappers offline pour toutes les opérations |
| `src/contexts/DataContext.tsx` | Hydratation au démarrage |
| `src/components/index.ts` | Export des nouveaux composants |

## Utilisation

### 1. Ajouter le Provider

Dans `App.tsx` ou `AppNavigator.tsx`:

```tsx
import { OfflineProvider } from './contexts/OfflineContext';
import { OfflineBanner } from './components';

function App() {
  return (
    <OfflineProvider>
      <DataProvider>
        <OfflineBanner />
        {/* Rest of your app */}
        <NavigationContainer>
          {/* ... */}
        </NavigationContainer>
      </DataProvider>
    </OfflineProvider>
  );
}
```

### 2. Utiliser dans les composants

```tsx
import { useOffline } from '../contexts/OfflineContext';

function MyComponent() {
  const { isOnline, pendingCount, syncStatus, syncNow } = useOffline();

  return (
    <View>
      {!isOnline && <Text>Vous êtes hors ligne</Text>}
      {pendingCount > 0 && (
        <Text>{pendingCount} opérations en attente</Text>
      )}
      <Button onPress={syncNow} title="Synchroniser" />
    </View>
  );
}
```

### 3. Les opérations de signature fonctionnent automatiquement offline

Aucune modification nécessaire dans les écrans de signature. Le service `transactionalAssignmentService` gère automatiquement:

- Si **online**: exécute directement sur Firebase
- Si **offline**: ajoute à la queue locale et retourne un ID temporaire

```tsx
// Ce code fonctionne identiquement online/offline
const assignmentId = await transactionalAssignmentService.issueEquipment({
  soldierId: soldier.id,
  soldierName: soldier.name,
  // ...
});
// -> Online: ID Firebase réel
// -> Offline: ID local "LOCAL_xxx" + opération en queue
```

## Guide de Test

### Test 1: Signature offline basique

1. **Préparation**
   - Ouvrir l'app avec connexion internet
   - Naviguer vers un écran de signature (ex: ClothingSignatureScreen)
   - Sélectionner un soldat

2. **Test**
   - Activer le mode avion sur l'appareil
   - Vérifier que la bannière "אין חיבור לאינטרנט" apparaît
   - Effectuer une signature complète
   - Vérifier le message de succès

3. **Vérification**
   - La bannière doit montrer "1 פעולות ממתינות לסנכרון"
   - Désactiver le mode avion
   - La synchronisation doit se faire automatiquement
   - La bannière doit disparaître

### Test 2: Multiple signatures offline

1. Activer le mode avion
2. Effectuer 3 signatures différentes
3. Vérifier que le compteur monte à 3
4. Désactiver le mode avion
5. Vérifier que toutes les opérations se synchronisent

### Test 3: Redémarrage de l'app offline

1. Activer le mode avion
2. Effectuer une signature
3. Fermer complètement l'app
4. Rouvrir l'app (toujours en mode avion)
5. Vérifier que l'opération est toujours en attente
6. Désactiver le mode avion et vérifier la sync

### Test 4: Cache persisté

1. Ouvrir l'app avec connexion
2. Naviguer dans plusieurs écrans pour charger les données
3. Fermer l'app
4. Activer le mode avion
5. Rouvrir l'app
6. Vérifier que les données sont disponibles immédiatement (depuis le cache persisté)

## Gestion des erreurs

### Opérations échouées

Si une opération échoue 3 fois:
- Elle est déplacée vers la queue "failed"
- Accessible via `useOffline().failedOperations`
- Peut être retentée manuellement avec `retryFailed(operationId)`

### Conflits

L'idempotence est garantie par le `requestId`:
- Chaque opération a un ID unique
- Si l'opération existe déjà sur Firebase, elle n'est pas dupliquée
- Géré automatiquement par `transactionalAssignmentService`

## Clés AsyncStorage utilisées

| Clé | Description |
|-----|-------------|
| `@gestion982/offline/pendingQueue` | Queue des opérations en attente |
| `@gestion982/offline/failedQueue` | Queue des opérations échouées |
| `@gestion982/offline/lastSync` | Timestamp de dernière sync |
| `@gestion982/cache/soldiers` | Cache des soldats |
| `@gestion982/cache/combatEquipment` | Cache équipements combat |
| `@gestion982/cache/clothingEquipment` | Cache équipements vêtements |
| `@gestion982/cache/manot` | Cache des manot |
| `@gestion982/cache/combatAssignments` | Cache assignments combat |
| `@gestion982/cache/clothingAssignments` | Cache assignments vêtements |
| `@gestion982/cache/rspEquipment` | Cache équipements RSP |
| `@gestion982/cache/weaponsInventory` | Cache inventaire armes |

## TTL (Time To Live) du cache

| Type de données | TTL | Raison |
|-----------------|-----|--------|
| Équipements | 10 min | Données statiques, changent rarement |
| Soldats | 5 min | Semi-statique |
| Assignments | 2 min | Données dynamiques |
| Storage persisté | 1 heure max | Évite données trop obsolètes |

## Logs de debug

Activer dans la console React Native:

```
[OfflineService] Queued operation: issue (offline_xxx)
[OfflineService] Back online - Processing queue...
[OfflineService] Processing 3 pending operations...
[OfflineService] Success: issue -> abc123
[CacheService] Hydrating caches from storage...
[CacheService] Hydrated soldiers: 150 items
```

## Limitations connues

1. **PDF non généré offline**: Le PDF de signature nécessite l'upload vers Firebase Storage, donc pas disponible offline
2. **WhatsApp non envoyé offline**: Le message WhatsApp est préparé mais pas envoyé
3. **Cache max 1 heure**: Les données persistées plus vieilles qu'1 heure sont ignorées au redémarrage
