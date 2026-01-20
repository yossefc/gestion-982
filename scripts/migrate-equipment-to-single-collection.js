// Script pour migrer tous les équipements vers equipment_combat et supprimer l'ancienne collection
const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateEquipment() {
  console.log('\n=== Migration des équipements vers equipment_combat ===\n');

  // 1. Charger tous les équipements de combatEquipment
  const oldCollectionRef = db.collection('combatEquipment');
  const oldSnapshot = await oldCollectionRef.get();

  console.log(`📦 Trouvé ${oldSnapshot.size} équipements dans combatEquipment`);

  if (oldSnapshot.size === 0) {
    console.log('✅ Aucun équipement à migrer depuis combatEquipment');
    return;
  }

  // 2. Charger les équipements existants dans equipment_combat pour éviter les doublons
  const newCollectionRef = db.collection('equipment_combat');
  const newSnapshot = await newCollectionRef.get();

  const existingNames = new Set();
  newSnapshot.docs.forEach(doc => {
    existingNames.add(doc.data().name);
  });

  console.log(`📋 ${existingNames.size} équipements déjà dans equipment_combat`);

  // 3. Migrer chaque équipement
  let migratedCount = 0;
  let skippedCount = 0;

  for (const doc of oldSnapshot.docs) {
    const data = doc.data();

    // Vérifier si cet équipement existe déjà (par nom)
    if (existingNames.has(data.name)) {
      console.log(`⏭️  Ignorer "${data.name}" (existe déjà)`);
      skippedCount++;
      continue;
    }

    // Copier vers la nouvelle collection
    await newCollectionRef.add({
      name: data.name,
      category: data.category,
      hasSubEquipment: data.hasSubEquipment || false,
      subEquipments: data.subEquipments || [],
      requiresSerial: data.requiresSerial || false,
      createdAt: data.createdAt || admin.firestore.Timestamp.now(),
    });

    console.log(`✅ Migré: "${data.name}" (${data.category})`);
    migratedCount++;
  }

  console.log(`\n📊 Migration terminée:`);
  console.log(`   ✅ ${migratedCount} équipements migrés`);
  console.log(`   ⏭️  ${skippedCount} équipements ignorés (doublons)`);

  // 4. Demander confirmation pour supprimer l'ancienne collection
  console.log(`\n⚠️  L'ancienne collection "combatEquipment" contient encore ${oldSnapshot.size} documents`);
  console.log(`   Pour la supprimer, exécutez le script: node scripts/delete-old-combat-equipment-collection.js`);
}

migrateEquipment()
  .then(() => {
    console.log('\n✅ Migration terminée avec succès\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
