// Service pour gérer les soldats dans Firestore
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Soldier, Company } from '../types';

const COLLECTION_NAME = 'soldiers';

// Convertir un document Firestore en Soldier
const convertDocToSoldier = (doc: any): Soldier => {
  const data = doc.data();
  return {
    id: doc.id,
    personalNumber: data.personalNumber,
    name: data.name,
    phone: data.phone || '',
    company: data.company,
    department: data.department || '',
    createdAt: data.createdAt?.toDate() || new Date(),
  };
};

// Récupérer tous les soldats
export const getAllSoldiers = async (): Promise<Soldier[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDocToSoldier);
  } catch (error) {
    console.error('Error getting soldiers:', error);
    throw error;
  }
};

// Récupérer les soldats par פלוגה
export const getSoldiersByCompany = async (company: Company): Promise<Soldier[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('company', '==', company),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDocToSoldier);
  } catch (error) {
    console.error('Error getting soldiers by company:', error);
    throw error;
  }
};

// Rechercher un soldat par מספר אישי
export const searchSoldierByPersonalNumber = async (personalNumber: string): Promise<Soldier | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('personalNumber', '==', personalNumber),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    return convertDocToSoldier(snapshot.docs[0]);
  } catch (error) {
    console.error('Error searching soldier:', error);
    throw error;
  }
};

// Rechercher des soldats par nom (partiel)
export const searchSoldiersByName = async (searchTerm: string): Promise<Soldier[]> => {
  try {
    // Firestore ne supporte pas la recherche partielle native
    // On récupère tous et on filtre côté client
    const soldiers = await getAllSoldiers();
    return soldiers.filter(soldier => 
      soldier.name.includes(searchTerm) || 
      soldier.personalNumber.includes(searchTerm)
    );
  } catch (error) {
    console.error('Error searching soldiers by name:', error);
    throw error;
  }
};

// Récupérer un soldat par ID
export const getSoldierById = async (id: string): Promise<Soldier | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return convertDocToSoldier(docSnap);
  } catch (error) {
    console.error('Error getting soldier by id:', error);
    throw error;
  }
};

// Ajouter un nouveau soldat
export const addSoldier = async (soldier: Omit<Soldier, 'id' | 'createdAt'>): Promise<string> => {
  try {
    // Vérifier si le מספר אישי existe déjà
    const existing = await searchSoldierByPersonalNumber(soldier.personalNumber);
    if (existing) {
      throw new Error('מספר אישי כבר קיים במערכת');
    }
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...soldier,
      createdAt: Timestamp.now(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding soldier:', error);
    throw error;
  }
};

// Mettre à jour un soldat
export const updateSoldier = async (id: string, updates: Partial<Soldier>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating soldier:', error);
    throw error;
  }
};

// Supprimer un soldat
export const deleteSoldier = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting soldier:', error);
    throw error;
  }
};

// Récupérer les statistiques
export const getSoldierStats = async (): Promise<{
  total: number;
  byCompany: { company: string; count: number }[];
}> => {
  try {
    const soldiers = await getAllSoldiers();
    
    const byCompany: { [key: string]: number } = {};
    soldiers.forEach(soldier => {
      byCompany[soldier.company] = (byCompany[soldier.company] || 0) + 1;
    });
    
    return {
      total: soldiers.length,
      byCompany: Object.entries(byCompany).map(([company, count]) => ({
        company,
        count,
      })),
    };
  } catch (error) {
    console.error('Error getting soldier stats:', error);
    throw error;
  }
};
