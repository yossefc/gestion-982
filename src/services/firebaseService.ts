// Service Firebase pour la gestion des données
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit as firestoreLimit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { app } from '../config/firebase';
import {
  Soldier,
  CombatEquipment,
  ClothingEquipment,
  Assignment,
  Mana,
  DashboardStats,
} from '../types';
import { mapFirebaseError, createAppError, ErrorCodes, logError } from './errors';
import { buildSoldierSearchKey, buildNameLower, normalizeText } from '../utils/normalize';
import { logService } from './logService';
import { auth } from '../config/firebase';

const db = getFirestore(app);

// Collections
const COLLECTIONS = {
  SOLDIERS: 'soldiers',
  COMBAT_EQUIPMENT: 'combatEquipment',
  CLOTHING_EQUIPMENT: 'clothingEquipment',
  ASSIGNMENTS: 'assignments',
  MANOT: 'manot',
};

// ============================================
// SOLDIERS
// ============================================

export const soldierService = {
  // Créer un nouveau soldat
  async create(soldierData: Omit<Soldier, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Vérifier si le numéro personnel existe déjà
      const existing = await this.getByPersonalNumber(soldierData.personalNumber);
      if (existing) {
        throw createAppError(ErrorCodes.SOLDIER_DUPLICATE);
      }

      // Calculer les champs de recherche normalisés
      const searchKey = buildSoldierSearchKey(soldierData);
      const nameLower = buildNameLower(soldierData.name);

      const docRef = await addDoc(collection(db, COLLECTIONS.SOLDIERS), {
        ...soldierData,
        searchKey,
        nameLower,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      // Log d'audit
      await logService.logChange({
        entityType: 'soldier',
        entityId: docRef.id,
        action: 'create',
        after: { ...soldierData, searchKey, nameLower },
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
      });
      
      return docRef.id;
    } catch (error) {
      logError('soldierService.create', error);
      throw mapFirebaseError(error);
    }
  },

  // Obtenir un soldat par ID
  async getById(id: string): Promise<Soldier | null> {
    try {
      const docRef = doc(db, COLLECTIONS.SOLDIERS, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
        } as Soldier;
      }
      return null;
    } catch (error) {
      logError('soldierService.getById', error);
      throw mapFirebaseError(error);
    }
  },

  // Rechercher un soldat par numéro personnel
  async getByPersonalNumber(personalNumber: string): Promise<Soldier | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SOLDIERS),
        where('personalNumber', '==', personalNumber),
        firestoreLimit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
        } as Soldier;
      }
      return null;
    } catch (error) {
      logError('soldierService.getByPersonalNumber', error);
      throw mapFirebaseError(error);
    }
  },

  // Obtenir tous les soldats (paginé par défaut)
  async getAll(limitCount: number = 50): Promise<Soldier[]> {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.SOLDIERS),
          orderBy('nameLower', 'asc'),
          firestoreLimit(limitCount)
        )
      );

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Soldier[];
    } catch (error) {
      logError('soldierService.getAll', error);
      throw mapFirebaseError(error);
    }
  },

  // Recherche performante côté serveur avec pagination
  async search(
    searchTerm: string,
    options?: {
      limitCount?: number;
      company?: string;
      lastDoc?: QueryDocumentSnapshot<DocumentData>;
    }
  ): Promise<{ soldiers: Soldier[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    try {
      const limitCount = options?.limitCount || 50;
      
      // Si pas de terme de recherche, retourner liste paginée
      if (!searchTerm || searchTerm.trim() === '') {
        let q = query(
          collection(db, COLLECTIONS.SOLDIERS),
          orderBy('nameLower', 'asc'),
          firestoreLimit(limitCount)
        );

        // Filtre par compagnie si fourni
        if (options?.company) {
          q = query(
            collection(db, COLLECTIONS.SOLDIERS),
            where('company', '==', options.company),
            orderBy('nameLower', 'asc'),
            firestoreLimit(limitCount)
          );
        }

        // Pagination
        if (options?.lastDoc) {
          q = query(q, startAfter(options.lastDoc));
        }

        const querySnapshot = await getDocs(q);
        
        return {
          soldiers: querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
          })) as Soldier[],
          lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
        };
      }

      // Recherche avec terme normalisé
      const normalizedTerm = normalizeText(searchTerm);
      
      let q = query(
        collection(db, COLLECTIONS.SOLDIERS),
        orderBy('searchKey'),
        where('searchKey', '>=', normalizedTerm),
        where('searchKey', '<=', normalizedTerm + '\uf8ff'),
        firestoreLimit(limitCount)
      );

      // Note: impossible de combiner where avec filtre company ET orderBy/startAt sur searchKey
      // Il faudrait un index composite ou filtrer côté client
      
      if (options?.lastDoc) {
        q = query(q, startAfter(options.lastDoc));
      }

      const querySnapshot = await getDocs(q);
      
      let soldiers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Soldier[];

      // Filtre côté client par company si nécessaire (limité mais fonctionnel)
      if (options?.company) {
        soldiers = soldiers.filter(s => s.company === options.company);
      }

      return {
        soldiers,
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
      };
    } catch (error) {
      logError('soldierService.search', error);
      throw mapFirebaseError(error);
    }
  },

  // Mettre à jour un soldat
  async update(id: string, data: Partial<Soldier>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SOLDIERS, id);
      
      // Récupérer les données avant modification (pour l'audit log)
      const before = await this.getById(id);
      
      // Recalculer searchKey si nécessaire
      const updateData: any = { ...data, updatedAt: Timestamp.now() };
      
      if (data.name || data.personalNumber || data.phone || data.company) {
        // Récupérer les données actuelles pour reconstruire searchKey
        const current = before;
        if (current) {
          const updatedSoldier = { ...current, ...data };
          updateData.searchKey = buildSoldierSearchKey(updatedSoldier);
          if (data.name) {
            updateData.nameLower = buildNameLower(data.name);
          }
        }
      }
      
      await updateDoc(docRef, updateData);
      
      // Log d'audit
      await logService.logChange({
        entityType: 'soldier',
        entityId: id,
        action: 'update',
        before,
        after: { ...before, ...updateData },
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
      });
    } catch (error) {
      logError('soldierService.update', error);
      throw mapFirebaseError(error);
    }
  },

  // Supprimer un soldat
  async delete(id: string): Promise<void> {
    try {
      // Récupérer les données avant suppression (pour l'audit log)
      const before = await this.getById(id);
      
      await deleteDoc(doc(db, COLLECTIONS.SOLDIERS, id));
      
      // Log d'audit
      await logService.logChange({
        entityType: 'soldier',
        entityId: id,
        action: 'delete',
        before,
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
      });
    } catch (error) {
      logError('soldierService.delete', error);
      throw mapFirebaseError(error);
    }
  },

  // Recherche par compagnie (filtre rapide)
  async getByCompany(company: string, limitCount: number = 50): Promise<Soldier[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SOLDIERS),
        where('company', '==', company),
        orderBy('nameLower', 'asc'),
        firestoreLimit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Soldier[];
    } catch (error) {
      logError('soldierService.getByCompany', error);
      throw mapFirebaseError(error);
    }
  },
};

