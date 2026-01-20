/**
 * Vérifier les serials des armes dans weapons_inventory
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-982'
});

const db = admin.firestore();

async function checkWeaponsSerials() {
  console.log('\n========================================');
  console.log('VÉRIFICATION SERIALS WEAPONS_INVENTORY');
  console.log('========================================\n');

  try {
    const assignedWeapons = await db.collection('weapons_inventory')
      .where('status', '==', 'assigned')
      .get();

    console.log(`Total armes assignées: ${assignedWeapons.size}\n`);

    assignedWeapons.forEach(doc => {
      const data = doc.data();
      console.log(`Document ID: ${doc.id}`);
      console.log(`  serialNumber: "${data.serialNumber}" (type: ${typeof data.serialNumber})`);
      console.log(`  type: ${data.type}`);
      console.log(`  status: ${data.status}`);
      console.log(`  assignedTo:`, data.assignedTo);
      console.log(`  Tous les champs:`, Object.keys(data));
      console.log('');
    });

    // Vérifier toutes les armes
    console.log('\n========================================');
    console.log('TOUTES LES ARMES:');
    console.log('========================================\n');

    const allWeapons = await db.collection('weapons_inventory').get();
    console.log(`Total: ${allWeapons.size} armes\n`);

    allWeapons.forEach(doc => {
      const data = doc.data();
      console.log(`${doc.id}: serial="${data.serialNumber}", status=${data.status}, type=${data.type}`);
    });

  } catch (error) {
    console.error('Erreur:', error);
  }

  process.exit(0);
}

checkWeaponsSerials();
