/**
 * Service de synchronisation offline pour Gestion 982
 *
 * Fonctionnalités:
 * - Queue persistante des opérations en attente (AsyncStorage)
 * - Sync automatique au retour du réseau
 * - Support complet pour les signatures offline
 * - Gestion des conflits avec requestId (idempotence)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Clés AsyncStorage
const STORAGE_KEYS = {
  PENDING_QUEUE: '@gestion982/offline/pendingQueue',
  FAILED_QUEUE: '@gestion982/offline/failedQueue',
  LAST_SYNC: '@gestion982/offline/lastSync',
};

// Types d'opérations supportées
export type OperationType =
  | 'issue'      // החתמה
  | 'return'     // החזרה
  | 'add'        // הוספה
  | 'credit'     // זיכוי
  | 'storage'    // אפסון
  | 'retrieve';  // שחרור מאפסון

export interface PendingOperation {
  id: string;                    // UUID unique
  type: OperationType;
  params: any;                   // Paramètres de l'opération
  timestamp: number;             // Timestamp de création
  retryCount: number;            // Nombre de tentatives
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;         // Message d'erreur si échec
  localResult?: string;          // ID local temporaire
}

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
}

// Flag pour savoir si le service a ete initialise
let initialized = false;

// État global - isOnline est false par defaut pour etre conservatif
// (mieux vaut queue une operation que d'echouer)
let currentState: OfflineState = {
  isOnline: false, // Conservatif: suppose offline jusqu'a preuve du contraire
  pendingCount: 0,
  failedCount: 0,
  syncStatus: 'idle',
  lastSyncTime: null,
};

// Callbacks pour notifier les changements d'état
const stateListeners: Set<(state: OfflineState) => void> = new Set();

// Reference aux fonctions transactionnelles (injectées pour éviter circular dependency)
let transactionFunctions: Record<OperationType, (params: any) => Promise<string>> = {} as any;

/**
 * Initialise le service offline
 */
export async function initOfflineService(): Promise<void> {
  // Charger l'état initial
  await loadQueueCounts();

  // Écouter les changements de connectivité
  NetInfo.addEventListener(handleConnectivityChange);

  // Vérifier l'état initial
  const netState = await NetInfo.fetch();
  currentState.isOnline = netState.isConnected ?? true;
  initialized = true;

  console.log(`[OfflineService] Initialized - online: ${currentState.isOnline}`);

  // NOTE: Auto-sync désactivé au démarrage pour éviter de bloquer l'app
  // La sync se fera automatiquement lors des changements de connectivité
  // ou peut être déclenchée manuellement via offlineService.process()

  // if (currentState.isOnline) {
  //   processQueue();
  // }

  notifyListeners();
}

/**
 * Injecte les fonctions transactionnelles (appelé depuis transactionalAssignmentService)
 */
export function setTransactionFunctions(functions: typeof transactionFunctions): void {
  transactionFunctions = functions;
}

/**
 * Gère les changements de connectivité
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
 * Charge les compteurs de queue depuis AsyncStorage
 */
async function loadQueueCounts(): Promise<void> {
  try {
    const [pendingJson, failedJson, lastSyncJson] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE),
      AsyncStorage.getItem(STORAGE_KEYS.FAILED_QUEUE),
      AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
    ]);

    const pending: PendingOperation[] = pendingJson ? JSON.parse(pendingJson) : [];
    const failed: PendingOperation[] = failedJson ? JSON.parse(failedJson) : [];

    currentState.pendingCount = pending.length;
    currentState.failedCount = failed.length;
    currentState.lastSyncTime = lastSyncJson ? new Date(JSON.parse(lastSyncJson)) : null;
  } catch (error) {
    console.error('[OfflineService] Error loading queue counts:', error);
  }
}

/**
 * Sauvegarde la queue pending
 */
async function savePendingQueue(queue: PendingOperation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(queue));
  currentState.pendingCount = queue.length;
  notifyListeners();
}

/**
 * Sauvegarde la queue failed
 */
async function saveFailedQueue(queue: PendingOperation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.FAILED_QUEUE, JSON.stringify(queue));
  currentState.failedCount = queue.length;
  notifyListeners();
}

/**
 * Ajoute une opération à la queue
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

  try {
    const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
    const queue: PendingOperation[] = queueJson ? JSON.parse(queueJson) : [];

    queue.push(operation);
    await savePendingQueue(queue);

    console.log(`[OfflineService] Queued operation: ${type} (${operation.id})`);

    return operation.localResult!;
  } catch (error) {
    console.error('[OfflineService] Error queuing operation:', error);
    throw error;
  }
}

/**
 * Traite toutes les opérations en attente
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

    // Traiter chaque opération dans l'ordre
    for (const op of queue) {
      try {
        op.status = 'syncing';
        op.retryCount++;

        const transactionFn = transactionFunctions[op.type];
        if (!transactionFn) {
          throw new Error(`Unknown operation type: ${op.type}`);
        }

        // Exécuter l'opération Firebase
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

    // Sauvegarder les états
    await savePendingQueue([]); // Vider la queue pending
    await saveFailedQueue([...existingFailed, ...failedOps.filter(o => o.retryCount >= 3)]);

    // Les opérations avec retry < 3 retournent dans pending
    const retryOps = failedOps.filter(o => o.retryCount < 3);
    if (retryOps.length > 0) {
      await savePendingQueue(retryOps);
    }

    // Mettre à jour lastSync
    currentState.lastSyncTime = new Date();
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
 * Récupère l'état actuel
 */
export function getOfflineState(): OfflineState {
  return { ...currentState };
}

/**
 * Vérifie si on est online
 * Si le service n'est pas initialisé, retourne false (conservatif)
 * pour éviter des échecs de requêtes
 */
export function isOnline(): boolean {
  if (!initialized) {
    console.warn('[OfflineService] isOnline() called before init - assuming offline');
    return false;
  }
  return currentState.isOnline;
}

/**
 * Récupère le nombre d'opérations en attente
 */
export function getPendingCount(): number {
  return currentState.pendingCount;
}

/**
 * Récupère toutes les opérations en attente
 */
export async function getPendingOperations(): Promise<PendingOperation[]> {
  const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
  return queueJson ? JSON.parse(queueJson) : [];
}

/**
 * Récupère toutes les opérations échouées
 */
export async function getFailedOperations(): Promise<PendingOperation[]> {
  const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_QUEUE);
  return queueJson ? JSON.parse(queueJson) : [];
}

/**
 * Supprime une opération échouée
 */
export async function removeFailedOperation(operationId: string): Promise<void> {
  const failedJson = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_QUEUE);
  const failed: PendingOperation[] = failedJson ? JSON.parse(failedJson) : [];

  const filtered = failed.filter(op => op.id !== operationId);
  await saveFailedQueue(filtered);
}

/**
 * Réessaie une opération échouée
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

  // Retirer de failed et ajouter à pending
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
 * Vide toutes les opérations échouées
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
 * S'abonne aux changements d'état
 */
export function subscribeToOfflineState(callback: (state: OfflineState) => void): () => void {
  stateListeners.add(callback);
  // Envoyer l'état actuel immédiatement
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
