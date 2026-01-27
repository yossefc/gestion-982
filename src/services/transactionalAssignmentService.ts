/**
 * transactionalAssignmentService.ts
 *
 * Service d'attribution avec transactions atomiques Firestore.
 * Garantit la cohérence entre assignments (historique) et soldier_holdings (état).
 *
 * Architecture:
 * - assignments: Historique immuable (append-only)
 * - soldier_holdings: État courant (mis à jour transactionnellement)
 */

import {
  getFirestore,
  collection,
  doc,
  runTransaction,
  Timestamp,
  Transaction,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
} from 'firebase/firestore';
import { app } from '../config/firebase';
import { AssignmentItem, HoldingItem } from '../types';

const db = getFirestore(app);

// ============================================
// TYPES
// ============================================

interface IssueEquipmentParams {
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  soldierPhone?: string;
  soldierCompany?: string;
  type: 'combat' | 'clothing';
  items: AssignmentItem[];
  signature?: string;
  signaturePdfUrl?: string;
  assignedBy: string;
  requestId: string; // ID stable pour l'idempotence
}

interface ReturnEquipmentParams {
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  type: 'combat' | 'clothing';
  items: AssignmentItem[];
  returnedBy: string;
  requestId: string;
}

interface AddEquipmentParams {
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  type: 'combat' | 'clothing';
  items: AssignmentItem[];
  addedBy: string;
  requestId: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcule l'état courant des holdings depuis l'historique complet des assignments
 * (Utilisé pour vérification/validation, mais pas dans la transaction critique)
 */
async function calculateCurrentHoldingsFromHistory(
  soldierId: string,
  type: 'combat' | 'clothing'
): Promise<HoldingItem[]> {
  const assignmentsQuery = query(
    collection(db, 'assignments'),
    where('soldierId', '==', soldierId),
    where('type', '==', type),
    orderBy('timestamp', 'asc')
  );

  const snapshot = await getDocs(assignmentsQuery);
  const holdings = new Map<string, HoldingItem>();

  for (const assignmentDoc of snapshot.docs) {
    const assignment = assignmentDoc.data();
    const action = assignment.action;

    // LOGIQUE SPÉCIALE: Si c'est une 'issue', on repart de zéro pour ce type (remplacement)
    if (action === 'issue') {
      holdings.clear();
    }

    for (const item of assignment.items || []) {
      const key = item.equipmentId;
      const current = holdings.get(key) || {
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        quantity: 0,
        serials: [],
        status: 'assigned' as const,
      };

      const itemSerials = item.serial ? item.serial.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

      if (action === 'issue' || action === 'add') {
        current.quantity += item.quantity;
        current.serials = [...current.serials, ...itemSerials];
        current.status = 'assigned';
      } else if (action === 'retrieve') {
        current.status = 'assigned';
      } else if (action === 'storage') {
        current.status = 'stored';
      } else if (action === 'return' || action === 'credit') {
        current.quantity -= item.quantity;
        // Pour le retrait, on retire les serials spécifiés si possible
        if (itemSerials.length > 0) {
          current.serials = current.serials.filter(s => !itemSerials.includes(s));
        } else {
          // Sinon on retire par la fin si c'est un retour générique
          current.serials = current.serials.slice(0, Math.max(0, current.serials.length - item.quantity));
        }
      }

      if (current.quantity > 0) {
        holdings.set(key, current);
      } else {
        holdings.delete(key);
      }
    }
  }

  return Array.from(holdings.values());
}

/**
 * Applique une opération sur les holdings existants
 */
function applyOperationToHoldings(
  currentHoldings: HoldingItem[],
  items: AssignmentItem[],
  action: 'issue' | 'add' | 'return' | 'credit' | 'storage' | 'retrieve'
): HoldingItem[] {
  const holdingsMap = new Map<string, HoldingItem>();

  // Charger les holdings actuels
  // LOGIQUE SPÉCIALE: Pour une החתמה (issue), on remplace tout l'existant.
  // Donc on commence avec une map vide. Pour les autres actions, on charge l'existant.
  if (action !== 'issue') {
    for (const holding of currentHoldings) {
      holdingsMap.set(holding.equipmentId, { ...holding });
    }
  }

  // Appliquer l'opération
  for (const item of items) {
    const key = item.equipmentId;
    const current = holdingsMap.get(key) || {
      equipmentId: item.equipmentId,
      equipmentName: item.equipmentName,
      quantity: 0,
      serials: [],
      status: 'assigned' as const,
    };

    const itemSerials = item.serial ? item.serial.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (action === 'issue' || action === 'add') {
      current.quantity += item.quantity;
      current.serials = [...current.serials, ...itemSerials];
      current.status = 'assigned';
    } else if (action === 'storage') {
      // Pour l'אפסון, on ne retire plus l'item, on change juste son statut
      current.status = 'stored';
    } else if (action === 'retrieve') {
      // Retour d'אפסון -> redevient active
      current.status = 'assigned';
    } else if (action === 'return' || action === 'credit') {
      current.quantity -= item.quantity;
      if (itemSerials.length > 0) {
        current.serials = current.serials.filter(s => !itemSerials.includes(s));
      } else {
        current.serials = current.serials.slice(0, Math.max(0, current.serials.length - item.quantity));
      }
    }

    if (current.quantity > 0) {
      holdingsMap.set(key, current);
    } else {
      holdingsMap.delete(key);
    }
  }

  return Array.from(holdingsMap.values());
}

// ============================================
// TRANSACTIONAL OPERATIONS
// ============================================

/**
 * Issue equipment to a soldier (החתמה)
 * Transaction atomique: assignment + soldier_holdings
 */
export async function issueEquipment(params: IssueEquipmentParams): Promise<string> {
  const {
    soldierId,
    soldierName,
    soldierPersonalNumber,
    soldierPhone,
    soldierCompany,
    type,
    items,
    signature,
    signaturePdfUrl,
    assignedBy,
    requestId,
  } = params;

  return await runTransaction(db, async (transaction: Transaction) => {
    // 0. Vérifier l'idempotence (si le requestId a déjà été traité)
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings (état courant) - DOIT ÊTRE FAIT AVANT LES WRITES
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    // 2. Créer l'assignment (historique immuable avec ID stable - WRITE)
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'issue',
      items,
      status: 'נופק לחייל',
      timestamp: Timestamp.now(),
      assignedBy,
      requestId,
    };

    if (soldierPhone) assignmentData.soldierPhone = soldierPhone;
    if (soldierCompany) assignmentData.soldierCompany = soldierCompany;
    if (signature) assignmentData.signature = signature;
    if (signaturePdfUrl) assignmentData.signaturePdfUrl = signaturePdfUrl;

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre à jour soldier_holdings (WRITE)
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

    // Appliquer l'opération issue
    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'issue');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      type,
      items: newHoldings,
      outstandingCount,
      status: 'OPEN',
      lastUpdated: Timestamp.now(),
    });

    return assignmentRef.id;
  });
}

