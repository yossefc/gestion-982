/**
 * Firebase Wrapper - Gestion automatique online/offline
 *
 * Ce wrapper centralise tous les appels Firebase et gere:
 * - Le cache automatique pour les lectures
 * - La queue offline pour les ecritures
 * - Le retry automatique au retour du reseau
 * - Les mises a jour optimistes de l'UI
 */

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import cacheService, { hasCachedData, getCachedDataImmediate } from './cacheService';
import { offlineService, queueOperation, OperationType } from './offlineService';

// Cles de stockage
const STORAGE_PREFIX = '@gestion982/wrapper/';

// Types
export interface FirebaseReadOptions {
  ttl?: number;           // TTL personnalise en ms
  forceRefresh?: boolean; // Forcer le rechargement meme si cache valide
  allowStale?: boolean;   // Autoriser les donnees expirees (default: true en offline)
  cacheKey?: string;      // Cle de cache personnalisee
}

export interface FirebaseWriteResult<T> {
  result: T | null;
  offline: boolean;
  localId?: string;       // ID local temporaire si offline
  error?: string;
}

export interface FirebaseWriteOptions {
  optimisticUpdate?: {
    cacheKey: string;
    operation: 'add' | 'update' | 'delete';
    data: any;
  };
  queueable?: boolean;    // Peut etre mis en queue si offline (default: true)
}

// Cache local pour les lectures non-standard (hors cacheService)
const localReadCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

/**
 * Verifie si l'appareil est online
 */
export async function checkOnlineStatus(): Promise<boolean> {
  try {
    const netState = await NetInfo.fetch();
    return netState.isConnected ?? false;
  } catch {
    return false;
  }
}

/**
 * Wrapper universel pour les lectures Firebase
 *
 * Strategie:
 * 1. Si cache valide disponible -> retourner immediatement
 * 2. Si online -> fetch et mettre en cache
 * 3. Si offline -> retourner cache meme expire
 * 4. Si aucun cache -> lever une erreur
 *
 * @param cacheKey - Cle unique pour le cache
 * @param fetchFn - Fonction qui fait l'appel Firebase
 * @param options - Options de configuration
 */
export async function firebaseRead<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: FirebaseReadOptions = {}
): Promise<T> {
  const {
    ttl = 5 * 60 * 1000,  // 5 minutes par defaut
    forceRefresh = false,
    allowStale = true,
  } = options;

  const now = Date.now();

  // 1. Verifier le cache local
  const cached = localReadCache.get(cacheKey);
  if (cached && !forceRefresh) {
    const isValid = (now - cached.timestamp) < cached.ttl;
    if (isValid) {
      console.log(`[FirebaseWrapper] Cache hit for ${cacheKey}`);
      return cached.data as T;
    }
  }

  // 2. Verifier si on est online
  const isOnline = await checkOnlineStatus();

  // 3. Si online, tenter de fetch
  if (isOnline) {
    try {
      console.log(`[FirebaseWrapper] Fetching ${cacheKey} from Firebase...`);
      const data = await fetchFn();

      // Mettre en cache
      localReadCache.set(cacheKey, {
        data,
        timestamp: now,
        ttl,
      });

      // Persister en AsyncStorage pour survie au restart
      try {
        await AsyncStorage.setItem(
          `${STORAGE_PREFIX}read/${cacheKey}`,
          JSON.stringify({ data, timestamp: now, ttl })
        );
      } catch (e) {
        console.warn(`[FirebaseWrapper] Could not persist ${cacheKey} to storage`);
      }

      return data;
    } catch (error) {
      console.warn(`[FirebaseWrapper] Fetch failed for ${cacheKey}:`, error);
      // Si fetch echoue mais on a du cache, l'utiliser
      if (cached && allowStale) {
        console.log(`[FirebaseWrapper] Using stale cache for ${cacheKey}`);
        return cached.data as T;
      }
      throw error;
    }
  }

  // 4. Mode offline - utiliser le cache meme expire
  if (cached && allowStale) {
    console.log(`[FirebaseWrapper] Offline - using stale cache for ${cacheKey}`);
    return cached.data as T;
  }

  // 5. Tenter de charger depuis AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(`${STORAGE_PREFIX}read/${cacheKey}`);
    if (stored) {
      const { data, timestamp, ttl: storedTtl } = JSON.parse(stored);
      // Accepter les donnees meme vieilles en mode offline
      console.log(`[FirebaseWrapper] Loaded ${cacheKey} from AsyncStorage (offline)`);
      localReadCache.set(cacheKey, { data, timestamp, ttl: storedTtl });
      return data as T;
    }
  } catch (e) {
    console.warn(`[FirebaseWrapper] Could not load ${cacheKey} from storage`);
  }

  // 6. Aucune donnee disponible
  throw new Error(`No cached data available for ${cacheKey} and device is offline`);
}

