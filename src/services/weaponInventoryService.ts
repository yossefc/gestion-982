// Service pour gérer l'inventaire des armes dans Firestore
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { WeaponInventoryItem } from '../types';

import cacheService from './cacheService';
import { offlineService, isOnline, setTransactionFunctions } from './offlineService';

const COLLECTION = 'weapons_inventory';

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function applyAssignedStatusToCache(
  weaponId: string,
  soldier: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    voucherNumber?: string;
  },
  assignedDate: Date = new Date()
): void {
  cacheService.update('weaponsInventory', 'update', {
    id: weaponId,
    status: 'assigned',
    assignedTo: {
      ...soldier,
      assignedDate,
    },
    storageDate: undefined,
    updatedAt: new Date(),
  } as any);
  cacheService.touch('weaponsInventory');
}

function applyAvailableStatusToCache(weaponId: string): void {
  cacheService.update('weaponsInventory', 'update', {
    id: weaponId,
    status: 'available',
    assignedTo: undefined,
    storageDate: undefined,
    updatedAt: new Date(),
  } as any);
  cacheService.touch('weaponsInventory');
}

// =============== CRUD OPERATIONS ===============

/**
 * Récupérer toutes les armes de l'inventaire
 */
export const getAllWeapons = async (): Promise<WeaponInventoryItem[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION));
    const weapons = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
        storageDate: data.storageDate?.toDate(),
        assignedTo: data.assignedTo
          ? {
            ...data.assignedTo,
            assignedDate: data.assignedTo.assignedDate?.toDate() || new Date(),
          }
          : undefined,
      } as WeaponInventoryItem;
    });

    // Trier en mémoire
    return weapons.sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.serialNumber.localeCompare(b.serialNumber);
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Récupérer une arme par ID
 */
export const getWeaponById = async (id: string): Promise<WeaponInventoryItem | null> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate(),
      storageDate: data.storageDate?.toDate(),
      assignedTo: data.assignedTo
        ? {
          ...data.assignedTo,
          assignedDate: data.assignedTo.assignedDate?.toDate() || new Date(),
        }
        : undefined,
    } as WeaponInventoryItem;
  } catch (error) {
    throw error;
  }
};

/**
 * Ajouter une arme à l'inventaire
 */
export const addWeapon = async (
  weapon: Omit<WeaponInventoryItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Vérifier que le numéro de série n'existe pas déjà
    const existing = await getWeaponBySerialNumber(weapon.serialNumber);
    if (existing) {
      throw new Error('מסטב זה כבר קיים במערכת');
    }

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...weapon,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

/**
 * Mettre à jour une arme
 */
export const updateWeapon = async (
  id: string,
  updates: Partial<WeaponInventoryItem>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);

    // Convertir les dates en Timestamp si nécessaire
    const cleanUpdates: any = { ...updates };

    // Gérer assignedTo.assignedDate
    if (cleanUpdates.assignedTo?.assignedDate) {
      const assignedDate = cleanUpdates.assignedTo.assignedDate;
      // Ne pas traiter deleteField
      if (assignedDate?._methodName === 'deleteField') {
        // Laisser tel quel
      } else if (assignedDate instanceof Date && !isNaN(assignedDate.getTime())) {
        cleanUpdates.assignedTo = {
          ...cleanUpdates.assignedTo,
          assignedDate: Timestamp.fromDate(assignedDate),
        };
      } else {
        // Utiliser la date actuelle comme fallback
        cleanUpdates.assignedTo = {
          ...cleanUpdates.assignedTo,
          assignedDate: Timestamp.now(),
        };
      }
    }

    // Gérer storageDate
    if (cleanUpdates.storageDate) {
      const storageDate = cleanUpdates.storageDate;
      // Ne pas traiter deleteField
      if (storageDate?._methodName === 'deleteField') {
        // Laisser tel quel, ne rien faire
      } else if (storageDate instanceof Date && !isNaN(storageDate.getTime())) {
        cleanUpdates.storageDate = Timestamp.fromDate(storageDate);
      } else {
        cleanUpdates.storageDate = Timestamp.now();
      }
    }

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Supprimer une arme
 */
export const deleteWeapon = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};

