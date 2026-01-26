import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkCombatEquipment() {
  try {
    console.log('=== Vérification des équipements de combat ===\n');

    // Récupérer tous les équipements de combat
    const equipmentSnapshot = await db.collection('combat_equipment').get();

    console.log(`Total d'équipements: ${equipmentSnapshot.size}\n`);

    // Regrouper par nom pour détecter les doublons
    const byName: { [key: string]: any[] } = {};

    equipmentSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const name = data.name || 'Sans nom';

      if (!byName[name]) {
        byName[name] = [];
      }

      byName[name].push({
        id: doc.id,
        ...data
      });
    });

    // Afficher les doublons
    console.log('Équipements avec doublons:\n');
    let hasDoubles = false;
    Object.keys(byName).forEach(name => {
      if (byName[name].length > 1) {
        hasDoubles = true;
        console.log(`\n⚠️  "${name}" apparaît ${byName[name].length} fois:`);
        byName[name].forEach((item, index) => {
          console.log(`  ${index + 1}. ID: ${item.id}`);
          console.log(`     Catégorie: ${item.category || 'N/A'}`);
          console.log(`     Créé le: ${item.createdAt ? new Date(item.createdAt._seconds * 1000).toLocaleDateString() : 'N/A'}`);
        });
      }
    });

    if (!hasDoubles) {
      console.log('Aucun doublon trouvé.\n');
    }

    // Afficher tous les équipements triés par nom
    console.log('\n=== Liste complète des équipements ===\n');
    const allEquipment = equipmentSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      category: doc.data().category
    }));

    allEquipment.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    allEquipment.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.category}) - ID: ${item.id}`);
    });

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

checkCombatEquipment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