// ============================================
// COMBAT EQUIPMENT
// ============================================

export const combatEquipmentService = {
  // Créer un équipement
  async create(equipmentData: Omit<CombatEquipment, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.COMBAT_EQUIPMENT), equipmentData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating combat equipment:', error);
      throw error;
    }
  },

  // Obtenir tous les équipements
  async getAll(): Promise<CombatEquipment[]> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.COMBAT_EQUIPMENT));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CombatEquipment[];
    } catch (error) {
      console.error('Error getting combat equipment:', error);
      throw error;
    }
  },

  // Obtenir par catégorie
  async getByCategory(category: string): Promise<CombatEquipment[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.COMBAT_EQUIPMENT),
        where('category', '==', category)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CombatEquipment[];
    } catch (error) {
      console.error('Error getting equipment by category:', error);
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<CombatEquipment>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.COMBAT_EQUIPMENT, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error updating combat equipment:', error);
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMBAT_EQUIPMENT, id));
    } catch (error) {
      console.error('Error deleting combat equipment:', error);
      throw error;
    }
  },
};

// ============================================
// CLOTHING EQUIPMENT
// ============================================

export const clothingEquipmentService = {
  // Créer un équipement
  async create(equipmentData: Omit<ClothingEquipment, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.CLOTHING_EQUIPMENT), equipmentData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating clothing equipment:', error);
      throw error;
    }
  },

  // Obtenir tous les équipements
  async getAll(): Promise<ClothingEquipment[]> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.CLOTHING_EQUIPMENT));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ClothingEquipment[];
    } catch (error) {
      console.error('Error getting clothing equipment:', error);
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<ClothingEquipment>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CLOTHING_EQUIPMENT, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error updating clothing equipment:', error);
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CLOTHING_EQUIPMENT, id));
    } catch (error) {
      console.error('Error deleting clothing equipment:', error);
      throw error;
    }
  },
};

// ============================================
// ASSIGNMENTS
// ============================================

