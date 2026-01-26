/**
 * migrate-legacy-collections.ts
 *
 * Script de migration pour fusionner les collections legacy vers modernes:
 * - equipment_clothing → clothingEquipment
 * - equipment_combat → combatEquipment
 *
 * Usage:
 *   npx ts-node scripts/migrate-legacy-collections.ts --dry-run
 *   npx ts-node scripts/migrate-legacy-collections.ts --apply
 *   npx ts-node scripts/migrate-legacy-collections.ts --apply --limit 10
 */

import {
  getFirestore,
  collection,
  getDocs,
  getDocsFromServer,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import * as fs from 'fs';
import * as path from 'path';

// Configuration Firebase (à adapter selon votre config)
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

interface Equipment {
  id: string;
  name: string;
  nameKey?: string;
  [key: string]: any;
}

interface MigrationReport {
  timestamp: string;
  mode: 'dry-run' | 'apply';
  actions: MigrationAction[];
  summary: {
    totalLegacyItems: number;
    totalModernItems: number;
    duplicatesFound: number;
    itemsMerged: number;
    itemsMigrated: number;
    itemsDeleted: number;
    errors: string[];
  };
}

interface MigrationAction {
  type: 'merge' | 'migrate' | 'delete' | 'skip';
  collection: string;
  reason: string;
  legacyId?: string;
  modernId?: string;
  itemName?: string;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
// MIGRATION LOGIC
// ============================================

async function detectDuplicates(
  legacyCollection: string,
  modernCollection: string
): Promise<{ legacy: Equipment[]; modern: Equipment[]; duplicates: Array<{ legacy: Equipment; modern: Equipment }> }> {
  console.log(`\n🔍 Detecting duplicates between ${legacyCollection} and ${modernCollection}...`);

  const legacySnapshot = await getDocsFromServer(collection(db, legacyCollection));
  const modernSnapshot = await getDocsFromServer(collection(db, modernCollection));

  const legacyItems: Equipment[] = legacySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as any,
  }));

  const modernItems: Equipment[] = modernSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as any,
  }));

  console.log(`📊 Legacy items: ${legacyItems.length}`);
  console.log(`📊 Modern items: ${modernItems.length}`);

  // Détecter les doublons par normalisation des noms
  const duplicates: Array<{ legacy: Equipment; modern: Equipment }> = [];

  for (const legacyItem of legacyItems) {
    const legacyNameKey = normalizeText(legacyItem.name);

    for (const modernItem of modernItems) {
      const modernNameKey = modernItem.nameKey || normalizeText(modernItem.name);

      if (legacyNameKey === modernNameKey) {
        duplicates.push({ legacy: legacyItem, modern: modernItem });
        console.log(`   🔗 Duplicate found: "${legacyItem.name}" (Legacy: ${legacyItem.id} → Modern: ${modernItem.id})`);
      }
    }
  }

  console.log(`📌 Found ${duplicates.length} duplicates`);

  return { legacy: legacyItems, modern: modernItems, duplicates };
}

async function checkAssignmentReferences(equipmentId: string): Promise<number> {
  // Vérifier si cet ID est utilisé dans les assignments
  const assignmentsRef = collection(db, 'assignments');
  const snapshot = await getDocs(assignmentsRef);

  let count = 0;
  for (const assignmentDoc of snapshot.docs) {
    const data = assignmentDoc.data();
    const items = data.items || [];

    for (const item of items) {
      if (item.equipmentId === equipmentId) {
        count++;
      }
    }
  }

  return count;
}

async function migrateEquipmentReferences(
  oldId: string,
  newId: string,
  dryRun: boolean
): Promise<number> {
  const assignmentsRef = collection(db, 'assignments');
  const snapshot = await getDocs(assignmentsRef);

  let updatedCount = 0;

  for (const assignmentDoc of snapshot.docs) {
    const data = assignmentDoc.data();
    const items = data.items || [];
    let modified = false;

    const updatedItems = items.map((item: any) => {
      if (item.equipmentId === oldId) {
        modified = true;
        return { ...item, equipmentId: newId };
      }
      return item;
    });

    if (modified) {
      updatedCount++;
      if (!dryRun) {
        await setDoc(doc(db, 'assignments', assignmentDoc.id), {
          ...data,
          items: updatedItems,
        });
      }
    }
  }

  return updatedCount;
}

