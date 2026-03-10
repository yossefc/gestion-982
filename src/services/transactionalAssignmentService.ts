/**
 * transactionalAssignmentService.ts
 *
 * Service d'attribution avec transactions atomiques Firestore.
 * Garantit la cohérence entre assignments (historique) et soldier_holdings (état).
 *
 * Architecture:
 * - assignments: Historique immuable (append-only)
 * - soldier_holdings: État courant (mis à jour transactionnellement)
 *
 * OFFLINE SUPPORT:
 * - Les opérations sont mises en queue si offline
 * - Sync automatique au retour du réseau
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
  deleteField,
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

// Weapon inventory update to include atomically inside the transaction
interface WeaponAssignUpdate {
  weaponId: string;
  assignedTo: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    voucherNumber: string;
  };
}

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
  assignedByName?: string;
  assignedByRank?: string;
  assignedByPersonalNumber?: string;
  requestId: string; // ID stable pour l'idempotence
  weaponUpdates?: WeaponAssignUpdate[]; // Weapon inventory updates to apply atomically
}

interface ReturnEquipmentParams {
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  type: 'combat' | 'clothing';
  items: AssignmentItem[];
  returnedBy: string;
  requestId: string;
  weaponReleases?: string[]; // Weapon IDs to release atomically (set back to available)
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
  addedByName?: string;
  addedByRank?: string;
  addedByPersonalNumber?: string;
  requestId: string;
  weaponUpdates?: WeaponAssignUpdate[]; // Weapon inventory updates to apply atomically
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
  const assignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
  return deduplicateHoldings(computeHoldingsFromAssignments(assignments));
}

/**
 * Applique une opération sur les holdings existants
 */
