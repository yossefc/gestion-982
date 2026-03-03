/**
 * transactionalAssignmentService.ts
 *
 * Service d'attribution avec transactions atomiques Firestore.
 * Garantit la cohֳ©rence entre assignments (historique) et soldier_holdings (ֳ©tat).
 *
 * Architecture:
 * - assignments: Historique immuable (append-only)
 * - soldier_holdings: ֳ‰tat courant (mis ֳ  jour transactionnellement)
 *
 * OFFLINE SUPPORT:
 * - Les opֳ©rations sont mises en queue si offline
 * - Sync automatique au retour du rֳ©seau
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
import { Assignment, AssignmentItem, HoldingItem } from '../types';
import {
  offlineService,
  isOnline,
  setTransactionFunctions,
  OperationType,
} from './offlineService';
import cacheService from './cacheService';
import { weaponInventoryService } from './weaponInventoryService';

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
  soldierPhone?: string;
  soldierCompany?: string;
  type: 'combat' | 'clothing';
  items: AssignmentItem[];
  signature?: string;
  signaturePdfUrl?: string;
  addedBy: string;
  requestId: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcule l'ֳ©tat courant des holdings depuis l'historique complet des assignments
 * (Utilisֳ© pour vֳ©rification/validation, mais pas dans la transaction critique)
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

    // LOGIQUE SPֳ‰CIALE: Si c'est une 'issue', on repart de zֳ©ro pour ce type (remplacement)
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
        // Pour le retrait, on retire les serials spֳ©cifiֳ©s si possible
        if (itemSerials.length > 0) {
          current.serials = current.serials.filter(s => !itemSerials.includes(s));
        } else {
          // Sinon on retire par la fin si c'est un retour gֳ©nֳ©rique
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
 * Applique une opֳ©ration sur les holdings existants
 */
