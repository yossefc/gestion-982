/**
 * Hook pour surveiller l'état du réseau
 *
 * Utilise NetInfo pour détecter les changements de connectivité
 * et expose l'état du réseau aux composants React.
 */

import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { offlineService, processQueue } from '../services/offlineService';

// NOTE: le sync automatique au retour du réseau est géré exclusivement
// par offlineService (handleConnectivityChange). Ce hook ne doit PAS
// déclencher processQueue() pour éviter un double sync.

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
  details: any;
}

export interface UseNetworkStatusResult {
  // État du réseau
  isOnline: boolean;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;

  // Actions
  refresh: () => Promise<void>;
  syncNow: () => Promise<{ success: number; failed: number }>;
}

/**
 * Hook principal pour surveiller l'état du réseau
 */
export function useNetworkStatus(): UseNetworkStatusResult {
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    // Récupérer l'état initial
    NetInfo.fetch().then(state => {
      setNetworkState(state);
    });

    // S'abonner aux changements
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState(state);
    });

    return () => unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    setNetworkState(state);
  }, []);

  const syncNow = useCallback(async () => {
    return await processQueue();
  }, []);

  // Dériver l'état "online" combiné
  const isOnline = networkState?.isConnected === true &&
                   (networkState?.isInternetReachable === true || networkState?.isInternetReachable === null);

  return {
    isOnline,
    isConnected: networkState?.isConnected ?? false,
    isInternetReachable: networkState?.isInternetReachable ?? null,
    connectionType: networkState?.type ?? 'unknown' as NetInfoStateType,
    refresh,
    syncNow,
  };
}

/**
 * Hook simplifié qui retourne juste isOnline
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}

export default useNetworkStatus;
