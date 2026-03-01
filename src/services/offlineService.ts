/**
 * Service de synchronisation offline pour Gestion 982
 *
 * Fonctionnalitֳ©s:
 * - Queue persistante des opֳ©rations en attente (AsyncStorage)
 * - Sync automatique au retour du rֳ©seau
 * - Support complet pour les signatures offline
 * - Gestion des conflits avec requestId (idempotence)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import cacheService, { persistCacheKey } from './cacheService';
import { Assignment } from '../types';

// Clֳ©s AsyncStorage
const STORAGE_KEYS = {
  PENDING_QUEUE: '@gestion982/offline/pendingQueue',
  FAILED_QUEUE: '@gestion982/offline/failedQueue',
  LAST_SYNC: '@gestion982/offline/lastSync',
};

// Types d'opֳ©rations supportֳ©es
export type OperationType =
  | 'issue'      // ׳”׳—׳×׳׳”
  | 'return'     // ׳”׳—׳–׳¨׳”
  | 'add'        // ׳”׳•׳¡׳₪׳”
  | 'credit'     // ׳–׳™׳›׳•׳™
  | 'storage'    // ׳׳₪׳¡׳•׳
  | 'retrieve'
  | 'weaponAssign';

export interface PendingOperation {
  id: string;                    // UUID unique
  type: OperationType;
  params: any;                   // Paramֳ¨tres de l'opֳ©ration
  timestamp: number;             // Timestamp de crֳ©ation
  retryCount: number;            // Nombre de tentatives
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;         // Message d'erreur si ֳ©chec
  localResult?: string;          // ID local temporaire
}

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
  lastSyncSuccessCount: number;
  lastSyncFailedCount: number;
}

// Flag pour savoir si le service a ete initialise
let initialized = false;

// ֳ‰tat global - isOnline est false par defaut pour etre conservatif
// (mieux vaut queue une operation que d'echouer)
let currentState: OfflineState = {
  isOnline: false, // Conservatif: suppose offline jusqu'a preuve du contraire
  pendingCount: 0,
  failedCount: 0,
  syncStatus: 'idle',
  lastSyncTime: null,
  lastSyncSuccessCount: 0,
  lastSyncFailedCount: 0,
};

// Callbacks pour notifier les changements d'ֳ©tat
const stateListeners: Set<(state: OfflineState) => void> = new Set();

// Cache mémoire des opérations pour éviter les lectures AsyncStorage répétées
let pendingOpsCache: PendingOperation[] = [];
let failedOpsCache: PendingOperation[] = [];
let opsCacheLoaded = false;

// Reference aux fonctions transactionnelles (injectֳ©es pour ֳ©viter circular dependency)
type TransactionFn = (params: any) => Promise<string>;
let transactionFunctions: Partial<Record<OperationType, TransactionFn>> = {};

/**
 * Initialise le service offline
 */
export async function initOfflineService(): Promise<void> {
  // Charger l'ֳ©tat initial
  await loadQueueCounts();

  // ֳ‰couter les changements de connectivitֳ©
  NetInfo.addEventListener(handleConnectivityChange);

  // Vֳ©rifier l'ֳ©tat initial
  const netState = await NetInfo.fetch();
  currentState.isOnline = netState.isConnected ?? true;
  initialized = true;

  console.log(`[OfflineService] Initialized - online: ${currentState.isOnline}`);

  // NOTE: Auto-sync dֳ©sactivֳ© au dֳ©marrage pour ֳ©viter de bloquer l'app
  // La sync se fera automatiquement lors des changements de connectivitֳ©
  // ou peut ֳ×tre dֳ©clenchֳ©e manuellement via offlineService.process()

  // if (currentState.isOnline) {
  //   processQueue();
  // }

  notifyListeners();
}

/**
 * Injecte les fonctions transactionnelles (appelֳ© depuis transactionalAssignmentService)
 */
export function setTransactionFunctions(functions: typeof transactionFunctions): void {
  transactionFunctions = { ...transactionFunctions, ...functions };
}

/**
 * Gֳ¨re les changements de connectivitֳ©
 */
async function handleConnectivityChange(state: NetInfoState): Promise<void> {
  const wasOffline = !currentState.isOnline;
  currentState.isOnline = state.isConnected ?? true;

  // Si on vient de revenir online, traiter la queue
  if (wasOffline && currentState.isOnline) {
    console.log('[OfflineService] Back online - Processing queue...');
    await processQueue();
  }

  notifyListeners();
}

