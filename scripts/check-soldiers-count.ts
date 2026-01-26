import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkSoldiersCount() {
  try {
    console.log('=== Vérification du nombre de soldats dans Firestore ===\n');

    // Récupérer tous les soldats
    const soldiersSnapshot = await db.collection('soldiers').get();

    console.log(`Total de soldats dans la base: ${soldiersSnapshot.size}`);

    // Compter par compagnie
    const byCompany: { [key: string]: number } = {};

    soldiersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const company = data.company || 'Non défini';
      byCompany[company] = (byCompany[company] || 0) + 1;
    });

    console.log('\nRépartition par compagnie:');
    Object.keys(byCompany).sort().forEach(company => {
      console.log(`  ${company}: ${byCompany[company]} soldats`);
    });

    // Afficher quelques exemples
    console.log('\nExemples de soldats (premiers 10):');
    soldiersSnapshot.docs.slice(0, 10).forEach((doc, index) => {
      const data = doc.data();
      console.log(`  ${index + 1}. ${data.name} (${data.personalNumber}) - ${data.company || 'N/A'}`);
    });

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

checkSoldiersCount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
