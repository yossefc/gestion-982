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
  RspAssignment,
  RspEquipment,
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
// CACHE EN MÉMOIRE POUR LES SOLDATS
// ============================================
let soldiersCache: Soldier[] | null = null;
let soldiersCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

      // Invalider le cache
      soldiersCache = null;
      soldiersCacheTime = 0;

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

  // Obtenir tous les soldats (avec cache en mémoire)
  async getAll(limitCount: number = 1000, forceRefresh: boolean = false): Promise<Soldier[]> {
    try {
      const now = Date.now();

      // Utiliser le cache si disponible et pas expiré
      if (!forceRefresh && soldiersCache && (now - soldiersCacheTime) < CACHE_DURATION) {
        return soldiersCache;
      }

      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.SOLDIERS),
          orderBy('nameLower', 'asc'),
          firestoreLimit(limitCount)
        )
      );

      const soldiers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Soldier[];

      // Mettre à jour le cache
      soldiersCache = soldiers;
      soldiersCacheTime = now;

      return soldiers;
    } catch (error) {
      logError('soldierService.getAll', error);
      throw mapFirebaseError(error);
    }
  },

  // Invalider le cache (après création/modification/suppression)
  invalidateCache(): void {
    soldiersCache = null;
    soldiersCacheTime = 0;
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
      const limitCount = options?.limitCount || 1000;

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

      // Invalider le cache
      soldiersCache = null;
      soldiersCacheTime = 0;
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

      // Invalider le cache
      soldiersCache = null;
      soldiersCacheTime = 0;
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
  async create(equipmentData: Omit<CombatEquipment, 'id'>): Promise<CombatEquipment> {
    try {
      // Générer les clés normalisées pour vérifier les doublons
      const nameKey = normalizeText(equipmentData.name);
      const categoryKey = normalizeText(equipmentData.category);

      // Vérifier si un équipement avec le même nom ET catégorie existe déjà
      const existingQuery = query(
        collection(db, COLLECTIONS.COMBAT_EQUIPMENT),
        where('nameKey', '==', nameKey),
        where('categoryKey', '==', categoryKey)
      );
      const existingDocs = await getDocs(existingQuery);

      if (!existingDocs.empty) {
        throw new Error(`Equipment "${equipmentData.name}" in category "${equipmentData.category}" already exists`);
      }

      // Nettoyer les valeurs undefined (Firestore ne les accepte pas)
      const cleanData: any = {
        name: equipmentData.name,
        nameKey,
        category: equipmentData.category,
        categoryKey,
        hasSubEquipment: equipmentData.hasSubEquipment || false,
        requiresSerial: (equipmentData as any).requiresSerial || false,
      };

      // Les sous-équipements (sans serial au niveau du catalogue)
      if (equipmentData.subEquipments && equipmentData.subEquipments.length > 0) {
        cleanData.subEquipments = equipmentData.subEquipments.map(sub => ({
          id: sub.id,
          name: sub.name,
        }));
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.COMBAT_EQUIPMENT), cleanData);
      return {
        id: docRef.id,
        ...cleanData,
      };
    } catch (error) {
      throw error;
    }
  },

  // Obtenir un équipement par ID
  async getById(id: string): Promise<CombatEquipment | null> {
    try {
      const docRef = doc(db, COLLECTIONS.COMBAT_EQUIPMENT, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as CombatEquipment;
      }
      return null;
    } catch (error) {
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
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<CombatEquipment>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.COMBAT_EQUIPMENT, id);
      // Nettoyer les valeurs undefined avant d'envoyer à Firestore
      const cleanData = removeUndefinedFields(data);
      await updateDoc(docRef, cleanData);
    } catch (error) {
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMBAT_EQUIPMENT, id));
    } catch (error) {
      throw error;
    }
  },
};

// ============================================
// CLOTHING EQUIPMENT
// ============================================