async function migrateClothingEquipment(dryRun: boolean, limit?: number): Promise<MigrationAction[]> {
  const actions: MigrationAction[] = [];

  console.log('\n' + '='.repeat(60));
  console.log('📋 CLOTHING EQUIPMENT MIGRATION');
  console.log('='.repeat(60));

  // 1. Backup
  if (!dryRun) {
    await backupCollection('equipment_clothing');
    await backupCollection('clothingEquipment');
  }

  // 2. Détecter les doublons
  const { legacy, modern, duplicates } = await detectDuplicates(
    'equipment_clothing',
    'clothingEquipment'
  );

  // 3. Traiter les doublons (garder moderne, supprimer legacy)
  let processed = 0;
  for (const { legacy: legacyItem, modern: modernItem } of duplicates) {
    if (limit && processed >= limit) {
      console.log(`⚠️  Limit reached (${limit}), stopping...`);
      break;
    }

    // Vérifier si l'ID legacy est utilisé dans des assignments
    const assignmentCount = await checkAssignmentReferences(legacyItem.id);

    const action: MigrationAction = {
      type: 'merge',
      collection: 'equipment_clothing → clothingEquipment',
      reason: `Duplicate name: "${legacyItem.name}"`,
      legacyId: legacyItem.id,
      modernId: modernItem.id,
      itemName: legacyItem.name,
      status: 'pending',
    };

    console.log(`\n   Processing: ${legacyItem.name}`);
    console.log(`   Legacy ID: ${legacyItem.id} → Modern ID: ${modernItem.id}`);
    console.log(`   Assignments using legacy ID: ${assignmentCount}`);

    if (!dryRun) {
      try {
        // Migrer les références dans assignments si nécessaire
        if (assignmentCount > 0) {
          const updated = await migrateEquipmentReferences(legacyItem.id, modernItem.id, false);
          console.log(`   ✅ Updated ${updated} assignments`);
        }

        // Supprimer l'item legacy
        await deleteDoc(doc(db, 'equipment_clothing', legacyItem.id));
        console.log(`   ✅ Deleted legacy item`);

        action.status = 'success';
      } catch (error: any) {
        console.error(`   ❌ Error:`, error.message);
        action.status = 'error';
        action.error = error.message;
      }
    } else {
      console.log(`   [DRY-RUN] Would migrate ${assignmentCount} assignments and delete legacy item`);
      action.status = 'pending';
    }

    actions.push(action);
    processed++;
  }

  // 4. Migrer les items uniques de legacy (ceux qui n'ont pas de match dans moderne)
  const duplicateLegacyIds = new Set(duplicates.map(d => d.legacy.id));
  const uniqueLegacyItems = legacy.filter(item => !duplicateLegacyIds.has(item.id));

  console.log(`\n📦 Unique legacy items to migrate: ${uniqueLegacyItems.length}`);

  for (const item of uniqueLegacyItems) {
    if (limit && processed >= limit) {
      console.log(`⚠️  Limit reached (${limit}), stopping...`);
      break;
    }

    const action: MigrationAction = {
      type: 'migrate',
      collection: 'equipment_clothing → clothingEquipment',
      reason: 'Unique item in legacy',
      legacyId: item.id,
      itemName: item.name,
      status: 'pending',
    };

    console.log(`\n   Migrating unique item: ${item.name} (${item.id})`);

    if (!dryRun) {
      try {
        // Créer dans clothingEquipment avec nameKey
        const nameKey = normalizeText(item.name);
        await setDoc(doc(db, 'clothingEquipment', item.id), {
          name: item.name,
          nameKey,
          yamach: item.yamach || 0,
        });
        console.log(`   ✅ Migrated to clothingEquipment`);

        // Supprimer de legacy
        await deleteDoc(doc(db, 'equipment_clothing', item.id));
        console.log(`   ✅ Deleted from legacy`);

        action.status = 'success';
        action.modernId = item.id;
      } catch (error: any) {
        console.error(`   ❌ Error:`, error.message);
        action.status = 'error';
        action.error = error.message;
      }
    } else {
      console.log(`   [DRY-RUN] Would migrate to clothingEquipment`);
    }

    actions.push(action);
    processed++;
  }

  return actions;
}

