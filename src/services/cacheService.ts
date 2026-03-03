/**
 * Service de cache centralisé pour Firebase
 * Optimise les performances en évitant les lectures répétées
 *
 * Fonctionnalités:
 * - Cache en mémoire avec TTL configurable
 * - Persistence AsyncStorage (survit aux redémarrages)
 * - Chargement optimiste (affiche le cache immédiatement, refresh en arrière-plan)
 * - Invalidation sélective du cache
 * - Support des listeners temps réel (onSnapshot)
 */

import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app } from '../config/firebase';

// Préfixe pour les clés AsyncStorage
const STORAGE_PREFIX = '@gestion982/cache/';

const db = getFirestore(app);

// TTL mémoire court (5 min) : quand online, on rafraîchit souvent depuis Firebase.
// maxStorageAge long : quand offline, on utilise les données persistées en AsyncStorage
// même si elles sont plus vieilles que le TTL mémoire.
const ONLINE_TTL = 5 * 60 * 1000; // 5 minutes

const CACHE_CONFIG = {
  soldiers: {
    ttl: ONLINE_TTL,
    collection: 'soldiers',
    priority: 1,
    maxStorageAge: 7 * 24 * 60 * 60 * 1000,  // 7 jours en storage offline
  },
  combatEquipment: {
    ttl: ONLINE_TTL,
    collection: 'combatEquipment',
    priority: 2,
    maxStorageAge: 7 * 24 * 60 * 60 * 1000,
  },
  clothingEquipment: {
    ttl: ONLINE_TTL,
    collection: 'clothingEquipment',
    priority: 2,
    maxStorageAge: 7 * 24 * 60 * 60 * 1000,
  },
  manot: {
    ttl: ONLINE_TTL,
    collection: 'manot',
    priority: 3,
    maxStorageAge: 7 * 24 * 60 * 60 * 1000,
  },
  rspEquipment: {
    ttl: ONLINE_TTL,
    collection: 'rsp_equipment',
    priority: 3,
    maxStorageAge: 7 * 24 * 60 * 60 * 1000,
  },
  combatAssignments: {
    ttl: ONLINE_TTL,
    collection: 'assignments',
    priority: 4,
    maxStorageAge: 24 * 60 * 60 * 1000,  // 24h en storage offline
  },
  clothingAssignments: {
    ttl: ONLINE_TTL,
    collection: 'assignments',
    priority: 4,
    maxStorageAge: 24 * 60 * 60 * 1000,
  },
  weaponsInventory: {
    ttl: ONLINE_TTL,
    collection: 'weapons_inventory',
    priority: 5,
    maxStorageAge: 24 * 60 * 60 * 1000,
  },
} as const;

type CacheKey = keyof typeof CACHE_CONFIG;

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  loading: boolean;
}

interface CacheState {
  soldiers: CacheEntry<any>;
  combatEquipment: CacheEntry<any>;
  clothingEquipment: CacheEntry<any>;
  manot: CacheEntry<any>;
  combatAssignments: CacheEntry<any>;
  clothingAssignments: CacheEntry<any>;
  rspEquipment: CacheEntry<any>;
  weaponsInventory: CacheEntry<any>;
}

// État du cache en mémoire
const cache: CacheState = {
  soldiers: { data: [], timestamp: 0, loading: false },
  combatEquipment: { data: [], timestamp: 0, loading: false },
  clothingEquipment: { data: [], timestamp: 0, loading: false },
  manot: { data: [], timestamp: 0, loading: false },
  combatAssignments: { data: [], timestamp: 0, loading: false },
  clothingAssignments: { data: [], timestamp: 0, loading: false },
  rspEquipment: { data: [], timestamp: 0, loading: false },
  weaponsInventory: { data: [], timestamp: 0, loading: false },
};

// Listeners actifs pour onSnapshot
const activeListeners: Map<string, Unsubscribe> = new Map();

// Callbacks pour notifier les composants des mises à jour
const subscribers: Map<CacheKey, Set<(data: any[]) => void>> = new Map();

/**
 * Vérifie si le cache est valide (non expiré)
 */
function isCacheValid(key: CacheKey): boolean {
  const entry = cache[key];
  const config = CACHE_CONFIG[key];
  const now = Date.now();
  return entry.data.length > 0 && (now - entry.timestamp) < config.ttl;
}

/**
 * Notifie tous les subscribers d'une mise à jour
 */
function notifySubscribers(key: CacheKey, data: any[]) {
  const subs = subscribers.get(key);
  if (subs) {
    subs.forEach(callback => callback(data));
  }
}

