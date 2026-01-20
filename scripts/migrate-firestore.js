const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Arguments du script
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_BACKUP = args.includes('--skip-backup');

console.log('='.repeat(80));
console.log('SCRIPT DE MIGRATION FIRESTORE - NETTOYAGE ET RESTRUCTURATION');
console.log('='.repeat(80));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN (simulation)' : '⚠️  EXÉCUTION RÉELLE'}`);
console.log(`Backup: ${SKIP_BACKUP ? '❌ Désactivé' : '✅ Activé'}`);
console.log('='.repeat(80));

// Fonction pour créer un backup
async function createBackup() {
    if (SKIP_BACKUP) {
        console.log('\n⏭️  Backup ignoré (--skip-backup)');
        return;
    }

    console.log('\n📦 Création du backup...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const backupFile = path.join(backupDir, `firestore-backup-${timestamp}.json`);

    const backup = {
        timestamp: new Date().toISOString(),
        collections: {}
    };

    const collections = [
        'soldiers',
        'users',
        'soldier_equipment',
        'soldier_holdings',
        'equipment_combat',
        'equipment_clothing',
        'clothingEquipment',
        'assignments'
    ];

    for (const collName of collections) {
        try {
            const snapshot = await db.collection(collName).get();
            backup.collections[collName] = snapshot.docs.map(doc => ({
                id: doc.id,
                data: doc.data()
            }));
            console.log(`  ✓ ${collName}: ${snapshot.size} documents`);
        } catch (error) {
            console.log(`  ⚠️  ${collName}: ${error.message}`);
        }
    }

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`✅ Backup créé: ${backupFile}`);
}

// Fonction pour nettoyer les données soldats dans soldier_equipment et assignments
async function cleanDuplicateSoldierData() {
    console.log('\n🧹 Étape 1: Nettoyage des données soldats dupliquées');
    console.log('-'.repeat(80));

    // Nettoyer soldier_equipment
    const soldierEquipmentSnapshot = await db.collection('soldier_equipment').get();
    let cleanedEquipment = 0;

    for (const doc of soldierEquipmentSnapshot.docs) {
        const data = doc.data();

        // Vérifier si les champs redondants existent
        const hasRedundantData = data.soldierName || data.soldierPhone ||
                                  data.soldierPersonalNumber || data.soldierCompany;

        if (hasRedundantData) {
            console.log(`  📝 ${doc.id}:`);
            console.log(`     - Supprimer: soldierName, soldierPhone, soldierPersonalNumber, soldierCompany`);

            if (!DRY_RUN) {
                await doc.ref.update({
                    soldierName: admin.firestore.FieldValue.delete(),
                    soldierPhone: admin.firestore.FieldValue.delete(),
                    soldierPersonalNumber: admin.firestore.FieldValue.delete(),
                    soldierCompany: admin.firestore.FieldValue.delete()
                });
            }
            cleanedEquipment++;
        }
    }

    console.log(`  ${DRY_RUN ? '📊' : '✅'} ${cleanedEquipment} documents soldier_equipment ${DRY_RUN ? 'seraient nettoyés' : 'nettoyés'}`);

    // Nettoyer assignments
    const assignmentsSnapshot = await db.collection('assignments').get();
    let cleanedAssignments = 0;

    for (const doc of assignmentsSnapshot.docs) {
        const data = doc.data();

        const hasRedundantData = data.soldierName || data.soldierPhone ||
                                  data.soldierPersonalNumber || data.soldierCompany;

        if (hasRedundantData) {
            console.log(`  📝 assignment ${doc.id}:`);
            console.log(`     - Supprimer: soldierName, soldierPhone, soldierPersonalNumber, soldierCompany`);

            if (!DRY_RUN) {
                await doc.ref.update({
                    soldierName: admin.firestore.FieldValue.delete(),
                    soldierPhone: admin.firestore.FieldValue.delete(),
                    soldierPersonalNumber: admin.firestore.FieldValue.delete(),
                    soldierCompany: admin.firestore.FieldValue.delete()
                });
            }
            cleanedAssignments++;
        }
    }

    console.log(`  ${DRY_RUN ? '📊' : '✅'} ${cleanedAssignments} documents assignments ${DRY_RUN ? 'seraient nettoyés' : 'nettoyés'}`);
}