function applyOperationToHoldings(
  currentHoldings: HoldingItem[],
  items: AssignmentItem[],
  action: 'issue' | 'add' | 'return' | 'credit' | 'storage' | 'retrieve'
): HoldingItem[] {
  type HoldingStatus = 'assigned' | 'stored';

  const parseSerials = (serial?: string): string[] =>
    serial
      ? [...new Set(serial.split(',').map(s => s.trim()).filter(Boolean))]
      : [];

  const normalizeStatus = (status?: string): HoldingStatus =>
    status === 'stored' || status === 'storage' ? 'stored' : 'assigned';

  const toKey = (equipmentId: string, status: HoldingStatus): string => `${equipmentId}__${status}`;

  const holdingsMap = new Map<string, HoldingItem>();

  const upsertEntry = (
    equipmentId: string,
    equipmentName: string,
    status: HoldingStatus
  ): HoldingItem => {
    const key = toKey(equipmentId, status);
    const existing = holdingsMap.get(key);
    if (existing) return existing;

    const created: HoldingItem = {
      equipmentId,
      equipmentName,
      quantity: 0,
      serials: [],
      status,
    };
    holdingsMap.set(key, created);
    return created;
  };

  const normalizeEntry = (entry: HoldingItem) => {
    entry.serials = [...new Set((entry.serials || []).map(s => s?.trim()).filter(Boolean))];
    if (entry.serials.length > 0) {
      entry.quantity = entry.serials.length;
    }
    entry.quantity = Math.max(0, entry.quantity || 0);
  };

  const removeIfEmpty = (equipmentId: string, status: HoldingStatus) => {
    const key = toKey(equipmentId, status);
    const entry = holdingsMap.get(key);
    if (!entry) return;
    normalizeEntry(entry);
    if (entry.quantity <= 0) {
      holdingsMap.delete(key);
    } else {
      holdingsMap.set(key, entry);
    }
  };

  const decreaseQuantity = (entry: HoldingItem, amount: number) => {
    const qty = Math.max(0, amount);
    if (qty <= 0) return;

    if (entry.serials.length > 0) {
      entry.serials = entry.serials.slice(0, Math.max(0, entry.serials.length - qty));
      entry.quantity = entry.serials.length;
      return;
    }

    entry.quantity = Math.max(0, entry.quantity - qty);
  };

  const addQuantity = (entry: HoldingItem, amount: number) => {
    const qty = Math.max(0, amount);
    if (qty <= 0) return;
    if (entry.serials.length > 0) {
      // For serial-managed items, quantity is derived from serials.
      return;
    }
    entry.quantity += qty;
  };

  const moveByQuantity = (from: HoldingItem, to: HoldingItem, requestedQty: number) => {
    const moveQty = Math.max(0, Math.min(requestedQty, from.quantity));
    if (moveQty <= 0) return;
    decreaseQuantity(from, moveQty);
    addQuantity(to, moveQty);
  };

  const removeSerialsFromEntry = (entry: HoldingItem, serialsToRemove: string[]): string[] => {
    if (serialsToRemove.length === 0) return [];
    const existing = new Set(entry.serials);
    const removed = serialsToRemove.filter(s => existing.has(s));
    if (removed.length === 0) return [];

    const removedSet = new Set(removed);
    entry.serials = entry.serials.filter(s => !removedSet.has(s));
    entry.quantity = entry.serials.length > 0 ? entry.serials.length : Math.max(0, entry.quantity - removed.length);
    return removed;
  };

  // For 'issue' we intentionally replace holdings with the provided issued set.
  if (action !== 'issue') {
    for (const holding of currentHoldings) {
      const status = normalizeStatus(holding.status);
      const target = upsertEntry(holding.equipmentId, holding.equipmentName, status);
      target.quantity += holding.quantity || 0;
      target.serials = [...target.serials, ...(holding.serials || [])];
      normalizeEntry(target);
    }
  }

  for (const item of items) {
    const equipmentId = item.equipmentId;
    const equipmentName = item.equipmentName;
    const itemSerials = parseSerials(item.serial);
    const itemStatusHint = normalizeStatus(item.status);

    if (action === 'issue' || action === 'add') {
      const assigned = upsertEntry(equipmentId, equipmentName, 'assigned');
      assigned.status = 'assigned';

      if (itemSerials.length > 0) {
        const toAdd = itemSerials.filter(s => !assigned.serials.includes(s));
        assigned.serials = [...assigned.serials, ...toAdd];
      } else {
        addQuantity(assigned, item.quantity);
      }

      normalizeEntry(assigned);
      removeIfEmpty(equipmentId, 'stored');
      continue;
    }

    if (action === 'storage') {
      const assigned = upsertEntry(equipmentId, equipmentName, 'assigned');
      const stored = upsertEntry(equipmentId, equipmentName, 'stored');
      assigned.status = 'assigned';
      stored.status = 'stored';

      if (itemSerials.length > 0) {
        const moved = removeSerialsFromEntry(assigned, itemSerials);
        if (moved.length > 0) {
          const newToStored = moved.filter(s => !stored.serials.includes(s));
          stored.serials = [...stored.serials, ...newToStored];
        } else {
          // Fallback for inconsistent data (no serials tracked in assigned): move by quantity.
          moveByQuantity(assigned, stored, item.quantity || itemSerials.length);
        }
      } else {
        moveByQuantity(assigned, stored, item.quantity);
      }

      normalizeEntry(assigned);
      normalizeEntry(stored);
      removeIfEmpty(equipmentId, 'assigned');
      removeIfEmpty(equipmentId, 'stored');
      continue;
    }

    if (action === 'retrieve') {
      const assigned = upsertEntry(equipmentId, equipmentName, 'assigned');
      const stored = upsertEntry(equipmentId, equipmentName, 'stored');
      assigned.status = 'assigned';
      stored.status = 'stored';

      if (itemSerials.length > 0) {
        const moved = removeSerialsFromEntry(stored, itemSerials);
        if (moved.length > 0) {
          const newToAssigned = moved.filter(s => !assigned.serials.includes(s));
          assigned.serials = [...assigned.serials, ...newToAssigned];
        } else {
          moveByQuantity(stored, assigned, item.quantity || itemSerials.length);
        }
      } else {
        moveByQuantity(stored, assigned, item.quantity);
      }

      normalizeEntry(assigned);
      normalizeEntry(stored);
      removeIfEmpty(equipmentId, 'assigned');
      removeIfEmpty(equipmentId, 'stored');
      continue;
    }

    if (action === 'return' || action === 'credit') {
      const assigned = upsertEntry(equipmentId, equipmentName, 'assigned');
      const stored = upsertEntry(equipmentId, equipmentName, 'stored');

      if (itemSerials.length > 0) {
        // Remove serials from the hinted bucket first, then fallback to the other one.
        const first = itemStatusHint === 'stored' ? stored : assigned;
        const second = first === stored ? assigned : stored;
        let remaining = [...itemSerials];

        const removedFirst = removeSerialsFromEntry(first, remaining);
        if (removedFirst.length > 0) {
          const removedSet = new Set(removedFirst);
          remaining = remaining.filter(s => !removedSet.has(s));
        }
        if (remaining.length > 0) {
          removeSerialsFromEntry(second, remaining);
        }
      } else {
        let remainingQty = Math.max(0, item.quantity);
        const ordered = itemStatusHint === 'stored'
          ? [stored, assigned]
          : [assigned, stored];

        for (const entry of ordered) {
          if (remainingQty <= 0) break;
          const before = entry.quantity;
          decreaseQuantity(entry, remainingQty);
          const removed = Math.max(0, before - entry.quantity);
          remainingQty -= removed;
        }
      }

      normalizeEntry(assigned);
      normalizeEntry(stored);
      removeIfEmpty(equipmentId, 'assigned');
      removeIfEmpty(equipmentId, 'stored');
    }
  }

  return Array.from(holdingsMap.values())
    .map(entry => ({
      ...entry,
      status: normalizeStatus(entry.status),
      serials: [...new Set((entry.serials || []).map(s => s?.trim()).filter(Boolean))],
      quantity: entry.serials?.length > 0 ? entry.serials.length : Math.max(0, entry.quantity || 0),
    }))
    .filter(entry => entry.quantity > 0);
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

  // IMPORTANT: Filtrer par soldierId si sp?cifi?
  if (soldierId) {
    cached = cached.filter(a => a.soldierId === soldierId);
  }

  // OPTIMIS?: getPendingOperations est maintenant synchrone (cache m?moire)
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
    assignedByName,
    assignedByRank,
    assignedByPersonalNumber,
    requestId,
    weaponUpdates = [],
  } = params;

  return await runTransaction(db, async (transaction: Transaction) => {
    // ── READS FIRST (Firestore constraint) ──────────────────────────────────

    // 0. Vérifier l'idempotence (si le requestId a déjà été traité)
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire soldier_holdings (état courant)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    // 2. Lire les documents weapons_inventory concernés (nécessaire avant tout write)
    const weaponRefs = weaponUpdates.map(wu => doc(db, 'weapons_inventory', wu.weaponId));
    await Promise.all(weaponRefs.map(ref => transaction.get(ref)));

    // ── WRITES ──────────────────────────────────────────────────────────────

    // 3. Créer l'assignment (historique immuable avec ID stable)
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
    if (assignedByName) assignmentData.assignedByName = assignedByName;
    if (assignedByRank) assignmentData.assignedByRank = assignedByRank;
    if (assignedByPersonalNumber) assignmentData.assignedByPersonalNumber = assignedByPersonalNumber;

    transaction.set(assignmentRef, assignmentData);

    // 4. Mettre à jour soldier_holdings
    const currentHoldings: HoldingItem[] = holdingSnap.exists()
      ? (holdingSnap.data().items || [])
      : [];

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

    // 5. Mettre à jour weapons_inventory atomiquement (même transaction)
    for (let i = 0; i < weaponUpdates.length; i++) {
      const wu = weaponUpdates[i];
      transaction.update(weaponRefs[i], {
        status: 'assigned',
        assignedTo: {
          soldierId: wu.assignedTo.soldierId,
          soldierName: wu.assignedTo.soldierName,
          soldierPersonalNumber: wu.assignedTo.soldierPersonalNumber,
          voucherNumber: wu.assignedTo.voucherNumber,
          assignedDate: Timestamp.now(),
        },
      });
    }

    return assignmentRef.id;
  });
}