/**
 * Wrapper universel pour les ecritures Firebase
 *
 * Strategie:
 * 1. Si online -> executer directement
 * 2. Si offline et queueable -> ajouter a la queue offline
 * 3. Mise a jour optimiste de l'UI si configuree
 *
 * @param actionType - Type d'operation (pour la queue offline)
 * @param data - Donnees a envoyer
 * @param writeFn - Fonction qui fait l'ecriture Firebase
 * @param options - Options de configuration
 */
export async function firebaseWrite<T>(
  actionType: OperationType,
  data: any,
  writeFn: () => Promise<T>,
  options: FirebaseWriteOptions = {}
): Promise<FirebaseWriteResult<T>> {
  const {
    optimisticUpdate,
    queueable = true,
  } = options;

  // Mise a jour optimiste de l'UI si configuree
  if (optimisticUpdate) {
    cacheService.update(
      optimisticUpdate.cacheKey as any,
      optimisticUpdate.operation,
      optimisticUpdate.data
    );
  }

  // Verifier si on est online
  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      console.log(`[FirebaseWrapper] Executing ${actionType} online...`);
      const result = await writeFn();
      return { result, offline: false };
    } catch (error) {
      console.error(`[FirebaseWrapper] Write failed for ${actionType}:`, error);

      // Si l'erreur est due au reseau, tenter de queue
      if (queueable && isNetworkError(error)) {
        console.log(`[FirebaseWrapper] Network error, queueing ${actionType}...`);
        const localId = await queueOperation(actionType, data);
        return { result: null, offline: true, localId };
      }

      throw error;
    }
  }

  // Mode offline
  if (queueable) {
    console.log(`[FirebaseWrapper] Offline - queueing ${actionType}...`);
    const localId = await queueOperation(actionType, data);
    return { result: null, offline: true, localId };
  }

  throw new Error(`Cannot execute ${actionType} while offline (not queueable)`);
}

/**
 * Verifie si une erreur est due au reseau
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';

  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('unavailable') ||
    code.includes('network') ||
    code === 'unavailable' ||
    code === 'failed-precondition'
  );
}

/**
 * Hydrate le cache local depuis AsyncStorage
 * Appele au demarrage de l'app
 */
export async function hydrateLocalCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const readKeys = keys.filter(k => k.startsWith(`${STORAGE_PREFIX}read/`));

    for (const key of readKeys) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const { data, timestamp, ttl } = JSON.parse(stored);
          const cacheKey = key.replace(`${STORAGE_PREFIX}read/`, '');
          localReadCache.set(cacheKey, { data, timestamp, ttl });
        }
      } catch (e) {
        // Ignorer les erreurs individuelles
      }
    }

    console.log(`[FirebaseWrapper] Hydrated ${readKeys.length} cache entries from storage`);
  } catch (error) {
    console.error('[FirebaseWrapper] Error hydrating cache:', error);
  }
}

/**
 * Vide le cache local (memoire et storage)
 */
export async function clearLocalCache(): Promise<void> {
  localReadCache.clear();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const readKeys = keys.filter(k => k.startsWith(`${STORAGE_PREFIX}read/`));
    await AsyncStorage.multiRemove(readKeys);
  } catch (error) {
    console.error('[FirebaseWrapper] Error clearing cache:', error);
  }
}

/**
 * Invalide une entree specifique du cache
 */
export function invalidateCache(cacheKey: string): void {
  localReadCache.delete(cacheKey);
  AsyncStorage.removeItem(`${STORAGE_PREFIX}read/${cacheKey}`).catch(() => {});
}

/**
 * Wrapper pour les ecritures avec retry automatique
 * Attend jusqu'a ce que l'operation reussisse ou atteigne le max de retries
 */
export async function firebaseWriteWithRetry<T>(
  actionType: OperationType,
  data: any,
  writeFn: () => Promise<T>,
  options: FirebaseWriteOptions & { maxRetries?: number; retryDelay?: number } = {}
): Promise<FirebaseWriteResult<T>> {
  const { maxRetries = 3, retryDelay = 1000, ...writeOptions } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await firebaseWrite(actionType, data, writeFn, writeOptions);
    } catch (error) {
      if (attempt < maxRetries && isNetworkError(error)) {
        console.log(`[FirebaseWrapper] Retry ${attempt + 1}/${maxRetries} for ${actionType}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      } else {
        throw error;
      }
    }
  }

  // Ne devrait jamais arriver, mais TypeScript veut un retour
  throw new Error('Max retries exceeded');
}

// Export du service
export const firebaseWrapper = {
  read: firebaseRead,
  write: firebaseWrite,
  writeWithRetry: firebaseWriteWithRetry,
  checkOnline: checkOnlineStatus,
  hydrate: hydrateLocalCache,
  clear: clearLocalCache,
  invalidate: invalidateCache,
};

export default firebaseWrapper;