export const clothingEquipmentService = {
  // Créer un équipement
  async create(equipmentData: Omit<ClothingEquipment, 'id'>): Promise<ClothingEquipment> {
    try {
      // Générer la clé normalisée pour vérifier les doublons
      const nameKey = normalizeText(equipmentData.name);

      // Vérifier si un équipement avec le même nom existe déjà
      const existingQuery = query(
        collection(db, COLLECTIONS.CLOTHING_EQUIPMENT),
        where('nameKey', '==', nameKey)
      );
      const existingDocs = await getDocs(existingQuery);

      if (!existingDocs.empty) {
        throw new Error(`Equipment "${equipmentData.name}" already exists`);
      }

      // Nettoyer les valeurs undefined (Firestore ne les accepte pas)
      const cleanData: any = {
        name: equipmentData.name,
        nameKey,
      };

      // Ajouter seulement les champs définis
      if (equipmentData.yamach !== undefined && equipmentData.yamach !== null) {
        cleanData.yamach = equipmentData.yamach;
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.CLOTHING_EQUIPMENT), cleanData);
      return {
        id: docRef.id,
        ...cleanData,
      };
    } catch (error) {
      throw error;
    }
  },

  // Obtenir un équipement par ID
  async getById(id: string): Promise<ClothingEquipment | null> {
    try {
      const docRef = doc(db, COLLECTIONS.CLOTHING_EQUIPMENT, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as ClothingEquipment;
      }

      return null;
    } catch (error) {
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
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<ClothingEquipment>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CLOTHING_EQUIPMENT, id);
      // Nettoyer les valeurs undefined avant d'envoyer à Firestore
      const cleanData = removeUndefinedFields(data);
      await updateDoc(docRef, cleanData);
    } catch (error) {
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CLOTHING_EQUIPMENT, id));
    } catch (error) {
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

      // UPSERT: créer ou mettre à jour
      // IMPORTANT: Pour 'issue' (החתמה), on REMPLACE complètement (pas de merge)
      // Seul 'add' utilise merge car il additionne
      const docRef = doc(db, COLLECTIONS.ASSIGNMENTS, assignmentId);

      if (useAdditiveMode) {
        // MODE ADDITIF: merge pour conserver et additionner
        await setDoc(docRef, cleanData, { merge: true });
      } else {
        // MODE REMPLACEMENT: remplace complètement le document
        await setDoc(docRef, cleanData);
      }

      return assignmentId;
    } catch (error) {
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
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<Assignment>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.ASSIGNMENTS, id);
      await updateDoc(docRef, data);
    } catch (error) {
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ASSIGNMENTS, id));
    } catch (error) {
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


      return status;
    } catch (error) {
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
      throw error;
    }
  },

  // Mettre à jour
  async update(id: string, data: Partial<Mana>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.MANOT, id);
      await updateDoc(docRef, data);
    } catch (error) {
      throw error;
    }
  },

  // Supprimer
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.MANOT, id));
    } catch (error) {
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

      // Calculer les soldats uniques qui détiennent de l'équipement (Signed)
      // On regroupe par soldat et on calcule le solde net (Issue/Add - Credit/Return)
      const soldierHoldings = new Map<string, number>();
      assignments.forEach(a => {
        // Ignorer ce qui n'est pas signé (pending)
        if (a.status === 'לא חתום') return;

        const isCredit = a.action === 'credit' || a.action === 'return' || a.status === 'זוכה';
        const qty = a.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const current = soldierHoldings.get(a.soldierId) || 0;
        soldierHoldings.set(a.soldierId, current + (qty * (isCredit ? -1 : 1)));
      });

      const signedSoldiers = Array.from(soldierHoldings.values()).filter(q => q > 0).length;

      // Calculer les soldats uniques en attente
      const pendingSoldiers = new Set(
        assignments.filter(a => a.status === 'לא חתום').map(a => a.soldierId)
      ).size;

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
      throw error;
    }
  },

  // Obtenir les statistiques pour le module arme
  async getCombatStats(): Promise<DashboardStats> {
    try {
      const assignments = await assignmentService.getByType('combat');
      const soldiers = await soldierService.getAll();

      // Calculer les soldats uniques qui détiennent de l'équipement (Signed)
      // On regroupe par soldat et on calcule le solde net (Issue/Add - Credit/Return)
      const soldierHoldings = new Map<string, number>();
      assignments.forEach(a => {
        // Ignorer ce qui n'est pas signé (pending)
        if (a.status === 'לא חתום') return;

        const isCredit = a.action === 'credit' || a.action === 'return' || a.status === 'זוכה';
        const qty = a.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const current = soldierHoldings.get(a.soldierId) || 0;
        soldierHoldings.set(a.soldierId, current + (qty * (isCredit ? -1 : 1)));
      });

      const signedSoldiers = Array.from(soldierHoldings.values()).filter(q => q > 0).length;

      // Calculer les soldats uniques en attente
      const pendingSoldiers = new Set(
        assignments.filter(a => a.status === 'לא חתום').map(a => a.soldierId)
      ).size;

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


      // Convertir Uint8Array en base64
      const pdfBase64 = pdfToBase64(pdfBytes);

      // Sauvegarder temporairement le fichier localement
      // @ts-ignore - cacheDirectory existe
      const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(tempFileUri, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });


      // Lire le fichier comme blob avec fetch
      const response = await fetch(tempFileUri);
      const blob = await response.blob();


      // Upload le blob (REMPLACE le fichier existant)
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'application/pdf',
      });


      // Nettoyer le fichier temporaire
      await FileSystem.deleteAsync(tempFileUri, { idempotent: true });

      // Récupérer l'URL de téléchargement
      // ATTENTION: Le token dans l'URL peut changer à chaque upload
      const downloadUrl = await getDownloadURL(snapshot.ref);


      return downloadUrl;
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      // Ne pas throw - la suppression peut échouer si le fichier n'existe pas
    }
  },
};