function applyOperationToHoldings(
  currentHoldings: HoldingItem[],
  items: AssignmentItem[],
  action: 'issue' | 'add' | 'return' | 'credit' | 'storage' | 'retrieve'
): HoldingItem[] {
  const holdingsMap = new Map<string, HoldingItem>();

  // Charger les holdings actuels
  // LOGIQUE SPֳ‰CIALE: Pour une ׳”׳—׳×׳׳” (issue), on remplace tout l'existant.
  // Donc on commence avec une map vide. Pour les autres actions, on charge l'existant.
  if (action !== 'issue') {
    for (const holding of currentHoldings) {
      holdingsMap.set(holding.equipmentId, { ...holding });
    }
  }

  // Appliquer l'opֳ©ration
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

    if (action === 'issue' || action === 'add' || action === 'retrieve') {
      current.quantity += item.quantity;

      // DEDUPLICATION: On n'ajoute que les sֳ©ries qui ne sont pas dֳ©jֳ  prֳ©sentes
      const newSerialsToAdd = itemSerials.filter(s => !current.serials.includes(s));
      current.serials = [...current.serials, ...newSerialsToAdd];

      // Si l'item a des serials, quantity DOIT = nombre de serials (chaque serial = 1 unitֳ©)
      if (current.serials.length > 0) {
        current.quantity = current.serials.length;
      }

      current.status = 'assigned';
    } else if (action === 'storage') {
      // Pour l'׳׳₪׳¡׳•׳, on ne retire plus l'item, on change juste son statut
      current.status = 'stored';
    } else if (action === 'return' || action === 'credit') {
      if (itemSerials.length > 0) {
        current.serials = current.serials.filter(s => !itemSerials.includes(s));
      } else {
        current.serials = current.serials.slice(0, Math.max(0, current.serials.length - item.quantity));
      }
      // Si l'item a des serials, quantity DOIT = nombre de serials restants
      if (current.serials.length > 0) {
        current.quantity = current.serials.length;
      } else {
        current.quantity -= item.quantity;
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
// OFFLINE HOLDINGS (CACHE + PENDING OPS)
// ============================================

function getAssignmentTimestampMs(assignment: Assignment): number {
  const ts: any = assignment.timestamp as any;
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (ts?.toDate) return ts.toDate().getTime();
  return 0;
}

function getStatusForAction(action: OperationType): string {
  switch (action) {
    case 'issue':
      return 'נופק לחייל';
    case 'return':
      return 'הוחזר';
    case 'add':
      return 'נוסף';
    case 'credit':
      return 'זוכה';
    case 'storage':
      return 'הופקד';
    case 'retrieve':
      return 'שוחרר מאפסון';
    default:
      return '';
  }
}

async function getAssignmentsForHoldings(
  type: 'combat' | 'clothing',
  soldierId?: string
): Promise<Assignment[]> {
  const cacheKey = type === 'combat' ? 'combatAssignments' : 'clothingAssignments';
  let cached = cacheService.getImmediate<Assignment>(cacheKey) || [];

  // IMPORTANT: Filtrer par soldierId si spécifié
  if (soldierId) {
    cached = cached.filter(a => a.soldierId === soldierId);
  }

  // OPTIMISÉ: getPendingOperations est maintenant synchrone (cache mémoire)
  const pendingOps = offlineService.getPendingOperations();
  const pendingAssignments: Assignment[] = pendingOps
    .filter(op => {
      if (op.params?.type !== type) return false;
      if (soldierId && op.params?.soldierId !== soldierId) return false;
      return true;
    })
    .map(op => {
      const params = op.params || {};
      const assignmentId = params.requestId || op.localResult || op.id;
      const assignedBy =
        params?.assignedBy ||
        params?.returnedBy ||
        params?.addedBy ||
        params?.creditedBy ||
        params?.storedBy ||
        params?.retrievedBy ||
        '';

      return {
        id: assignmentId,
        soldierId: params.soldierId,
        soldierName: params.soldierName,
        soldierPersonalNumber: params.soldierPersonalNumber,
        soldierPhone: params.soldierPhone,
        soldierCompany: params.soldierCompany,
        type: type,
        action: op.type,
        items: params.items || [],
        signature: params.signature,
        status: getStatusForAction(op.type) as any,
        timestamp: new Date(op.timestamp),
        assignedBy: assignedBy,
      } as Assignment;
    });

  // Merge with deduplication (avoid double-counting if already cached)
  const seen = new Set<string>();
  const combined: Assignment[] = [];
  for (const a of [...cached, ...pendingAssignments]) {
    const id = a.id || '';
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    combined.push(a);
  }

  return combined;
}

function computeHoldingsFromAssignments(assignments: Assignment[]): HoldingItem[] {
  const sorted = [...assignments].sort((a, b) => getAssignmentTimestampMs(a) - getAssignmentTimestampMs(b));
  let holdings: HoldingItem[] = [];

  for (const assignment of sorted) {
    const action = (assignment.action || 'issue') as OperationType;
    const items = assignment.items || [];

    if (action === 'issue') {
      holdings = applyOperationToHoldings([], items, 'issue');
    } else if (action === 'credit' && (!items || items.length === 0)) {
      // Credit offline without items: clear holdings
      holdings = [];
    } else {
      holdings = applyOperationToHoldings(holdings, items, action as any);
    }
  }

  return holdings;
}

function computeHoldingsBySoldier(assignments: Assignment[], type: 'combat' | 'clothing'): any[] {
  const sorted = [...assignments].sort((a, b) => getAssignmentTimestampMs(a) - getAssignmentTimestampMs(b));
  const holdingsMap = new Map<string, HoldingItem[]>();
  const metaMap = new Map<string, { soldierName?: string; soldierPersonalNumber?: string }>();

  for (const assignment of sorted) {
    if (!assignment.soldierId) continue;
    const soldierId = assignment.soldierId;
    const current = holdingsMap.get(soldierId) || [];
    const items = assignment.items || [];
    const action = (assignment.action || 'issue') as OperationType;

    let next: HoldingItem[];
    if (action === 'issue') {
      next = applyOperationToHoldings([], items, 'issue');
    } else if (action === 'credit' && (!items || items.length === 0)) {
      next = [];
    } else {
      next = applyOperationToHoldings(current, items, action as any);
    }

    holdingsMap.set(soldierId, next);
    metaMap.set(soldierId, {
      soldierName: assignment.soldierName,
      soldierPersonalNumber: assignment.soldierPersonalNumber,
    });
  }

  return Array.from(holdingsMap.entries()).map(([soldierId, items]) => ({
    soldierId,
    soldierName: metaMap.get(soldierId)?.soldierName || '',
    soldierPersonalNumber: metaMap.get(soldierId)?.soldierPersonalNumber || '',
    type,
    items,
    outstandingCount: items.reduce((sum, item) => sum + item.quantity, 0),
    status: items.length > 0 ? 'OPEN' : 'CLOSED',
  }));
}

// ============================================
// NETWORK TIMEOUT HELPERS (OFFLINE FAST FAIL)
// ============================================

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

function isNetworkOrTimeoutError(error: any): boolean {
  return (
    error?.message === 'timeout' ||
    error?.code === 'unavailable' ||
    error?.code === 'failed-precondition' ||
    error?.message?.includes('network') ||
    error?.message?.includes('offline') ||
    error?.message?.includes('Failed to get document') ||
    error?.message?.includes('Could not reach Cloud Firestore')
  );
}

// ============================================
// TRANSACTIONAL OPERATIONS
// ============================================

/**
 * Issue equipment to a soldier (׳”׳—׳×׳׳”)
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
    // 0. Vֳ©rifier l'idempotence (si le requestId a dֳ©jֳ  ֳ©tֳ© traitֳ©)
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings (ֳ©tat courant) - DOIT ֳTRE FAIT AVANT LES WRITES
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    // 2. Crֳ©er l'assignment (historique immuable avec ID stable - WRITE)
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

    // 3. Mettre ֳ  jour soldier_holdings (WRITE)
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

    // Appliquer l'opֳ©ration issue
    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'issue');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      soldierName,
      soldierPersonalNumber,
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
 * Return equipment from a soldier (זיכוי)
 * Transaction atomique: assignment + soldier_holdings
 * Puis mise à jour de l'inventaire des armes (hors transaction - requêtes Firestore incompatibles)
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

  const assignmentId = await runTransaction(db, async (transaction: Transaction) => {
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

    // On prֳ©-charge les issues pour pouvoir les supprimer si le solde tombe ֳ  0
    const issueQuery = query(
      collection(db, 'assignments'),
      where('soldierId', '==', soldierId),
      where('type', '==', type),
      where('action', '==', 'issue')
    );
    const issueDocs = await getDocs(issueQuery);

    // 2. Créer l'assignment (historique - WRITE)
    // action 'credit' + status 'זוכה' : cohérent avec l'UI "זיכוי חייל"
    const assignmentData: any = {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      action: 'credit',
      items,
      status: 'זוכה',
      timestamp: Timestamp.now(),
      assignedBy: returnedBy,
      requestId,
    };

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre ֳ  jour soldier_holdings
    if (!holdingSnap.exists()) {
      throw new Error('No holdings found for this soldier');
    }

    const currentHoldings: HoldingItem[] = holdingSnap.data().items || [];
    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'return');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      soldierName,
      soldierPersonalNumber,
      type,
      items: newHoldings,
      outstandingCount,
      status: outstandingCount > 0 ? 'OPEN' : 'CLOSED',
      lastUpdated: Timestamp.now(),
    });

    // 4. Nettoyage automatique: si le solde est ֳ  0, effacer les documents de signature (issue) et l'ancienne collection
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
          // Garder uniquement les items de l'autre type et effacer les champs liֳ©s ֳ  celui-ci
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

  // Mise à jour de l'inventaire des armes APRÈS la transaction
  // (les requêtes Firestore ne sont pas compatibles avec runTransaction)
  // Un échec ici ne remet pas en cause le זיכוי déjà enregistré — on log et on continue
  if (type === 'combat') {
    // Fire-and-forget pour ne pas bloquer le traitement global et éviter les timeouts
    Promise.all(items.map(async (item) => {
      const serials = item.serial
        ? item.serial.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      await Promise.all(serials.map(async (serial) => {
        try {
          const weapon = await weaponInventoryService.getWeaponBySerialNumber(serial);
          if (weapon) {
            await weaponInventoryService.setWeaponAvailableStatusOnlyOffline(weapon.id);
          } else {
            console.warn(`[ReturnEquipment] Arme introuvable dans l'inventaire pour le מסטב: ${serial}`);
          }
        } catch (err) {
          console.warn(`[ReturnEquipment] Échec mise à jour inventaire pour מסטב ${serial}:`, err);
        }
      }));
    })).catch(err => console.error("[ReturnEquipment] Erreur globale lors de la libération des armes:", err));
  }

  return assignmentId;
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
    soldierPhone,
    soldierCompany,
    type,
    items,
    signature,
    signaturePdfUrl,
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

    // 2. Crֳ©er l'assignment (historique - WRITE)
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

    if (soldierPhone) assignmentData.soldierPhone = soldierPhone;
    if (soldierCompany) assignmentData.soldierCompany = soldierCompany;
    if (signature) assignmentData.signature = signature;
    if (signaturePdfUrl) assignmentData.signaturePdfUrl = signaturePdfUrl;

    transaction.set(assignmentRef, assignmentData);

    // 3. Mettre ֳ  jour soldier_holdings
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'add');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      soldierName,
      soldierPersonalNumber,
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
 * Credit all equipment (׳–׳™׳›׳•׳™ - retourne tout)
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
  let returnedHoldings: HoldingItem[] = [];

  const assignmentId = await runTransaction(db, async (transaction: Transaction) => {
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
    returnedHoldings = currentHoldings; // Capture for weapon release after transaction

    // 2. Crֳ©er un assignment credit avec tous les items
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
      soldierName,
      soldierPersonalNumber,
      type,
      items: [],
      outstandingCount: 0,
      status: 'CLOSED',
      lastUpdated: Timestamp.now(),
    });

    // 4. Nettoyage automatique: le crֳ©dit remet toujours ֳ  0
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

  // Mise à jour de l'inventaire des armes APRÈS la transaction réussie
  if (type === 'combat' && returnedHoldings.length > 0) {
    // Fire-and-forget pour ne pas bloquer le traitement global et éviter les timeouts
    Promise.all(returnedHoldings.map(async (item) => {
      const serials = item.serials ? item.serials : [];
      await Promise.all(serials.map(async (serial) => {
        try {
          const weapon = await weaponInventoryService.getWeaponBySerialNumber(serial);
          if (weapon) {
            await weaponInventoryService.setWeaponAvailableStatusOnlyOffline(weapon.id);
          } else {
            console.warn(`[CreditEquipment] Arme introuvable dans l'inventaire pour le מסטב: ${serial}`);
          }
        } catch (err) {
          console.warn(`[CreditEquipment] Échec mise à jour inventaire pour מסטב ${serial}:`, err);
        }
      }));
    })).catch(err => console.error("[CreditEquipment] Erreur globale lors de la libération des armes:", err));
  }

  return assignmentId;
}

/**
 * Storage operation (׳׳₪׳¡׳•׳)
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

    // 2. Crֳ©er l'assignment (WRITE)
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

    // 3. Mettre ֳ  jour holdings (storage retire des items)
    if (!holdingSnap.exists()) {
      throw new Error('No holdings found for this soldier');
    }

    const currentHoldings: HoldingItem[] = holdingSnap.data().items || [];
    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'storage');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      soldierName,
      soldierPersonalNumber,
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
 * Retrieve from storage (׳©׳—׳¨׳•׳¨ ׳׳׳₪׳¡׳•׳)
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

    // 2. Crֳ©er l'assignment (WRITE)
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

    // 3. Mettre ֳ  jour holdings (retrieve ajoute des items)
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

    const newHoldings = applyOperationToHoldings(currentHoldings, items, 'retrieve');
    const outstandingCount = newHoldings.reduce((sum, item) => sum + item.quantity, 0);

    transaction.set(holdingRef, {
      soldierId,
      soldierName,
      soldierPersonalNumber,
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
 * Dֳ©duplique les items en fusionnant les quantitֳ©s et serials.
 * Gֳ¨re 2 cas:
 *  1) Mֳ×me equipmentId ג†’ fusion directe
 *  2) Mֳ×me equipmentName + serials en commun mais equipmentId diffֳ©rents
 *     (ex: un vrai ID "1ejpa..." et un ID fabriquֳ© "WEAPON_׳׳§׳׳¢ ׳׳׳’")
 *     ג†’ on garde le vrai ID (celui qui ne commence pas par "WEAPON_")
 */
function deduplicateHoldings(items: HoldingItem[]): HoldingItem[] {
  const holdingsMap = new Map<string, HoldingItem>();

  for (const item of items) {
    // Chercher un doublon existant: mֳ×me equipmentId OU mֳ×me nom + serials en commun
    let mergeKey: string | undefined = undefined;

    if (holdingsMap.has(item.equipmentId)) {
      mergeKey = item.equipmentId;
    } else {
      // Vֳ©rifier si un autre item avec le mֳ×me nom a des serials en commun
      for (const [key, existing] of holdingsMap) {
        if (existing.equipmentName === item.equipmentName) {
          const hasCommonSerial = item.serials.some(s => s && existing.serials.includes(s));
          if (hasCommonSerial) {
            mergeKey = key;
            break;
          }
        }
      }
    }

    if (mergeKey !== undefined) {
      const existing = holdingsMap.get(mergeKey)!;
      const mergedSerials = [...new Set([...existing.serials, ...item.serials])];

      // Garder le vrai ID (celui qui ne commence pas par "WEAPON_")
      const realId = existing.equipmentId.startsWith('WEAPON_') ? item.equipmentId : existing.equipmentId;

      holdingsMap.delete(mergeKey);
      holdingsMap.set(realId, {
        ...existing,
        equipmentId: realId,
        serials: mergedSerials,
        quantity: mergedSerials.filter(Boolean).length || existing.quantity,
        status: existing.status === 'stored' || item.status === 'stored' ? 'stored' : 'assigned',
      });
    } else {
      holdingsMap.set(item.equipmentId, { ...item });
    }
  }

  return Array.from(holdingsMap.values()).filter(item => item.quantity > 0);
}

/**
 * REPAIR ONLY: Force save current deduplicated holdings to DB
 * Utilise la logique de lecture (qui dֳ©duplique) pour ֳ©craser les donnֳ©es corrompues
 */
export async function repairSoldierHoldings(soldierId: string, type: 'combat' | 'clothing'): Promise<void> {
  // 1. Lire les holdings (la lecture applique dֳ©jֳ  deduplicateHoldings)
  const cleanItems = await getCurrentHoldings(soldierId, type);

  // 2. Calculer le total
  const outstandingCount = cleanItems.reduce((sum, item) => sum + item.quantity, 0);

  // 3. ֳ‰craser dans la base
  const holdingId = `${soldierId}_${type}`;
  const holdingRef = doc(db, 'soldier_holdings', holdingId);

  await setDoc(holdingRef, {
    items: cleanItems,
    outstandingCount,
    lastUpdated: Timestamp.now(),
  }, { merge: true });
}

/**
 * Get current holdings for a soldier (lecture depuis soldier_holdings)
 * NON-TRANSACTIONNEL: simple lecture
 * Inclut une dֳ©duplication automatique pour corriger les donnֳ©es historiques
 */
export async function getCurrentHoldings(
  soldierId: string,
  type: 'combat' | 'clothing'
): Promise<HoldingItem[]> {
  // Offline: compute from cache + pending ops
  if (!isOnline()) {
    const assignments = await getAssignmentsForHoldings(type, soldierId);
    return deduplicateHoldings(computeHoldingsFromAssignments(assignments));
  }

  try {
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await runWithTimeout(getDoc(holdingRef), 1500);

    if (holdingSnap.exists()) {
      const items = holdingSnap.data().items || [];
      // Dֳ©dupliquer automatiquement pour corriger les donnֳ©es historiques
      return deduplicateHoldings(items);
    }

    return [];
  } catch (error) {
    console.warn('[TransactionalAssignment] getCurrentHoldings failed, using offline cache:', error);
    const assignments = await getAssignmentsForHoldings(type, soldierId);
    return deduplicateHoldings(computeHoldingsFromAssignments(assignments));
  }
}

/**
 * Get all holdings for a type (utilisֳ© pour les rapports de stock globaux)
 */
export async function getAllHoldings(type: 'combat' | 'clothing'): Promise<any[]> {
  if (!isOnline()) {
    const assignments = await getAssignmentsForHoldings(type);
    return computeHoldingsBySoldier(assignments, type);
  }

  try {
    const q = query(
      collection(db, 'soldier_holdings'),
      where('type', '==', type)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.warn('[TransactionalAssignment] getAllHoldings failed, using offline cache:', error);
    const assignments = await getAssignmentsForHoldings(type);
    return computeHoldingsBySoldier(assignments, type);
  }
}

/**
 * Recalcule les holdings pour TOUS les soldats
 * Utile pour la migration initiale ou en cas de dֳ©synchronisation
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
          // Si plus rien, on marque CLOSED ou on supprime si on veut ֳ×tre strict
          // Pour la cohֳ©rence on garde le doc mais ֳ  CLOSED
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

// ============================================
// OFFLINE-AWARE WRAPPERS
// ============================================

/**
 * Wrapper pour issueEquipment avec support offline
 * AMֳ‰LIORֳ‰: Attrape les erreurs rֳ©seau et met en queue automatiquement
 */
async function issueEquipmentOffline(params: IssueEquipmentParams): Promise<string> {
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing issue operation');
    return await offlineService.queue('issue', params);
  }

  try {
    return await runWithTimeout(issueEquipment(params), 2500);
  } catch (error: any) {
    // Si c'est une erreur rֳ©seau, mettre en queue au lieu d'ֳ©chouer
    if (isNetworkOrTimeoutError(error)) {
      console.log('[TransactionalAssignment] Network error detected - Queuing issue operation');
      return await offlineService.queue('issue', params);
    }

    // Pour les autres erreurs, les propager normalement
    throw error;
  }
}

/**
 * Wrapper pour returnEquipment avec support offline
 * AMֳ‰LIORֳ‰: Attrape les erreurs rֳ©seau et met en queue automatiquement
 */
async function returnEquipmentOffline(params: ReturnEquipmentParams): Promise<string> {
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing return operation');
    return await offlineService.queue('return', params);
  }

  try {
    return await runWithTimeout(returnEquipment(params), 2500);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error)) {
      console.log('[TransactionalAssignment] Network error detected - Queuing return operation');
      return await offlineService.queue('return', params);
    }
    throw error;
  }
}