export const assignmentService = {
  // Créer une attribution
  async create(assignmentData: Omit<Assignment, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Filtrer les valeurs undefined pour éviter les erreurs Firestore
      const cleanData: any = {
        soldierId: assignmentData.soldierId,
        soldierName: assignmentData.soldierName,
        soldierPersonalNumber: assignmentData.soldierPersonalNumber,
        type: assignmentData.type,
        items: assignmentData.items || [],
        status: assignmentData.status,
        assignedBy: assignmentData.assignedBy,
        timestamp: Timestamp.now(),
      };

      // Ajouter les champs optionnels seulement s'ils existent
      if (assignmentData.signature) {
        cleanData.signature = assignmentData.signature;
      }
      if (assignmentData.pdfUrl) {
        cleanData.pdfUrl = assignmentData.pdfUrl;
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.ASSIGNMENTS), cleanData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  },

  // Obtenir une attribution par ID
  async getById(id: string): Promise<Assignment | null> {
    try {
      const docRef = doc(db, COLLECTIONS.ASSIGNMENTS, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          timestamp: docSnap.data().timestamp?.toDate(),
        } as Assignment;
      }
      return null;
    } catch (error) {
      console.error('Error getting assignment:', error);
      throw error;
    }
  },

  // Obtenir toutes les attributions d'un soldat
  async getBySoldier(soldierId: string): Promise<Assignment[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ASSIGNMENTS),
        where('soldierId', '==', soldierId),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as Assignment[];
    } catch (error) {
      console.error('Error getting soldier assignments:', error);
      throw error;
    }
  },

  // Obtenir par type
  async getByType(type: 'combat' | 'clothing'): Promise<Assignment[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ASSIGNMENTS),
        where('type', '==', type),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as Assignment[];
    } catch (error) {
      console.error('Error getting assignments by type:', error);
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<Assignment>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.ASSIGNMENTS, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ASSIGNMENTS, id));
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw error;
    }
  },
};

// ============================================
// MANOT
// ============================================

export const manaService = {
  // Créer une mana
  async create(manaData: Omit<Mana, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.MANOT), manaData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating mana:', error);
      throw error;
    }
  },

  // Obtenir une mana par ID
  async getById(id: string): Promise<Mana | null> {
    try {
      const docRef = doc(db, COLLECTIONS.MANOT, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Mana;
      }
      return null;
    } catch (error) {
      console.error('Error getting mana:', error);
      throw error;
    }
  },

  // Obtenir toutes les manot
  async getAll(): Promise<Mana[]> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.MANOT));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Mana[];
    } catch (error) {
      console.error('Error getting manot:', error);
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<Mana>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.MANOT, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error updating mana:', error);
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.MANOT, id));
    } catch (error) {
      console.error('Error deleting mana:', error);
      throw error;
    }
  },
};

// ============================================
// DASHBOARD STATS
// ============================================

export const dashboardService = {
  // Obtenir les statistiques pour le module vêtement
  async getClothingStats(): Promise<DashboardStats> {
    try {
      const assignments = await assignmentService.getByType('clothing');
      const soldiers = await soldierService.getAll();

      const signedSoldiers = assignments.filter(a => a.status === 'נופק לחייל').length;
      const pendingSoldiers = assignments.filter(a => a.status === 'לא חתום').length;
      const returnedEquipment = assignments.filter(a => a.status === 'זוכה').length;

      // Compter par type d'équipement
      const equipmentByType: { [key: string]: { issued: number; returned: number; pending: number } } = {};

      assignments.forEach(assignment => {
        assignment.items.forEach(item => {
          if (!equipmentByType[item.equipmentName]) {
            equipmentByType[item.equipmentName] = { issued: 0, returned: 0, pending: 0 };
          }

          if (assignment.status === 'נופק לחייל') {
            equipmentByType[item.equipmentName].issued += item.quantity;
          } else if (assignment.status === 'זוכה') {
            equipmentByType[item.equipmentName].returned += item.quantity;
          } else if (assignment.status === 'לא חתום') {
            equipmentByType[item.equipmentName].pending += item.quantity;
          }
        });
      });

      return {
        totalSoldiers: soldiers.length,
        signedSoldiers,
        pendingSoldiers,
        returnedEquipment,
        equipmentByType: Object.entries(equipmentByType).map(([name, counts]) => ({
          name,
          ...counts,
        })),
      };
    } catch (error) {
      console.error('Error getting clothing stats:', error);
      throw error;
    }
  },

  // Obtenir les statistiques pour le module arme
  async getCombatStats(): Promise<DashboardStats> {
    try {
      const assignments = await assignmentService.getByType('combat');
      const soldiers = await soldierService.getAll();

      const signedSoldiers = assignments.filter(a => a.status === 'נופק לחייל').length;
      const pendingSoldiers = assignments.filter(a => a.status === 'לא חתום').length;
      const returnedEquipment = assignments.filter(a => a.status === 'זוכה').length;

      // Compter par type d'équipement
      const equipmentByType: { [key: string]: { issued: number; returned: number; pending: number } } = {};

      assignments.forEach(assignment => {
        assignment.items.forEach(item => {
          if (!equipmentByType[item.equipmentName]) {
            equipmentByType[item.equipmentName] = { issued: 0, returned: 0, pending: 0 };
          }

          if (assignment.status === 'נופק לחייל') {
            equipmentByType[item.equipmentName].issued += item.quantity;
          } else if (assignment.status === 'זוכה') {
            equipmentByType[item.equipmentName].returned += item.quantity;
          } else if (assignment.status === 'לא חתום') {
            equipmentByType[item.equipmentName].pending += item.quantity;
          }
        });
      });

      return {
        totalSoldiers: soldiers.length,
        signedSoldiers,
        pendingSoldiers,
        returnedEquipment,
        equipmentByType: Object.entries(equipmentByType).map(([name, counts]) => ({
          name,
          ...counts,
        })),
      };
    } catch (error) {
      console.error('Error getting combat stats:', error);
      throw error;
    }
  },
};