// Fonction pour migrer soldier_holdings vers soldier_equipment
async function mergeSoldierHoldings() {
    console.log('\n🔄 Étape 2: Fusion de soldier_holdings dans soldier_equipment');
    console.log('-'.repeat(80));

    const holdingsSnapshot = await db.collection('soldier_holdings').get();

    if (holdingsSnapshot.empty) {
        console.log('  ℹ️  Collection soldier_holdings vide ou déjà migrée');
        return;
    }

    console.log(`  📊 ${holdingsSnapshot.size} documents à traiter`);

    for (const holdingDoc of holdingsSnapshot.docs) {
        const holdingData = holdingDoc.data();
        const soldierId = holdingData.soldierId;

        console.log(`\n  👤 Soldat ${soldierId}:`);
        console.log(`     Holdings: ${JSON.stringify(holdingData.items || [])}`);

        // Vérifier s'il existe déjà un document soldier_equipment
        const equipmentRef = db.collection('soldier_equipment').doc(soldierId);
        const equipmentDoc = await equipmentRef.get();

        if (equipmentDoc.exists) {
            const equipmentData = equipmentDoc.data();
            console.log(`     Equipment existant: ${JSON.stringify(equipmentData.items || [])}`);

            // Comparer et fusionner
            const existingItems = equipmentData.items || [];
            const holdingItems = holdingData.items || [];

            // Créer une map des items existants par equipmentId
            const itemsMap = new Map();

            existingItems.forEach(item => {
                itemsMap.set(item.equipmentId, item);
            });

            // Ajouter ou mettre à jour avec les holdings
            let updated = false;
            holdingItems.forEach(holdingItem => {
                const existing = itemsMap.get(holdingItem.equipmentId);

                if (existing) {
                    // Vérifier si les quantités diffèrent
                    if (existing.quantity !== holdingItem.quantity) {
                        console.log(`     ⚠️  Conflit pour ${holdingItem.equipmentName}:`);
                        console.log(`        - Equipment: ${existing.quantity}`);
                        console.log(`        - Holdings: ${holdingItem.quantity}`);
                        console.log(`        → Garder la valeur d'equipment: ${existing.quantity}`);
                    }
                } else {
                    console.log(`     ➕ Ajouter: ${holdingItem.equipmentName} (qty: ${holdingItem.quantity})`);
                    itemsMap.set(holdingItem.equipmentId, {
                        type: holdingData.type || 'clothing',
                        equipmentId: holdingItem.equipmentId,
                        equipmentName: holdingItem.equipmentName,
                        quantity: holdingItem.quantity,
                        serials: holdingItem.serials || [],
                        issuedAt: admin.firestore.Timestamp.now(),
                        issuedBy: 'migration'
                    });
                    updated = true;
                }
            });

            if (updated && !DRY_RUN) {
                const mergedItems = Array.from(itemsMap.values());
                await equipmentRef.update({
                    items: mergedItems,
                    lastUpdated: admin.firestore.Timestamp.now()
                });
                console.log(`     ✅ Document soldier_equipment mis à jour`);
            } else if (updated) {
                console.log(`     📊 Document serait mis à jour (dry-run)`);
            } else {
                console.log(`     ℹ️  Aucune mise à jour nécessaire`);
            }
        } else {
            // Créer un nouveau document soldier_equipment
            console.log(`     ➕ Créer nouveau document soldier_equipment`);

            const newItems = (holdingData.items || []).map(item => ({
                type: holdingData.type || 'clothing',
                equipmentId: item.equipmentId,
                equipmentName: item.equipmentName,
                quantity: item.quantity,
                serials: item.serials || [],
                issuedAt: admin.firestore.Timestamp.now(),
                issuedBy: 'migration'
            }));

            if (!DRY_RUN) {
                await equipmentRef.set({
                    soldierId: soldierId,
                    items: newItems,
                    createdAt: admin.firestore.Timestamp.now(),
                    lastUpdated: admin.firestore.Timestamp.now()
                });
                console.log(`     ✅ Document créé`);
            } else {
                console.log(`     📊 Document serait créé (dry-run)`);
            }
        }
    }
}

