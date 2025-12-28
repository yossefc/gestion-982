const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanInvalidClothingEquipment() {
  try {
    console.log('🧹 NETTOYAGE DES DOCUMENTS CLOTHING INVALIDES\n');
    console.log('='.repeat(60));
    
    const snapshot = await db.collection('clothingEquipment').get();
    
    if (snapshot.empty) {
      console.log('✅ Aucun document à nettoyer\n');
      process.exit(0);
    }
    
    console.log(`📊 ${snapshot.size} document(s) trouvé(s)\n`);
    
    const batch = db.batch();
    let deletedCount = 0;
    let fixedCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Si yamach est undefined, supprimer le document
      if (data.yamach === undefined || data.yamach === null) {
        console.log(`🗑️  Suppression: ${data.name} (yamach invalide: ${data.yamach})`);
        batch.delete(doc.ref);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0 || fixedCount > 0) {
      await batch.commit();
      console.log('\n' + '='.repeat(60));
      if (deletedCount > 0) {
        console.log(`✅ ${deletedCount} document(s) invalide(s) supprimé(s)`);
      }
      if (fixedCount > 0) {
        console.log(`✅ ${fixedCount} document(s) corrigé(s)`);
      }
      console.log('\n🎉 Base de données nettoyée!\n');
    } else {
      console.log('✅ Tous les documents sont valides\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    process.exit(0);
  }
}

cleanInvalidClothingEquipment();

