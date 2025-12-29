const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Helper functions (copié de src/utils/normalize.ts)
function normalizeText(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSoldierSearchKey(soldier) {
  const parts = [
    soldier.name,
    soldier.personalNumber,
    soldier.phone || '',
  ];
  return normalizeText(parts.join(' '));
}

async function fixExistingSoldiers() {
  try {
    console.log('🔧 CORRECTION DES SOLDATS EXISTANTS\n');
    console.log('='.repeat(60));
    
    // Récupérer tous les soldats
    const soldiersSnapshot = await db.collection('soldiers').get();
    
    if (soldiersSnapshot.empty) {
      console.log('✅ Aucun soldat à corriger\n');
      process.exit(0);
    }
    
    console.log(`📊 ${soldiersSnapshot.size} soldat(s) à traiter\n`);
    
    const batch = db.batch();
    let fixedCount = 0;
    
    soldiersSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Vérifier si les champs manquent
      if (!data.searchKey || !data.nameLower) {
        console.log(`🔧 Correction de: ${data.name} (${data.personalNumber})`);
        
        const updates = {};
        
        if (!data.searchKey) {
          updates.searchKey = buildSoldierSearchKey({
            name: data.name,
            personalNumber: data.personalNumber,
            phone: data.phone
          });
          console.log(`   + searchKey: ${updates.searchKey}`);
        }
        
        if (!data.nameLower) {
          updates.nameLower = normalizeText(data.name);
          console.log(`   + nameLower: ${updates.nameLower}`);
        }
        
        batch.update(doc.ref, updates);
        fixedCount++;
        console.log('');
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
      console.log('='.repeat(60));
      console.log(`✅ ${fixedCount} soldat(s) corrigé(s) avec succès!\n`);
      console.log('🎉 Vous pouvez maintenant utiliser l\'application normalement\n');
    } else {
      console.log('✅ Tous les soldats sont déjà corrects\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

fixExistingSoldiers();