/**
 * Charge les compteurs de queue depuis AsyncStorage + cache mémoire
 */
async function loadQueueCounts(): Promise<void> {
  try {
    const [pendingJson, failedJson, lastSyncJson] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE),
      AsyncStorage.getItem(STORAGE_KEYS.FAILED_QUEUE),
      AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
    ]);

    pendingOpsCache = pendingJson ? JSON.parse(pendingJson) : [];
    failedOpsCache = failedJson ? JSON.parse(failedJson) : [];
    opsCacheLoaded = true;

    currentState.pendingCount = pendingOpsCache.length;
    currentState.failedCount = failedOpsCache.length;
    currentState.lastSyncTime = lastSyncJson ? new Date(JSON.parse(lastSyncJson)) : null;
  } catch (error) {
    console.error('[OfflineService] Error loading queue counts:', error);
  }
}

/**
 * Tente d'écrire dans AsyncStorage avec un retry unique en cas d'échec.
 * Throw si les deux tentatives échouent.
 */
async function persistToStorage(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (firstErr) {
    console.warn(`[OfflineService] AsyncStorage write failed (attempt 1) for ${key}:`, firstErr);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (secondErr) {
      console.error(`[OfflineService] CRITICAL: AsyncStorage write failed after retry for ${key}. Data may be lost on restart:`, secondErr);
      throw secondErr;
    }
  }
}

/**
 * Sauvegarde la queue pending (cache mémoire + AsyncStorage)
 */
async function savePendingQueue(queue: PendingOperation[]): Promise<void> {
  pendingOpsCache = queue;
  currentState.pendingCount = queue.length;
  notifyListeners();
  await persistToStorage(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(queue));
}

/**
 * Sauvegarde la queue failed (cache mémoire + AsyncStorage)
 */
async function saveFailedQueue(queue: PendingOperation[]): Promise<void> {
  failedOpsCache = queue;
  currentState.failedCount = queue.length;
  notifyListeners();
  await persistToStorage(STORAGE_KEYS.FAILED_QUEUE, JSON.stringify(queue));
}

/**
 * Ajoute une opֳ©ration ֳ  la queue
 * Retourne un ID local temporaire
 */
export async function queueOperation(
  type: OperationType,
  params: any
): Promise<string> {
  const operation: PendingOperation = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    params,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
    localResult: `LOCAL_${params.requestId || Date.now()}`,
  };

  // OPTIMISÉ: Utiliser le cache mémoire au lieu de lire AsyncStorage (RAPIDE)
  pendingOpsCache.push(operation);
  // Fire-and-forget pour ne pas bloquer l'UI — l'erreur est loggée si AsyncStorage échoue après retry
  savePendingQueue([...pendingOpsCache]).catch(err => {
    console.error(`[OfflineService] Operation ${operation.id} queued in memory but could not be persisted:`, err);
  });

  console.log(`[OfflineService] Queued operation: ${type} (${operation.id})`);

  // Update cache optimistically so offline UI reflects the operation immediately
  try {
    await updateAssignmentsCache(type, params, operation);
  } catch (cacheError) {
    console.warn('[OfflineService] Failed to update cache optimistically:', cacheError);
  }

  return operation.localResult!;
}

