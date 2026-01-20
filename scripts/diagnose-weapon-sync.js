/**
 * Script de diagnostic pour identifier les désynchronisations entre
 * weapons_inventory et assignments
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-982'
});

const db = admin.firestore();

async function diagnoseWeaponSync() {
  console.log('\n========================================');
  console.log('DIAGNOSTIC: SYNCHRONISATION ARMES');
  console.log('========================================\n');

  try {
    // 1. Récupérer toutes les armes assignées dans weapons_inventory
    console.log('1️⃣  ARMES ASSIGNÉES dans weapons_inventory:');
    console.log('─'.repeat(60));

    const assignedWeapons = await db.collection('weapons_inventory')
      .where('status', '==', 'assigned')
      .get();

    const assignedWeaponsList = [];
    assignedWeapons.forEach(doc => {
      const data = doc.data();
      assignedWeaponsList.push({
        id: doc.id,
        serialNumber: data.serialNumber,
        type: data.type,
        soldierId: data.assignedTo?.soldierId,
        soldierName: data.assignedTo?.soldierName,
        assignedDate: data.assignedTo?.assignedDate?.toDate(),
      });

      console.log(`  ✓ ${data.serialNumber} (${data.type})`);
      console.log(`    → Assigné à: ${data.assignedTo?.soldierName} (${data.assignedTo?.soldierId})`);
      console.log(`    → Date: ${data.assignedTo?.assignedDate?.toDate()?.toLocaleString('fr-FR')}`);
      console.log('');
    });

    console.log(`Total: ${assignedWeaponsList.length} armes assignées\n`);

    // 2. Récupérer toutes les assignments de type combat avec action=issue
    console.log('2️⃣  ASSIGNMENTS de type COMBAT (action=issue):');
    console.log('─'.repeat(60));

    const allAssignments = await db.collection('assignments')
      .where('type', '==', 'combat')
      .get();

    const issueAssignments = [];
    const creditAssignments = [];

    allAssignments.forEach(doc => {
      const data = doc.data();
      const assignment = {
        id: doc.id,
        soldierId: data.soldierId,
        soldierName: data.soldierName,
        action: data.action,
        items: data.items,
        timestamp: data.timestamp?.toDate(),
      };

      if (data.action === 'issue') {
        issueAssignments.push(assignment);
      } else if (data.action === 'credit') {
        creditAssignments.push(assignment);
      }
    });

    console.log(`Assignments ISSUE: ${issueAssignments.length}`);
    issueAssignments.forEach(a => {
      console.log(`  ✓ ${a.soldierName} (${a.soldierId})`);
      console.log(`    → Date: ${a.timestamp?.toLocaleString('fr-FR')}`);
      a.items.forEach(item => {
        console.log(`    → ${item.equipmentName} x${item.quantity}${item.serial ? ` (${item.serial})` : ''}`);
      });
      console.log('');
    });

    console.log(`\nAssignments CREDIT: ${creditAssignments.length}`);
    creditAssignments.forEach(a => {
      console.log(`  ✓ ${a.soldierName} (${a.soldierId})`);
      console.log(`    → Date: ${a.timestamp?.toLocaleString('fr-FR')}`);
      a.items.forEach(item => {
        console.log(`    → ${item.equipmentName} x${item.quantity}${item.serial ? ` (${item.serial})` : ''}`);
      });
      console.log('');
    });

    // 3. Identifier les désynchronisations
    console.log('\n3️⃣  ANALYSE DES DÉSYNCHRONISATIONS:');
    console.log('─'.repeat(60));

    let orphanedWeapons = 0;

    for (const weapon of assignedWeaponsList) {
      // Chercher si ce numéro de série existe dans un assignment issue
      let foundInAssignments = false;

      for (const assignment of issueAssignments) {
        for (const item of assignment.items) {
          if (item.serial && item.serial.includes(weapon.serialNumber)) {
            foundInAssignments = true;
            break;
          }
        }
        if (foundInAssignments) break;
      }

      if (!foundInAssignments) {
        orphanedWeapons++;
        console.log(`  ⚠️  ARME ORPHELINE: ${weapon.serialNumber}`);
        console.log(`      → Marquée assignée à ${weapon.soldierName} dans weapons_inventory`);
        console.log(`      → MAIS aucun assignment issue trouvé avec ce serial`);
        console.log(`      → Résultat: arme invisible dans le système de retour`);
        console.log('');
      }
    }

    if (orphanedWeapons === 0) {
      console.log('  ✅ Aucune désynchronisation trouvée!\n');
    } else {
      console.log(`  ❌ ${orphanedWeapons} arme(s) orpheline(s) trouvée(s)\n`);
    }

    // 4. Calculer les holdings actuels par soldat
    console.log('4️⃣  HOLDINGS ACTUELS PAR SOLDAT (calculés):');
    console.log('─'.repeat(60));

    const soldierHoldings = new Map();

    // Ajouter les issues
    for (const assignment of issueAssignments) {
      if (!soldierHoldings.has(assignment.soldierId)) {
        soldierHoldings.set(assignment.soldierId, {
          name: assignment.soldierName,
          items: new Map(),
        });
      }

      const holder = soldierHoldings.get(assignment.soldierId);
      for (const item of assignment.items) {
        const key = item.equipmentId || item.equipmentName;
        if (!holder.items.has(key)) {
          holder.items.set(key, {
            name: item.equipmentName,
            quantity: 0,
            serials: [],
          });
        }

        const current = holder.items.get(key);
        current.quantity += item.quantity;
        if (item.serial) {
          current.serials.push(...item.serial.split(',').map(s => s.trim()));
        }
      }
    }

    // Soustraire les credits
    for (const assignment of creditAssignments) {
      if (soldierHoldings.has(assignment.soldierId)) {
        const holder = soldierHoldings.get(assignment.soldierId);
        for (const item of assignment.items) {
          const key = item.equipmentId || item.equipmentName;
          if (holder.items.has(key)) {
            const current = holder.items.get(key);
            current.quantity -= item.quantity;
            if (item.serial) {
              const returnedSerials = item.serial.split(',').map(s => s.trim());
              current.serials = current.serials.filter(s => !returnedSerials.includes(s));
            }

            if (current.quantity <= 0) {
              holder.items.delete(key);
            }
          }
        }
      }
    }

    // Afficher les holdings
    if (soldierHoldings.size === 0) {
      console.log('  ℹ️  Aucun soldat n\'a de holdings actuellement\n');
    } else {
      soldierHoldings.forEach((holder, soldierId) => {
        if (holder.items.size > 0) {
          console.log(`  👤 ${holder.name} (${soldierId}):`);
          holder.items.forEach((item, key) => {
            console.log(`      → ${item.name} x${item.quantity}`);
            if (item.serials.length > 0) {
              console.log(`        Serials: ${item.serials.join(', ')}`);
            }
          });
          console.log('');
        }
      });
    }

    // 5. Comparaison avec weapons_inventory
    console.log('5️⃣  COMPARAISON weapons_inventory vs HOLDINGS CALCULÉS:');
    console.log('─'.repeat(60));

    let mismatches = 0;

    // Pour chaque arme assignée, vérifier si le soldat l'a dans ses holdings
    for (const weapon of assignedWeaponsList) {
      const holder = soldierHoldings.get(weapon.soldierId);

      if (!holder) {
        mismatches++;
        console.log(`  ❌ MISMATCH: ${weapon.serialNumber}`);
        console.log(`      → weapons_inventory dit: assigné à ${weapon.soldierName}`);
        console.log(`      → holdings calculés: soldat ${weapon.soldierName} n'a AUCUN holding`);
        console.log('');
      } else {
        // Vérifier si le serial est dans les holdings
        let found = false;
        holder.items.forEach(item => {
          if (item.serials.includes(weapon.serialNumber)) {
            found = true;
          }
        });

        if (!found) {
          mismatches++;
          console.log(`  ❌ MISMATCH: ${weapon.serialNumber}`);
          console.log(`      → weapons_inventory dit: assigné à ${weapon.soldierName}`);
          console.log(`      → holdings calculés: soldat a des items mais PAS ce serial`);
          console.log('');
        }
      }
    }

    if (mismatches === 0) {
      console.log('  ✅ Tous les weapons_inventory correspondent aux holdings calculés!\n');
    } else {
      console.log(`  ⚠️  ${mismatches} désynchronisation(s) trouvée(s)\n`);
    }

    console.log('\n========================================');
    console.log('RÉSUMÉ:');
    console.log('========================================');
    console.log(`Armes assignées dans weapons_inventory: ${assignedWeaponsList.length}`);
    console.log(`Assignments issue: ${issueAssignments.length}`);
    console.log(`Assignments credit: ${creditAssignments.length}`);
    console.log(`Soldats avec holdings: ${soldierHoldings.size}`);
    console.log(`Armes orphelines: ${orphanedWeapons}`);
    console.log(`Mismatches trouvés: ${mismatches}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Erreur lors du diagnostic:', error);
  }

  process.exit(0);
}

diagnoseWeaponSync();
