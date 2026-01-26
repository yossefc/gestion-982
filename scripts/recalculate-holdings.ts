/**
 * recalculate-holdings.ts
 *
 * Script pour recalculer tous les soldier_holdings depuis les assignments (source de vérité).
 * Résout l'incohérence entre soldier_holdings et soldier_equipment.
 *
 * Usage:
 *   npx ts-node scripts/recalculate-holdings.ts --dry-run
 *   npx ts-node scripts/recalculate-holdings.ts --apply
 *   npx ts-node scripts/recalculate-holdings.ts --apply --soldier-id ABC123
 */

import {
  getFirestore,
  collection,
  getDocs,
  getDocsFromServer,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import * as fs from 'fs';
import * as path from 'path';

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBRsF-2Y5F0Xdvq3zO8hI5eN6kW7tJ9mLc",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gestion-982.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "gestion-982",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gestion-982.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================
// TYPES
// ============================================

interface Assignment {
  id: string;
  soldierId: string;
  type: 'combat' | 'clothing';
  action: 'issue' | 'add' | 'return' | 'credit' | 'storage' | 'retrieve';
  items: AssignmentItem[];
  timestamp: any;
  status?: string;
}

interface AssignmentItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
}

interface HoldingItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
}

interface SoldierHoldings {
  id: string;
  soldierId: string;
  type: 'combat' | 'clothing';
  items: HoldingItem[];
  outstandingCount: number;
  status: 'OPEN' | 'CLOSED';
  lastUpdated: any;
}

interface RecalculationReport {
  timestamp: string;
  mode: 'dry-run' | 'apply';
  soldierId?: string;
  results: RecalculationResult[];
  summary: {
    totalSoldiers: number;
    holdingsRecalculated: number;
    inconsistenciesFound: number;
    errors: string[];
  };
}