/**
 * Return equipment from a soldier (�����)
 * Transaction atomique: assignment + soldier_holdings
 * Transaction atomique: assignment + soldier_holdings + weapons_inventory (via weaponReleases pré-résolus)
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
    weaponReleases = [],
  } = params;

  return await runTransaction(db, async (transaction: Transaction) => {
    // ── READS FIRST (Firestore constraint) ──────────────────────────────────

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

    // 2. Lire les documents weapons_inventory à libérer
    const weaponRefs = weaponReleases.map(id => doc(db, 'weapons_inventory', id));
    await Promise.all(weaponRefs.map(ref => transaction.get(ref)));

    // ── WRITES ──────────────────────────────────────────────────────────────

    // 3. Créer l'assignment (historique - action 'credit')
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

    // 4. Mettre à jour soldier_holdings
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

    // 5. Libérer les armes dans weapons_inventory atomiquement
    for (const weaponRef of weaponRefs) {
      transaction.update(weaponRef, {
        status: 'available',
        assignedTo: deleteField(),
        storageDate: deleteField(),
      });
    }

    return assignmentRef.id;
  });
}

/**
 * Add equipment to a soldier's holdings (�����)
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
    addedByName,
    addedByRank,
    addedByPersonalNumber,
    requestId,
    weaponUpdates = [],
  } = params;

  return await runTransaction(db, async (transaction: Transaction) => {
    // ── READS FIRST (Firestore constraint) ──────────────────────────────────

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

    // 2. Lire les documents weapons_inventory concernés
    const weaponRefs = weaponUpdates.map(wu => doc(db, 'weapons_inventory', wu.weaponId));
    await Promise.all(weaponRefs.map(ref => transaction.get(ref)));

    // ── WRITES ──────────────────────────────────────────────────────────────

    // 3. Créer l'assignment (historique)
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
    if (addedByName) assignmentData.assignedByName = addedByName;
    if (addedByRank) assignmentData.assignedByRank = addedByRank;
    if (addedByPersonalNumber) assignmentData.assignedByPersonalNumber = addedByPersonalNumber;

    transaction.set(assignmentRef, assignmentData);

    // 4. Mettre à jour soldier_holdings
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

    // 5. Mettre à jour weapons_inventory atomiquement
    for (let i = 0; i < weaponUpdates.length; i++) {
      const wu = weaponUpdates[i];
      transaction.update(weaponRefs[i], {
        status: 'assigned',
        assignedTo: {
          soldierId: wu.assignedTo.soldierId,
          soldierName: wu.assignedTo.soldierName,
          soldierPersonalNumber: wu.assignedTo.soldierPersonalNumber,
          voucherNumber: wu.assignedTo.voucherNumber,
          assignedDate: Timestamp.now(),
        },
      });
    }

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
  let returnedHoldings: HoldingItem[] = [];

  // Transaction append-only: on ecrit un credit dans assignments + mise a jour soldier_holdings uniquement.

  const assignmentId = await runTransaction(db, async (transaction: Transaction) => {
    // 0. Idempotence
    const assignmentRef = doc(db, 'assignments', requestId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (assignmentSnap.exists()) {
      return assignmentRef.id;
    }

    // 1. Lire les holdings actuels (READ)
    const holdingId = `${soldierId}_${type}`;
    const holdingRef = doc(db, 'soldier_holdings', holdingId);
    const holdingSnap = await transaction.get(holdingRef);

    if (!holdingSnap.exists() || !holdingSnap.data().items || holdingSnap.data().items.length === 0) {
      throw new Error('No holdings to credit for this soldier');
    }

    const currentHoldings: HoldingItem[] = holdingSnap.data().items;
    returnedHoldings = currentHoldings; // Capture for weapon release after transaction

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
      soldierName,
      soldierPersonalNumber,
      type,
      items: [],
      outstandingCount: 0,
      status: 'CLOSED',
      lastUpdated: Timestamp.now(),
    });
    // Append-only: conserver l'historique assignments.
    // Aucun nettoyage/suppression des anciens 'issue' et aucune ecriture legacy soldier_equipment.

    return assignmentRef.id;
  });

  // Mise à jour de l'inventaire des armes APRÈS la transaction réussie
  if (type === 'combat' && returnedHoldings.length > 0) {
    await Promise.all(returnedHoldings.map(async (item) => {
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
 * Déduplique les items en fusionnant les quantités et serials.
 * Gère 2 cas:
 *  1) Même equipmentId → fusion directe
 *  2) Même equipmentName + serials en commun mais equipmentId différents
 *     (ex: un vrai ID "1ejpa..." et un ID fabriqué "WEAPON_מקלע מאג")
 *     → on garde le vrai ID (celui qui ne commence pas par "WEAPON_")
 */
