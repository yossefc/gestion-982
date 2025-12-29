// Service pour gérer les attributions d'équipement dans Firestore
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Assignment, AssignmentItem, EquipmentStatus } from '../types';

const COLLECTION_NAME = 'assignments';

// Convertir un document Firestore en Assignment
const convertDocToAssignment = (doc: any): Assignment => {
  const data = doc.data();
  return {
    id: doc.id,
    soldierId: data.soldierId,
    soldierName: data.soldierName,
    soldierPersonalNumber: data.soldierPersonalNumber,
    type: data.type,
    items: data.items || [],
    signature: data.signature,
    pdfUrl: data.pdfUrl,
    status: data.status,
    timestamp: data.timestamp?.toDate() || new Date(),
    assignedBy: data.assignedBy,
  };
};

// Récupérer toutes les attributions d'un soldat
export const getAssignmentsBySoldier = async (
  soldierId: string, 
  type?: 'combat' | 'clothing'
): Promise<Assignment[]> => {
  try {
    let q;
    if (type) {
      q = query(
        collection(db, COLLECTION_NAME),
        where('soldierId', '==', soldierId),
        where('type', '==', type),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(
        collection(db, COLLECTION_NAME),
        where('soldierId', '==', soldierId),
        orderBy('timestamp', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDocToAssignment);
  } catch (error) {
    console.error('Error getting assignments:', error);
    throw error;
  }
};

// Récupérer les attributions par type
export const getAssignmentsByType = async (type: 'combat' | 'clothing'): Promise<Assignment[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('type', '==', type),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDocToAssignment);
  } catch (error) {
    console.error('Error getting assignments by type:', error);
    throw error;
  }
};

// Créer une nouvelle attribution avec signature
export const createAssignment = async (
  assignment: Omit<Assignment, 'id' | 'timestamp' | 'pdfUrl'>,
  signatureBase64?: string
): Promise<string> => {
  try {
    let signatureUrl: string | undefined = undefined;

    // Upload de la signature si fournie
    if (signatureBase64) {
      const signatureRef = ref(
        storage,
        `signatures/${assignment.soldierId}_${Date.now()}.png`
      );
      await uploadString(signatureRef, signatureBase64, 'data_url');
      signatureUrl = await getDownloadURL(signatureRef);
    }

    // Construire les données en filtrant les undefined
    const data: any = {
      soldierId: assignment.soldierId,
      soldierName: assignment.soldierName,
      soldierPersonalNumber: assignment.soldierPersonalNumber,
      type: assignment.type,
      items: assignment.items || [],
      status: assignment.status,
      assignedBy: assignment.assignedBy,
      timestamp: Timestamp.now(),
    };

    // Ajouter signature uniquement si elle existe
    if (signatureUrl) {
      data.signature = signatureUrl;
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);

    return docRef.id;
  } catch (error) {
    console.error('Error creating assignment:', error);
    throw error;
  }
};

// Mettre à jour le statut d'une attribution
export const updateAssignmentStatus = async (
  assignmentId: string, 
  status: EquipmentStatus
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, assignmentId);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    throw error;
  }
};

// Mettre à jour l'URL du PDF
export const updateAssignmentPdfUrl = async (
  assignmentId: string, 
  pdfUrl: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, assignmentId);
    await updateDoc(docRef, {
      pdfUrl,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating assignment PDF URL:', error);
    throw error;
  }
};

// Faire un זיכוי (retour d'équipement)
export const returnEquipment = async (
  assignmentId: string,
  returnedItems: AssignmentItem[]
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, assignmentId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Attribution non trouvée');
    }
    
    const currentAssignment = convertDocToAssignment(docSnap);
    
    // Mettre à jour les items retournés
    const updatedItems = currentAssignment.items.map(item => {
      const returnedItem = returnedItems.find(ri => ri.equipmentId === item.equipmentId);
      if (returnedItem) {
        return {
          ...item,
          quantity: item.quantity - returnedItem.quantity,
        };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    // Déterminer le nouveau statut
    const newStatus: EquipmentStatus = updatedItems.length === 0 ? 'זוכה' : 'נופק לחייל';
    
    await updateDoc(docRef, {
      items: updatedItems,
      status: newStatus,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error returning equipment:', error);
    throw error;
  }
};

// Statistiques pour le dashboard
export const getAssignmentStats = async (type: 'combat' | 'clothing'): Promise<{
  total: number;
  signed: number;
  pending: number;
  returned: number;
}> => {
  try {
    const assignments = await getAssignmentsByType(type);
    
    return {
      total: assignments.length,
      signed: assignments.filter(a => a.status === 'נופק לחייל').length,
      pending: assignments.filter(a => a.status === 'לא חתום').length,
      returned: assignments.filter(a => a.status === 'זוכה').length,
    };
  } catch (error) {
    console.error('Error getting assignment stats:', error);
    throw error;
  }
};
