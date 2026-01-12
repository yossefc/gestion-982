const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanSoldiers() {
  try {
    const shouldDelete = process.argv.includes('--delete');
    
    if (!shouldDelete) {
      console.log('⚠️  ATTENTION - SUPPRESSION DE TOUS LES SOLDATS\n');
      console.log('Cette commande va supprimer TOUS les soldats de la base de données.');
      console.log('Utilisez uniquement en développement !\n');
      console.log('Pour confirmer, relancez avec : node scripts/clean-soldiers.js --delete\n');
      process.exit(0);
    }
    
    console.log('🗑️  SUPPRESSION DE TOUS LES SOLDATS\n');
    console.log('='.repeat(60));
    
    const soldiersSnapshot = await db.collection('soldiers').get();
    
    if (soldiersSnapshot.empty) {
      console.log('✅ Aucun soldat à supprimer\n');
      process.exit(0);
    }
    
    console.log(`📊 ${soldiersSnapshot.size} soldat(s) à supprimer\n`);
    
    const batch = db.batch();
    
    soldiersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`🗑️  Suppression : ${data.name} (${data.personalNumber})`);
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ ${soldiersSnapshot.size} soldat(s) supprimé(s) avec succès!\n`);
    console.log('🎉 La base de données est maintenant vide\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

cleanSoldiers();