function deduplicateHoldings(items: HoldingItem[]): HoldingItem[] {
  const toStatus = (status?: string): 'assigned' | 'stored' =>
    status === 'stored' || status === 'storage' ? 'stored' : 'assigned';
  const toKey = (equipmentId: string, status: 'assigned' | 'stored') => `${equipmentId}__${status}`;

  const holdingsMap = new Map<string, HoldingItem>();

  for (const item of items) {
    const status = toStatus(item.status);
    const itemSerials = [...new Set((item.serials || []).map(s => s?.trim()).filter(Boolean))];
    const itemQty = itemSerials.length > 0 ? itemSerials.length : Math.max(0, item.quantity || 0);

    // Merge by exact key first.
    let mergeKey: string | undefined;
    const exactKey = toKey(item.equipmentId, status);
    if (holdingsMap.has(exactKey)) {
      mergeKey = exactKey;
    } else {
      // Legacy merge: same status + same name + overlapping serials, even with different IDs.
      for (const [key, existing] of holdingsMap) {
        if (toStatus(existing.status) !== status) continue;
        if (existing.equipmentName !== item.equipmentName) continue;
        if (itemSerials.length === 0 || existing.serials.length === 0) continue;
        const hasCommonSerial = itemSerials.some(s => existing.serials.includes(s));
        if (hasCommonSerial) {
          mergeKey = key;
          break;
        }
      }
    }

    if (!mergeKey) {
      holdingsMap.set(exactKey, {
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        serials: itemSerials,
        quantity: itemQty,
        status,
      });
      continue;
    }

    const existing = holdingsMap.get(mergeKey)!;
    const mergedSerials = [...new Set([...(existing.serials || []), ...itemSerials])];

    // Prefer real (non synthetic) ID, but keep status boundary.
    const realId = existing.equipmentId.startsWith('WEAPON_') ? item.equipmentId : existing.equipmentId;
    const mergedQty = mergedSerials.length > 0
      ? mergedSerials.length
      : Math.max(0, (existing.quantity || 0) + itemQty);

    holdingsMap.delete(mergeKey);
    holdingsMap.set(toKey(realId, status), {
      ...existing,
      equipmentId: realId,
      status,
      serials: mergedSerials,
      quantity: mergedQty,
    });
  }

  return Array.from(holdingsMap.values()).filter(item => (item.quantity || 0) > 0);
}

