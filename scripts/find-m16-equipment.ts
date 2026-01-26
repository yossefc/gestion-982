/**
 * Script pour trouver tous les équipements M-16 dans la base de données
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

async function findM16Equipment() {
  try {
    console.log('🔍 Recherche de tous les équipements de combat...\n');

    const equipmentSnapshot = await db.collection('combatEquipment').get();

    console.log(`📦 Total d'équipements: ${equipmentSnapshot.size}\n`);

    const m16Equipment: any[] = [];

    equipmentSnapshot.forEach((doc) => {
      const data = doc.data();
      const name = data.name || '';

      // Rechercher tout ce qui contient "M-16", "M16", "רוסק", etc.
      if (
        name.toLowerCase().includes('m-16') ||
        name.toLowerCase().includes('m16') ||
        name.includes('רוסק') ||
        name.includes('רוס״ק')
      ) {
        m16Equipment.push({
          id: doc.id,
          name: data.name,
          category: data.category,
          nameKey: data.nameKey,
          categoryKey: data.categoryKey,
        });
      }
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🔎 Équipements M-16 trouvés: ${m16Equipment.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    m16Equipment.forEach((eq, index) => {
      console.log(`${index + 1}. ID: ${eq.id}`);
      console.log(`   Nom: "${eq.name}"`);
      console.log(`   Catégorie: ${eq.category}`);
      console.log(`   nameKey: ${eq.nameKey}`);
      console.log(`   categoryKey: ${eq.categoryKey}`);
      console.log('');
    });

    // Maintenant chercher dans les holdings
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 Recherche dans soldier_holdings...');
    console.log('═══════════════════════════════════════════════════════════\n');

    const holdingsSnapshot = await db
      .collection('soldier_holdings')
      .where('type', '==', 'combat')
      .get();

    let totalHoldings = 0;
    const holdingsByEquipment = new Map<string, number>();

    holdingsSnapshot.forEach((doc) => {
      const data = doc.data();
      const items = data.items || [];

      items.forEach((item: any) => {
        const name = item.equipmentName || '';
        if (
          name.toLowerCase().includes('m-16') ||
          name.toLowerCase().includes('m16') ||
          name.includes('רוסק') ||
          name.includes('רוס״ק')
        ) {
          totalHoldings++;
          const count = holdingsByEquipment.get(name) || 0;
          holdingsByEquipment.set(name, count + 1);
        }
      });
    });

    console.log(`Holdings M-16 trouvés: ${totalHoldings}`);
    console.log('Répartition par nom:');
    holdingsByEquipment.forEach((count, name) => {
      console.log(`  "${name}": ${count} occurrences`);
    });

    // Chercher dans assignments
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 Recherche dans assignments...');
    console.log('═══════════════════════════════════════════════════════════\n');

    const assignmentsSnapshot = await db
      .collection('assignments')
      .where('type', '==', 'combat')
      .get();

    let totalAssignments = 0;
    const assignmentsByEquipment = new Map<string, number>();

    assignmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const items = data.items || [];

      items.forEach((item: any) => {
        const name = item.equipmentName || '';
        if (
          name.toLowerCase().includes('m-16') ||
          name.toLowerCase().includes('m16') ||
          name.includes('רוסק') ||
          name.includes('רוס״ק')
        ) {
          totalAssignments++;
          const count = assignmentsByEquipment.get(name) || 0;
          assignmentsByEquipment.set(name, count + 1);
        }
      });
    });

    console.log(`Assignments M-16 trouvés: ${totalAssignments}`);
    console.log('Répartition par nom:');
    assignmentsByEquipment.forEach((count, name) => {
      console.log(`  "${name}": ${count} occurrences`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  }
}

// Exécuter le script
findM16Equipment()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
