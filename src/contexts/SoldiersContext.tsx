/**
 * SoldiersContext - Cache des soldats en mémoire
 * Évite de recharger les soldats à chaque écran
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
      console.log('📥 Chargement des soldats depuis Firestore...');
      const data = await soldierService.getAll();
      setSoldiers(data);
      console.log(`✓ ${data.length} soldats chargés en cache`);
    } catch (err) {
      console.error('Erreur lors du chargement des soldats:', err);
      setError('Impossible de charger les soldats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Rafraîchir les soldats (pour pull-to-refresh)
  const refreshSoldiers = useCallback(async () => {
    console.log('🔄 Rafraîchissement du cache des soldats...');
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
      console.log(`➕ Soldat ajouté au cache: ${soldier.name}`);
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
      console.log(`✏️ Soldat mis à jour dans le cache: ${id}`);
      return updated;
    });
  }, []);

  // Supprimer un soldat du cache
  const removeSoldier = useCallback((id: string) => {
    setSoldiers((prev) => {
      const filtered = prev.filter(s => s.id !== id);
      console.log(`🗑️ Soldat supprimé du cache: ${id}`);
      return filtered;
    });
  }, []);

  // Charger au montage du provider
  useEffect(() => {
    loadSoldiers();
  }, [loadSoldiers]);

  const value: SoldiersContextType = {
    soldiers,
    loading,
    error,
    refreshSoldiers,
    addSoldier,
    updateSoldier,
    removeSoldier,
  };

  return (
    <SoldiersContext.Provider value={value}>
      {children}
    </SoldiersContext.Provider>
  );
};