/**
 * Return equipment from a soldier (החזרה)
 * Transaction atomique: assignment + soldier_holdings
 */
export async function returnEquipment(params: ReturnEquipmentParams): Promise<string> {
  const {
    soldierId,
    soldierName,
    soldierPersonalNumber,
    type,
    items,
    returnedBy,
    requestId,
  } = params;

  return await runTransaction(db, async (transaction: Transaction) => {
    // 0. Idempotence
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings et les assignments 'issue' existants (READ)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const extraRef = doc(db, 'soldier_equipment', soldierId);

    const [holdingSnap, extraSnap] = await Promise.all([
      transaction.get(holdingRef),
      transaction.get(extraRef)
    ]);

    // On pré-charge les issues pour pouvoir les supprimer si le solde tombe à 0
    const issueQuery = query(
      collection(db, 'assignments'),
      where('soldierId', '==', soldierId),
      where('type', '==', type),
      where('action', '==', 'issue')
    );
    const issueDocs = await getDocs(issueQuery);

    // 2. Créer l'assignment (historique - WRITE)
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'return',
      items,
      status: 'הוחזר',
      timestamp: Timestamp.now(),
      assignedBy: returnedBy,
      requestId,
    };

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre à jour soldier_holdings
    if (!holdingSnap.exists()) {
      throw new Error('No holdings found for this soldier');
    }

    const currentHoldings: HoldingItem[] = holdingSnap.data().items || [];
    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'return');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      type,
      items: newHoldings,
      outstandingCount,
      status: outstandingCount > 0 ? 'OPEN' : 'CLOSED',
      lastUpdated: Timestamp.now(),
    });

    // 4. Nettoyage automatique: si le solde est à 0, effacer les documents de signature (issue) et l'ancienne collection
    if (outstandingCount === 0) {
      issueDocs.forEach(issueDoc => {
        transaction.delete(issueDoc.ref);
      });

      // Nettoyer intelligemment la collection soldier_equipment (ancienne redondante)
      if (extraSnap.exists()) {
        const extraData = extraSnap.data();
        const otherItems = (extraData.items || []).filter((it: any) => it.type !== type);

        if (otherItems.length === 0) {
          transaction.delete(extraRef);
        } else {
          // Garder uniquement les items de l'autre type et effacer les champs liés à celui-ci
          const updates: any = {
            items: otherItems,
            lastUpdated: Timestamp.now()
          };
          if (type === 'combat') {
            updates.combatSignature = null;
            updates.combatPdfUrl = null;
          } else {
            updates.clothingSignature = null;
            updates.clothingPdfUrl = null;
          }
          transaction.update(extraRef, updates);
        }
      }
    }

    return assignmentRef.id;
  });
}

