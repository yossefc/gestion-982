// Script pour restaurer seulement les 5 équipements corrects
const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function restoreCorrectEquipment() {
  console.log('\n=== Restauration des équipements corrects ===\n');

  const collectionRef = db.collection('equipment_combat');

  // 1. Lister tous les équipements actuels
  const snapshot = await collectionRef.get();
  console.log(`📦 Actuellement ${snapshot.size} équipements dans equipment_combat`);

  console.log('\nÉquipements actuels:');
  const equipmentList = [];
  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    equipmentList.push({ id: doc.id, name: data.name, category: data.category });
    console.log(`  ${index + 1}. ${data.name} (${data.category}) - ID: ${doc.id}`);
  });

  // 2. Identifier les 5 équipements qui étaient là AVANT la migration
  // Ces équipements ont probablement été créés en premier (plus anciens IDs)
  console.log('\n⚠️  Pour identifier les 5 équipements corrects,');
  console.log('   lesquels voulez-vous GARDER ? Les autres seront supprimés.');
  console.log('\n   Équipements probablement corrects (créés en premier):');

  // Trier par ID pour trouver les plus anciens
  equipmentList.sort((a, b) => a.id.localeCompare(b.id));

  const oldestFive = equipmentList.slice(0, 5);
  console.log('\n   Les 5 plus anciens (probablement les corrects):');
  oldestFive.forEach((eq, index) => {
    console.log(`     ${index + 1}. ${eq.name} (${eq.category})`);
  });

  console.log('\n   Pour supprimer automatiquement tout sauf ces 5 anciens,');
  console.log('   exécutez: node scripts/keep-only-oldest-five.js');
}

restoreCorrectEquipment()
  .then(() => {
    console.log('\n✅ Analyse terminée\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