/**
 * S'abonner aux mises à jour d'un cache
 */
export function subscribeToCache(key: CacheKey, callback: (data: any[]) => void): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key)!.add(callback);

  // Retourner fonction de désabonnement
  return () => {
    subscribers.get(key)?.delete(callback);
  };
}

/**
 * Récupère les données du cache ou les charge depuis Firebase
 * Mode optimiste: retourne immédiatement le cache s'il existe, puis refresh en arrière-plan
 */
export async function getCached<T>(
  key: CacheKey,
  options: {
    forceRefresh?: boolean;
    backgroundRefresh?: boolean;
  } = {}
): Promise<{ data: T[]; fromCache: boolean; loading: boolean }> {
  const { forceRefresh = false, backgroundRefresh = true } = options;
  const entry = cache[key];

  // Si le cache est valide et pas de forceRefresh, retourner le cache
  if (!forceRefresh && isCacheValid(key)) {
    // Optionnel: refresh en arrière-plan si les données ont plus de 50% du TTL
    const config = CACHE_CONFIG[key];
    const age = Date.now() - entry.timestamp;
    if (backgroundRefresh && age > config.ttl * 0.5 && !entry.loading) {
      // Refresh en arrière-plan sans bloquer
      refreshCache(key).catch(console.error);
    }
    return { data: entry.data as T[], fromCache: true, loading: false };
  }

  // Si déjà en chargement, retourner le cache actuel (même vide)
  if (entry.loading) {
    return { data: entry.data as T[], fromCache: true, loading: true };
  }

  // Si on a des données en cache (même expirées), les retourner en cas d'erreur réseau
  const hasStaleCache = entry.data.length > 0;

  // Charger depuis Firebase
  try {
    await refreshCache(key);
    return { data: cache[key].data as T[], fromCache: false, loading: false };
  } catch (error) {
    // En cas d'erreur (offline), retourner le cache expiré si disponible
    if (hasStaleCache) {
      console.warn(`[CacheService] Using stale cache for ${key} (offline mode)`);
      return { data: entry.data as T[], fromCache: true, loading: false };
    }
    // Sinon, propager l'erreur
    throw error;
  }
}

/**
 * Rafraîchit le cache depuis Firebase
 */
async function refreshCache(key: CacheKey): Promise<void> {
  const config = CACHE_CONFIG[key];
  const entry = cache[key];

  // Éviter les chargements multiples simultanés
  if (entry.loading) return;

  entry.loading = true;

  try {
    let q;

    // Requêtes spécifiques selon le type
    switch (key) {
      case 'combatAssignments':
        q = query(
          collection(db, config.collection),
          // Pas de filtre ici, on filtre côté client pour éviter index composites
        );
        break;
      case 'clothingAssignments':
        q = query(collection(db, config.collection));
        break;
      default:
        q = query(collection(db, config.collection));
    }

    const snapshot = await getDocs(q);
    let data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convertir les timestamps si présents
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
    }));

    // Filtrage spécifique pour les assignments
    if (key === 'combatAssignments') {
      data = data.filter((d: any) => d.type === 'combat');
    } else if (key === 'clothingAssignments') {
      data = data.filter((d: any) => d.type === 'clothing');
    }

    // Tri pour les soldats
    if (key === 'soldiers') {
      data.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }

    entry.data = data;
    entry.timestamp = Date.now();

    // Notifier les subscribers
    notifySubscribers(key, data);

    // IMPORTANT: Persister dans AsyncStorage pour le mode offline
    // Ne pas attendre pour ne pas bloquer le rendu
    persistToStorage(key).catch(err => {
      console.warn(`[CacheService] Failed to persist ${key}:`, err);
    });
  } catch (error) {
    console.error(`Error refreshing cache for ${key}:`, error);
    throw error;
  } finally {
    entry.loading = false;
  }
}

/**
 * Invalide un cache spécifique
 */
export function invalidateCache(key: CacheKey | CacheKey[]): void {
  const keys = Array.isArray(key) ? key : [key];
  keys.forEach(k => {
    cache[k].timestamp = 0;
  });
}

/**
 * Met a jour le timestamp d'un cache (utile pour updates offline)
 */
export function touchCache(key: CacheKey): void {
  cache[key].timestamp = Date.now();
}

/**
 * Invalide tous les caches
 */
export function invalidateAllCaches(): void {
  Object.keys(cache).forEach(key => {
    cache[key as CacheKey].timestamp = 0;
  });
}

/**
 * Met à jour le cache localement (optimistic update)
 * Permet de mettre à jour l'UI immédiatement sans attendre Firebase
 */
