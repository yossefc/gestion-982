/**
 * DataContext - Contexte global pour toutes les données Firebase
 *
 * Fonctionnalités:
 * - Cache centralisé pour éviter les lectures répétées
 * - Chargement optimiste (affiche immédiatement, refresh en arrière-plan)
 * - Mises à jour optimistes (UI instantanée)
 * - Préchargement des données au démarrage
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from 'react';
import cacheService, {
  subscribeToCache,
  invalidateCache,
  hydrateFromStorage,
  hasCachedData,
  getCachedDataImmediate,
} from '../services/cacheService';
import { useAuth } from './AuthContext';
import {
  Soldier,
  CombatEquipment,
  ClothingEquipment,
  Mana,
  Assignment,
  DashboardStats,
} from '../types';

// Types pour le contexte
interface DataContextType {
  // Soldats
  soldiers: Soldier[];
  soldiersLoading: boolean;
  refreshSoldiers: () => Promise<void>;

  // Équipements combat
  combatEquipment: CombatEquipment[];
  combatEquipmentLoading: boolean;
  refreshCombatEquipment: () => Promise<void>;

  // Équipements vêtements
  clothingEquipment: ClothingEquipment[];
  clothingEquipmentLoading: boolean;
  refreshClothingEquipment: () => Promise<void>;

  // Manot
  manot: Mana[];
  manotLoading: boolean;
  refreshManot: () => Promise<void>;

  // Assignments combat
  combatAssignments: Assignment[];
  combatAssignmentsLoading: boolean;
  refreshCombatAssignments: () => Promise<void>;

  // Assignments vêtements
  clothingAssignments: Assignment[];
  clothingAssignmentsLoading: boolean;
  refreshClothingAssignments: () => Promise<void>;

  // Stats calculées
  combatStats: DashboardStats | null;
  clothingStats: DashboardStats | null;

  // Actions globales
  refreshAll: () => Promise<void>;
  invalidateAll: () => void;

  // État global
  isInitialized: boolean;
  globalLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Hook spécialisé pour les soldats (compatible avec useSoldiers)
export const useSoldiers = () => {
  const { soldiers, soldiersLoading, refreshSoldiers } = useData();
  return {
    soldiers,
    loading: soldiersLoading,
    error: null,
    refreshSoldiers,
    // Compatibilité avec l'ancien SoldiersContext
    addSoldier: (soldier: Soldier) => {
      cacheService.update('soldiers', 'add', soldier);
    },
    updateSoldier: (id: string, updates: Partial<Soldier>) => {
      cacheService.update('soldiers', 'update', { id, ...updates });
    },
    removeSoldier: (id: string) => {
      cacheService.update('soldiers', 'delete', { id } as any);
    },
  };
};

// Hook pour les équipements combat
export const useCombatEquipment = () => {
  const { combatEquipment, combatEquipmentLoading, refreshCombatEquipment } = useData();
  return {
    equipment: combatEquipment,
    loading: combatEquipmentLoading,
    refresh: refreshCombatEquipment,
  };
};

// Hook pour les équipements vêtements
export const useClothingEquipment = () => {
  const { clothingEquipment, clothingEquipmentLoading, refreshClothingEquipment } = useData();
  return {
    equipment: clothingEquipment,
    loading: clothingEquipmentLoading,
    refresh: refreshClothingEquipment,
  };
};

// Hook pour les manot
export const useManot = () => {
  const { manot, manotLoading, refreshManot } = useData();
  return {
    manot,
    loading: manotLoading,
    refresh: refreshManot,
  };
};

// Hook pour les stats combat
export const useCombatStats = () => {
  const { combatStats, combatAssignmentsLoading, soldiers, refreshCombatAssignments } = useData();
  return {
    stats: combatStats,
    loading: combatAssignmentsLoading,
    totalSoldiers: soldiers.length,
    refresh: refreshCombatAssignments,
  };
};

// Hook pour les stats vêtements
export const useClothingStats = () => {
  const { clothingStats, clothingAssignmentsLoading, soldiers, refreshClothingAssignments } = useData();
  return {
    stats: clothingStats,
    loading: clothingAssignmentsLoading,
    totalSoldiers: soldiers.length,
    refresh: refreshClothingAssignments,
  };
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  // Get authentication state
  const { user, authLoading } = useAuth();

  // États pour chaque type de données
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [soldiersLoading, setSoldiersLoading] = useState(true);

  const [combatEquipment, setCombatEquipment] = useState<CombatEquipment[]>([]);
  const [combatEquipmentLoading, setCombatEquipmentLoading] = useState(true);

  const [clothingEquipment, setClothingEquipment] = useState<ClothingEquipment[]>([]);
  const [clothingEquipmentLoading, setClothingEquipmentLoading] = useState(true);

  const [manot, setManot] = useState<Mana[]>([]);
  const [manotLoading, setManotLoading] = useState(true);

  const [combatAssignments, setCombatAssignments] = useState<Assignment[]>([]);
  const [combatAssignmentsLoading, setCombatAssignmentsLoading] = useState(true);

  const [clothingAssignments, setClothingAssignments] = useState<Assignment[]>([]);
  const [clothingAssignmentsLoading, setClothingAssignmentsLoading] = useState(true);

  const [isInitialized, setIsInitialized] = useState(false);

  // Ref pour éviter les doubles chargements
  const loadingRef = useRef(false);

  // Calculer les stats à partir des données en cache
  const combatStats = useMemo((): DashboardStats | null => {
    if (combatAssignments.length === 0 && soldiers.length === 0) return null;

    const soldierHoldings = new Map<string, number>();
    combatAssignments.forEach(a => {
      if (a.status === 'לא חתום') return;
      const isCredit = a.action === 'credit' || a.action === 'return' || a.status === 'זוכה';
      const qty = a.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      const current = soldierHoldings.get(a.soldierId) || 0;
      soldierHoldings.set(a.soldierId, current + (qty * (isCredit ? -1 : 1)));
    });

    const signedSoldiers = Array.from(soldierHoldings.values()).filter(q => q > 0).length;
    const pendingSoldiers = new Set(
      combatAssignments.filter(a => a.status === 'לא חתום').map(a => a.soldierId)
    ).size;
    const returnedEquipment = combatAssignments.filter(a => a.status === 'זוכה').length;

    return {
      totalSoldiers: soldiers.length,
      signedSoldiers,
      pendingSoldiers,
      returnedEquipment,
      equipmentByType: [],
    };
  }, [combatAssignments, soldiers]);

  const clothingStats = useMemo((): DashboardStats | null => {
    if (clothingAssignments.length === 0 && soldiers.length === 0) return null;

    const soldierHoldings = new Map<string, number>();
    clothingAssignments.forEach(a => {
      if (a.status === 'לא חתום') return;
      const isCredit = a.action === 'credit' || a.action === 'return' || a.status === 'זוכה';
      const qty = a.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      const current = soldierHoldings.get(a.soldierId) || 0;
      soldierHoldings.set(a.soldierId, current + (qty * (isCredit ? -1 : 1)));
    });

    const signedSoldiers = Array.from(soldierHoldings.values()).filter(q => q > 0).length;
    const pendingSoldiers = new Set(
      clothingAssignments.filter(a => a.status === 'לא חתום').map(a => a.soldierId)
    ).size;
    const returnedEquipment = clothingAssignments.filter(a => a.status === 'זוכה').length;

    return {
      totalSoldiers: soldiers.length,
      signedSoldiers,
      pendingSoldiers,
      returnedEquipment,
      equipmentByType: [],
    };
  }, [clothingAssignments, soldiers]);

  // Fonctions de rafraîchissement
  const refreshSoldiers = useCallback(async () => {
    setSoldiersLoading(true);
    try {
      const result = await cacheService.get<Soldier>('soldiers', { forceRefresh: true });
      setSoldiers(result.data);
    } catch (error) {
      console.error('Error refreshing soldiers:', error);
    } finally {
      setSoldiersLoading(false);
    }
  }, []);

  const refreshCombatEquipment = useCallback(async () => {
    setCombatEquipmentLoading(true);
    try {
      const result = await cacheService.get<CombatEquipment>('combatEquipment', { forceRefresh: true });
      setCombatEquipment(result.data);
    } catch (error) {
      console.error('Error refreshing combat equipment:', error);
    } finally {
      setCombatEquipmentLoading(false);
    }
  }, []);

  const refreshClothingEquipment = useCallback(async () => {
    setClothingEquipmentLoading(true);
    try {
      const result = await cacheService.get<ClothingEquipment>('clothingEquipment', { forceRefresh: true });
      setClothingEquipment(result.data);
    } catch (error) {
      console.error('Error refreshing clothing equipment:', error);
    } finally {
      setClothingEquipmentLoading(false);
    }
  }, []);

  const refreshManot = useCallback(async () => {
    setManotLoading(true);
    try {
      const result = await cacheService.get<Mana>('manot', { forceRefresh: true });
      setManot(result.data);
    } catch (error) {
      console.error('Error refreshing manot:', error);
    } finally {
      setManotLoading(false);
    }
  }, []);

  const refreshCombatAssignments = useCallback(async () => {
    setCombatAssignmentsLoading(true);
    try {
      const result = await cacheService.get<Assignment>('combatAssignments', { forceRefresh: true });
      setCombatAssignments(result.data);
    } catch (error) {
      console.error('Error refreshing combat assignments:', error);
    } finally {
      setCombatAssignmentsLoading(false);
    }
  }, []);

  const refreshClothingAssignments = useCallback(async () => {
    setClothingAssignmentsLoading(true);
    try {
      const result = await cacheService.get<Assignment>('clothingAssignments', { forceRefresh: true });
      setClothingAssignments(result.data);
    } catch (error) {
      console.error('Error refreshing clothing assignments:', error);
    } finally {
      setClothingAssignmentsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshSoldiers(),
      refreshCombatEquipment(),
      refreshClothingEquipment(),
      refreshManot(),
      refreshCombatAssignments(),
      refreshClothingAssignments(),
    ]);
  }, [refreshSoldiers, refreshCombatEquipment, refreshClothingEquipment, refreshManot, refreshCombatAssignments, refreshClothingAssignments]);

  const invalidateAll = useCallback(() => {
    cacheService.invalidateAll();
  }, []);

  // Chargement initial optimise avec support offline ameliore
  useEffect(() => {
    // Don't load data until auth check is complete
    if (authLoading) return;

    // Don't load data if user is not authenticated
    if (!user) {
      setSoldiersLoading(false);
      setCombatEquipmentLoading(false);
      setClothingEquipmentLoading(false);
      setManotLoading(false);
      setCombatAssignmentsLoading(false);
      setClothingAssignmentsLoading(false);
      setIsInitialized(true);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;

    const loadInitialData = async () => {
      // Timeout de securite: ne pas bloquer l'app plus de 10 secondes
      const initTimeoutId = setTimeout(() => {
        console.warn('[DataContext] Init timeout reached, forcing initialization');
        forceInitialization();
      }, 10000);

      try {
        // D'abord hydrater depuis AsyncStorage (restaure les donnees persistees)
        // Cela doit etre fait en premier pour avoir les donnees offline disponibles
        console.log('[DataContext] Hydrating from storage...');
        await hydrateFromStorage();

        // Apres hydratation, mettre a jour les states avec les donnees du cache
        // Cela permet d'afficher quelque chose immediatement meme offline
        updateStatesFromCache();

        // Charger chaque cache individuellement avec gestion d'erreur
        // Cela permet de charger ce qui est disponible meme en mode hors ligne
        await loadAllCachesWithFallback();

      } catch (error) {
        console.error('Error loading initial data:', error);
        // En cas d'erreur, utiliser les donnees du cache si disponibles
        updateStatesFromCache();
      } finally {
        clearTimeout(initTimeoutId);
        forceInitialization();
      }
    };

    // Fonction pour forcer l'initialisation avec les donnees disponibles
    const forceInitialization = () => {
      setSoldiersLoading(false);
      setCombatEquipmentLoading(false);
      setClothingEquipmentLoading(false);
      setManotLoading(false);
      setCombatAssignmentsLoading(false);
      setClothingAssignmentsLoading(false);
      setIsInitialized(true);
      console.log('[DataContext] Initialization complete');
    };

    // Fonction pour mettre a jour les states depuis le cache (sans fetch)
    const updateStatesFromCache = () => {
      if (hasCachedData('soldiers')) {
        setSoldiers(getCachedDataImmediate<Soldier>('soldiers'));
      }
      if (hasCachedData('combatEquipment')) {
        setCombatEquipment(getCachedDataImmediate<CombatEquipment>('combatEquipment'));
      }
      if (hasCachedData('clothingEquipment')) {
        setClothingEquipment(getCachedDataImmediate<ClothingEquipment>('clothingEquipment'));
      }
      if (hasCachedData('manot')) {
        setManot(getCachedDataImmediate<Mana>('manot'));
      }
      if (hasCachedData('combatAssignments')) {
        setCombatAssignments(getCachedDataImmediate<Assignment>('combatAssignments'));
      }
      if (hasCachedData('clothingAssignments')) {
        setClothingAssignments(getCachedDataImmediate<Assignment>('clothingAssignments'));
      }
    };

    // Fonction pour charger tous les caches avec fallback
    const loadAllCachesWithFallback = async () => {
      // Charger en parallele avec des timeouts individuels
      const loadWithTimeout = async <T,>(
        key: string,
        setter: React.Dispatch<React.SetStateAction<T[]>>,
        timeoutMs: number = 5000
      ) => {
        try {
          const result = await Promise.race([
            cacheService.get<T>(key as any),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout loading ${key}`)), timeoutMs)
            ),
          ]);
          setter(result.data);
        } catch (error) {
          console.warn(`Failed to load ${key}:`, error);
          // Garder les donnees du cache si disponibles (deja mis par updateStatesFromCache)
        }
      };

      // Charger tous les caches en parallele
      // Note: On charge aussi weaponsInventory pour le mode offline des signatures
      await Promise.allSettled([
        loadWithTimeout<Soldier>('soldiers', setSoldiers),
        loadWithTimeout<CombatEquipment>('combatEquipment', setCombatEquipment),
        loadWithTimeout<ClothingEquipment>('clothingEquipment', setClothingEquipment),
        loadWithTimeout<Mana>('manot', setManot),
        loadWithTimeout<Assignment>('combatAssignments', setCombatAssignments),
        loadWithTimeout<Assignment>('clothingAssignments', setClothingAssignments),
        // Charger l'inventaire des armes pour le mode offline (mסטב)
        loadWithTimeout<any>('weaponsInventory', () => {}), // Juste peupler le cache
      ]);
    };

    loadInitialData();

    // S'abonner aux mises a jour du cache
    const unsubscribers = [
      subscribeToCache('soldiers', setSoldiers),
      subscribeToCache('combatEquipment', setCombatEquipment),
      subscribeToCache('clothingEquipment', setClothingEquipment),
      subscribeToCache('manot', setManot),
      subscribeToCache('combatAssignments', setCombatAssignments),
      subscribeToCache('clothingAssignments', setClothingAssignments),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [authLoading, user]);

  // Calculer l'état de chargement global
  const globalLoading = soldiersLoading || combatEquipmentLoading || clothingEquipmentLoading ||
    manotLoading || combatAssignmentsLoading || clothingAssignmentsLoading;

  const value: DataContextType = useMemo(() => ({
    soldiers,
    soldiersLoading,
    refreshSoldiers,

    combatEquipment,
    combatEquipmentLoading,
    refreshCombatEquipment,

    clothingEquipment,
    clothingEquipmentLoading,
    refreshClothingEquipment,

    manot,
    manotLoading,
    refreshManot,

    combatAssignments,
    combatAssignmentsLoading,
    refreshCombatAssignments,

    clothingAssignments,
    clothingAssignmentsLoading,
    refreshClothingAssignments,

    combatStats,
    clothingStats,

    refreshAll,
    invalidateAll,

    isInitialized,
    globalLoading,
  }), [
    soldiers, soldiersLoading, refreshSoldiers,
    combatEquipment, combatEquipmentLoading, refreshCombatEquipment,
    clothingEquipment, clothingEquipmentLoading, refreshClothingEquipment,
    manot, manotLoading, refreshManot,
    combatAssignments, combatAssignmentsLoading, refreshCombatAssignments,
    clothingAssignments, clothingAssignmentsLoading, refreshClothingAssignments,
    combatStats, clothingStats,
    refreshAll, invalidateAll,
    isInitialized, globalLoading,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export default DataContext;
