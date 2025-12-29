// Hook personnalisé pour la recherche de soldats avec pagination
import { useState, useCallback } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Soldier } from '../types';
import { soldierService } from '../services/firebaseService';
import { AppError, mapFirebaseError } from '../services/errors';

interface UseSoldierSearchResult {
  soldiers: Soldier[];
  loading: boolean;
  error: AppError | null;
  hasMore: boolean;
  search: (query: string, company?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export function useSoldierSearch(): UseSoldierSearchResult {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentCompany, setCurrentCompany] = useState<string | undefined>(undefined);

  const search = useCallback(async (query: string, company?: string) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentQuery(query);
      setCurrentCompany(company);
      
      const result = await soldierService.search(query, {
        limitCount: 50,
        company,
      });

      setSoldiers(result.soldiers);
      setLastDoc(result.lastDoc);
      setHasMore(result.soldiers.length >= 50 && result.lastDoc !== null);
    } catch (err) {
      const appError = mapFirebaseError(err);
      setError(appError);
      setSoldiers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !lastDoc) return;

    try {
      setLoading(true);
      
      const result = await soldierService.search(currentQuery, {
        limitCount: 50,
        company: currentCompany,
        lastDoc,
      });

      setSoldiers(prev => [...prev, ...result.soldiers]);
      setLastDoc(result.lastDoc);
      setHasMore(result.soldiers.length >= 50 && result.lastDoc !== null);
    } catch (err) {
      const appError = mapFirebaseError(err);
      setError(appError);
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, lastDoc, currentQuery, currentCompany]);

  const reset = useCallback(() => {
    setSoldiers([]);
    setLoading(false);
    setError(null);
    setHasMore(true);
    setLastDoc(null);
    setCurrentQuery('');
    setCurrentCompany(undefined);
  }, []);

  return {
    soldiers,
    loading,
    error,
    hasMore,
    search,
    loadMore,
    reset,
  };
}




