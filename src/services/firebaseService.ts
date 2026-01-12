// Service Firebase pour la gestion des données
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
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
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { app, storage } from '../config/firebase';
import { pdfToBase64 } from './pdfService';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Soldier,
  CombatEquipment,
  ClothingEquipment,
  Assignment,
  AssignmentItem,
  Mana,
  DashboardStats,
  SoldierHoldings,
  HoldingItem,
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
  SOLDIER_HOLDINGS: 'soldier_holdings',
};

// Fonction utilitaire pour nettoyer les valeurs undefined avant d'envoyer à Firestore
function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
}

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

      // Nettoyer les valeurs undefined avant d'envoyer à Firestore
      const cleanData = removeUndefinedFields({
        ...soldierData,
        searchKey,
        nameLower,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      const docRef = await addDoc(collection(db, COLLECTIONS.SOLDIERS), cleanData);
      
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

      // Nettoyer les valeurs undefined avant d'envoyer à Firestore
      const cleanUpdateData = removeUndefinedFields(updateData);

      await updateDoc(docRef, cleanUpdateData);
      
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
  // Récupérer l'assignment actuel d'un soldat (par ID déterministe)
  async getCurrentAssignment(
    soldierId: string,
    type: 'combat' | 'clothing',
    action?: 'issue' | 'credit'
  ): Promise<Assignment | null> {
    try {
      // Générer l'ID déterministe (même logique que create)
      const actionSuffix = action ? `_${action}` : '';
      const assignmentId = `${soldierId}_${type}${actionSuffix}`;

      const docRef = doc(db, COLLECTIONS.ASSIGNMENTS, assignmentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate(),
      } as Assignment;
    } catch (error) {
      console.error('Error getting current assignment:', error);
      return null;
    }
  },

  // Créer ou mettre à jour une attribution (UPSERT)
  async create(assignmentData: Omit<Assignment, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Générer un ID déterministe basé sur soldierId, type, et action
      const actionSuffix = assignmentData.action ? `_${assignmentData.action}` : '';
      const assignmentId = `${assignmentData.soldierId}_${assignmentData.type}${actionSuffix}`;

      // Déterminer le mode de fusion selon l'action
      // 'issue' (החתמה) = REPLACE (remplacer les données)
      // 'add' = ADDITIVE (ajouter aux données existantes)
      const useAdditiveMode = assignmentData.action === 'add';

      let mergedItems: any[] = [];

      if (useAdditiveMode) {
        // MODE ADDITIF: Charger l'assignment existant et additionner
        const existingAssignment = await this.getById(assignmentId);

        if (existingAssignment && existingAssignment.items) {
          // Créer une map des items existants
          const itemsMap = new Map(
            existingAssignment.items.map(item => [item.equipmentId, { ...item }])
          );

          // Ajouter/mettre à jour avec les nouveaux items
          assignmentData.items.forEach(newItem => {
            const existing = itemsMap.get(newItem.equipmentId);
            if (existing) {
              // Item existe déjà - ADDITIONNER les quantités
              existing.quantity += newItem.quantity;
              if (newItem.serial) existing.serial = newItem.serial;
              if (newItem.subEquipments) existing.subEquipments = newItem.subEquipments;
            } else {
              // Nouvel item - l'ajouter
              itemsMap.set(newItem.equipmentId, { ...newItem });
            }
          });

          mergedItems = Array.from(itemsMap.values());
        } else {
          mergedItems = assignmentData.items;
        }
      } else {
        // MODE REMPLACEMENT (issue, credit): Utiliser directement les nouveaux items
        // C'est le comportement pour החתמה - on remplace avec ce qui est sélectionné
        mergedItems = assignmentData.items;
      }

      // Nettoyer les items pour supprimer les champs undefined
      const cleanItems = mergedItems.map((item: any) => {
        const cleanItem: any = {
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: item.quantity,
        };

        // Ajouter les champs optionnels seulement s'ils existent
        if (item.serial) cleanItem.serial = item.serial;
        if (item.subEquipments && item.subEquipments.length > 0) {
          cleanItem.subEquipments = item.subEquipments;
        }

        return cleanItem;
      });

      // Filtrer les valeurs undefined pour éviter les erreurs Firestore
      const cleanData: any = {
        soldierId: assignmentData.soldierId,
        soldierName: assignmentData.soldierName,
        soldierPersonalNumber: assignmentData.soldierPersonalNumber,
        type: assignmentData.type,
        items: cleanItems,
        status: assignmentData.status,
        assignedBy: assignmentData.assignedBy,
        timestamp: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Ajouter les champs optionnels seulement s'ils existent
      if (assignmentData.action) {
        cleanData.action = assignmentData.action;
      }
      if (assignmentData.soldierPhone) {
        cleanData.soldierPhone = assignmentData.soldierPhone;
      }
      if (assignmentData.soldierCompany) {
        cleanData.soldierCompany = assignmentData.soldierCompany;
      }
      if (assignmentData.assignedByName) {
        cleanData.assignedByName = assignmentData.assignedByName;
      }
      if (assignmentData.assignedByEmail) {
        cleanData.assignedByEmail = assignmentData.assignedByEmail;
      }
      if (assignmentData.signature) {
        cleanData.signature = assignmentData.signature;
      }
      if (assignmentData.pdfUrl) {
        cleanData.pdfUrl = assignmentData.pdfUrl;
      }

      // UPSERT: créer ou mettre à jour (merge:true)
      const docRef = doc(db, COLLECTIONS.ASSIGNMENTS, assignmentId);
      await setDoc(docRef, cleanData, { merge: true });

      console.log(`Assignment ${assignmentId} created/updated successfully (merged)`);

      return assignmentId;
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

  /**
   * Retire des items d'un assignment (utilisé pour les retours/crédits)
   * Met à jour l'assignment existant en retirant les quantités spécifiées
   *
   * @returns 'CLOSED' si tous les items sont retournés, 'OPEN' sinon
   */
  async removeItemsFromAssignment(
    soldierId: string,
    type: 'combat' | 'clothing',
    itemsToRemove: { equipmentId: string; quantity: number; serials?: string[] }[]
  ): Promise<'OPEN' | 'CLOSED'> {
    try {
      // Récupérer l'assignment actuel
      const assignment = await this.getCurrentAssignment(soldierId, type, 'issue');

      if (!assignment || !assignment.items || assignment.items.length === 0) {
        console.log('No assignment found or no items to remove');
        return 'CLOSED';
      }

      // Créer une map des items actuels
      const itemsMap = new Map(
        assignment.items.map(item => [item.equipmentId, { ...item }])
      );

      // Retirer les quantités
      itemsToRemove.forEach(itemToRemove => {
        const existing = itemsMap.get(itemToRemove.equipmentId);
        if (existing) {
          existing.quantity -= itemToRemove.quantity;

          // Si la quantité tombe à 0 ou moins, retirer complètement l'item
          if (existing.quantity <= 0) {
            itemsMap.delete(itemToRemove.equipmentId);
          }
        }
      });

      // Convertir la map en array
      const updatedItems = Array.from(itemsMap.values());

      // Mettre à jour l'assignment
      const assignmentId = `${soldierId}_${type}_issue`;
      await this.update(assignmentId, {
        items: updatedItems,
      } as Partial<Assignment>);

      // Déterminer le status
      const status = updatedItems.length === 0 ? 'CLOSED' : 'OPEN';

      console.log(`Assignment updated: ${updatedItems.length} items remaining (${status})`);

      return status;
    } catch (error) {
      console.error('Error removing items from assignment:', error);
      throw error;
    }
  },

  /**
   * Obtient tous les assignments avec des items à rendre
   * Utilisé pour la liste זיכוי (retours)
   */
  async getAllWithOutstandingItems(
    type: 'combat' | 'clothing'
  ): Promise<Assignment[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ASSIGNMENTS),
        where('type', '==', type),
        where('action', '==', 'issue')
      );

      const querySnapshot = await getDocs(q);

      // Filtrer ceux qui ont des items
      const assignmentsWithItems = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate(),
        } as Assignment))
        .filter(assignment => assignment.items && assignment.items.length > 0);

      return assignmentsWithItems;
    } catch (error) {
      console.error('Error getting assignments with outstanding items:', error);
      throw error;
    }
  },

  /**
   * Calcule l'équipement actuellement détenu par un soldat
   * en scannant tous ses assignments (issue - credit)
   */
  async calculateCurrentHoldings(
    soldierId: string,
    type: 'combat' | 'clothing'
  ): Promise<AssignmentItem[]> {
    try {
      const assignments = await this.getBySoldier(soldierId);
      const typeAssignments = assignments.filter(a => a.type === type);

      // Créer une map des quantités par equipmentId
      const holdingsMap = new Map<string, AssignmentItem>();

      typeAssignments.forEach(assignment => {
        const multiplier = assignment.action === 'credit' ? -1 : 1;

        assignment.items.forEach(item => {
          const existing = holdingsMap.get(item.equipmentId);

          if (existing) {
            existing.quantity += item.quantity * multiplier;
          } else {
            holdingsMap.set(item.equipmentId, {
              ...item,
              quantity: item.quantity * multiplier,
            });
          }
        });
      });

      // Filtrer pour ne retourner que les items avec quantité > 0
      return Array.from(holdingsMap.values()).filter(item => item.quantity > 0);
    } catch (error) {
      console.error('Error calculating current holdings:', error);
      throw error;
    }
  },

  /**
   * Obtient tous les soldats qui détiennent actuellement de l'équipement
   * avec le calcul dynamique basé sur les assignments
   */
  async getSoldiersWithCurrentHoldings(
    type: 'combat' | 'clothing'
  ): Promise<Assignment[]> {
    try {
      // Récupérer tous les assignments du type
      const allAssignments = await this.getByType(type);

      // Grouper par soldierId
      const soldierMap = new Map<string, Assignment[]>();
      allAssignments.forEach(assignment => {
        const existing = soldierMap.get(assignment.soldierId) || [];
        existing.push(assignment);
        soldierMap.set(assignment.soldierId, existing);
      });

      // Calculer les holdings pour chaque soldat
      const result: Assignment[] = [];

      for (const [soldierId, assignments] of soldierMap.entries()) {
        // Prendre le premier assignment comme base
        const baseAssignment = assignments[0];

        // Calculer les holdings actuels
        const currentHoldings = await this.calculateCurrentHoldings(soldierId, type);

        if (currentHoldings.length > 0) {
          result.push({
            ...baseAssignment,
            items: currentHoldings,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting soldiers with current holdings:', error);
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

// ============================================
// PDF STORAGE (Firebase Storage)
// ============================================

export const pdfStorageService = {
  /**
   * Upload un PDF vers Firebase Storage à un chemin structuré
   * Le fichier est REMPLACÉ à chaque upload (même nom)
   *
   * @param pdfBytes - Contenu du PDF en Uint8Array
   * @param soldierId - ID du soldat
   * @param type - Type d'équipement ('combat' | 'clothing')
   * @param action - Action ('issue' | 'credit')
   * @returns URL de téléchargement du PDF
   *
   * Structure des chemins:
   * - pdf/{type}/signature/{soldierId}.pdf (pour issue)
   * - pdf/{type}/credit/{soldierId}.pdf (pour credit)
   *
   * NOTE: Le downloadURL peut changer car le token Firebase change à chaque upload.
   * Pour une URL stable, il faudrait forcer un token constant via Admin SDK.
   */
  async uploadPdf(
    pdfBytes: Uint8Array,
    soldierId: string,
    type: 'combat' | 'clothing',
    action: 'issue' | 'credit'
  ): Promise<string> {
    try {
      // Déterminer le sous-dossier selon l'action
      const subFolder = action === 'issue' ? 'signature' : 'credit';

      // Construire le chemin structuré: pdf/{type}/{subFolder}/{soldierId}.pdf
      const fileName = `${soldierId}.pdf`;
      const storagePath = `pdf/${type}/${subFolder}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      console.log('Uploading PDF to Storage (REPLACE mode):', fileName);

      // Convertir Uint8Array en base64
      const pdfBase64 = pdfToBase64(pdfBytes);

      // Sauvegarder temporairement le fichier localement
      // @ts-ignore - cacheDirectory existe
      const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(tempFileUri, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('PDF saved to temp file:', tempFileUri);

      // Lire le fichier comme blob avec fetch
      const response = await fetch(tempFileUri);
      const blob = await response.blob();

      console.log('PDF blob created, size:', blob.size);

      // Upload le blob (REMPLACE le fichier existant)
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'application/pdf',
      });

      console.log('PDF uploaded successfully (replaced):', snapshot.metadata.fullPath);

      // Nettoyer le fichier temporaire
      await FileSystem.deleteAsync(tempFileUri, { idempotent: true });

      // Récupérer l'URL de téléchargement
      // ATTENTION: Le token dans l'URL peut changer à chaque upload
      const downloadUrl = await getDownloadURL(snapshot.ref);

      console.log('PDF download URL:', downloadUrl);

      return downloadUrl;
    } catch (error) {
      console.error('Error uploading PDF:', error);
      throw error;
    }
  },

  /**
   * Supprime un PDF de Firebase Storage
   *
   * @param pdfUrl - URL du PDF à supprimer
   */
  async deletePdf(pdfUrl: string): Promise<void> {
    try {
      // Extraire le chemin depuis l'URL
      const { deleteObject } = await import('firebase/storage');
      const storageRef = ref(storage, pdfUrl);
      await deleteObject(storageRef);
      console.log('PDF deleted successfully');
    } catch (error) {
      console.error('Error deleting PDF:', error);
      // Ne pas throw - la suppression peut échouer si le fichier n'existe pas
    }
  },

  /**
   * Supprime un PDF par son chemin structuré
   *
   * @param soldierId - ID du soldat
   * @param type - Type d'équipement ('combat' | 'clothing')
   * @param action - Action ('issue' | 'credit')
   */
  async deletePdfByPath(
    soldierId: string,
    type: 'combat' | 'clothing',
    action: 'issue' | 'credit'
  ): Promise<void> {
    try {
      const subFolder = action === 'issue' ? 'signature' : 'credit';
      const storagePath = `pdf/${type}/${subFolder}/${soldierId}.pdf`;
      const storageRef = ref(storage, storagePath);

      const { deleteObject } = await import('firebase/storage');
      await deleteObject(storageRef);
      console.log('PDF deleted successfully:', storagePath);
    } catch (error) {
      console.error('Error deleting PDF by path:', error);
      // Ne pas throw - la suppression peut échouer si le fichier n'existe pas
    }
  },
};