// Fonction pour supprimer equipment_clothing (doublon)
async function deleteEquipmentClothing() {
    console.log('\n🗑️  Étape 3: Suppression de equipment_clothing (doublon de clothingEquipment)');
    console.log('-'.repeat(80));

    const equipmentClothingSnapshot = await db.collection('equipment_clothing').get();

    if (equipmentClothingSnapshot.empty) {
        console.log('  ℹ️  Collection equipment_clothing déjà vide');
        return;
    }

    console.log(`  📊 ${equipmentClothingSnapshot.size} documents à supprimer`);

    // Vérifier les références avant suppression
    console.log('\n  🔍 Vérification des références...');

    const soldierEquipmentSnapshot = await db.collection('soldier_equipment').get();
    const assignmentsSnapshot = await db.collection('assignments').get();

    let referencesFound = false;

    for (const doc of soldierEquipmentSnapshot.docs) {
        const data = doc.data();
        (data.items || []).forEach(item => {
            equipmentClothingSnapshot.docs.forEach(equipDoc => {
                if (item.equipmentId === equipDoc.id) {
                    console.log(`  ⚠️  Référence trouvée dans soldier_equipment/${doc.id}`);
                    referencesFound = true;
                }
            });
        });
    }

    if (referencesFound) {
        console.log('\n  ❌ ERREUR: Des références à equipment_clothing existent encore!');
        console.log('     Toutes les références pointent vers clothingEquipment? Vérifier manuellement.');
        return;
    }

    console.log('  ✅ Aucune référence active trouvée');

    if (!DRY_RUN) {
        const batch = db.batch();
        equipmentClothingSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`  ✅ ${equipmentClothingSnapshot.size} documents supprimés`);
    } else {
        console.log(`  📊 ${equipmentClothingSnapshot.size} documents seraient supprimés (dry-run)`);
    }
}

// Fonction pour supprimer soldier_holdings après migration
async function deleteSoldierHoldings() {
    console.log('\n🗑️  Étape 4: Suppression de soldier_holdings (après migration)');
    console.log('-'.repeat(80));

    const holdingsSnapshot = await db.collection('soldier_holdings').get();

    if (holdingsSnapshot.empty) {
        console.log('  ℹ️  Collection soldier_holdings déjà vide');
        return;
    }

    console.log(`  📊 ${holdingsSnapshot.size} documents à supprimer`);

    if (!DRY_RUN) {
        const batch = db.batch();
        holdingsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`  ✅ ${holdingsSnapshot.size} documents supprimés`);
    } else {
        console.log(`  📊 ${holdingsSnapshot.size} documents seraient supprimés (dry-run)`);
    }
}

// Fonction pour afficher un rapport final
async function generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RAPPORT FINAL');
    console.log('='.repeat(80));

    const collections = [
        'soldiers',
        'users',
        'soldier_equipment',
        'soldier_holdings',
        'equipment_combat',
        'equipment_clothing',
        'clothingEquipment',
        'assignments'
    ];

    console.log('\nNombre de documents par collection:\n');

    for (const collName of collections) {
        try {
            const snapshot = await db.collection(collName).get();
            const status = snapshot.size === 0 ? '📭' : '📦';
            console.log(`  ${status} ${collName.padEnd(25)} : ${snapshot.size} documents`);
        } catch (error) {
            console.log(`  ❌ ${collName.padEnd(25)} : Erreur`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Structure recommandée:');
    console.log('  ✅ soldiers               - Données de base uniquement');
    console.log('  ✅ users                  - Utilisateurs de l\'app');
    console.log('  ✅ soldier_equipment      - Équipements par soldat (habits + armes)');
    console.log('  ✅ equipment_combat       - Catalogue équipements combat');
    console.log('  ✅ clothingEquipment      - Catalogue équipements vêtements');
    console.log('  ✅ assignments            - Historique des assignations');
    console.log('  ❌ equipment_clothing     - À supprimer (doublon)');
    console.log('  ❌ soldier_holdings       - À supprimer (migré vers soldier_equipment)');
    console.log('='.repeat(80));
}

// Fonction principale
async function main() {
    try {
        // Créer un backup
        if (!DRY_RUN) {
            await createBackup();
        }

        // Exécuter les migrations
        await cleanDuplicateSoldierData();
        await mergeSoldierHoldings();
        await deleteEquipmentClothing();
        await deleteSoldierHoldings();

        // Générer le rapport
        await generateReport();

        console.log('\n' + '='.repeat(80));
        if (DRY_RUN) {
            console.log('✅ SIMULATION TERMINÉE');
            console.log('');
            console.log('Pour exécuter la migration réelle, lancez:');
            console.log('  node scripts/migrate-firestore.js');
            console.log('');
            console.log('Pour ignorer le backup (déconseillé):');
            console.log('  node scripts/migrate-firestore.js --skip-backup');
        } else {
            console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
        }
        console.log('='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERREUR FATALE:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Lancer le script
main();