/**
 * Traite toutes les opֳ©rations en attente
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  if (currentState.syncStatus === 'syncing') {
    console.log('[OfflineService] Already syncing, skipping...');
    return { success: 0, failed: 0 };
  }

  if (!currentState.isOnline) {
    console.log('[OfflineService] Offline, skipping sync...');
    return { success: 0, failed: 0 };
  }

  currentState.syncStatus = 'syncing';
  notifyListeners();

  let successCount = 0;
  let failedCount = 0;

  try {
    const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
    const queue: PendingOperation[] = queueJson ? JSON.parse(queueJson) : [];

    if (queue.length === 0) {
      currentState.syncStatus = 'idle';
      notifyListeners();
      return { success: 0, failed: 0 };
    }

    console.log(`[OfflineService] Processing ${queue.length} pending operations...`);

    const failedOps: PendingOperation[] = [];
    const existingFailedJson = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_QUEUE);
    const existingFailed: PendingOperation[] = existingFailedJson ? JSON.parse(existingFailedJson) : [];

    // Traiter chaque opֳ©ration dans l'ordre
    for (const op of queue) {
      try {
        op.status = 'syncing';
        op.retryCount++;

        const transactionFn = transactionFunctions[op.type];
        if (!transactionFn) {
          throw new Error(`Unknown operation type: ${op.type}`);
        }

        // Exֳ©cuter l'opֳ©ration Firebase
        const result = await transactionFn(op.params);

        console.log(`[OfflineService] Success: ${op.type} -> ${result}`);
        successCount++;

      } catch (error) {
        console.error(`[OfflineService] Failed: ${op.type}`, error);

        op.status = 'failed';
        op.errorMessage = (error as Error).message;

        // Si trop de tentatives, mettre dans failed queue
        if (op.retryCount >= 3) {
          failedOps.push(op);
        } else {
          // Remettre dans pending pour retry
          op.status = 'pending';
          failedOps.push(op);
        }

        failedCount++;
      }
    }

    // Sauvegarder les ֳ©tats
    await savePendingQueue([]); // Vider la queue pending
    await saveFailedQueue([...existingFailed, ...failedOps.filter(o => o.retryCount >= 3)]);

    // Les opֳ©rations avec retry < 3 retournent dans pending
    const retryOps = failedOps.filter(o => o.retryCount < 3);
    if (retryOps.length > 0) {
      await savePendingQueue(retryOps);
    }

    // Mettre ֳ  jour lastSync
    currentState.lastSyncTime = new Date();
    currentState.lastSyncSuccessCount = successCount;
    currentState.lastSyncFailedCount = failedCount;
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, JSON.stringify(currentState.lastSyncTime.toISOString()));

    currentState.syncStatus = failedCount > 0 ? 'error' : 'idle';

  } catch (error) {
    console.error('[OfflineService] Error processing queue:', error);
    currentState.syncStatus = 'error';
  }

  notifyListeners();
  return { success: successCount, failed: failedCount };
}

/**
 * Rֳ©cupֳ¨re l'ֳ©tat actuel
 */
export function getOfflineState(): OfflineState {
  return { ...currentState };
}

/**
 * Vֳ©rifie si on est online
 * Si le service n'est pas initialisֳ©, retourne false (conservatif)
 * pour ֳ©viter des ֳ©checs de requֳ×tes
 */
export function isOnline(): boolean {
  if (!initialized) {
    console.warn('[OfflineService] isOnline() called before init - assuming offline');
    return false;
  }
  return currentState.isOnline;
}

/**
 * Rֳ©cupֳ¨re le nombre d'opֳ©rations en attente
 */
export function getPendingCount(): number {
  return currentState.pendingCount;
}

/**
 * Rֳ©cupֳ¨re toutes les opֳ©rations en attente
 * OPTIMISÉ: Utilise le cache mémoire (synchrone et rapide)
 */
export function getPendingOperations(): PendingOperation[] {
  return [...pendingOpsCache];
}

/**
 * Rֳ©cupֳ¨re toutes les opֳ©rations ֳ©chouֳ©es
 * OPTIMISÉ: Utilise le cache mémoire (synchrone et rapide)
 */
export function getFailedOperations(): PendingOperation[] {
  return [...failedOpsCache];
}

/**
 * Supprime une opֳ©ration ֳ©chouֳ©e
 * OPTIMISÉ: Utilise le cache mémoire
 */
export async function removeFailedOperation(operationId: string): Promise<void> {
  const filtered = failedOpsCache.filter(op => op.id !== operationId);
  await saveFailedQueue(filtered);
}

/**
 * Rֳ©essaie une opֳ©ration ֳ©chouֳ©e
 */
export async function retryFailedOperation(operationId: string): Promise<void> {
  const failedJson = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_QUEUE);
  const failed: PendingOperation[] = failedJson ? JSON.parse(failedJson) : [];

  const opIndex = failed.findIndex(op => op.id === operationId);
  if (opIndex === -1) return;

  const op = failed[opIndex];
  op.retryCount = 0;
  op.status = 'pending';
  op.errorMessage = undefined;

  // Retirer de failed et ajouter ֳ  pending
  failed.splice(opIndex, 1);
  await saveFailedQueue(failed);

  const pendingJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
  const pending: PendingOperation[] = pendingJson ? JSON.parse(pendingJson) : [];
  pending.push(op);
  await savePendingQueue(pending);

  // Tenter de sync si online
  if (currentState.isOnline) {
    processQueue();
  }
}

