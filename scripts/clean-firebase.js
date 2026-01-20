const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Arguments du script
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const KEEP_CATALOGS = args.includes('--keep-catalogs');

console.log('='.repeat(80));
console.log('NETTOYAGE COMPLET DE FIREBASE');
console.log('='.repeat(80));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN (simulation)' : '⚠️  EXÉCUTION RÉELLE'}`);
console.log(`Catalogues: ${KEEP_CATALOGS ? '✅ Conserver' : '❌ Supprimer aussi'}`);
console.log('='.repeat(80));

async function cleanCollection(collectionName, keepCatalog = false) {
    try {
        const snapshot = await db.collection(collectionName).get();

        if (snapshot.empty) {
            console.log(`  ℹ️  ${collectionName}: déjà vide`);
            return 0;
        }

        console.log(`  📦 ${collectionName}: ${snapshot.size} documents`);

        if (keepCatalog && KEEP_CATALOGS) {
            console.log(`     ⏭️  Conservation du catalogue (--keep-catalogs)`);
            return 0;
        }

        if (!DRY_RUN) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`     ✅ ${snapshot.size} documents supprimés`);
        } else {
            console.log(`     📊 ${snapshot.size} documents seraient supprimés`);
        }

        return snapshot.size;
    } catch (error) {
        console.log(`     ❌ Erreur: ${error.message}`);
        return 0;
    }
}

async function main() {
    console.log('\n🗑️  SUPPRESSION DES COLLECTIONS\n');

    let totalDeleted = 0;

    // 1. Supprimer les données de test des soldats
    console.log('1️⃣  Soldats (données de test):');
    totalDeleted += await cleanCollection('soldiers');

    // 2. Supprimer soldier_equipment (données de test)
    console.log('\n2️⃣  Équipements des soldats (données de test):');
    totalDeleted += await cleanCollection('soldier_equipment');

    // 3. Supprimer soldier_holdings (ancien système)
    console.log('\n3️⃣  Holdings des soldats (ancien système):');
    totalDeleted += await cleanCollection('soldier_holdings');

    // 4. Supprimer assignments (historique de test)
    console.log('\n4️⃣  Assignations (historique de test):');
    totalDeleted += await cleanCollection('assignments');

    // 5. Supprimer equipment_clothing (DOUBLON)
    console.log('\n5️⃣  Equipment Clothing (DOUBLON - à supprimer):');
    totalDeleted += await cleanCollection('equipment_clothing');

    // 6. Catalogues (optionnel)
    console.log('\n6️⃣  Catalogues d\'équipements:');

    console.log('   • combatEquipment:');
    totalDeleted += await cleanCollection('combatEquipment', true);

    console.log('   • clothingEquipment:');
    totalDeleted += await cleanCollection('clothingEquipment', true);

    // 7. Manot (optionnel)
    console.log('\n7️⃣  Manot:');
    totalDeleted += await cleanCollection('manot');

    // 8. Users - GARDER (ne pas supprimer)
    console.log('\n8️⃣  Users:');
    const usersSnapshot = await db.collection('users').get();
    console.log(`  👥 users: ${usersSnapshot.size} utilisateurs (NON SUPPRIMÉS)`);

    // Rapport final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RAPPORT FINAL');
    console.log('='.repeat(80));

    // Vérifier l'état final
    const finalState = {
        soldiers: (await db.collection('soldiers').get()).size,
        soldier_equipment: (await db.collection('soldier_equipment').get()).size,
        soldier_holdings: (await db.collection('soldier_holdings').get()).size,
        assignments: (await db.collection('assignments').get()).size,
        equipment_clothing: (await db.collection('equipment_clothing').get()).size,
        combatEquipment: (await db.collection('combatEquipment').get()).size,
        clothingEquipment: (await db.collection('clothingEquipment').get()).size,
        manot: (await db.collection('manot').get()).size,
        users: (await db.collection('users').get()).size,
    };

    console.log('\nÉtat final:\n');
    Object.entries(finalState).forEach(([name, count]) => {
        const icon = count === 0 ? '📭' : '📦';
        const status = count === 0 ? 'VIDE ✅' : `${count} documents`;
        console.log(`  ${icon} ${name.padEnd(25)} : ${status}`);
    });

    console.log('\n' + '-'.repeat(80));
    console.log('Collections à conserver:');
    console.log('  ✅ soldiers               - Vide (prêt pour données réelles)');
    console.log('  ✅ soldier_equipment      - Vide (prêt pour données réelles)');
    console.log('  ✅ combatEquipment        - Catalogue (conserver ou repeupler)');
    console.log('  ✅ clothingEquipment      - Catalogue (conserver ou repeupler)');
    console.log('  ✅ assignments            - Vide (historique futur)');
    console.log('  ✅ users                  - Utilisateurs (NE PAS SUPPRIMER)');
    console.log('  ✅ manot                  - Vide (optionnel)');

    console.log('\nCollections supprimées:');
    console.log('  ❌ equipment_clothing     - DOUBLON (supprimé)');
    console.log('  ❌ soldier_holdings       - ANCIEN SYSTÈME (supprimé)');

    console.log('\n' + '='.repeat(80));

    if (DRY_RUN) {
        console.log('✅ SIMULATION TERMINÉE');
        console.log('');
        console.log('Pour exécuter le nettoyage réel:');
        console.log('  node scripts/clean-firebase.js');
        console.log('');
        console.log('Pour garder les catalogues d\'équipements:');
        console.log('  node scripts/clean-firebase.js --keep-catalogs');
        console.log('');
        console.log('⚠️  ATTENTION: Cette opération supprimera TOUTES les données de test!');
    } else {
        console.log('✅ NETTOYAGE TERMINÉ');
        console.log('');
        console.log(`${totalDeleted} documents supprimés au total`);
        console.log('');
        console.log('Prochaines étapes:');
        console.log('  1. Vérifier que la structure est propre');
        console.log('  2. Repeupler les catalogues si nécessaire');
        console.log('  3. Commencer à utiliser l\'application avec données réelles');
    }
    console.log('='.repeat(80));

    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ ERREUR:', err);
    process.exit(1);
});
