/**
 * Script de migration des soldats existants
 * Ajoute les champs searchKey et nameLower pour la recherche performante
 * 
 * Usage: npx ts-node scripts/migrate-soldiers.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';

// Import de la config Firebase (adapter le chemin si nécessaire)
const firebaseConfig = {
  // À remplir avec vos credentials Firebase
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Fonctions de normalisation
function normalizeText(text: string): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildSoldierSearchKey(soldier: any): string {
  const parts = [
    soldier.name || '',
    soldier.personalNumber || '',
    soldier.phone || '',
    soldier.company || '',
  ];
  return normalizeText(parts.join(' '));
}

function buildNameLower(name: string): string {
  return normalizeText(name);
}

async function migrateSoldiers() {
  console.log('🚀 Démarrage de la migration des soldats...\n');

  // Initialiser Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Récupérer tous les soldats
    console.log('📥 Récupération des soldats...');
    const soldiersRef = collection(db, 'soldiers');
    const snapshot = await getDocs(soldiersRef);
    
    console.log(`✅ ${snapshot.size} soldats trouvés\n`);

    if (snapshot.empty) {
      console.log('⚠️  Aucun soldat à migrer');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Migrer chaque soldat
    for (const docSnap of snapshot.docs) {
      const soldier = docSnap.data();
      const soldierId = docSnap.id;

      // Vérifier si déjà migré
      if (soldier.searchKey && soldier.nameLower) {
        console.log(`⏭️  Déjà migré: ${soldier.name} (${soldierId})`);
        skippedCount++;
        continue;
      }

      try {
        // Calculer les nouveaux champs
        const searchKey = buildSoldierSearchKey(soldier);
        const nameLower = buildNameLower(soldier.name);

        // Mettre à jour le document
        const docRef = doc(db, 'soldiers', soldierId);
        await updateDoc(docRef, {
          searchKey,
          nameLower,
          updatedAt: Timestamp.now(),
        });

        console.log(`✅ Migré: ${soldier.name} (${soldier.personalNumber})`);
        console.log(`   searchKey: "${searchKey}"`);
        console.log(`   nameLower: "${nameLower}"\n`);
        
        migratedCount++;
      } catch (error) {
        console.error(`❌ Erreur pour ${soldier.name}:`, error);
        errorCount++;
      }
    }

    // Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(50));
    console.log(`✅ Migrés avec succès : ${migratedCount}`);
    console.log(`⏭️  Déjà migrés (ignorés): ${skippedCount}`);
    console.log(`❌ Erreurs            : ${errorCount}`);
    console.log(`📦 Total             : ${snapshot.size}`);
    console.log('='.repeat(50) + '\n');

    if (migratedCount > 0) {
      console.log('🎉 Migration terminée avec succès !');
      console.log('\n⚠️  PROCHAINES ÉTAPES:');
      console.log('1. Créer les index Firestore (voir docs/firestore-indexes.md)');
      console.log('2. Tester la recherche dans l\'application\n');
    }

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    process.exit(1);
  }
}

// Exécuter la migration
migrateSoldiers()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Échec du script:', error);
    process.exit(1);
  });