/**
 * Add equipment to a soldier's holdings (הוספה)
 * Transaction atomique: assignment + soldier_holdings
 */
export async function addEquipment(params: AddEquipmentParams): Promise<string> {
  const {
    soldierId,
    soldierName,
    soldierPersonalNumber,
    type,
    items,
    addedBy,
    requestId,
  } = params;

  return await runTransaction(db, async (transaction: Transaction) => {
    // 0. Idempotence
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings (READ)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    // 2. Créer l'assignment (historique - WRITE)
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'add',
      items,
      status: 'נוסף',
      timestamp: Timestamp.now(),
      assignedBy: addedBy,
      requestId,
    };

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre à jour soldier_holdings
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'add');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      type,
      items: newHoldings,
      outstandingCount,
      status: 'OPEN',
      lastUpdated: Timestamp.now(),
    });

    return assignmentRef.id;
  });
}

/**
 * Credit all equipment (זיכוי - retourne tout)
 * Transaction atomique: assignment + soldier_holdings
 */
export async function creditEquipment(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  creditedBy: string,
  requestId: string
): Promise<string> {
  return await runTransaction(db, async (transaction: Transaction) => {
    // 0. Idempotence
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire les holdings actuels et les assignments 'issue' (READ)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const extraRef = doc(db, 'soldier_equipment', soldierId);

    const [holdingSnap, extraSnap] = await Promise.all([
      transaction.get(holdingRef),
      transaction.get(extraRef)
    ]);

    if (!holdingSnap.exists() || !holdingSnap.data().items || holdingSnap.data().items.length === 0) {
      throw new Error('No holdings to credit for this soldier');
    }

    const issueQuery = query(
      collection(db, 'assignments'),
      where('soldierId', '==', soldierId),
      where('type', '==', type),
      where('action', '==', 'issue')
    );
    const issueDocs = await getDocs(issueQuery);

    const currentHoldings: HoldingItem[] = holdingSnap.data().items;

    // 2. Créer un assignment credit avec tous les items
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'credit',
      items: currentHoldings,
      status: 'זוכה',
      timestamp: Timestamp.now(),
      assignedBy: creditedBy,
      requestId,
    };

    transaction.set(assignmentRef, assignmentData);

    // 3. Fermer les holdings
    transaction.set(holdingRef, {
      soldierId,
      type,
      items: [],
      outstandingCount: 0,
      status: 'CLOSED',
      lastUpdated: Timestamp.now(),
    });

    // 4. Nettoyage automatique: le crédit remet toujours à 0
    issueDocs.forEach(issueDoc => {
      transaction.delete(issueDoc.ref);
    });

    // Nettoyer intelligemment la collection soldier_equipment
    if (extraSnap.exists()) {
      const extraData = extraSnap.data();
      const otherItems = (extraData.items || []).filter((it: any) => it.type !== type);

      if (otherItems.length === 0) {
        transaction.delete(extraRef);
      } else {
        const updates: any = {
          items: otherItems,
          lastUpdated: Timestamp.now()
        };
        if (type === 'combat') {
          updates.combatSignature = null;
          updates.combatPdfUrl = null;
        } else {
          updates.clothingSignature = null;
          updates.clothingPdfUrl = null;
        }
        transaction.update(extraRef, updates);
      }
    }

    return assignmentRef.id;
  });
}

/**
 * Storage operation (אפסון)
 * Transaction atomique: assignment + soldier_holdings
 */
