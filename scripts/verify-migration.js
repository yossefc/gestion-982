const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log('='.repeat(80));
console.log('VÉRIFICATION POST-MIGRATION');
console.log('='.repeat(80));

async function verifyMigration() {
    const issues = [];
    let checksPerformed = 0;

    console.log('\n🔍 Vérification en cours...\n');

    // Check 1: Vérifier que equipment_clothing est vide ou n'existe plus
    console.log('✓ Check 1: Collection equipment_clothing');
    checksPerformed++;
    try {
        const equipmentClothingSnapshot = await db.collection('equipment_clothing').get();
        if (equipmentClothingSnapshot.size > 0) {
            issues.push({
                level: 'ERROR',
                message: `Collection equipment_clothing contient encore ${equipmentClothingSnapshot.size} documents`
            });
            console.log(`  ❌ ERREUR: ${equipmentClothingSnapshot.size} documents restants`);
        } else {
            console.log('  ✅ Collection vide ou supprimée');
        }
    } catch (error) {
        console.log('  ✅ Collection n\'existe plus');
    }

    // Check 2: Vérifier que soldier_holdings est vide ou n'existe plus
    console.log('\n✓ Check 2: Collection soldier_holdings');
    checksPerformed++;
    try {
        const holdingsSnapshot = await db.collection('soldier_holdings').get();
        if (holdingsSnapshot.size > 0) {
            issues.push({
                level: 'ERROR',
                message: `Collection soldier_holdings contient encore ${holdingsSnapshot.size} documents`
            });
            console.log(`  ❌ ERREUR: ${holdingsSnapshot.size} documents restants`);
        } else {
            console.log('  ✅ Collection vide ou supprimée');
        }
    } catch (error) {
        console.log('  ✅ Collection n\'existe plus');
    }

    // Check 3: Vérifier qu'aucun document soldier_equipment n'a de données soldats dupliquées
    console.log('\n✓ Check 3: Données dupliquées dans soldier_equipment');
    checksPerformed++;
    const soldierEquipmentSnapshot = await db.collection('soldier_equipment').get();
    let duplicatesFound = 0;

    soldierEquipmentSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const hasDuplicates = data.soldierName || data.soldierPhone ||
                              data.soldierPersonalNumber || data.soldierCompany;

        if (hasDuplicates) {
            duplicatesFound++;
            issues.push({
                level: 'WARNING',
                message: `Document soldier_equipment/${doc.id} contient des données soldats dupliquées`
            });
        }
    });

    if (duplicatesFound > 0) {
        console.log(`  ⚠️  ATTENTION: ${duplicatesFound} documents avec données dupliquées`);
    } else {
        console.log('  ✅ Aucune donnée dupliquée');
    }

    // Check 4: Vérifier qu'aucun document assignments n'a de données soldats dupliquées
    console.log('\n✓ Check 4: Données dupliquées dans assignments');
    checksPerformed++;
    const assignmentsSnapshot = await db.collection('assignments').get();
    let assignmentDuplicates = 0;

    assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const hasDuplicates = data.soldierName || data.soldierPhone ||
                              data.soldierPersonalNumber || data.soldierCompany;

        if (hasDuplicates) {
            assignmentDuplicates++;
            issues.push({
                level: 'WARNING',
                message: `Document assignments/${doc.id} contient des données soldats dupliquées`
            });
        }
    });

    if (assignmentDuplicates > 0) {
        console.log(`  ⚠️  ATTENTION: ${assignmentDuplicates} documents avec données dupliquées`);
    } else {
        console.log('  ✅ Aucune donnée dupliquée');
    }

    // Check 5: Vérifier l'intégrité des références
    console.log('\n✓ Check 5: Intégrité des références soldierId');
    checksPerformed++;
    const soldiersSnapshot = await db.collection('soldiers').get();
    const soldierIds = new Set(soldiersSnapshot.docs.map(doc => doc.id));

    let brokenReferences = 0;

    // Vérifier soldier_equipment
    soldierEquipmentSnapshot.docs.forEach(doc => {
        if (!soldierIds.has(doc.id)) {
            brokenReferences++;
            issues.push({
                level: 'ERROR',
                message: `soldier_equipment/${doc.id} référence un soldat inexistant`
            });
        }
    });

    // Vérifier assignments
    assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.soldierId && !soldierIds.has(data.soldierId)) {
            brokenReferences++;
            issues.push({
                level: 'WARNING',
                message: `assignments/${doc.id} référence un soldat inexistant: ${data.soldierId}`
            });
        }
    });

    if (brokenReferences > 0) {
        console.log(`  ⚠️  ATTENTION: ${brokenReferences} références cassées`);
    } else {
        console.log('  ✅ Toutes les références sont valides');
    }

    // Check 6: Vérifier la cohérence des IDs d'équipements
    console.log('\n✓ Check 6: Cohérence des IDs d\'équipements');
    checksPerformed++;
    const clothingEquipmentSnapshot = await db.collection('clothingEquipment').get();
    const combatEquipmentSnapshot = await db.collection('equipment_combat').get();

    const validClothingIds = new Set(clothingEquipmentSnapshot.docs.map(doc => doc.id));
    const validCombatIds = new Set(combatEquipmentSnapshot.docs.map(doc => doc.id));

    let invalidEquipmentRefs = 0;

    soldierEquipmentSnapshot.docs.forEach(doc => {
        const data = doc.data();
        (data.items || []).forEach(item => {
            if (item.type === 'clothing' && !validClothingIds.has(item.equipmentId)) {
                invalidEquipmentRefs++;
                issues.push({
                    level: 'ERROR',
                    message: `soldier_equipment/${doc.id} référence un équipement clothing inexistant: ${item.equipmentId}`
                });
            } else if (item.type === 'combat' && !validCombatIds.has(item.equipmentId)) {
                invalidEquipmentRefs++;
                issues.push({
                    level: 'ERROR',
                    message: `soldier_equipment/${doc.id} référence un équipement combat inexistant: ${item.equipmentId}`
                });
            }
        });
    });

    if (invalidEquipmentRefs > 0) {
        console.log(`  ⚠️  ATTENTION: ${invalidEquipmentRefs} références d'équipements invalides`);
    } else {
        console.log('  ✅ Toutes les références d\'équipements sont valides');
    }

    // Check 7: Statistiques générales
    console.log('\n✓ Check 7: Statistiques générales');
    checksPerformed++;
    console.log(`  📊 Soldats: ${soldiersSnapshot.size}`);
    console.log(`  📊 Équipements soldats: ${soldierEquipmentSnapshot.size}`);
    console.log(`  📊 Assignations: ${assignmentsSnapshot.size}`);
    console.log(`  📊 Équipements vêtements (catalogue): ${clothingEquipmentSnapshot.size}`);
    console.log(`  📊 Équipements combat (catalogue): ${combatEquipmentSnapshot.size}`);

    // Résumé final
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ DE LA VÉRIFICATION');
    console.log('='.repeat(80));
    console.log(`\nChecks effectués: ${checksPerformed}`);

    if (issues.length === 0) {
        console.log('\n✅ AUCUN PROBLÈME DÉTECTÉ');
        console.log('   La migration s\'est déroulée avec succès!');
    } else {
        console.log(`\n⚠️  ${issues.length} PROBLÈME(S) DÉTECTÉ(S):\n`);

        const errors = issues.filter(i => i.level === 'ERROR');
        const warnings = issues.filter(i => i.level === 'WARNING');

        if (errors.length > 0) {
            console.log(`❌ Erreurs critiques (${errors.length}):`);
            errors.forEach((issue, idx) => {
                console.log(`   ${idx + 1}. ${issue.message}`);
            });
            console.log('');
        }

        if (warnings.length > 0) {
            console.log(`⚠️  Avertissements (${warnings.length}):`);
            warnings.forEach((issue, idx) => {
                console.log(`   ${idx + 1}. ${issue.message}`);
            });
            console.log('');
        }

        if (errors.length > 0) {
            console.log('🔧 ACTIONS RECOMMANDÉES:');
            console.log('   1. Vérifier les messages d\'erreur ci-dessus');
            console.log('   2. Relancer le script de migration si nécessaire');
            console.log('   3. Corriger manuellement les problèmes persistants');
        }
    }

    console.log('='.repeat(80));

    process.exit(issues.filter(i => i.level === 'ERROR').length > 0 ? 1 : 0);
}

verifyMigration().catch(err => {
    console.error('\n❌ ERREUR:', err);
    process.exit(1);
});
