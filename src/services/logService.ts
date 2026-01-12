// Service de gestion des logs d'audit
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { mapFirebaseError, logError } from './errors';

export interface AuditLog {
  id?: string;
  entityType: 'soldier' | 'assignment' | 'equipment' | 'user';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'sign' | 'return';
  before?: any;
  after?: any;
  performedBy: string; // User ID
  performedByName?: string;
  performedAt: Date;
  metadata?: Record<string, any>;
}

const COLLECTION_NAME = 'logs';

export const logService = {
  /**
   * Créer un log d'audit
   */
  async logChange(log: Omit<AuditLog, 'id' | 'performedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...log,
        performedAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      logError('logService.logChange', error);
      // Ne pas throw pour ne pas bloquer l'opération principale
      return '';
    }
  },

  /**
   * Récupérer les logs pour une entité
   */
  async getLogsByEntity(
    entityType: string,
    entityId: string,
    limitCount: number = 50
  ): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('entityType', '==', entityType),
        where('entityId', '==', entityId),
        orderBy('performedAt', 'desc'),
        firestoreLimit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        performedAt: doc.data().performedAt?.toDate(),
      })) as AuditLog[];
    } catch (error) {
      logError('logService.getLogsByEntity', error);
      throw mapFirebaseError(error);
    }
  },

  /**
   * Récupérer les logs par utilisateur
   */
  async getLogsByUser(userId: string, limitCount: number = 50): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('performedBy', '==', userId),
        orderBy('performedAt', 'desc'),
        firestoreLimit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        performedAt: doc.data().performedAt?.toDate(),
      })) as AuditLog[];
    } catch (error) {
      logError('logService.getLogsByUser', error);
      throw mapFirebaseError(error);
    }
  },

  /**
   * Récupérer les logs récents
   */
  async getRecentLogs(limitCount: number = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('performedAt', 'desc'),
        firestoreLimit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        performedAt: doc.data().performedAt?.toDate(),
      })) as AuditLog[];
    } catch (error) {
      logError('logService.getRecentLogs', error);
      throw mapFirebaseError(error);
    }
  },
};