// ============================================
// RSP EQUIPMENT (ציוד רס"פ)
// ============================================

export const rspEquipmentService = {
  // Créer un équipement RSP
  async create(equipmentData: Omit<RspEquipment, 'id' | 'createdAt'>): Promise<string> {
    try {
      const cleanData = removeUndefinedFields({
        ...equipmentData,
        createdAt: Timestamp.now(),
      });
      const docRef = await addDoc(collection(db, 'rsp_equipment'), cleanData);
      return docRef.id;
    } catch (error) {
      throw error;
    }
  },

  // Obtenir tous les équipements RSP
  async getAll(): Promise<RspEquipment[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'rsp_equipment'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as RspEquipment[];
    } catch (error) {
      throw error;
    }
  },

  // Mettre à jour un équipement RSP
  async update(id: string, data: Partial<RspEquipment>): Promise<void> {
    try {
      const docRef = doc(db, 'rsp_equipment', id);
      const cleanData = removeUndefinedFields(data);
      await updateDoc(docRef, cleanData);
    } catch (error) {
      throw error;
    }
  },

  // Supprimer un équipement RSP
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'rsp_equipment', id));
    } catch (error) {
      throw error;
    }
  }
};

// ============================================
// RSP ASSIGNMENTS (החתמות רס"פ)
// ============================================