export function updateCacheOptimistically<T extends { id: string }>(
  key: CacheKey,
  operation: 'add' | 'update' | 'delete',
  item: T | Partial<T> & { id: string }
): void {
  const entry = cache[key];

  switch (operation) {
    case 'add':
      entry.data = [...entry.data, item];
      if (key === 'soldiers') {
        entry.data.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      }
      break;
    case 'update':
      entry.data = entry.data.map((d: any) =>
        d.id === item.id ? { ...d, ...item } : d
      );
      break;
    case 'delete':
      entry.data = entry.data.filter((d: any) => d.id !== item.id);
      break;
  }

  // Notifier les subscribers
  notifySubscribers(key, entry.data);
}

/**
 * Démarre un listener temps réel pour un cache
 * Utile pour les données qui changent fréquemment
 */
export function startRealtimeListener(key: CacheKey): () => void {
  // Ne pas créer de doublon
  if (activeListeners.has(key)) {
    return () => stopRealtimeListener(key);
  }

  const config = CACHE_CONFIG[key];
  const entry = cache[key];

  const unsubscribe = onSnapshot(
    collection(db, config.collection),
    (snapshot: QuerySnapshot<DocumentData>) => {
      let data = snapshot.docs.map(doc => {
        const docData = doc.data();
        // Omit base64 signatures from cache to save storage space and avoid SQLite full errors
        delete docData.signature;

        return {
          id: doc.id,
          ...docData,
          createdAt: docData.createdAt?.toDate?.() || docData.createdAt,
          updatedAt: docData.updatedAt?.toDate?.() || docData.updatedAt,
          timestamp: docData.timestamp?.toDate?.() || docData.timestamp,
        };
      });

      // Filtrage spécifique
      if (key === 'combatAssignments') {
        data = data.filter((d: any) => d.type === 'combat');
      } else if (key === 'clothingAssignments') {
        data = data.filter((d: any) => d.type === 'clothing');
      }

      // Tri pour les soldats
      if (key === 'soldiers') {
        data.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      }

      entry.data = data;
      entry.timestamp = Date.now();
      entry.loading = false;

      // Notifier les subscribers
      notifySubscribers(key, data);
    },
    (error) => {
      console.error(`Realtime listener error for ${key}:`, error);
    }
  );

  activeListeners.set(key, unsubscribe);

  return () => stopRealtimeListener(key);
}

/**
 * Arrête un listener temps réel
 */
export function stopRealtimeListener(key: CacheKey): void {
  const unsubscribe = activeListeners.get(key);
  if (unsubscribe) {
    unsubscribe();
    activeListeners.delete(key);
  }
}

/**
 * Arrête tous les listeners temps réel
 */
export function stopAllRealtimeListeners(): void {
  activeListeners.forEach((unsubscribe, key) => {
    unsubscribe();
  });
  activeListeners.clear();
}

/**
 * Précharge plusieurs caches en parallèle
 * Utile au démarrage de l'app
 * Les caches sont chargés par priorité (défini dans CACHE_CONFIG)
 */
export async function preloadCaches(keys?: CacheKey[]): Promise<void> {
  const cacheKeys = keys || (Object.keys(CACHE_CONFIG) as CacheKey[]);

  // Trier par priorité
  const sortedKeys = [...cacheKeys].sort((a, b) => {
    const priorityA = CACHE_CONFIG[a].priority || 99;
    const priorityB = CACHE_CONFIG[b].priority || 99;
    return priorityA - priorityB;
  });

  // Charger en parallèle mais par groupes de priorité
  const priorities = new Map<number, CacheKey[]>();
  sortedKeys.forEach(key => {
    const priority = CACHE_CONFIG[key].priority || 99;
    if (!priorities.has(priority)) {
      priorities.set(priority, []);
    }
    priorities.get(priority)!.push(key);
  });

  // Charger chaque groupe de priorité séquentiellement,
  // mais les items du même groupe en parallèle
  for (const [, groupKeys] of Array.from(priorities.entries()).sort((a, b) => a[0] - b[0])) {
    await Promise.all(groupKeys.map(key =>
      getCached(key, { forceRefresh: true }).catch(err => {
        console.warn(`[CacheService] Failed to preload ${key}:`, err);
        // Ne pas propager l'erreur, continuer avec les autres
      })
    ));
  }
}

/**
 * Précharge les caches essentiels uniquement (priorité 1-3)
 * Plus rapide au démarrage, données volatiles chargées à la demande
 */
export async function preloadEssentialCaches(): Promise<void> {
  const essentialKeys = (Object.keys(CACHE_CONFIG) as CacheKey[]).filter(
    key => (CACHE_CONFIG[key].priority || 99) <= 3
  );
  await preloadCaches(essentialKeys);
}

