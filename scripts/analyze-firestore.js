// Script pour analyser la structure Firestore et lister toutes les collections
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyzeFirestore() {
  console.log('🔍 Analyse de Firestore...\n');

  try {
    // Lister toutes les collections racines
    const collections = await db.listCollections();

    console.log(`📚 Collections trouvées: ${collections.length}\n`);

    for (const collection of collections) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📁 Collection: ${collection.id}`);
      console.log(`${'='.repeat(60)}`);

      // Compter les documents
      const snapshot = await collection.get();
      console.log(`📊 Nombre de documents: ${snapshot.size}`);

      if (snapshot.size > 0) {
        console.log(`\n📄 Exemples de documents (max 3):\n`);

        let count = 0;
        snapshot.forEach((doc) => {
          if (count < 3) {
            console.log(`  Document ID: ${doc.id}`);
            console.log(`  Données:`, JSON.stringify(doc.data(), null, 2));
            console.log(`  ${'-'.repeat(50)}`);
            count++;
          }
        });

        // Afficher tous les IDs si collection petite
        if (snapshot.size <= 20) {
          console.log(`\n📋 Liste complète des IDs:`);
          snapshot.forEach((doc) => {
            console.log(`  - ${doc.id}`);
          });
        }
      } else {
        console.log(`  ⚠️  Collection vide`);
      }
    }

    console.log(`\n\n${'='.repeat(60)}`);
    console.log('✅ Analyse terminée');
    console.log(`${'='.repeat(60)}\n`);

    // Analyse spécifique pour les équipements et manot
    console.log('\n🔬 ANALYSE SPÉCIFIQUE:\n');

    // Vérifier combatEquipment
    const combatEquipmentSnapshot = await db.collection('combatEquipment').get();
    console.log(`🔫 combatEquipment: ${combatEquipmentSnapshot.size} documents`);

    // Vérifier clothingEquipment
    const clothingEquipmentSnapshot = await db.collection('clothingEquipment').get();
    console.log(`👔 clothingEquipment: ${clothingEquipmentSnapshot.size} documents`);

    // Vérifier manot
    const manotSnapshot = await db.collection('manot').get();
    console.log(`📦 manot: ${manotSnapshot.size} documents`);

    if (manotSnapshot.size > 0) {
      console.log(`\n📦 Détails des manot:`);
      manotSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`\n  Mana: ${data.name} (${data.type || 'N/A'})`);
        console.log(`  Équipements (${data.equipments?.length || 0}):`);
        data.equipments?.forEach((eq) => {
          console.log(`    - ${eq.equipmentName} (ID: ${eq.equipmentId || 'VIDE'}) x${eq.quantity}`);
        });
      });
    }

    // Vérifier soldiers
    const soldiersSnapshot = await db.collection('soldiers').get();
    console.log(`\n🪖 soldiers: ${soldiersSnapshot.size} documents`);

    // Vérifier assignments
    const assignmentsSnapshot = await db.collection('assignments').get();
    console.log(`📝 assignments: ${assignmentsSnapshot.size} documents`);

    // Recommandations
    console.log(`\n\n💡 RECOMMANDATIONS:\n`);

    if (combatEquipmentSnapshot.size === 0) {
      console.log(`⚠️  PROBLÈME: La collection 'combatEquipment' est vide!`);
      console.log(`   Solution: Créer des équipements de combat via "ניהול ציוד" dans l'app`);
    }

    if (manotSnapshot.size > 0 && combatEquipmentSnapshot.size === 0) {
      console.log(`⚠️  INCOHÉRENCE: Des manot existent mais aucun combatEquipment!`);
      console.log(`   Les manot référencent des équipements qui n'existent pas.`);
    }

    // Vérifier les IDs manquants dans manot
    let hasEmptyIds = false;
    manotSnapshot.forEach((doc) => {
      const data = doc.data();
      data.equipments?.forEach((eq) => {
        if (!eq.equipmentId || eq.equipmentId === '') {
          hasEmptyIds = true;
        }
      });
    });

    if (hasEmptyIds) {
      console.log(`⚠️  PROBLÈME: Certaines manot ont des equipmentId vides`);
      console.log(`   Solution: Recréer les manot après avoir ajouté les équipements`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    process.exit(0);
  }
}

// Exécuter l'analyse
analyzeFirestore();