/**
 * Wrapper pour addEquipment avec support offline
 * AMֳ‰LIORֳ‰: Attrape les erreurs rֳ©seau et met en queue automatiquement
 */
async function addEquipmentOffline(params: AddEquipmentParams): Promise<string> {
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing add operation');
    return await offlineService.queue('add', params);
  }

  try {
    return await runWithTimeout(addEquipment(params), 2500);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error)) {
      console.log('[TransactionalAssignment] Network error detected - Queuing add operation');
      return await offlineService.queue('add', params);
    }
    throw error;
  }
}

/**
 * Wrapper pour creditEquipment avec support offline
 * AMֳ‰LIORֳ‰: Attrape les erreurs rֳ©seau et met en queue automatiquement
 */
async function creditEquipmentOffline(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  creditedBy: string,
  requestId: string
): Promise<string> {
  const params = { soldierId, soldierName, soldierPersonalNumber, type, creditedBy, requestId };
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing credit operation');
    return await offlineService.queue('credit', params);
  }

  try {
    return await runWithTimeout(creditEquipment(soldierId, soldierName, soldierPersonalNumber, type, creditedBy, requestId), 2500);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error)) {
      console.log('[TransactionalAssignment] Network error detected - Queuing credit operation');
      return await offlineService.queue('credit', params);
    }
    throw error;
  }
}