/**
 * Récupère les statistiques du cache (pour debug)
 */
export function getCacheStats(): Record<CacheKey, { count: number; age: number; valid: boolean }> {
  const now = Date.now();
  const stats: any = {};

  Object.keys(cache).forEach(key => {
    const k = key as CacheKey;
    const entry = cache[k];
    const config = CACHE_CONFIG[k];
    stats[k] = {
      count: entry.data.length,
      age: entry.timestamp ? Math.round((now - entry.timestamp) / 1000) : -1,
      valid: isCacheValid(k),
    };
  });

  return stats;
}

// ============================================
// PERSISTENCE ASYNCSTORAGE
// ============================================

const DEFAULT_CHUNK_SIZE = 50;

function getChunkSize(key: CacheKey): number {
  // Assignments can be large (lots of items). Max 10 per chunk.
  if (key === 'combatAssignments' || key === 'clothingAssignments') {
    return 10;
  }
  return DEFAULT_CHUNK_SIZE;
}

/**
 * Sauvegarde un cache vers AsyncStorage avec chunking pour les gros tableaux
 */
async function persistToStorage(key: CacheKey): Promise<void> {
  try {
    const entry = cache[key];
    if (entry.data.length === 0) {
      console.log(`[CacheService] Skip persist ${key}: no data`);
      return;
    }

    // Supprimer les anciens chunks d'abord pour éviter les conflits
    await clearSpecificStorage(key);

    const isLargeData = ['combatAssignments', 'clothingAssignments', 'weaponsInventory', 'soldiers'].includes(key);
    const chunkSize = getChunkSize(key);

    if (isLargeData && entry.data.length > chunkSize) {
      // Chunking saving
      const chunksCount = Math.ceil(entry.data.length / chunkSize);
      const metadata = {
        timestamp: entry.timestamp,
        isChunked: true,
        chunksCount,
      };

      await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}_meta`, JSON.stringify(metadata));

      for (let i = 0; i < chunksCount; i++) {
        const chunkData = entry.data.slice(i * chunkSize, (i + 1) * chunkSize);
        await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}_chunk_${i}`, JSON.stringify(chunkData));
      }
      console.log(`[CacheService] Persisted ${key}: ${entry.data.length} items in ${chunksCount} chunks`);
    } else {
      // Small data saving directly
      const storageData = {
        data: entry.data,
        timestamp: entry.timestamp,
        isChunked: false
      };

      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}${key}`,
        JSON.stringify(storageData)
      );
      console.log(`[CacheService] Persisted ${key}: ${entry.data.length} items`);
    }

  } catch (error) {
    console.error(`[CacheService] Error persisting ${key}:`, error);
  }
}

/**
 * Nettoie toutes les clés reliées à un Storage specifique
 */
async function clearSpecificStorage(key: CacheKey): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(k => k.startsWith(`${STORAGE_PREFIX}${key}`));
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    console.error(`[CacheService] Error clearing old keys for ${key}:`, error);
  }
}

/**
 * Charge un cache depuis AsyncStorage
 * En mode offline, accepte les données plus anciennes que le TTL normal
 */
async function loadFromStorage(key: CacheKey): Promise<boolean> {
  try {
    const config = CACHE_CONFIG[key];

    // Essayer de lire en tant que données chunkées d'abord (nouveau format)
    const metaStored = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}_meta`);

    if (metaStored) {
      const metadata = JSON.parse(metaStored);

      const ageMs = Date.now() - metadata.timestamp;
      const maxAge = config.maxStorageAge || (7 * 24 * 60 * 60 * 1000);
      if (ageMs > maxAge) {
        console.log(`[CacheService] Chunked Storage data too old for ${key}, removing...`);
        await clearSpecificStorage(key);
        return false;
      }

      let allData: any[] = [];
      for (let i = 0; i < metadata.chunksCount; i++) {
        const chunkStr = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}_chunk_${i}`);
        if (chunkStr) {
          allData = allData.concat(JSON.parse(chunkStr));
        }
      }

      cache[key].data = allData;
      cache[key].timestamp = metadata.timestamp;
      console.log(`[CacheService] Loaded ${key} from storage: ${allData.length} items in chunks`);
      return true;
    }

    // Sinon essayer ancien format non chunké
    const stored = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!stored) {
      console.log(`[CacheService] No stored data for ${key}`);
      return false;
    }

    const { data, timestamp } = JSON.parse(stored);

    // Calculer l'âge des données
    const ageMs = Date.now() - timestamp;
    const ageHours = Math.round(ageMs / (1000 * 60 * 60));
    const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24));

    // Utiliser maxStorageAge au lieu d'une limite fixe de 1 heure
    // Cela permet d'utiliser les données offline plus longtemps
    const maxAge = config.maxStorageAge || (7 * 24 * 60 * 60 * 1000); // 7 jours par défaut
    if (ageMs > maxAge) {
      console.log(`[CacheService] Storage data too old for ${key} (${ageDays} days), removing...`);
      await clearSpecificStorage(key);
      return false;
    }

    cache[key].data = data;
    cache[key].timestamp = timestamp;

    console.log(`[CacheService] Loaded ${key} from storage: ${data.length} items (age: ${ageHours}h)`);
    return true;
  } catch (error) {
    console.error(`[CacheService] Error loading ${key} from storage:`, error);
    // En cas d'erreur de lecture (ex: CursorWindow trop petit), on efface le cache corrompu
    await clearSpecificStorage(key);
    return false;
  }
}

/**
 * Hydrate tous les caches depuis AsyncStorage
 * Appelé au démarrage de l'app
 */
export async function hydrateFromStorage(): Promise<void> {
  console.log('[CacheService] Hydrating caches from storage...');

  const keys = Object.keys(CACHE_CONFIG) as CacheKey[];

  await Promise.all(
    keys.map(async (key) => {
      const loaded = await loadFromStorage(key);
      if (loaded) {
        console.log(`[CacheService] Hydrated ${key}: ${cache[key].data.length} items`);
        // Notifier les subscribers avec les données restaurées
        notifySubscribers(key, cache[key].data);
      }
    })
  );

  console.log('[CacheService] Hydration complete');
}

/**
 * Persiste tous les caches vers AsyncStorage
 */
export async function persistAllToStorage(): Promise<void> {
  const keys = Object.keys(CACHE_CONFIG) as CacheKey[];
  await Promise.all(keys.map(persistToStorage));
}

/**
 * Persiste un cache sp׼cifique vers AsyncStorage
 * Utile pour les updates offline (optimistes)
 */
export async function persistCacheKey(key: CacheKey): Promise<void> {
  await persistToStorage(key);
}

/**
 * Vide tout le storage de cache
 */
export async function clearStorage(): Promise<void> {
  const keys = Object.keys(CACHE_CONFIG) as CacheKey[];
  await Promise.all(
    keys.map(key => clearSpecificStorage(key))
  );
}

// Note: La persistence est maintenant intégrée dans refreshCache directement

/**
 * Vérifie si le cache a des données (même expirées)
 * Utile pour le mode offline
 */
export function hasCachedData(key: CacheKey): boolean {
  return cache[key].data.length > 0;
}

/**
 * Récupère les données du cache sans tenter de rafraîchir
 * Retourne les données même si expirées (mode offline)
 */
export function getCachedDataImmediate<T>(key: CacheKey): T[] {
  return cache[key].data as T[];
}

/**
 * Vérifie si toutes les données essentielles sont disponibles en cache
 * (même expirées - utile pour le mode offline)
 */
export function hasEssentialData(): boolean {
  return hasCachedData('soldiers') &&
    (hasCachedData('combatEquipment') || hasCachedData('clothingEquipment'));
}

/**
 * Réinitialise complètement le cache (pour les tests)
 * ATTENTION: Vide toutes les données en mémoire
 */
export function resetAllCacheData(): void {
  const keys = Object.keys(cache) as CacheKey[];
  keys.forEach(key => {
    cache[key].data = [];
    cache[key].timestamp = 0;
    cache[key].loading = false;
  });
  subscribers.clear();
}

// Export du service principal
export const cacheService = {
  get: getCached,
  invalidate: invalidateCache,
  invalidateAll: invalidateAllCaches,
  touch: touchCache,
  update: updateCacheOptimistically,
  subscribe: subscribeToCache,
  startRealtime: startRealtimeListener,
  stopRealtime: stopRealtimeListener,
  stopAllRealtime: stopAllRealtimeListeners,
  preload: preloadCaches,
  preloadEssential: preloadEssentialCaches,
  getStats: getCacheStats,
  isValid: isCacheValid,
  hasData: hasCachedData,
  getImmediate: getCachedDataImmediate,
  hasEssentialData,
  // Fonctions de persistence
  hydrate: hydrateFromStorage,
  persistAll: persistAllToStorage,
  persistKey: persistCacheKey,
  clearStorage,
  // Pour les tests
  resetAll: resetAllCacheData,
};

export default cacheService;
