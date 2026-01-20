/**
 * Script pour synchroniser weapons_inventory avec les holdings réels
 * depuis les assignments
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-982'
});

const db = admin.firestore();

async function calculateCurrentHoldings(soldierId, type) {
  const assignmentsSnapshot = await db.collection('assignments')
    .where('soldierId', '==', soldierId)
    .where('type', '==', type)
    .get();

  const holdings = new Map();

  assignmentsSnapshot.forEach(doc => {
    const data = doc.data();
    const multiplier = data.action === 'issue' ? 1 : -1;

    data.items.forEach(item => {
      const key = item.equipmentId || item.equipmentName;
      if (!holdings.has(key)) {
        holdings.set(key, {
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: 0,
          serials: [],
        });
      }

      const current = holdings.get(key);
      current.quantity += item.quantity * multiplier;

      if (item.serial) {
        const serials = item.serial.split(',').map(s => s.trim());
        if (data.action === 'issue') {
          current.serials.push(...serials);
        } else {
          // Remove returned serials
          current.serials = current.serials.filter(s => !serials.includes(s));
        }
      }
    });
  });

  // Filter out items with 0 or negative quantities
  const result = [];
  holdings.forEach(item => {
    if (item.quantity > 0) {
      result.push(item);
    }
  });

  return result;
}

async function syncWeaponsInventory() {
  console.log('\n========================================');
  console.log('SYNCHRONISATION weapons_inventory');
  console.log('========================================\n');

  try {
    // 1. Get all assigned weapons
    const assignedWeapons = await db.collection('weapons_inventory')
      .where('status', '==', 'assigned')
      .get();

    console.log(`Armes marquées "assigned" dans weapons_inventory: ${assignedWeapons.size}\n`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const weaponDoc of assignedWeapons.docs) {
      const weaponData = weaponDoc.data();
      const soldierId = weaponData.assignedTo?.soldierId;
      const serialNumber = weaponData.serialNumber;

      console.log(`\nVérification arme ${serialNumber} (assignée à ${weaponData.assignedTo?.soldierName}):`);

      if (!soldierId) {
        console.log('  ⚠️  Pas de soldierId dans assignedTo, skip');
        continue;
      }

      // Check if this soldier really has this weapon
      const holdings = await calculateCurrentHoldings(soldierId, 'combat');

      console.log(`  Holdings actuels du soldat:`, holdings.map(h => ({
        name: h.equipmentName,
        qty: h.quantity,
        serials: h.serials,
      })));

      let hasWeapon = false;
      for (const holding of holdings) {
        if (holding.serials && holding.serials.includes(serialNumber)) {
          hasWeapon = true;
          break;
        }
      }

      if (hasWeapon) {
        console.log(`  ✅ Soldat a bien cette arme, statut correct`);
        alreadyCorrect++;
      } else {
        console.log(`  ❌ Soldat N'A PAS cette arme, mise à jour du statut...`);

        // Update weapon status to available
        await db.collection('weapons_inventory')
          .doc(weaponDoc.id)
          .update({
            status: 'available',
            assignedTo: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        console.log(`  ✅ Statut mis à jour: assigned → available`);
        fixed++;
      }
    }

    console.log('\n========================================');
    console.log('RÉSULTAT:');
    console.log('========================================');
    console.log(`Armes vérifiées: ${assignedWeapons.size}`);
    console.log(`Armes correctes: ${alreadyCorrect}`);
    console.log(`Armes corrigées: ${fixed}`);
    console.log('========================================\n');

    if (fixed > 0) {
      console.log('✅ Synchronisation terminée! Les armes sont maintenant disponibles.\n');
    } else {
      console.log('ℹ️  Aucune correction nécessaire.\n');
    }

  } catch (error) {
    console.error('Erreur:', error);
  }

  process.exit(0);
}

syncWeaponsInventory();