export const rspAssignmentService = {
  // Créer ou mettre à jour une attribution (avec agrégation)
  async updateQuantity(
    data: {
      soldierId: string;
      soldierName: string;
      company: string;
      equipmentId: string;
      equipmentName: string;
      quantityChange: number; // Positif pour ajout, négatif pour retrait
      action: 'add' | 'remove';
      notes?: string;
    }
  ): Promise<void> {
    try {
      // Clé unique pour trouver l'attribution existante (RSP + Équipement)
      // On utilise une requête car l'ID n'est pas forcément déterministe ici, ou on pourrait le forcer
      // Forçons l'ID pour simplicité: rsp_{soldierId}_{equipmentId}
      const assignmentId = `rsp_${data.soldierId}_${data.equipmentId}`;
      const docRef = doc(db, 'rsp_assignments', assignmentId);
      const docSnap = await getDoc(docRef);

      const historyItem = {
        date: Timestamp.now(),
        quantityChange: data.quantityChange,
        action: data.action,
        notes: data.notes || ''
      };

      if (docSnap.exists()) {
        const current = docSnap.data();
        const newQuantity = (current.quantity || 0) + data.quantityChange;

        // Logique de statut
        let newStatus = current.status;
        if (newQuantity <= 0) newStatus = 'credited';
        else newStatus = 'signed';

        await updateDoc(docRef, {
          quantity: newQuantity,
          status: newStatus,
          lastSignatureDate: Timestamp.now(),
          updatedAt: Timestamp.now(),
          // Ajouter à l'historique (arrayUnion pourrait être utilisé mais on veut garder l'ordre)
          history: [...(current.history || []), historyItem]
        });
      } else {
        // Création nouvelle attribution
        if (data.quantityChange <= 0) {
          throw new Error("Impossible de créer une attribution avec une quantité négative");
        }

        const newAssignment = {
          soldierId: data.soldierId,
          soldierName: data.soldierName,
          company: data.company,
          equipmentId: data.equipmentId,
          equipmentName: data.equipmentName,
          quantity: data.quantityChange,
          status: 'signed',
          lastSignatureDate: Timestamp.now(),
          history: [historyItem],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        await setDoc(docRef, newAssignment);
      }
    } catch (error) {
      throw error;
    }
  },

  // Obtenir toutes les attributions
  async getAll(): Promise<RspAssignment[]> {
    try {
      const q = query(
        collection(db, 'rsp_assignments'),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastSignatureDate: doc.data().lastSignatureDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as RspAssignment[];
    } catch (error) {
      throw error;
    }
  },

  // Obtenir par soldat (RSP)
  async getBySoldier(soldierId: string): Promise<RspAssignment[]> {
    try {
      const q = query(
        collection(db, 'rsp_assignments'),
        where('soldierId', '==', soldierId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastSignatureDate: doc.data().lastSignatureDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as RspAssignment[];
    } catch (error) {
      throw error;
    }
  },

  // Obtenir les équipements détenus par un soldat pour l'inventaire
  async getHoldingsBySoldierId(soldierId: string): Promise<RspAssignment[]> {
    return this.getBySoldier(soldierId);
  }
};

// =============== DEFAULT DATA CONSTANTS ===============

/**
 * Équipements de combat par défaut
 * Utilisés pour initialiser le système la première fois
 */
export const DEFAULT_COMBAT_EQUIPMENT: Omit<CombatEquipment, 'id'>[] = [
  {
    name: 'M16', category: 'נשק', hasSubEquipment: true, subEquipments: [
      { id: '1', name: 'מחסנית' },
      { id: '2', name: 'רצועה' },
      { id: '3', name: 'כלי טעינה' },
    ]
  },
  { name: 'M203', category: 'נשק', hasSubEquipment: true, subEquipments: [] },
  { name: 'קלע', category: 'נשק', hasSubEquipment: false, subEquipments: [] },
  { name: 'נגב', category: 'נשק', hasSubEquipment: true, subEquipments: [] },
  { name: 'מאג', category: 'נשק', hasSubEquipment: true, subEquipments: [] },
  { name: 'אופטיקה', category: 'אביזרים', hasSubEquipment: false, subEquipments: [] },
  { name: 'לייזר', category: 'אביזרים', hasSubEquipment: false, subEquipments: [] },
  { name: 'פנס', category: 'אביזרים', hasSubEquipment: false, subEquipments: [] },
  { name: 'אפוד', category: 'ציוד לוחם', hasSubEquipment: false, subEquipments: [] },
  { name: 'קסדה', category: 'ציוד לוחם', hasSubEquipment: false, subEquipments: [] },
  { name: 'וסט קרמי', category: 'ציוד לוחם', hasSubEquipment: false, subEquipments: [] },
  { name: 'משקפי לילה', category: 'אופטיקה', hasSubEquipment: false, subEquipments: [] },
];

/**
 * Manot (מנות) par défaut
 * Utilisées pour initialiser le système la première fois
 */
export const DEFAULT_MANOT: Omit<Mana, 'id'>[] = [
  {
    name: 'מנת מפקד',
    type: 'מנה',
    equipments: [
      { equipmentId: '', equipmentName: 'M16', quantity: 1 },
      { equipmentId: '', equipmentName: 'אופטיקה', quantity: 1 },
      { equipmentId: '', equipmentName: 'אפוד', quantity: 1 },
      { equipmentId: '', equipmentName: 'קסדה', quantity: 1 },
    ]
  },
  {
    name: 'מנת לוחם',
    type: 'מנה',
    equipments: [
      { equipmentId: '', equipmentName: 'M16', quantity: 1 },
      { equipmentId: '', equipmentName: 'אפוד', quantity: 1 },
      { equipmentId: '', equipmentName: 'קסדה', quantity: 1 },
    ]
  },
  {
    name: 'מנת רימונאי',
    type: 'מנה',
    equipments: [
      { equipmentId: '', equipmentName: 'M203', quantity: 1 },
      { equipmentId: '', equipmentName: 'אפוד', quantity: 1 },
      { equipmentId: '', equipmentName: 'קסדה', quantity: 1 },
    ]
  },
];