// =============== QUERIES PAR STATUT ===============

/**
 * Récupérer les armes disponibles
 * AMÉLIORÉ: Utilise le cache en mode offline
 */
export const getAvailableWeapons = async (): Promise<WeaponInventoryItem[]> => {
  // En mode offline, utiliser directement le cache mémoire
  if (!isOnline()) {
    console.log('[WeaponInventory] Offline mode - using cached weapons');
    const cached = cacheService.getImmediate<WeaponInventoryItem>('weaponsInventory') || [];
    const available = cached.filter(w => w.status === 'available');
    return available.sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.serialNumber.localeCompare(b.serialNumber);
    });
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'available')
    );
    const snapshot = await runWithTimeout(getDocs(q), 1500);
    const weapons = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
      } as WeaponInventoryItem;
    });

    // Trier en mémoire
    return weapons.sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.serialNumber.localeCompare(b.serialNumber);
    });
  } catch (error) {
    // Fallback au cache si erreur réseau
    console.warn('[WeaponInventory] Firebase error, using cache:', error);
    const cached = cacheService.getImmediate<WeaponInventoryItem>('weaponsInventory') || [];
    const available = cached.filter(w => w.status === 'available');
    return available.sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.serialNumber.localeCompare(b.serialNumber);
    });
  }
};

/**
 * Récupérer les armes assignées
 * AMÉLIORÉ: Utilise le cache en mode offline
 */
export const getAssignedWeapons = async (): Promise<WeaponInventoryItem[]> => {
  // En mode offline, utiliser directement le cache mémoire
  if (!isOnline()) {
    console.log('[WeaponInventory] Offline mode - using cached assigned weapons');
    const cached = cacheService.getImmediate<WeaponInventoryItem>('weaponsInventory') || [];
    const assigned = cached.filter(w => w.status === 'assigned');
    return assigned.sort((a, b) => a.category.localeCompare(b.category));
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'assigned')
    );
    const snapshot = await getDocs(q);
    const weapons = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
        assignedTo: data.assignedTo
          ? {
            ...data.assignedTo,
            assignedDate: data.assignedTo.assignedDate?.toDate() || new Date(),
          }
          : undefined,
      } as WeaponInventoryItem;
    });

    // Trier en mémoire
    return weapons.sort((a, b) => a.category.localeCompare(b.category));
  } catch (error) {
    // Fallback au cache si erreur réseau
    console.warn('[WeaponInventory] Firebase error, using cache for assigned:', error);
    const cached = cacheService.getImmediate<WeaponInventoryItem>('weaponsInventory') || [];
    const assigned = cached.filter(w => w.status === 'assigned');
    return assigned.sort((a, b) => a.category.localeCompare(b.category));
  }
};

/**
 * Récupérer les armes en אפסון
 * AMÉLIORÉ: Utilise le cache en mode offline
 */
export const getStorageWeapons = async (): Promise<WeaponInventoryItem[]> => {
  // En mode offline, utiliser directement le cache mémoire
  if (!isOnline()) {
    console.log('[WeaponInventory] Offline mode - using cached stored weapons');
    const cached = cacheService.getImmediate<WeaponInventoryItem>('weaponsInventory') || [];
    const stored = cached.filter(w => w.status === 'stored');
    return stored.sort((a, b) => a.category.localeCompare(b.category));
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'stored')
    );
    const snapshot = await getDocs(q);
    const weapons = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
        storageDate: data.storageDate?.toDate(),
      } as WeaponInventoryItem;
    });

    // Trier en mémoire
    return weapons.sort((a, b) => a.category.localeCompare(b.category));
  } catch (error) {
    // Fallback au cache si erreur réseau
    console.warn('[WeaponInventory] Firebase error, using cache for stored:', error);
    const cached = cacheService.getImmediate<WeaponInventoryItem>('weaponsInventory') || [];
    const stored = cached.filter(w => w.status === 'stored');
    return stored.sort((a, b) => a.category.localeCompare(b.category));
  }
};

