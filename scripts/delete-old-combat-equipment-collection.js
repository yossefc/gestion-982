// Script pour supprimer l'ancienne collection combatEquipment
const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteOldCollection() {
  console.log('\n=== Suppression de l\'ancienne collection combatEquipment ===\n');

  const collectionRef = db.collection('combatEquipment');
  const snapshot = await collectionRef.get();

  if (snapshot.size === 0) {
    console.log('✅ La collection combatEquipment est déjà vide');
    return;
  }

  console.log(`⚠️  Suppression de ${snapshot.size} documents...`);

  // Supprimer par lots de 500 (limite Firestore)
  const batchSize = 500;
  let deletedCount = 0;

  while (true) {
    const batch = db.batch();
    const docs = await collectionRef.limit(batchSize).get();

    if (docs.size === 0) {
      break;
    }

    docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
      console.log(`  🗑️  Supprimé: ${doc.data().name}`);
    });

    await batch.commit();
  }

  console.log(`\n✅ ${deletedCount} documents supprimés de combatEquipment`);
}

deleteOldCollection()
  .then(() => {
    console.log('\n✅ Nettoyage terminé\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
