// Service pour gérer les attributions d'équipement dans Firestore
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
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
    soldierPhone: data.soldierPhone,
    soldierCompany: data.soldierCompany,
    type: data.type,
    action: data.action, // IMPORTANT: lire le champ action
    items: data.items || [],
    signature: data.signature,
    pdfUrl: data.pdfUrl,
    status: data.status,
    timestamp: data.timestamp?.toDate() || new Date(),
    assignedBy: data.assignedBy,
    assignedByName: data.assignedByName,
    assignedByEmail: data.assignedByEmail,
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
    const assignments = snapshot.docs.map(convertDocToAssignment);
    return assignments;
  } catch (error) {
    throw error;
  }
};

// Récupérer les attributions par type
// Obtenir par type
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
    throw error;
  }
};

// Obtenir tous les assignments (sans filtre de type)
export const getAll = async (): Promise<Assignment[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDocToAssignment);
  } catch (error) {
    throw error;
  }
};

// Calculer l'équipement actuellement détenu par un soldat
// Scanne tous les assignments (issue/credit) et calcule le solde actuel
export const calculateCurrentHoldings = async (
  soldierId: string,
  type: 'combat' | 'clothing'
): Promise<AssignmentItem[]> => {
  try {
    const assignments = await getAssignmentsBySoldier(soldierId, type);

    // Map pour accumuler les items: equipmentId -> item
    const itemsMap = new Map<string, AssignmentItem>();

    // Trier par timestamp (plus ancien en premier)
    const sortedAssignments = assignments.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Pour chaque assignment, ajouter ou retirer les items
    sortedAssignments.forEach(assignment => {
      const action = assignment.action || 'issue'; // Par défaut 'issue' si pas d'action


      assignment.items.forEach(item => {
        const existing = itemsMap.get(item.equipmentId);

        if (action === 'issue' || action === 'add') {
          // AJOUTER à l'inventaire
          if (existing) {
            existing.quantity += item.quantity;
            // Ajouter le serial s'il existe et n'est pas déjà présent
            if (item.serial && !existing.serial?.includes(item.serial)) {
              existing.serial = existing.serial
                ? `${existing.serial}, ${item.serial}`
                : item.serial;
            }
          } else {
            itemsMap.set(item.equipmentId, { ...item });
          }
        } else if (action === 'credit' || action === 'return') {
          // RETIRER de l'inventaire
          if (existing) {
            existing.quantity -= item.quantity;

            // Retirer les serials
            if (item.serial && existing.serial) {
              const serialsToRemove = item.serial.split(',').map(s => s.trim());
              const existingSerials = existing.serial.split(',').map(s => s.trim());
              const remainingSerials = existingSerials.filter(
                s => !serialsToRemove.includes(s)
              );
              existing.serial = remainingSerials.length > 0
                ? remainingSerials.join(', ')
                : undefined;
            }

            // Supprimer l'item si quantité <= 0
            if (existing.quantity <= 0) {
              itemsMap.delete(item.equipmentId);
            }
          }
        } else if (action === 'storage') {
          // אפסון - L'équipement reste au soldat, on ne fait rien
          // Le statut est géré dans weapons_inventory, pas dans les holdings
          // Ne rien faire - l'équipement reste dans itemsMap tel quel
        } else if (action === 'retrieve') {
          // Reprendre du storage - Ne rien faire non plus
          // Ne rien faire - l'équipement reste dans itemsMap tel quel
        }
      });
    });

    // Retourner les items avec quantity > 0
    const result = Array.from(itemsMap.values()).filter(item => item.quantity > 0);
    return result;
  } catch (error) {
    throw error;
  }
};