/**
 * Récupérer les armes par catégorie
 */
export const getWeaponsByCategory = async (category: string): Promise<WeaponInventoryItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('category', '==', category)
    );
    const snapshot = await getDocs(q);
    const weapons = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
        storageDate: data.storageDate?.toDate(),
        assignedTo: data.assignedTo
          ? {
            ...data.assignedTo,
            assignedDate: data.assignedTo.assignedDate?.toDate() || new Date(),
          }
          : undefined,
      } as WeaponInventoryItem;
    });

    // Trier en mémoire
    return weapons.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
  } catch (error) {
    throw error;
  }
};

/**
 * Récupérer une arme par numéro de série
 */
export const getWeaponBySerialNumber = async (
  serialNumber: string
): Promise<WeaponInventoryItem | null> => {
  try {
    const q = query(collection(db, COLLECTION), where('serialNumber', '==', serialNumber));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate(),
      storageDate: data.storageDate?.toDate(),
      assignedTo: data.assignedTo
        ? {
          ...data.assignedTo,
          assignedDate: data.assignedTo.assignedDate?.toDate() || new Date(),
        }
        : undefined,
    } as WeaponInventoryItem;
  } catch (error) {
    throw error;
  }
};

/**
 * Récupérer les armes d'un soldat (assigned ET storage)
 */
export const getWeaponsBySoldier = async (soldierId: string): Promise<WeaponInventoryItem[]> => {
  try {
    // Récupérer les armes assigned
    const assignedQuery = query(
      collection(db, COLLECTION),
      where('status', '==', 'assigned'),
      where('assignedTo.soldierId', '==', soldierId)
    );
    const assignedSnapshot = await getDocs(assignedQuery);

    // Récupérer les armes en storage (support both old and new status)
    const storageQuery = query(
      collection(db, COLLECTION),
      where('status', 'in', ['stored', 'storage']),
      where('assignedTo.soldierId', '==', soldierId)
    );
    const storageSnapshot = await getDocs(storageQuery);

    // Combiner les deux
    const allDocs = [...assignedSnapshot.docs, ...storageSnapshot.docs];

    return allDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
        storageDate: data.storageDate?.toDate(),
        assignedTo: data.assignedTo
          ? {
            ...data.assignedTo,
            assignedDate: data.assignedTo.assignedDate?.toDate() || new Date(),
          }
          : undefined,
      } as WeaponInventoryItem;
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Récupérer les soldats qui ont des armes en storage
 * Retourne une liste de { soldierId, soldierName, count }
 */
export const getSoldiersWithStoredWeapons = async (): Promise<Array<{
  soldierId: string;
  soldierName: string;
  count: number;
}>> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['stored', 'storage'])
    );
    const snapshot = await getDocs(q);

    // Grouper par soldierId
    const soldiersMap = new Map<string, { soldierName: string; count: number }>();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.assignedTo?.soldierId) {
        const soldierId = data.assignedTo.soldierId;
        const existing = soldiersMap.get(soldierId);

        if (existing) {
          existing.count++;
        } else {
          soldiersMap.set(soldierId, {
            soldierName: data.assignedTo.soldierName || '',
            count: 1,
          });
        }
      }
    });

    // Convertir en array
    return Array.from(soldiersMap.entries()).map(([soldierId, data]) => ({
      soldierId,
      soldierName: data.soldierName,
      count: data.count,
    }));
  } catch (error) {
    throw error;
  }
};

// =============== ACTIONS ===============

/**
 * Assigner une arme à un soldat
 */
/**
 * Mettre à jour UNIQUEMENT le statut de l'arme en inventaire (sans créer d'assignment)
 * Utilisé par CombatAssignmentScreen qui gère déjà l'assignment globalement
 */