/**
 * Wrapper pour storageEquipment avec support offline
 * AMֳ‰LIORֳ‰: Attrape les erreurs rֳ©seau et met en queue automatiquement
 */
async function storageEquipmentOffline(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  items: AssignmentItem[],
  storedBy: string,
  requestId: string
): Promise<string> {
  const params = { soldierId, soldierName, soldierPersonalNumber, type, items, storedBy, requestId };
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing storage operation');
    return await offlineService.queue('storage', params);
  }

  try {
    return await runWithTimeout(storageEquipment(soldierId, soldierName, soldierPersonalNumber, type, items, storedBy, requestId), 2500);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error)) {
      console.log('[TransactionalAssignment] Network error detected - Queuing storage operation');
      return await offlineService.queue('storage', params);
    }
    throw error;
  }
}

/**
 * Wrapper pour retrieveEquipment avec support offline
 * AMֳ‰LIORֳ‰: Attrape les erreurs rֳ©seau et met en queue automatiquement
 */
async function retrieveEquipmentOffline(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  items: AssignmentItem[],
  retrievedBy: string,
  requestId: string
): Promise<string> {
  const params = { soldierId, soldierName, soldierPersonalNumber, type, items, retrievedBy, requestId };
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing retrieve operation');
    return await offlineService.queue('retrieve', params);
  }

  try {
    return await runWithTimeout(retrieveEquipment(soldierId, soldierName, soldierPersonalNumber, type, items, retrievedBy, requestId), 2500);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error)) {
      console.log('[TransactionalAssignment] Network error detected - Queuing retrieve operation');
      return await offlineService.queue('retrieve', params);
    }
    throw error;
  }
}

