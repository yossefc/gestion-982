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
import { WeaponInventoryItem, WeaponStatus } from '../types';

const COLLECTION = 'weapons_inventory';

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
    console.error('Error getting weapons:', error);
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
    console.error('Error getting weapon:', error);
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
    console.error('Error adding weapon:', error);
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
        console.error('Invalid assignedDate:', assignedDate);
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
        console.error('Invalid storageDate:', storageDate);
        cleanUpdates.storageDate = Timestamp.now();
      }
    }

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating weapon:', error);
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
    console.error('Error deleting weapon:', error);
    throw error;
  }
};

// =============== QUERIES PAR STATUT ===============

/**
 * Récupérer les armes disponibles
 */
export const getAvailableWeapons = async (): Promise<WeaponInventoryItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'available')
    );
    const snapshot = await getDocs(q);
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
    console.error('Error getting available weapons:', error);
    throw error;
  }
};

/**
 * Récupérer les armes assignées
 */
export const getAssignedWeapons = async (): Promise<WeaponInventoryItem[]> => {
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
    console.error('Error getting assigned weapons:', error);
    throw error;
  }
};

/**
 * Récupérer les armes en אפסון
 */
export const getStorageWeapons = async (): Promise<WeaponInventoryItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'storage')
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
    console.error('Error getting storage weapons:', error);
    throw error;
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
    console.error('Error getting weapons by category:', error);
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
    console.error('Error getting weapon by serial:', error);
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

    // Récupérer les armes en storage
    const storageQuery = query(
      collection(db, COLLECTION),
      where('status', '==', 'storage'),
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
    console.error('Error getting weapons by soldier:', error);
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
      where('status', '==', 'storage')
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
    console.error('Error getting soldiers with stored weapons:', error);
    throw error;
  }
};

// =============== ACTIONS ===============

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

    await updateWeapon(weaponId, {
      status: 'assigned',
      assignedTo: {
        ...soldier,
        assignedDate: new Date(),
      },
      storageDate: deleteField() as any,
    });
  } catch (error) {
    console.error('Error assigning weapon:', error);
    throw error;
  }
};

/**
 * Retourner une arme (la rendre disponible)
 */
export const returnWeapon = async (weaponId: string): Promise<void> => {
  try {
    await updateWeapon(weaponId, {
      status: 'available',
      assignedTo: deleteField() as any,
      storageDate: deleteField() as any,
    });
  } catch (error) {
    console.error('Error returning weapon:', error);
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
      status: 'storage', // En stock mais réservé/stocké pour ce soldat
      assignedTo: {
        ...soldier,
        assignedDate: new Date(),
      },
      storageDate: new Date(),
    });
  } catch (error) {
    console.error('Error moving weapon to storage with soldier:', error);
    throw error;
  }
};

/**
 * Mettre une arme en אפסון
 */
export const moveWeaponToStorage = async (weaponId: string): Promise<void> => {
  try {
    await updateWeapon(weaponId, {
      status: 'storage',
      assignedTo: deleteField() as any,
      storageDate: new Date(),
    });
  } catch (error) {
    console.error('Error moving weapon to storage:', error);
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
    console.error('Error removing weapon from storage:', error);
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
  storage: number;
  byCategory: {
    category: string;
    total: number;
    available: number;
    assigned: number;
    storage: number;
  }[];
}> => {
  try {
    const allWeapons = await getAllWeapons();

    const stats = {
      total: allWeapons.length,
      available: allWeapons.filter((w) => w.status === 'available').length,
      assigned: allWeapons.filter((w) => w.status === 'assigned').length,
      storage: allWeapons.filter((w) => w.status === 'storage').length,
      byCategory: [] as {
        category: string;
        total: number;
        available: number;
        assigned: number;
        storage: number;
      }[],
    };

    // Grouper par catégorie
    const categoryMap = new Map<
      string,
      { total: number; available: number; assigned: number; storage: number }
    >();

    allWeapons.forEach((weapon) => {
      if (!categoryMap.has(weapon.category)) {
        categoryMap.set(weapon.category, {
          total: 0,
          available: 0,
          assigned: 0,
          storage: 0,
        });
      }

      const cat = categoryMap.get(weapon.category)!;
      cat.total++;
      if (weapon.status === 'available') cat.available++;
      if (weapon.status === 'assigned') cat.assigned++;
      if (weapon.status === 'storage') cat.storage++;
    });

    stats.byCategory = Array.from(categoryMap.entries()).map(([category, counts]) => ({
      category,
      ...counts,
    }));

    return stats;
  } catch (error) {
    console.error('Error getting inventory stats:', error);
    throw error;
  }
};

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
  returnWeapon,
  moveWeaponToStorage,
  moveWeaponToStorageWithSoldier,
  removeWeaponFromStorage,
  // Stats
  getInventoryStats,
};