export const setWeaponAssignedStatusOnly = async (
  weaponId: string,
  soldier: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    voucherNumber?: string;
  }
): Promise<void> => {
  try {
    const assignedDate = new Date();
    await updateWeapon(weaponId, {
      status: 'assigned',
      assignedTo: {
        ...soldier,
        assignedDate,
      },
      storageDate: deleteField() as any,
    });
    applyAssignedStatusToCache(weaponId, soldier, assignedDate);
  } catch (error) {
    throw error;
  }
};

/**
 * Version offline-aware: queue l'update si hors ligne
 */
export const setWeaponAssignedStatusOnlyOffline = async (
  weaponId: string,
  soldier: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    voucherNumber?: string;
  }
): Promise<string> => {
  const params = { weaponId, soldier };

  if (!isOnline()) {
    applyAssignedStatusToCache(weaponId, soldier);
    return await offlineService.queue('weaponAssign', params);
  }

  try {
    await setWeaponAssignedStatusOnly(weaponId, soldier);
    return weaponId;
  } catch (error: any) {
    const isNetworkError =
      error?.code === 'unavailable' ||
      error?.code === 'failed-precondition' ||
      error?.message?.includes('network') ||
      error?.message?.includes('offline') ||
      error?.message?.includes('Failed to get document') ||
      error?.message?.includes('Could not reach Cloud Firestore');

    if (isNetworkError) {
      // Preserve intent: assignment failures must retry as assignment, not return.
      applyAssignedStatusToCache(weaponId, soldier);
      return await offlineService.queue('weaponAssign', params);
    }

    throw error;
  }
};

/**
 * Mettre à jour UNIQUEMENT le statut de l'arme en inventaire pour la rendre disponible
 */
export const setWeaponAvailableStatusOnly = async (weaponId: string): Promise<void> => {
  try {
    await updateWeapon(weaponId, {
      status: 'available',
      assignedTo: deleteField() as any,
      storageDate: deleteField() as any,
    });
    applyAvailableStatusToCache(weaponId);
  } catch (error) {
    throw error;
  }
};

/**
 * Version offline-aware: queue l'update si hors ligne
 */
export const setWeaponAvailableStatusOnlyOffline = async (weaponId: string): Promise<string> => {
  const params = { weaponId };

  if (!isOnline()) {
    applyAvailableStatusToCache(weaponId);
    return await offlineService.queue('weaponReturn', params);
  }

  try {
    await setWeaponAvailableStatusOnly(weaponId);
    return weaponId;
  } catch (error: any) {
    const isNetworkError =
      error?.code === 'unavailable' ||
      error?.code === 'failed-precondition' ||
      error?.message?.includes('network') ||
      error?.message?.includes('offline') ||
      error?.message?.includes('Failed to get document') ||
      error?.message?.includes('Could not reach Cloud Firestore');

    if (isNetworkError) {
      applyAvailableStatusToCache(weaponId);
      return await offlineService.queue('weaponReturn', params);
    }

    throw error;
  }
};

/**
 * Assigner une arme à un soldat
 */
export const assignWeaponToSoldier = async (
  weaponId: string,
  soldier: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
  }
): Promise<void> => {
  try {
    const weapon = await getWeaponById(weaponId);
    if (!weapon) {
      throw new Error('הנשק לא נמצא');
    }

    if (weapon.status !== 'available') {
      throw new Error('הנשק אינו זמין להקצאה');
    }

    // 1. Find correct CATALOG ID (Standardization)
    // Avoid using "WEAPON_..." if we can find the real UUID from combat_equipment
    // We import the service dynamically strictly if needed or assume top-level import
    const { combatEquipmentService } = require('./firebaseService');
    const catalogItems = await combatEquipmentService.getAll();

    // Try to find a match by name or category
    let targetEquipmentId = `WEAPON_${weapon.category}`; // Default fallback
    let targetEquipmentName = weapon.category;

    const match = catalogItems.find((item: any) =>
      item.name === weapon.category || item.category === weapon.category
    );

    if (match) {
      targetEquipmentId = match.id;
      targetEquipmentName = match.name;
    }

    // 2. Update Inventory
    await updateWeapon(weaponId, {
      status: 'assigned',
      assignedTo: {
        ...soldier,
        assignedDate: new Date(),
      },
      storageDate: deleteField() as any,
    });
    applyAssignedStatusToCache(weaponId, soldier);

    // 3. Create Assignment (Standardized)
    const { transactionalAssignmentService } = await import('./transactionalAssignmentService');
    await transactionalAssignmentService.addEquipment({
      soldierId: soldier.soldierId,
      soldierName: soldier.soldierName,
      soldierPersonalNumber: soldier.soldierPersonalNumber,
      type: 'combat',
      items: [{
        equipmentId: targetEquipmentId,
        equipmentName: targetEquipmentName,
        quantity: 1,
        serial: weapon.serialNumber,
      }],
      addedBy: 'SYSTEM_INVENTORY',
      requestId: `assign_${weaponId}_${Date.now()}`,
    });

  } catch (error) {
    throw error;
  }
};