// Créer une nouvelle attribution avec signature
// Chaque attribution est un document unique pour conserver l'historique complet
export const createAssignment = async (
  assignment: Omit<Assignment, 'id' | 'timestamp' | 'pdfUrl'>,
  signatureBase64?: string
): Promise<string> => {
  try {

    // LOGIQUE SPÉCIALE: Si c'est une החתמה (issue) et que le soldat a déjà des équipements,
    // on crée d'abord un זיכוי automatique pour "rendre" tout ce qu'il a
    if (assignment.action === 'issue') {
      const currentHoldings = await calculateCurrentHoldings(assignment.soldierId, assignment.type);

      if (currentHoldings.length > 0) {

        // Créer un assignment 'credit' automatique pour tout rendre
        const creditData: any = {
          soldierId: assignment.soldierId,
          soldierName: assignment.soldierName,
          soldierPersonalNumber: assignment.soldierPersonalNumber,
          type: assignment.type,
          action: 'credit',
          items: currentHoldings, // Tout ce qu'il a actuellement
          status: 'זוכה',
          assignedBy: assignment.assignedBy,
          assignedByName: assignment.assignedByName,
          assignedByEmail: assignment.assignedByEmail,
          timestamp: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        if (assignment.soldierPhone) creditData.soldierPhone = assignment.soldierPhone;
        if (assignment.soldierCompany) creditData.soldierCompany = assignment.soldierCompany;

        // Créer le credit automatique
        await addDoc(collection(db, COLLECTION_NAME), creditData);
      }
    }

    // Construire les données pour la nouvelle assignment
    // Note: On stocke la signature directement en base64 dans Firestore
    // Les signatures sont petites (~10-50KB), donc acceptable dans Firestore
    const data: any = {
      soldierId: assignment.soldierId,
      soldierName: assignment.soldierName,
      soldierPersonalNumber: assignment.soldierPersonalNumber,
      type: assignment.type,
      items: assignment.items || [],
      status: assignment.status,
      assignedBy: assignment.assignedBy,
      timestamp: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Ajouter les champs optionnels s'ils existent
    if (assignment.action) {
      data.action = assignment.action;
    }
    if (assignment.soldierPhone) {
      data.soldierPhone = assignment.soldierPhone;
    }
    if (assignment.soldierCompany) {
      data.soldierCompany = assignment.soldierCompany;
    }
    if (assignment.assignedByName) {
      data.assignedByName = assignment.assignedByName;
    }
    if (assignment.assignedByEmail) {
      data.assignedByEmail = assignment.assignedByEmail;
    }
    if (signatureBase64) {
      // Stocker la signature directement en base64 (pas de Storage upload)
      data.signature = signatureBase64;
    }

    // Créer un nouveau document avec ID auto-généré (permet l'historique complet)
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);


    return docRef.id;
  } catch (error) {
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
    throw error;
  }
};

// Récupérer tous les soldats avec de l'équipement détenu actuellement
// Retourne une liste de {soldierId, soldierName, soldierPersonalNumber, items, totalQuantity}
export const getSoldiersWithCurrentHoldings = async (
  type: 'combat' | 'clothing'
): Promise<Array<{
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  items: AssignmentItem[];
  totalQuantity: number;
}>> => {
  try {
    // Récupérer tous les assignments de ce type
    const allAssignments = await getAssignmentsByType(type);

    // Grouper par soldierId
    const bySoldier = new Map<string, {
      soldierName: string;
      soldierPersonalNumber: string;
      assignments: Assignment[];
    }>();

    allAssignments.forEach(assignment => {
      if (!bySoldier.has(assignment.soldierId)) {
        bySoldier.set(assignment.soldierId, {
          soldierName: assignment.soldierName,
          soldierPersonalNumber: assignment.soldierPersonalNumber,
          assignments: [],
        });
      }
      bySoldier.get(assignment.soldierId)!.assignments.push(assignment);
    });

    // Calculer les holdings pour chaque soldat
    const results: Array<{
      soldierId: string;
      soldierName: string;
      soldierPersonalNumber: string;
      items: AssignmentItem[];
      totalQuantity: number;
    }> = [];

    for (const [soldierId, data] of bySoldier.entries()) {
      // Calculer les items actuellement détenus
      const items = await calculateCurrentHoldings(soldierId, type);

      if (items.length > 0) {
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        results.push({
          soldierId,
          soldierName: data.soldierName,
          soldierPersonalNumber: data.soldierPersonalNumber,
          items,
          totalQuantity,
        });
      }
    }

    // Trier par nombre total décroissant
    return results.sort((a, b) => b.totalQuantity - a.totalQuantity);
  } catch (error) {
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
    throw error;
  }
};

/**
 * Service object for assignment management
 */
export const assignmentService = {
  getAssignmentsBySoldier,
  getAssignmentsByType,
  getByType: getAssignmentsByType, // Alias for backward compatibility
  calculateCurrentHoldings,
  create: createAssignment,  // Alias for createAssignment
  createAssignment,
  updateAssignmentStatus,
  updateAssignmentPdfUrl,
  returnEquipment,
  getSoldiersWithCurrentHoldings,
  getAssignmentStats,
  getAll, // Get all assignments without type filter
};
