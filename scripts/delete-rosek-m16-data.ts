/**
 * Script pour supprimer toutes les données du רוסק M-16 (Rosek M-16)
 * - Supprime les holdings dans soldier_holdings
 * - Supprime les assignments contenant cet équipement
 * - Conserve l'équipement lui-même dans combatEquipment
 */

import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function deleteRosekM16Data() {
  try {
    console.log('🔍 Recherche de l\'équipement רוסק M-16...\n');

    // 1. Trouver l'ID de l'équipement רוס״ק M-16 (avec les guillemets hébreux corrects)
    const equipmentSnapshot = await db
      .collection('combatEquipment')
      .where('name', '==', 'רוס״ק M-16')
      .get();

    if (equipmentSnapshot.empty) {
      console.log('❌ Équipement רוס״ק M-16 non trouvé dans combatEquipment');
      return;
    }

    const equipmentDoc = equipmentSnapshot.docs[0];
    const equipmentId = equipmentDoc.id;
    const equipmentName = equipmentDoc.data().name;

    console.log(`✅ Équipement trouvé:`);
    console.log(`   ID: ${equipmentId}`);
    console.log(`   Nom: ${equipmentName}`);
    console.log(`   Catégorie: ${equipmentDoc.data().category}\n`);

    // 2. Supprimer les holdings dans soldier_holdings
    console.log('🗑️  Suppression des holdings dans soldier_holdings...\n');

    const holdingsSnapshot = await db.collection('soldier_holdings').get();
    let holdingsUpdated = 0;
    let holdingsDeleted = 0;

    const batch = db.batch();
    let operationCount = 0;

    for (const holdingDoc of holdingsSnapshot.docs) {
      const data = holdingDoc.data();

      if (data.type !== 'combat') continue;

      const items = data.items || [];
      const filteredItems = items.filter((item: any) =>
        item.equipmentId !== equipmentId && item.equipmentName !== equipmentName
      );

      if (filteredItems.length !== items.length) {
        const removedCount = items.length - filteredItems.length;
        console.log(`   📝 Soldat ${data.soldierName || data.soldierId}: ${removedCount} item(s) supprimé(s)`);

        if (filteredItems.length === 0) {
          // Supprimer le document entier si plus d'items
          batch.delete(holdingDoc.ref);
          holdingsDeleted++;
        } else {
          // Mettre à jour avec les items restants
          batch.update(holdingDoc.ref, { items: filteredItems });
          holdingsUpdated++;
        }

        operationCount++;

        // Commit par batch de 500 (limite Firestore)
        if (operationCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Batch de ${operationCount} opérations commitées`);
          operationCount = 0;
        }
      }
    }

    // Commit final
    if (operationCount > 0) {
      await batch.commit();
      console.log(`   ✅ Batch final de ${operationCount} opérations commitées`);
    }

    console.log(`\n✅ Holdings: ${holdingsUpdated} mis à jour, ${holdingsDeleted} supprimés\n`);

    // 3. Supprimer/Nettoyer les assignments
    console.log('🗑️  Nettoyage des assignments...\n');

    const assignmentsSnapshot = await db
      .collection('assignments')
      .where('type', '==', 'combat')
      .get();

    let assignmentsUpdated = 0;
    let assignmentsDeleted = 0;
    const batch2 = db.batch();
    let operationCount2 = 0;

    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const data = assignmentDoc.data();
      const items = data.items || [];

      const filteredItems = items.filter((item: any) =>
        item.equipmentId !== equipmentId && item.equipmentName !== equipmentName
      );

      if (filteredItems.length !== items.length) {
        const removedCount = items.length - filteredItems.length;
        console.log(`   📝 Assignment ${assignmentDoc.id}: ${removedCount} item(s) supprimé(s)`);

        if (filteredItems.length === 0) {
          // Supprimer l'assignment entier si plus d'items
          batch2.delete(assignmentDoc.ref);
          assignmentsDeleted++;
        } else {
          // Mettre à jour avec les items restants
          batch2.update(assignmentDoc.ref, { items: filteredItems });
          assignmentsUpdated++;
        }

        operationCount2++;

        if (operationCount2 >= 500) {
          await batch2.commit();
          console.log(`   ✅ Batch de ${operationCount2} opérations commitées`);
          operationCount2 = 0;
        }
      }
    }

    // Commit final
    if (operationCount2 > 0) {
      await batch2.commit();
      console.log(`   ✅ Batch final de ${operationCount2} opérations commitées`);
    }

    console.log(`\n✅ Assignments: ${assignmentsUpdated} mis à jour, ${assignmentsDeleted} supprimés\n`);

    // 4. Résumé final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ NETTOYAGE TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Équipement conservé: ${equipmentName} (ID: ${equipmentId})`);
    console.log(`Holdings mis à jour: ${holdingsUpdated}`);
    console.log(`Holdings supprimés: ${holdingsDeleted}`);
    console.log(`Assignments mis à jour: ${assignmentsUpdated}`);
    console.log(`Assignments supprimés: ${assignmentsDeleted}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  }
}

// Exécuter le script
deleteRosekM16Data()
  .then(() => {
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
