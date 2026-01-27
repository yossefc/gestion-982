/**
 * SoldiersContext - Cache des soldats en mémoire
 * Évite de recharger les soldats à chaque écran
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { soldierService } from '../services/firebaseService';

export interface Soldier {
  id: string;
  name: string;
  personalNumber: string;
  phone?: string;
  company?: string;
  department?: string;
  createdAt?: Date;
}

interface SoldiersContextType {
  soldiers: Soldier[];
  loading: boolean;
  error: string | null;
  refreshSoldiers: () => Promise<void>;
  addSoldier: (soldier: Soldier) => void;
  updateSoldier: (id: string, updates: Partial<Soldier>) => void;
  removeSoldier: (id: string) => void;
}

const SoldiersContext = createContext<SoldiersContextType | undefined>(undefined);

export const useSoldiers = () => {
  const context = useContext(SoldiersContext);
  if (!context) {
    throw new Error('useSoldiers must be used within a SoldiersProvider');
  }
  return context;
};

interface SoldiersProviderProps {
  children: ReactNode;
}

export const SoldiersProvider: React.FC<SoldiersProviderProps> = ({ children }) => {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les soldats au démarrage
  const loadSoldiers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await soldierService.getAll();
      setSoldiers(data);
    } catch (err) {
      setError('Impossible de charger les soldats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Rafraîchir les soldats (pour pull-to-refresh)
  const refreshSoldiers = useCallback(async () => {
    await loadSoldiers();
  }, [loadSoldiers]);

  // Ajouter un soldat au cache (après création)
  const addSoldier = useCallback((soldier: Soldier) => {
    setSoldiers((prev) => {
      // Vérifier si le soldat existe déjà
      if (prev.some(s => s.id === soldier.id)) {
        return prev;
      }
      // Ajouter et trier par nom
      const updated = [...prev, soldier];
      updated.sort((a, b) => a.name.localeCompare(b.name));
      return updated;
    });
  }, []);

  // Mettre à jour un soldat dans le cache
  const updateSoldier = useCallback((id: string, updates: Partial<Soldier>) => {
    setSoldiers((prev) => {
      const updated = prev.map(s =>
        s.id === id ? { ...s, ...updates } : s
      );
      // Re-trier si le nom a changé
      if (updates.name) {
        updated.sort((a, b) => a.name.localeCompare(b.name));
      }
      return updated;
    });
  }, []);

  // Supprimer un soldat du cache
  const removeSoldier = useCallback((id: string) => {
    setSoldiers((prev) => {
      const filtered = prev.filter(s => s.id !== id);
      return filtered;
    });
  }, []);

  // Charger au montage du provider
  useEffect(() => {
    loadSoldiers();
  }, [loadSoldiers]);

  const value: SoldiersContextType = useMemo(() => ({
    soldiers,
    loading,
    error,
    refreshSoldiers,
    addSoldier,
    updateSoldier,
    removeSoldier,
  }), [soldiers, loading, error, refreshSoldiers, addSoldier, updateSoldier, removeSoldier]);

  return (
    <SoldiersContext.Provider value={value}>
      {children}
    </SoldiersContext.Provider>
  );
};
