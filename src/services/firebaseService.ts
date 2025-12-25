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
      const docRef = await addDoc(collection(db, COLLECTIONS.SOLDIERS), {
        ...soldierData,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating soldier:', error);
      throw error;
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
      console.error('Error getting soldier:', error);
      throw error;
    }
  },

  // Rechercher un soldat par numéro personnel
  async getByPersonalNumber(personalNumber: string): Promise<Soldier | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SOLDIERS),
        where('personalNumber', '==', personalNumber)
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
      console.error('Error searching soldier:', error);
      throw error;
    }
  },

  // Obtenir tous les soldats
  async getAll(): Promise<Soldier[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, COLLECTIONS.SOLDIERS), orderBy('createdAt', 'desc'))
      );

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Soldier[];
    } catch (error) {
      console.error('Error getting soldiers:', error);
      throw error;
    }
  },

  // Rechercher des soldats
  async search(searchTerm: string): Promise<Soldier[]> {
    try {
      const soldiers = await this.getAll();
      const term = searchTerm.toLowerCase();

      return soldiers.filter(soldier =>
        soldier.name.toLowerCase().includes(term) ||
        soldier.personalNumber.includes(term) ||
        soldier.company.toLowerCase().includes(term)
      );
    } catch (error) {
      console.error('Error searching soldiers:', error);
      throw error;
    }
  },

  // Mettre à jour un soldat
  async update(id: string, data: Partial<Soldier>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SOLDIERS, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error updating soldier:', error);
      throw error;
    }
  },

  // Supprimer un soldat
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.SOLDIERS, id));
    } catch (error) {
      console.error('Error deleting soldier:', error);
      throw error;
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
      const docRef = await addDoc(collection(db, COLLECTIONS.ASSIGNMENTS), {
        ...assignmentData,
        timestamp: Timestamp.now(),
      });
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
