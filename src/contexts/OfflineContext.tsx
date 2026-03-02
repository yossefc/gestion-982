/**
 * OfflineContext - Contexte global pour la gestion offline
 *
 * Fournit l'état de connectivité et de synchronisation
 * à toute l'application.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  offlineService,
  OfflineState,
  PendingOperation,
  initOfflineService,
} from '../services/offlineService';

interface OfflineContextType {
  // État
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
  lastSyncSuccessCount: number;
  lastSyncFailedCount: number;

  // Opérations en attente
  pendingOperations: PendingOperation[];
  failedOperations: PendingOperation[];

  // Actions
  syncNow: () => Promise<{ success: number; failed: number }>;
  retryFailed: (operationId: string) => Promise<void>;
  removeFailed: (operationId: string) => Promise<void>;
  clearAllFailed: () => Promise<void>;
  refreshOperations: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

// Hook simplifié pour juste savoir si on est online
export const useIsOnline = () => {
  const { isOnline } = useOffline();
  return isOnline;
};

// Hook pour le nombre d'opérations en attente
export const usePendingCount = () => {
  const { pendingCount } = useOffline();
  return pendingCount;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  // IMPORTANT: Default to false (conservatif) pour éviter de filtrer les soldats
  // avant que l'état réseau réel soit connu
  const [state, setState] = useState<OfflineState>({
    isOnline: false, // Conservatif: suppose offline jusqu'à vérification
    pendingCount: 0,
    failedCount: 0,
    syncStatus: 'idle',
    lastSyncTime: null,
    lastSyncSuccessCount: 0,
    lastSyncFailedCount: 0,
  });

  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const [failedOperations, setFailedOperations] = useState<PendingOperation[]>([]);

  // Ref pour éviter de ré-initialiser le service si le Provider remonte
  const initCalledRef = useRef(false);

  // Initialiser le service offline
  useEffect(() => {
    // S'abonner aux changements d'état EN PREMIER pour ne rater aucune mise à jour
    const unsubscribe = offlineService.subscribe((newState) => {
      setState(newState);
    });

    // Initialiser le service une seule fois (la garde dans offlineService protège
    // aussi des appels concurrents, mais on évite même l'appel inutile ici)
    if (!initCalledRef.current) {
      initCalledRef.current = true;
      initOfflineService().catch(console.error);
    }

    return () => unsubscribe();
  }, []);

  // Charger les opérations quand l'état change
  useEffect(() => {
    refreshOperations();
  }, [state.pendingCount, state.failedCount]);

  const refreshOperations = useCallback(async () => {
    try {
      const [pending, failed] = await Promise.all([
        offlineService.getPendingOperations(),
        offlineService.getFailedOperations(),
      ]);
      setPendingOperations(pending);
      setFailedOperations(failed);
    } catch (error) {
      console.error('[OfflineContext] Error refreshing operations:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const result = await offlineService.process();
    await refreshOperations();
    return result;
  }, [refreshOperations]);

  const retryFailed = useCallback(async (operationId: string) => {
    await offlineService.retryFailedOperation(operationId);
    await refreshOperations();
  }, [refreshOperations]);

  const removeFailed = useCallback(async (operationId: string) => {
    await offlineService.removeFailedOperation(operationId);
    await refreshOperations();
  }, [refreshOperations]);

  const clearAllFailed = useCallback(async () => {
    await offlineService.clearFailedOperations();
    await refreshOperations();
  }, [refreshOperations]);

  const value: OfflineContextType = {
    isOnline: state.isOnline,
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
    syncStatus: state.syncStatus,
    lastSyncTime: state.lastSyncTime,
    lastSyncSuccessCount: state.lastSyncSuccessCount,
    lastSyncFailedCount: state.lastSyncFailedCount,
    pendingOperations,
    failedOperations,
    syncNow,
    retryFailed,
    removeFailed,
    clearAllFailed,
    refreshOperations,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export default OfflineContext;
