const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('SIMULATION DE MIGRATION - ANALYSE DU JSON EXPORTÉ');
console.log('='.repeat(80));

// Fonction pour charger le JSON
function loadJSON() {
    const args = process.argv.slice(2);
    let jsonPath = args.find(arg => !arg.startsWith('--'));

    if (!jsonPath) {
        console.log('\n❌ Erreur: Veuillez fournir le chemin du fichier JSON');
        console.log('\nUsage: node simulate-migration-from-json.js <chemin-vers-export.json>');
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(jsonPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.log(`\n❌ Erreur lors de la lecture du fichier: ${error.message}`);
        process.exit(1);
    }
}

// Charger les données
const data = loadJSON();
const collections = data.collections;

console.log(`\nFichier chargé: ${data.exportDate}`);
console.log('='.repeat(80));

// Étape 1: Nettoyage des données soldats dupliquées
console.log('\n🧹 Étape 1: Analyse des données soldats dupliquées');
console.log('-'.repeat(80));

let soldierEquipmentCleaned = 0;
let assignmentsCleaned = 0;

if (collections.soldier_equipment) {
    collections.soldier_equipment.forEach(doc => {
        const hasRedundantData = doc.soldierName || doc.soldierPhone ||
                                  doc.soldierPersonalNumber || doc.soldierCompany;

        if (hasRedundantData) {
            console.log(`  📝 soldier_equipment/${doc.id}:`);
            console.log(`     - Nom: ${doc.soldierName || 'N/A'}`);
            console.log(`     - Téléphone: ${doc.soldierPhone || 'N/A'}`);
            console.log(`     - Numéro: ${doc.soldierPersonalNumber || 'N/A'}`);
            console.log(`     - Compagnie: ${doc.soldierCompany || 'N/A'}`);
            console.log(`     ❌ Ces champs seraient supprimés (référence soldierId: ${doc.soldierId} conservée)\n`);
            soldierEquipmentCleaned++;
        }
    });
    console.log(`  📊 ${soldierEquipmentCleaned} documents soldier_equipment avec données dupliquées`);
} else {
    console.log('  ℹ️  Collection soldier_equipment non trouvée dans l\'export');
}

if (collections.assignments) {
    collections.assignments.forEach(doc => {
        const hasRedundantData = doc.soldierName || doc.soldierPhone ||
                                  doc.soldierPersonalNumber || doc.soldierCompany;

        if (hasRedundantData) {
            assignmentsCleaned++;
        }
    });
    console.log(`  📊 ${assignmentsCleaned} documents assignments avec données dupliquées`);
} else {
    console.log('  ℹ️  Collection assignments non trouvée dans l\'export');
}

// Étape 2: Fusion de soldier_holdings
console.log('\n🔄 Étape 2: Analyse de fusion soldier_holdings -> soldier_equipment');
console.log('-'.repeat(80));

if (collections.soldier_holdings && collections.soldier_holdings.length > 0) {
    console.log(`  📊 ${collections.soldier_holdings.length} documents à fusionner\n`);

    const equipmentMap = new Map();
    if (collections.soldier_equipment) {
        collections.soldier_equipment.forEach(doc => {
            equipmentMap.set(doc.id, doc);
        });
    }

    collections.soldier_holdings.forEach(holding => {
        const soldierId = holding.soldierId;
        const existingEquipment = equipmentMap.get(soldierId);

        console.log(`  👤 Soldat ${soldierId} (${holding.soldierName || 'N/A'}):`);
        console.log(`     Type: ${holding.type}`);
        console.log(`     Holdings items: ${holding.items ? holding.items.length : 0}`);

        if (existingEquipment) {
            console.log(`     ✅ Document soldier_equipment existant`);
            console.log(`     Equipment items: ${existingEquipment.items ? existingEquipment.items.length : 0}`);

            // Comparer les items
            if (holding.items && existingEquipment.items) {
                const equipMap = new Map();
                existingEquipment.items.forEach(item => {
                    equipMap.set(item.equipmentId, item);
                });

                holding.items.forEach(holdingItem => {
                    const existing = equipMap.get(holdingItem.equipmentId);
                    if (existing) {
                        if (existing.quantity !== holdingItem.quantity) {
                            console.log(`     ⚠️  CONFLIT - ${holdingItem.equipmentName}:`);
                            console.log(`        Holdings qty: ${holdingItem.quantity}`);
                            console.log(`        Equipment qty: ${existing.quantity}`);
                            console.log(`        → Garder Equipment qty: ${existing.quantity}`);
                        } else {
                            console.log(`     ✓ ${holdingItem.equipmentName}: quantités identiques (${holdingItem.quantity})`);
                        }
                    } else {
                        console.log(`     ➕ AJOUTER: ${holdingItem.equipmentName} (qty: ${holdingItem.quantity})`);
                    }
                });
            }
        } else {
            console.log(`     ➕ CRÉER nouveau document soldier_equipment`);
            if (holding.items) {
                holding.items.forEach(item => {
                    console.log(`        - ${item.equipmentName}: ${item.quantity}`);
                });
            }
        }
        console.log('');
    });
} else {
    console.log('  ℹ️  Collection soldier_holdings vide ou non trouvée');
}

// Étape 3: Analyse equipment_clothing (doublon)
console.log('\n🗑️  Étape 3: Analyse equipment_clothing (doublon de clothingEquipment)');
console.log('-'.repeat(80));

if (collections.equipment_clothing && collections.equipment_clothing.length > 0) {
    console.log(`  📊 ${collections.equipment_clothing.length} documents à supprimer\n`);

    // Comparer avec clothingEquipment
    const clothingEquipMap = new Map();
    if (collections.clothingEquipment) {
        collections.clothingEquipment.forEach(doc => {
            clothingEquipMap.set(doc.name.toLowerCase(), doc);
        });
    }

    console.log('  🔍 Comparaison equipment_clothing vs clothingEquipment:\n');
    collections.equipment_clothing.forEach(item => {
        const match = clothingEquipMap.get(item.name.toLowerCase());
        if (match) {
            console.log(`  ✓ "${item.name}" existe dans clothingEquipment (ID: ${match.id})`);
        } else {
            console.log(`  ⚠️  "${item.name}" (ID: ${item.id}) n'existe PAS dans clothingEquipment - Vérification requise!`);
        }
    });

    // Vérifier les références
    console.log('\n  🔍 Vérification des références à equipment_clothing:\n');
    let referencesFound = false;

    if (collections.soldier_equipment) {
        collections.soldier_equipment.forEach(doc => {
            if (doc.items) {
                doc.items.forEach(item => {
                    const isInEquipmentClothing = collections.equipment_clothing.some(
                        eq => eq.id === item.equipmentId
                    );
                    if (isInEquipmentClothing) {
                        console.log(`  ⚠️  soldier_equipment/${doc.id} référence equipment_clothing/${item.equipmentId}`);
                        referencesFound = true;
                    }
                });
            }
        });
    }

    if (!referencesFound) {
        console.log('  ✅ Aucune référence active à equipment_clothing trouvée');
        console.log('  ✅ Suppression sécurisée possible');
    } else {
        console.log('\n  ❌ ATTENTION: Des références existent encore!');
        console.log('     Migrer les références vers clothingEquipment avant suppression');
    }
} else {
    console.log('  ℹ️  Collection equipment_clothing vide ou non trouvée');
}

// Rapport des doublons
console.log('\n📋 Étape 4: Analyse des doublons');
console.log('-'.repeat(80));

// Vérifier les doublons d'équipements
console.log('\n🔍 Équipements vêtements en double:\n');

if (collections.equipment_clothing && collections.clothingEquipment) {
    const allClothing = {};

    collections.equipment_clothing.forEach(item => {
        const key = item.name.toLowerCase();
        if (!allClothing[key]) {
            allClothing[key] = [];
        }
        allClothing[key].push({ id: item.id, collection: 'equipment_clothing' });
    });

    collections.clothingEquipment.forEach(item => {
        const key = item.name.toLowerCase();
        if (!allClothing[key]) {
            allClothing[key] = [];
        }
        allClothing[key].push({ id: item.id, collection: 'clothingEquipment' });
    });

    Object.entries(allClothing).forEach(([name, items]) => {
        if (items.length > 1) {
            console.log(`  ⚠️  DOUBLON: "${name}"`);
            items.forEach(item => {
                console.log(`     - ${item.collection}/${item.id}`);
            });
            console.log('');
        }
    });
}

// Rapport final
console.log('\n' + '='.repeat(80));
console.log('📊 RAPPORT DE SIMULATION');
console.log('='.repeat(80));

console.log('\nCollections actuelles:\n');
Object.entries(collections).forEach(([name, docs]) => {
    const count = Array.isArray(docs) ? docs.length : 0;
    const status = count === 0 ? '📭' : '📦';
    console.log(`  ${status} ${name.padEnd(25)} : ${count} documents`);
});

console.log('\n' + '-'.repeat(80));
console.log('Actions qui seraient effectuées:\n');

console.log(`  🧹 Nettoyer ${soldierEquipmentCleaned} documents soldier_equipment`);
console.log(`  🧹 Nettoyer ${assignmentsCleaned} documents assignments`);

if (collections.soldier_holdings) {
    console.log(`  🔄 Fusionner ${collections.soldier_holdings.length} documents soldier_holdings`);
}

if (collections.equipment_clothing) {
    console.log(`  🗑️  Supprimer ${collections.equipment_clothing.length} documents equipment_clothing`);
}

if (collections.soldier_holdings) {
    console.log(`  🗑️  Supprimer ${collections.soldier_holdings.length} documents soldier_holdings`);
}

console.log('\n' + '-'.repeat(80));
console.log('Structure finale recommandée:\n');

console.log('  ✅ soldiers               - Données de base uniquement');
console.log('  ✅ users                  - Utilisateurs de l\'app');
console.log('  ✅ soldier_equipment      - Équipements par soldat (habits + armes)');
console.log('  ✅ equipment_combat       - Catalogue équipements combat');
console.log('  ✅ clothingEquipment      - Catalogue équipements vêtements');
console.log('  ✅ assignments            - Historique des assignations');
console.log('  ❌ equipment_clothing     - À supprimer (doublon)');
console.log('  ❌ soldier_holdings       - À supprimer (migré)');

console.log('\n' + '='.repeat(80));
console.log('✅ SIMULATION TERMINÉE');
console.log('');
console.log('Pour exécuter la migration réelle sur Firebase:');
console.log('  1. Corriger les credentials Firebase');
console.log('  2. Lancer: node scripts/migrate-firestore.js --dry-run');
console.log('  3. Puis: node scripts/migrate-firestore.js');
console.log('='.repeat(80));