interface RecalculationResult {
  soldierId: string;
  soldierName?: string;
  type: 'combat' | 'clothing';
  before: {
    items: HoldingItem[];
    outstandingCount: number;
  } | null;
  after: {
    items: HoldingItem[];
    outstandingCount: number;
  };
  inconsistency: boolean;
  difference: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function createBackupFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-backup-${timestamp}.json`;
}

async function backupCollection(collectionName: string): Promise<void> {
  console.log(`📦 Backing up collection: ${collectionName}...`);

  const snapshot = await getDocsFromServer(collection(db, collectionName));
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = createBackupFilename(collectionName);
  const filepath = path.join(backupDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`✅ Backup saved: ${filepath} (${data.length} items)`);
}

// ============================================
// HOLDINGS CALCULATION LOGIC
// ============================================

/**
 * Calcule les holdings actuels d'un soldat depuis l'historique des assignments
 * (même logique que assignmentService.calculateCurrentHoldings)
 */
async function calculateCurrentHoldings(
  soldierId: string,
  type: 'combat' | 'clothing'
): Promise<HoldingItem[]> {
  // Récupérer tous les assignments du soldat pour ce type, triés par timestamp
  const assignmentsQuery = query(
    collection(db, 'assignments'),
    where('soldierId', '==', soldierId),
    where('type', '==', type),
    orderBy('timestamp', 'asc')
  );

  const snapshot = await getDocs(assignmentsQuery);
  const assignments: Assignment[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Assignment));

  // Calculer l'état courant en appliquant toutes les opérations
  const holdings = new Map<string, HoldingItem>();

  for (const assignment of assignments) {
    const action = assignment.action;

    for (const item of assignment.items) {
      const key = item.equipmentId;
      const current = holdings.get(key) || {
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        quantity: 0,
      };

      // Appliquer l'action
      if (action === 'issue' || action === 'add' || action === 'retrieve') {
        current.quantity += item.quantity;
      } else if (action === 'return' || action === 'credit' || action === 'storage') {
        current.quantity -= item.quantity;
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
 * Récupère les holdings existants pour un soldat
 */
async function getExistingHoldings(
  soldierId: string,
  type: 'combat' | 'clothing'
): Promise<SoldierHoldings | null> {
  const holdingId = `${soldierId}_${type}`;
  const docRef = doc(db, 'soldier_holdings', holdingId);
  const docSnap = await getDocsFromServer(docRef);

  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as SoldierHoldings;
  }

  return null;
}

/**
 * Récupère tous les soldats uniques depuis les assignments
 */
async function getAllSoldiersFromAssignments(): Promise<Set<string>> {
  const snapshot = await getDocsFromServer(collection(db, 'assignments'));
  const soldierIds = new Set<string>();

  for (const assignmentDoc of snapshot.docs) {
    const data = assignmentDoc.data();
    if (data.soldierId) {
      soldierIds.add(data.soldierId);
    }
  }

  return soldierIds;
}

/**
 * Récupère le nom d'un soldat
 */
async function getSoldierName(soldierId: string): Promise<string | undefined> {
  try {
    const docRef = doc(db, 'soldiers', soldierId);
    const docSnap = await getDocsFromServer(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }
  } catch (error) {
    // Ignorer les erreurs
  }

  return undefined;
}

/**
 * Recalcule les holdings pour un soldat et un type
 */
async function recalculateHoldingsForSoldier(
  soldierId: string,
  type: 'combat' | 'clothing',
  dryRun: boolean
): Promise<RecalculationResult> {
  const soldierName = await getSoldierName(soldierId);
  const result: RecalculationResult = {
    soldierId,
    soldierName,
    type,
    before: null,
    after: { items: [], outstandingCount: 0 },
    inconsistency: false,
    difference: 0,
    status: 'pending',
  };

  try {
    // 1. Récupérer les holdings existants
    const existing = await getExistingHoldings(soldierId, type);

    if (existing) {
      result.before = {
        items: existing.items || [],
        outstandingCount: existing.outstandingCount || 0,
      };
    }

    // 2. Calculer les holdings depuis les assignments
    const calculatedItems = await calculateCurrentHoldings(soldierId, type);
    const calculatedCount = calculatedItems.reduce((sum, item) => sum + item.quantity, 0);

    result.after = {
      items: calculatedItems,
      outstandingCount: calculatedCount,
    };

    // 3. Détecter l'incohérence
    if (existing) {
      const beforeCount = result.before?.outstandingCount || 0;
      const afterCount = calculatedCount;

      if (beforeCount !== afterCount) {
        result.inconsistency = true;
        result.difference = afterCount - beforeCount;
      }
    }

    // 4. Mettre à jour si pas dry-run
    if (!dryRun) {
      const holdingId = `${soldierId}_${type}`;

      if (calculatedItems.length > 0) {
        // Créer ou mettre à jour
        await setDoc(doc(db, 'soldier_holdings', holdingId), {
          soldierId,
          type,
          items: calculatedItems,
          outstandingCount: calculatedCount,
          status: 'OPEN',
          lastUpdated: Timestamp.now(),
        });
      } else {
        // Supprimer si vide
        if (existing) {
          await deleteDoc(doc(db, 'soldier_holdings', holdingId));
        }
      }
    }

    result.status = 'success';
  } catch (error: any) {
    result.status = 'error';
    result.error = error.message;
  }

  return result;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const soldierIdArg = args.find(arg => arg.startsWith('--soldier-id='));
  const targetSoldierId = soldierIdArg ? soldierIdArg.split('=')[1] : undefined;

  console.log('\n' + '='.repeat(60));
  console.log('🔄 SOLDIER HOLDINGS RECALCULATION SCRIPT');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes)' : 'APPLY (making changes!)'}`);
  if (targetSoldierId) {
    console.log(`Target: Single soldier (${targetSoldierId})`);
  } else {
    console.log(`Target: All soldiers`);
  }
  console.log('='.repeat(60));

  const report: RecalculationReport = {
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    soldierId: targetSoldierId,
    results: [],
    summary: {
      totalSoldiers: 0,
      holdingsRecalculated: 0,
      inconsistenciesFound: 0,
      errors: [],
    },
  };

  try {
    // Backup avant modification
    if (!dryRun) {
      await backupCollection('soldier_holdings');
    }

    // Récupérer la liste des soldats
    let soldierIds: Set<string>;

    if (targetSoldierId) {
      soldierIds = new Set([targetSoldierId]);
    } else {
      soldierIds = await getAllSoldiersFromAssignments();
    }

    console.log(`\n📊 Found ${soldierIds.size} soldiers with assignments`);
    report.summary.totalSoldiers = soldierIds.size;

    // Recalculer pour chaque soldat et chaque type
    let processed = 0;

    for (const soldierId of soldierIds) {
      processed++;
      console.log(`\n[${ processed}/${soldierIds.size}] Processing soldier: ${soldierId}`);

      // Combat equipment
      console.log(`   Recalculating combat holdings...`);
      const combatResult = await recalculateHoldingsForSoldier(soldierId, 'combat', dryRun);
      report.results.push(combatResult);

      if (combatResult.status === 'success') {
        console.log(`   ✅ Combat: ${combatResult.after.outstandingCount} items`);
        if (combatResult.inconsistency) {
          console.log(`      ⚠️  Inconsistency: ${combatResult.difference > 0 ? '+' : ''}${combatResult.difference} items`);
          report.summary.inconsistenciesFound++;
        }
        report.summary.holdingsRecalculated++;
      } else {
        console.log(`   ❌ Combat: Error - ${combatResult.error}`);
        report.summary.errors.push(`${soldierId} (combat): ${combatResult.error}`);
      }

      // Clothing equipment
      console.log(`   Recalculating clothing holdings...`);
      const clothingResult = await recalculateHoldingsForSoldier(soldierId, 'clothing', dryRun);
      report.results.push(clothingResult);

      if (clothingResult.status === 'success') {
        console.log(`   ✅ Clothing: ${clothingResult.after.outstandingCount} items`);
        if (clothingResult.inconsistency) {
          console.log(`      ⚠️  Inconsistency: ${clothingResult.difference > 0 ? '+' : ''}${clothingResult.difference} items`);
          report.summary.inconsistenciesFound++;
        }
        report.summary.holdingsRecalculated++;
      } else {
        console.log(`   ❌ Clothing: Error - ${clothingResult.error}`);
        report.summary.errors.push(`${soldierId} (clothing): ${clothingResult.error}`);
      }
    }

    // Sauvegarder le rapport
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFilename = `recalculation-report-${dryRun ? 'dry-run' : 'apply'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const reportPath = path.join(reportDir, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📊 RECALCULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total soldiers processed: ${report.summary.totalSoldiers}`);
    console.log(`Holdings recalculated: ${report.summary.holdingsRecalculated}`);
    console.log(`Inconsistencies found: ${report.summary.inconsistenciesFound}`);
    console.log(`Errors: ${report.summary.errors.length}`);
    console.log(`\n📄 Full report saved: ${reportPath}`);
    console.log('='.repeat(60));

    if (dryRun) {
      console.log('\n💡 This was a DRY-RUN. No changes were made.');
      console.log('   To apply changes, run with --apply flag');
    } else {
      console.log('\n✅ Recalculation completed!');
      console.log('   soldier_holdings collection has been updated from assignments');
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error);
    report.summary.errors.push(error.message);
    process.exit(1);
  }
}

// Exécuter
main().then(() => {
  console.log('\n✅ Script finished successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
