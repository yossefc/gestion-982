const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listAllSoldiers() {
  try {
    console.log('🔍 VÉRIFICATION DE LA BASE DE DONNÉES FIRESTORE\n');
    console.log('='.repeat(60));
    
    // Récupérer tous les soldats
    const soldiersSnapshot = await db.collection('soldiers').get();
    
    console.log(`\n📊 Nombre total de soldats : ${soldiersSnapshot.size}\n`);
    
    if (soldiersSnapshot.empty) {
      console.log('✅ Aucun soldat dans la base de données');
      console.log('   Vous pouvez créer votre premier soldat maintenant !\n');
    } else {
      console.log('📋 LISTE DES SOLDATS :\n');
      
      soldiersSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   Nom: ${data.name || 'N/A'}`);
        console.log(`   Numéro: ${data.personalNumber || 'N/A'}`);
        console.log(`   Compagnie: ${data.company || 'N/A'}`);
        console.log(`   Téléphone: ${data.phone || 'N/A'}`);
        console.log(`   Créé: ${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'N/A'}`);
        console.log(`   searchKey: ${data.searchKey || 'MANQUANT ❌'}`);
        console.log(`   nameLower: ${data.nameLower || 'MANQUANT ❌'}`);
        console.log('');
      });
      
      console.log('='.repeat(60));
      console.log('\n⚠️  VOULEZ-VOUS SUPPRIMER TOUS LES SOLDATS ?');
      console.log('   Pour supprimer : node scripts/clean-soldiers.js --delete');
      console.log('   (Utile pour repartir de zéro en développement)\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

listAllSoldiers();