export async function storageEquipment(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  items: AssignmentItem[],
  storedBy: string,
  requestId: string
): Promise<string> {
  return await runTransaction(db, async (transaction: Transaction) => {
    // 0. Idempotence
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings (READ)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    // 2. Créer l'assignment (WRITE)
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'storage',
      items,
      status: 'הופקד',
      timestamp: Timestamp.now(),
      assignedBy: storedBy,
      requestId,
    };

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre à jour holdings (storage retire des items)
    if (!holdingSnap.exists()) {
      throw new Error('No holdings found for this soldier');
    }

    const currentHoldings: HoldingItem[] = holdingSnap.data().items || [];
    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'storage');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      type,
      items: newHoldings,
      outstandingCount,
      status: outstandingCount > 0 ? 'OPEN' : 'CLOSED',
      lastUpdated: Timestamp.now(),
    });

    return assignmentRef.id;
  });
}

/**
 * Retrieve from storage (שחרור מאפסון)
 * Transaction atomique: assignment + soldier_holdings
 */
export async function retrieveEquipment(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  items: AssignmentItem[],
  retrievedBy: string,
  requestId: string
): Promise<string> {
  return await runTransaction(db, async (transaction: Transaction) => {
    // 0. Idempotence
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings (READ)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    // 2. Créer l'assignment (WRITE)
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'retrieve',
      items,
      status: 'שוחרר מאפסון',
      timestamp: Timestamp.now(),
      assignedBy: retrievedBy,
      requestId,
    };

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre à jour holdings (retrieve ajoute des items)
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'retrieve');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      type,
      items: newHoldings,
      outstandingCount,
      status: 'OPEN',
      lastUpdated: Timestamp.now(),
    });

    return assignmentRef.id;
  });
}

/**
 * Get current holdings for a soldier (lecture depuis soldier_holdings)
 * NON-TRANSACTIONNEL: simple lecture
 */
export async function getCurrentHoldings(
  soldierId: string,
  type: 'combat' | 'clothing'
): Promise<HoldingItem[]> {
  const holdingId = `${soldierId}_${type}`;
  const holdingRef = doc(db, 'soldier_holdings', holdingId);
  const holdingSnap = await getDoc(holdingRef);

  if (holdingSnap.exists()) {
    return holdingSnap.data().items || [];
  }

  return [];
}

/**
 * Get all holdings for a type (utilisé pour les rapports de stock globaux)
 */
export async function getAllHoldings(type: 'combat' | 'clothing'): Promise<any[]> {
  const q = query(
    collection(db, 'soldier_holdings'),
    where('type', '==', type)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Recalcule les holdings pour TOUS les soldats
 * Utile pour la migration initiale ou en cas de désynchronisation
 */
export async function recalculateAllSoldiersHoldings(
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; errors: number }> {
  const soldiersSnap = await getDocs(collection(db, 'soldiers'));
  const total = soldiersSnap.docs.length;
  let success = 0;
  let errors = 0;


  for (let i = 0; i < total; i++) {
    const soldierDoc = soldiersSnap.docs[i];
    const soldierId = soldierDoc.id;

    try {
      for (const type of ['combat', 'clothing'] as const) {
        const holdings = await calculateCurrentHoldingsFromHistory(soldierId, type);
        const outstandingCount = holdings.reduce((sum, item) => sum + item.quantity, 0);

        const holdingId = `${soldierId}_${type}`;
        const holdingRef = doc(db, 'soldier_holdings', holdingId);

        if (holdings.length > 0) {
          await setDoc(holdingRef, {
            soldierId,
            type,
            items: holdings,
            outstandingCount,
            status: 'OPEN',
            lastUpdated: Timestamp.now(),
          });
        } else {
          // Si plus rien, on marque CLOSED ou on supprime si on veut être strict
          // Pour la cohérence on garde le doc mais à CLOSED
          await setDoc(holdingRef, {
            soldierId,
            type,
            items: [],
            outstandingCount: 0,
            status: 'CLOSED',
            lastUpdated: Timestamp.now(),
          });
        }
      }
      success++;
    } catch (error) {
      errors++;
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return { success, errors };
}

// Export du service
export const transactionalAssignmentService = {
  issueEquipment,
  returnEquipment,
  addEquipment,
  creditEquipment,
  storageEquipment,
  retrieveEquipment,
  getCurrentHoldings,
  getAllHoldings,
  recalculateAllSoldiersHoldings,
};