async function detectIntraCollectionDuplicates(): Promise<MigrationAction[]> {
  const actions: MigrationAction[] = [];

  console.log('\n' + '='.repeat(60));
  console.log('🔍 DETECTING INTRA-COLLECTION DUPLICATES');
  console.log('='.repeat(60));

  const snapshot = await getDocsFromServer(collection(db, 'clothingEquipment'));
  const items: Equipment[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as any,
  }));

  // Grouper par nameKey
  const nameKeyMap = new Map<string, Equipment[]>();

  for (const item of items) {
    const nameKey = item.nameKey || normalizeText(item.name);
    if (!nameKeyMap.has(nameKey)) {
      nameKeyMap.set(nameKey, []);
    }
    nameKeyMap.get(nameKey)!.push(item);
  }

  // Détecter les groupes avec plus d'un item
  for (const [nameKey, group] of nameKeyMap.entries()) {
    if (group.length > 1) {
      console.log(`\n⚠️  Duplicate found: "${group[0].name}" (${group.length} instances)`);

      for (let i = 0; i < group.length; i++) {
        console.log(`   [${i}] ID: ${group[i].id}`);
      }

      // Recommandation: garder le premier, supprimer les autres
      const keep = group[0];
      const toDelete = group.slice(1);

      console.log(`   ✅ Recommendation: Keep ${keep.id}, delete ${toDelete.map(i => i.id).join(', ')}`);

      for (const item of toDelete) {
        actions.push({
          type: 'delete',
          collection: 'clothingEquipment',
          reason: `Intra-collection duplicate of "${item.name}"`,
          legacyId: item.id,
          modernId: keep.id,
          itemName: item.name,
          status: 'pending',
        });
      }
    }
  }

  return actions;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  console.log('\n' + '='.repeat(60));
  console.log('🚀 LEGACY COLLECTIONS MIGRATION SCRIPT');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes)' : 'APPLY (making changes!)'}`);
  if (limit) {
    console.log(`Limit: ${limit} items`);
  }
  console.log('='.repeat(60));

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    actions: [],
    summary: {
      totalLegacyItems: 0,
      totalModernItems: 0,
      duplicatesFound: 0,
      itemsMerged: 0,
      itemsMigrated: 0,
      itemsDeleted: 0,
      errors: [],
    },
  };

  try {
    // Étape 1: Migrer equipment_clothing → clothingEquipment
    const clothingActions = await migrateClothingEquipment(dryRun, limit);
    report.actions.push(...clothingActions);

    // Étape 2: Détecter et signaler les doublons intra-collection
    const intraActions = await detectIntraCollectionDuplicates();
    report.actions.push(...intraActions);

    // Calculer le résumé
    report.summary.duplicatesFound = report.actions.filter(a => a.type === 'merge').length;
    report.summary.itemsMigrated = report.actions.filter(a => a.type === 'migrate').length;
    report.summary.itemsDeleted = report.actions.filter(a => a.type === 'delete').length;
    report.summary.itemsMerged = report.actions.filter(a => a.type === 'merge' && a.status === 'success').length;
    report.summary.errors = report.actions.filter(a => a.status === 'error').map(a => a.error || 'Unknown error');

    // Sauvegarder le rapport
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFilename = `migration-report-${dryRun ? 'dry-run' : 'apply'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const reportPath = path.join(reportDir, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total actions: ${report.actions.length}`);
    console.log(`Duplicates found: ${report.summary.duplicatesFound}`);
    console.log(`Items migrated: ${report.summary.itemsMigrated}`);
    console.log(`Items deleted: ${report.summary.itemsDeleted}`);
    console.log(`Items merged: ${report.summary.itemsMerged}`);
    console.log(`Errors: ${report.summary.errors.length}`);
    console.log(`\n📄 Full report saved: ${reportPath}`);
    console.log('='.repeat(60));

    if (dryRun) {
      console.log('\n💡 This was a DRY-RUN. No changes were made.');
      console.log('   To apply changes, run with --apply flag');
    } else {
      console.log('\n✅ Migration completed!');
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