/**
 * Retourner une arme (la rendre disponible)
 */
export const returnWeapon = async (weaponId: string): Promise<void> => {
  try {
    const weapon = await getWeaponById(weaponId);
    if (!weapon) throw new Error('Weapon not found');

    const previousOwner = weapon.assignedTo;

    // 1. Update Inventory
    await updateWeapon(weaponId, {
      status: 'available',
      assignedTo: deleteField() as any,
      storageDate: deleteField() as any,
    });
    applyAvailableStatusToCache(weaponId);

    // 2. Update Soldier Holdings (Smart Return)
    if (previousOwner && previousOwner.soldierId) {
      const { transactionalAssignmentService } = await import('./transactionalAssignmentService');

      // Find which Equipment ID holds this serial
      const currentHoldings = await transactionalAssignmentService.getCurrentHoldings(previousOwner.soldierId, 'combat');

      // Look for the specific serial number
      const holdingItem = currentHoldings.find((h: any) =>
        h.serials && h.serials.includes(weapon.serialNumber)
      );

      // Default to constructed ID if not found (fallback)
      const targetEquipmentId = holdingItem ? holdingItem.equipmentId : `WEAPON_${weapon.category}`;
      const targetEquipmentName = holdingItem ? holdingItem.equipmentName : weapon.category;

      await transactionalAssignmentService.returnEquipment({
        soldierId: previousOwner.soldierId,
        soldierName: previousOwner.soldierName,
        soldierPersonalNumber: previousOwner.soldierPersonalNumber,
        type: 'combat',
        items: [{
          equipmentId: targetEquipmentId,
          equipmentName: targetEquipmentName,
          quantity: 1,
          serial: weapon.serialNumber,
        }],
        returnedBy: 'SYSTEM_INVENTORY',
        requestId: `return_${weaponId}_${Date.now()}`,
      });
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Mettre une arme en אפסון tout en la gardant assignée à un soldat
 */
export const moveWeaponToStorageWithSoldier = async (
  weaponId: string,
  soldier: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
  }
): Promise<void> => {
  try {
    await updateWeapon(weaponId, {
      status: 'stored', // En stock mais réservé/stocké pour ce soldat
      assignedTo: {
        ...soldier,
        assignedDate: new Date(),
      },
      storageDate: new Date(),
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Mettre une arme en אפסון
 */
export const moveWeaponToStorage = async (weaponId: string): Promise<void> => {
  try {
    await updateWeapon(weaponId, {
      status: 'stored',
      assignedTo: deleteField() as any,
      storageDate: new Date(),
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Sortir une arme de אפסון
 */
export const removeWeaponFromStorage = async (weaponId: string): Promise<void> => {
  try {
    await updateWeapon(weaponId, {
      status: 'available',
      storageDate: deleteField() as any,
    });
  } catch (error) {
    throw error;
  }
};

// =============== STATISTIQUES ===============

/**
 * Obtenir les statistiques de l'inventaire
 */
export const getInventoryStats = async (): Promise<{
  total: number;
  available: number;
  assigned: number;
  stored: number;
  defective: number;
  byCategory: {
    category: string;
    total: number;
    available: number;
    assigned: number;
    stored: number;
    defective: number;
  }[];
}> => {
  try {
    const allWeapons = await getAllWeapons();

    const stats = {
      total: allWeapons.length,
      available: allWeapons.filter((w) => w.status === 'available').length,
      assigned: allWeapons.filter((w) => w.status === 'assigned').length,
      stored: allWeapons.filter((w) => w.status === 'stored').length,
      defective: allWeapons.filter((w) => w.status === 'defective').length,
      byCategory: [] as {
        category: string;
        total: number;
        available: number;
        assigned: number;
        stored: number;
        defective: number;
      }[],
    };

    // Grouper par catégorie
    const categoryMap = new Map<
      string,
      { total: number; available: number; assigned: number; stored: number; defective: number }
    >();

    allWeapons.forEach((weapon) => {
      if (!categoryMap.has(weapon.category)) {
        categoryMap.set(weapon.category, {
          total: 0,
          available: 0,
          assigned: 0,
          stored: 0,
          defective: 0,
        });
      }

      const cat = categoryMap.get(weapon.category)!;
      cat.total++;
      if (weapon.status === 'available') cat.available++;
      if (weapon.status === 'assigned') cat.assigned++;
      if (weapon.status === 'stored') cat.stored++;
      if (weapon.status === 'defective') cat.defective++;
    });

    stats.byCategory = Array.from(categoryMap.entries()).map(([category, counts]) => ({
      category,
      ...counts,
    }));

    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Supprimer les armes d'une catégorie spécifique (sauf celles assignées)
 * Retourne le nombre d'armes supprimées
 */
export const deleteWeaponsByCategory = async (
  category: string,
  excludeAssigned: boolean = true
): Promise<number> => {
  try {
    const weapons = await getWeaponsByCategory(category);

    // Filtrer les armes à supprimer
    const weaponsToDelete = excludeAssigned
      ? weapons.filter(w => w.status !== 'assigned')
      : weapons;

    if (weaponsToDelete.length === 0) {
      return 0;
    }

    // Firebase batch limit is 500
    const BATCH_SIZE = 450;
    const chunks = [];

    for (let i = 0; i < weaponsToDelete.length; i += BATCH_SIZE) {
      chunks.push(weaponsToDelete.slice(i, i + BATCH_SIZE));
    }

    let deletedCount = 0;
    const { writeBatch } = require('firebase/firestore');

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      chunk.forEach(weapon => {
        const docRef = doc(db, COLLECTION, weapon.id);
        batch.delete(docRef);
      });

      await batch.commit();
      deletedCount += chunk.length;
    }

    return deletedCount;
  } catch (error) {
    console.error('Error deleting weapons by category:', error);
    throw error;
  }
};

// Register offline replay handler for weapon assignment
setTransactionFunctions({
  weaponAssign: async (params: any) => {
    await setWeaponAssignedStatusOnly(params.weaponId, params.soldier);
    return params.weaponId;
  },
  weaponReturn: async (params: any) => {
    await setWeaponAvailableStatusOnly(params.weaponId);
    return params.weaponId;
  },
});

export const weaponInventoryService = {
  // CRUD
  getAllWeapons,
  getWeaponById,
  addWeapon,
  updateWeapon,
  deleteWeapon,
  // Queries
  getAvailableWeapons,
  getAssignedWeapons,
  getStorageWeapons,
  getWeaponsByCategory,
  getWeaponBySerialNumber,
  getWeaponsBySoldier,
  getSoldiersWithStoredWeapons,
  // Actions
  assignWeaponToSoldier,
  setWeaponAssignedStatusOnly,
  setWeaponAssignedStatusOnlyOffline,
  setWeaponAvailableStatusOnly,
  setWeaponAvailableStatusOnlyOffline,
  returnWeapon,
  moveWeaponToStorage,
  moveWeaponToStorageWithSoldier,
  removeWeaponFromStorage,
  // Stats
  getInventoryStats,
  deleteWeaponsByCategory,
};