// Enregistrer les fonctions transactionnelles pour le service offline
// Cela permet au service offline de rejouer les opֳ©rations quand on revient online
setTransactionFunctions({
  issue: issueEquipment,
  return: returnEquipment,
  add: addEquipment,
  credit: (params: any) => creditEquipment(
    params.soldierId,
    params.soldierName,
    params.soldierPersonalNumber,
    params.type,
    params.creditedBy,
    params.requestId
  ),
  storage: (params: any) => storageEquipment(
    params.soldierId,
    params.soldierName,
    params.soldierPersonalNumber,
    params.type,
    params.items,
    params.storedBy,
    params.requestId
  ),
  retrieve: (params: any) => retrieveEquipment(
    params.soldierId,
    params.soldierName,
    params.soldierPersonalNumber,
    params.type,
    params.items,
    params.retrievedBy,
    params.requestId
  ),
});

// Export du service avec wrappers offline
export const transactionalAssignmentService = {
  // Fonctions avec support offline (recommandֳ©)
  issueEquipment: issueEquipmentOffline,
  returnEquipment: returnEquipmentOffline,
  addEquipment: addEquipmentOffline,
  creditEquipment: creditEquipmentOffline,
  storageEquipment: storageEquipmentOffline,
  retrieveEquipment: retrieveEquipmentOffline,

  // Fonctions directes (sans offline, pour usage interne)
  issueEquipmentDirect: issueEquipment,
  returnEquipmentDirect: returnEquipment,
  addEquipmentDirect: addEquipment,

  // Fonctions de lecture (pas besoin d'offline wrapper)
  getCurrentHoldings,
  getAllHoldings,
  recalculateAllSoldiersHoldings,
  repairSoldierHoldings,
};

