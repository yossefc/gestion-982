// Script pour garder seulement les 5 équipements originaux
const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function keepOnlyOriginalFive() {
  console.log('\n=== Restauration des 5 équipements originaux ===\n');

  // Les 5 IDs qui existaient AVANT la migration (d'après le premier check)
  const originalIds = [
    'Apxv7lLaUV3hAEJWXvO5', // אופטיקה
    'iH8iKqqNLZmt7ASS0oni', // M203
    'iJCPBWMBxXJDpCOPNxxe', // פךם
    'lNoK9k9QPXhdelXnXBib', // M16
    'yYKRlKnC82nXWLOswJtR', // ממ
  ];

  const collectionRef = db.collection('equipment_combat');
  const snapshot = await collectionRef.get();

  console.log(`📦 Actuellement ${snapshot.size} équipements`);
  console.log(`✅ Garder ${originalIds.length} équipements originaux`);
  console.log(`🗑️  Supprimer ${snapshot.size - originalIds.length} équipements ajoutés par erreur\n`);

  let keptCount = 0;
  let deletedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (originalIds.includes(doc.id)) {
      console.log(`✅ Garder: ${data.name} (${data.category})`);
      keptCount++;
    } else {
      await doc.ref.delete();
      console.log(`🗑️  Supprimé: ${data.name} (${data.category})`);
      deletedCount++;
    }
  }

  console.log(`\n📊 Résultat:`);
  console.log(`   ✅ ${keptCount} équipements gardés`);
  console.log(`   🗑️  ${deletedCount} équipements supprimés`);
}

keepOnlyOriginalFive()
  .then(() => {
    console.log('\n✅ Restauration terminée\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