/**
 * Vide toutes les opֳ©rations ֳ©chouֳ©es
 */
export async function clearFailedOperations(): Promise<void> {
  await saveFailedQueue([]);
}

/**
 * Vide toute la queue (pending + failed)
 */
export async function clearAllQueues(): Promise<void> {
  await Promise.all([
    savePendingQueue([]),
    saveFailedQueue([]),
  ]);
}

/**
 * S'abonne aux changements d'ֳ©tat
 */
export function subscribeToOfflineState(callback: (state: OfflineState) => void): () => void {
  stateListeners.add(callback);
  // Envoyer l'ֳ©tat actuel immֳ©diatement
  callback(currentState);

  return () => {
    stateListeners.delete(callback);
  };
}

/**
 * Notifie tous les listeners
 */
function notifyListeners(): void {
  stateListeners.forEach(callback => callback({ ...currentState }));
}

// Export du service
export const offlineService = {
  init: initOfflineService,
  setTransactionFunctions,
  queue: queueOperation,
  process: processQueue,
  getState: getOfflineState,
  isOnline,
  getPendingCount,
  getPendingOperations,
  getFailedOperations,
  removeFailedOperation,
  retryFailedOperation,
  clearFailedOperations,
  clearAllQueues,
  subscribe: subscribeToOfflineState,
};

export default offlineService;

// ============================================
// OPTIMISTIC CACHE UPDATE (OFFLINE)
// ============================================

function getStatusForAction(action: OperationType): string {
  switch (action) {
    case 'issue':
      return '׳³ֲ ׳³ג€¢׳³ג‚×׳³ֲ§ ׳³ֲ׳³ג€”׳³ג„¢׳³ג„¢׳³ֲ';
    case 'return':
      return '׳³ג€׳³ג€¢׳³ג€”׳³ג€“׳³ֲ¨';
    case 'add':
      return '׳³ֲ ׳³ג€¢׳³ֲ¡׳³ֲ£';
    case 'credit':
      return '׳³ג€“׳³ג€¢׳³ג€÷׳³ג€';
    case 'storage':
      return '׳³ג€׳³ג€¢׳³ג‚×׳³ֲ§׳³ג€';
    case 'retrieve':
      return '׳³ֲ©׳³ג€¢׳³ג€”׳³ֲ¨׳³ֲ¨ ׳³ֲ׳³ֲ׳³ג‚×׳³ֲ¡׳³ג€¢׳³ֲ';
    default:
      return '';
  }
}

async function updateAssignmentsCache(
  type: OperationType,
  params: any,
  operation: PendingOperation
): Promise<void> {
  const assignmentType = params?.type as 'combat' | 'clothing' | undefined;
  if (!assignmentType) return;

  const cacheKey = assignmentType === 'combat' ? 'combatAssignments' : 'clothingAssignments';

  const assignmentId = params?.requestId || operation.localResult || operation.id;
  const existing = cacheService.getImmediate<Assignment>(cacheKey);
  if (existing.some(a => a.id === assignmentId)) {
    return;
  }

  const assignedBy =
    params?.assignedBy ||
    params?.returnedBy ||
    params?.addedBy ||
    params?.creditedBy ||
    params?.storedBy ||
    params?.retrievedBy ||
    '';

  const assignmentAction = type === 'weaponAssign' ? 'add' : type;

  const assignment: Assignment = {
    id: assignmentId,
    soldierId: params?.soldierId,
    soldierName: params?.soldierName,
    soldierPersonalNumber: params?.soldierPersonalNumber,
    soldierPhone: params?.soldierPhone,
    soldierCompany: params?.soldierCompany,
    type: assignmentType,
    action: assignmentAction,
    items: params?.items || [],
    signature: params?.signature,
    status: getStatusForAction(assignmentAction) as any,
    timestamp: new Date(operation.timestamp),
    assignedBy: assignedBy,
  };

  cacheService.update(cacheKey, 'add', assignment as any);
  cacheService.touch(cacheKey);
  await persistCacheKey(cacheKey).catch(() => {});
}

