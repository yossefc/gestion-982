// Service pour gérer les équipements dans Firestore
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CombatEquipment, ClothingEquipment, Mana } from '../types';

// =============== ÉQUIPEMENTS COMBAT ===============

const COMBAT_COLLECTION = 'equipment_combat';

export const getAllCombatEquipment = async (): Promise<CombatEquipment[]> => {
  try {
    const q = query(
      collection(db, COMBAT_COLLECTION),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CombatEquipment));
  } catch (error) {
    console.error('Error getting combat equipment:', error);
    throw error;
  }
};

export const addCombatEquipment = async (
  equipment: Omit<CombatEquipment, 'id'>
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COMBAT_COLLECTION), {
      ...equipment,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding combat equipment:', error);
    throw error;
  }
};

// =============== ÉQUIPEMENTS VÊTEMENT ===============

const CLOTHING_COLLECTION = 'equipment_clothing';

export const getAllClothingEquipment = async (): Promise<ClothingEquipment[]> => {
  try {
    const q = query(
      collection(db, CLOTHING_COLLECTION),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ClothingEquipment));
  } catch (error) {
    console.error('Error getting clothing equipment:', error);
    throw error;
  }
};

export const addClothingEquipment = async (
  equipment: Omit<ClothingEquipment, 'id'>
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, CLOTHING_COLLECTION), {
      ...equipment,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding clothing equipment:', error);
    throw error;
  }
};

export const updateClothingEquipmentYamach = async (
  id: string, 
  yamach: number
): Promise<void> => {
  try {
    const docRef = doc(db, CLOTHING_COLLECTION, id);
    await updateDoc(docRef, {
      yamach,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating yamach:', error);
    throw error;
  }
};

// =============== MANOT (מנות) ===============

const MANOT_COLLECTION = 'manot';

export const getAllManot = async (): Promise<Mana[]> => {
  try {
    const q = query(
      collection(db, MANOT_COLLECTION),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Mana));
  } catch (error) {
    console.error('Error getting manot:', error);
    throw error;
  }
};

export const getManaById = async (id: string): Promise<Mana | null> => {
  try {
    const docRef = doc(db, MANOT_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Mana;
  } catch (error) {
    console.error('Error getting mana:', error);
    throw error;
  }
};

export const addMana = async (mana: Omit<Mana, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, MANOT_COLLECTION), {
      ...mana,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding mana:', error);
    throw error;
  }
};

export const updateMana = async (id: string, updates: Partial<Mana>): Promise<void> => {
  try {
    const docRef = doc(db, MANOT_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating mana:', error);
    throw error;
  }
};

export const deleteMana = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, MANOT_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting mana:', error);
    throw error;
  }
};

// =============== INITIALISATION DES DONNÉES ===============

// Équipements combat par défaut (du système existant)
export const DEFAULT_COMBAT_EQUIPMENT: Omit<CombatEquipment, 'id'>[] = [
  { name: 'M16', category: 'נשק', hasSubEquipment: true, subEquipments: [
    { id: '1', name: 'מחסנית' },
    { id: '2', name: 'רצועה' },
    { id: '3', name: 'כלי טעינה' },
  ]},
  { name: 'M203', category: 'נשק', hasSubEquipment: true },
  { name: 'קלע', category: 'נשק', hasSubEquipment: false },
  { name: 'נגב', category: 'נשק', hasSubEquipment: true },
  { name: 'מאג', category: 'נשק', hasSubEquipment: true },
  { name: 'אופטיקה', category: 'אביזרים', hasSubEquipment: false },
  { name: 'לייזר', category: 'אביזרים', hasSubEquipment: false },
  { name: 'פנס', category: 'אביזרים', hasSubEquipment: false },
  { name: 'אפוד', category: 'ציוד לוחם', hasSubEquipment: false },
  { name: 'קסדה', category: 'ציוד לוחם', hasSubEquipment: false },
  { name: 'וסט קרמי', category: 'ציוד לוחם', hasSubEquipment: false },
  { name: 'משקפי לילה', category: 'אופטיקה', hasSubEquipment: false },
];

// Équipements vêtement par défaut
export const DEFAULT_CLOTHING_EQUIPMENT: Omit<ClothingEquipment, 'id'>[] = [
  { name: 'חולצה ב', yamach: 0 },
  { name: 'מכנסיים ב', yamach: 0 },
  { name: 'חולצה א', yamach: 0 },
  { name: 'מכנסיים א', yamach: 0 },
  { name: 'נעליים', yamach: 0 },
  { name: 'כומתה', yamach: 0 },
  { name: 'קסדה', yamach: 0 },
  { name: 'וסט לוחם', yamach: 0 },
  { name: 'שק שינה', yamach: 0 },
  { name: 'תרמיל', yamach: 0 },
  { name: 'מימייה', yamach: 0 },
  { name: 'פונצ\'ו', yamach: 0 },
  { name: 'חגורה', yamach: 0 },
  { name: 'גרביים', yamach: 0 },
  { name: 'תחתונים', yamach: 0 },
];

// Manot par défaut
export const DEFAULT_MANOT: Omit<Mana, 'id'>[] = [
  { 
    name: 'מנת מפקד', 
    equipments: [
      { equipmentId: '', equipmentName: 'M16', quantity: 1 },
      { equipmentId: '', equipmentName: 'אופטיקה', quantity: 1 },
      { equipmentId: '', equipmentName: 'אפוד', quantity: 1 },
      { equipmentId: '', equipmentName: 'קסדה', quantity: 1 },
    ]
  },
  { 
    name: 'מנת לוחם', 
    equipments: [
      { equipmentId: '', equipmentName: 'M16', quantity: 1 },
      { equipmentId: '', equipmentName: 'אפוד', quantity: 1 },
      { equipmentId: '', equipmentName: 'קסדה', quantity: 1 },
    ]
  },
  { 
    name: 'מנת רימונאי', 
    equipments: [
      { equipmentId: '', equipmentName: 'M203', quantity: 1 },
      { equipmentId: '', equipmentName: 'אפוד', quantity: 1 },
      { equipmentId: '', equipmentName: 'קסדה', quantity: 1 },
    ]
  },
];

// Initialiser les données par défaut
export const initializeDefaultData = async (): Promise<void> => {
  try {
    // Vérifier si les données existent déjà
    const combatEquipment = await getAllCombatEquipment();
    if (combatEquipment.length === 0) {
      console.log('Initializing combat equipment...');
      for (const equipment of DEFAULT_COMBAT_EQUIPMENT) {
        await addCombatEquipment(equipment);
      }
    }

    const clothingEquipment = await getAllClothingEquipment();
    if (clothingEquipment.length === 0) {
      console.log('Initializing clothing equipment...');
      for (const equipment of DEFAULT_CLOTHING_EQUIPMENT) {
        await addClothingEquipment(equipment);
      }
    }

    const manot = await getAllManot();
    if (manot.length === 0) {
      console.log('Initializing manot...');
      for (const mana of DEFAULT_MANOT) {
        await addMana(mana);
      }
    }

    console.log('Default data initialized successfully');
  } catch (error) {
    console.error('Error initializing default data:', error);
    throw error;
  }
};