/**
 * REPAIR ONLY: Force save current deduplicated holdings to DB
 * Utilise la logique de lecture (qui déduplique) pour écraser les données corrompues
 */
export async function repairSoldierHoldings(soldierId: string, type: 'combat' | 'clothing'): Promise<void> {
  // 1. Lire les holdings (la lecture applique déjà deduplicateHoldings)
  const cleanItems = await getCurrentHoldings(soldierId, type);

  // 2. Calculer le total
  const outstandingCount = cleanItems.reduce((sum, item) => sum + item.quantity, 0);

  // 3. Écraser dans la base
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
 * Inclut une déduplication automatique pour corriger les données historiques
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
      // Dédupliquer automatiquement pour corriger les données historiques
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
 * Get all holdings for a type (utilisé pour les rapports de stock globaux)
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
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const items = Array.isArray(data.items) ? data.items as HoldingItem[] : [];
      return {
        ...data,
        items: deduplicateHoldings(items),
      };
    });
  } catch (error) {
    console.warn('[TransactionalAssignment] getAllHoldings failed, using offline cache:', error);
    const assignments = await getAssignmentsForHoldings(type);
    return computeHoldingsBySoldier(assignments, type);
  }
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

// ============================================
// OFFLINE-AWARE WRAPPERS
// ============================================

/**
 * Wrapper pour issueEquipment avec support offline
 * AMÉLIORÉ: Attrape les erreurs réseau et met en queue automatiquement
 */
async function issueEquipmentOffline(params: IssueEquipmentParams): Promise<string> {
  if (!isOnline()) {
    console.log('[TransactionalAssignment] Offline - Queuing issue operation');
    return await offlineService.queue('issue', params);
  }

  try {
    return await runWithTimeout(issueEquipment(params), 2500);
  } catch (error: any) {
    // Si c'est une erreur réseau, mettre en queue au lieu d'échouer
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
 * Tente toujours Firebase directement - isOnline() peut être un faux négatif (NetInfo peu fiable).
 * L'erreur "connexion requise" n'est levée que si Firebase confirme l'échec réseau.
 */
async function returnEquipmentOffline(params: ReturnEquipmentParams): Promise<string> {
  try {
    return await runWithTimeout(returnEquipment(params), 5000);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error) || !isOnline()) {
      throw new Error('זיכוי דורש חיבור לאינטרנט');
    }
    throw error;
  }
}

/**
 * Wrapper pour addEquipment avec support offline
 * AMÉLIORÉ: Attrape les erreurs réseau et met en queue automatiquement
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
 * AMÉLIORÉ: Attrape les erreurs réseau et met en queue automatiquement
 */
async function creditEquipmentOffline(
  soldierId: string,
  soldierName: string,
  soldierPersonalNumber: string,
  type: 'combat' | 'clothing',
  creditedBy: string,
  requestId: string
): Promise<string> {
  try {
    return await runWithTimeout(creditEquipment(soldierId, soldierName, soldierPersonalNumber, type, creditedBy, requestId), 5000);
  } catch (error: any) {
    if (isNetworkOrTimeoutError(error) || !isOnline()) {
      throw new Error('זיכוי דורש חיבור לאינטרנט');
    }
    throw error;
  }
}

/**
 * Wrapper pour storageEquipment avec support offline
 * AMÉLIORÉ: Attrape les erreurs réseau et met en queue automatiquement
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
 * AMÉLIORÉ: Attrape les erreurs réseau et met en queue automatiquement
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
// Cela permet au service offline de rejouer les opérations quand on revient online
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
  // Fonctions avec support offline (recommandé)
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
