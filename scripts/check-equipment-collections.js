// Script pour vérifier les collections d'équipements dans Firestore
const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkEquipmentCollections() {
  console.log('\n=== Vérification des collections d\'équipements ===\n');

  // Vérifier equipment_combat
  const equipmentCombatRef = db.collection('equipment_combat');
  const equipmentCombatSnapshot = await equipmentCombatRef.get();
  console.log(`📦 equipment_combat: ${equipmentCombatSnapshot.size} équipements`);

  if (equipmentCombatSnapshot.size > 0) {
    console.log('\nPremiers 5 équipements de equipment_combat:');
    equipmentCombatSnapshot.docs.slice(0, 5).forEach((doc, index) => {
      const data = doc.data();
      console.log(`  ${index + 1}. ${data.name} (${data.category}) - ID: ${doc.id}`);
    });
  }

  // Vérifier combatEquipment
  const combatEquipmentRef = db.collection('combatEquipment');
  const combatEquipmentSnapshot = await combatEquipmentRef.get();
  console.log(`\n🔫 combatEquipment: ${combatEquipmentSnapshot.size} équipements`);

  if (combatEquipmentSnapshot.size > 0) {
    console.log('\nPremiers 5 équipements de combatEquipment:');
    combatEquipmentSnapshot.docs.slice(0, 5).forEach((doc, index) => {
      const data = doc.data();
      console.log(`  ${index + 1}. ${data.name} (${data.category}) - ID: ${doc.id}`);
    });
  }

  // Total
  const total = equipmentCombatSnapshot.size + combatEquipmentSnapshot.size;
  console.log(`\n📊 TOTAL: ${total} équipements dans les deux collections`);

  if (equipmentCombatSnapshot.size > 0 && combatEquipmentSnapshot.size > 0) {
    console.log('\n⚠️  ATTENTION: Vous avez des équipements dans les DEUX collections!');
    console.log('   Recommandation: Utiliser une seule collection pour éviter la confusion.');
  }
}

checkEquipmentCollections()
  .then(() => {
    console.log('\n✅ Vérification terminée\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
