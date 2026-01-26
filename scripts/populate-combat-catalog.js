const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Vérifier si Firebase est déjà initialisé
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Arguments du script
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');

console.log('='.repeat(80));
console.log('PEUPLEMENT DU CATALOGUE COMBAT');
console.log('='.repeat(80));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN (simulation)' : '⚠️  EXÉCUTION RÉELLE'}`);
console.log(`Reset: ${RESET ? '✅ Supprimer et recréer' : '➕ Ajouter uniquement'}`);
console.log('='.repeat(80));

// Catalogue des équipements de combat
const combatEquipments = [
    // === ARMES (נשק) ===
    {
        name: 'M16',
        category: 'נשק',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'מחסנית ריקה' },
            { id: '2', name: 'רצועה' },
            { id: '3', name: 'כידון משולש' }
        ]
    },
    {
        name: 'M203',
        category: 'נשק',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'רצועה' },
            { id: '2', name: 'נרתיק' }
        ]
    },
    {
        name: 'MAG',
        category: 'נשק',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'רצועה' },
            { id: '2', name: 'חגורה' }
        ]
    },
    {
        name: 'נגב',
        category: 'נשק',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'רצועה' },
            { id: '2', name: 'מחסנית' }
        ]
    },
    {
        name: 'קשת',
        category: 'נשק',
        hasSubEquipment: false
    },
    {
        name: 'טאבור',
        category: 'נשק',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'מחסנית' },
            { id: '2', name: 'רצועה' }
        ]
    },
    {
        name: 'M4',
        category: 'נשק',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'מחסנית' },
            { id: '2', name: 'רצועה' },
            { id: '3', name: 'כידון' }
        ]
    },

    // === OPTIQUE (אופטיקה) ===
    {
        name: 'משקפת קרבית',
        category: 'אופטיקה',
        hasSubEquipment: false
    },
    {
        name: 'כוונת לילה',
        category: 'אופטיקה',
        hasSubEquipment: false
    },
    {
        name: 'כוונת יום',
        category: 'אופטיקה',
        hasSubEquipment: false
    },
    {
        name: 'אקדח',
        category: 'אופטיקה',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'נרתיק' },
            { id: '2', name: 'מחסנית' }
        ]
    },

    // === ÉQUIPEMENT PERSONNEL (ציוד אישי) ===
    {
        name: 'אפוד טקטי',
        category: 'ציוד אישי',
        hasSubEquipment: false
    },
    {
        name: 'קסדה',
        category: 'ציוד אישי',
        hasSubEquipment: false
    },
    {
        name: 'מגפיים',
        category: 'ציוד אישי',
        hasSubEquipment: false
    },
    {
        name: 'חגורה טקטית',
        category: 'ציוד אישי',
        hasSubEquipment: false
    },

    // === COMMUNICATION (תקשורת) ===
    {
        name: 'אמ"ר',
        category: 'תקשורת',
        hasSubEquipment: true,
        subEquipments: [
            { id: '1', name: 'סוללה' },
            { id: '2', name: 'אוזניה' },
            { id: '3', name: 'מטען' }
        ]
    },
    {
        name: 'טרנזיסטור',
        category: 'תקשורת',
        hasSubEquipment: false
    },

    // === BIGOUDIM LAKHIMA (אפנאותי לחימה) ===
    {
        name: 'מדים א׳',
        category: 'אפנאותי לחימה',
        hasSubEquipment: false
    },
    {
        name: 'מדים ב׳',
        category: 'אפנאותי לחימה',
        hasSubEquipment: false
    },
    {
        name: 'ז׳קט חורף',
        category: 'אפנאותי לחימה',
        hasSubEquipment: false
    },
    {
        name: 'שקי שינה',
        category: 'אפנאותי לחימה',
        hasSubEquipment: false
    },

    // === AUTRES (אחר) ===
    {
        name: 'אולר',
        category: 'אחר',
        hasSubEquipment: false
    },
    {
        name: 'נשא',
        category: 'אחר',
        hasSubEquipment: false
    },
    {
        name: 'שק גב',
        category: 'אחר',
        hasSubEquipment: false
    }
];

async function resetCatalog() {
    console.log('\n🗑️  Réinitialisation du catalogue...\n');

    const snapshot = await db.collection('combatEquipment').get();

    if (snapshot.empty) {
        console.log('  ℹ️  Catalogue déjà vide');
        return;
    }

    console.log(`  📦 ${snapshot.size} équipements existants`);

    if (!DRY_RUN) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`  ✅ ${snapshot.size} équipements supprimés\n`);
    } else {
        console.log(`  📊 ${snapshot.size} équipements seraient supprimés\n`);
    }
}

async function addEquipments() {
    console.log('\n➕ Ajout des équipements de combat...\n');

    let added = 0;
    let skipped = 0;

    for (const equipment of combatEquipments) {
        try {
            // Vérifier si l'équipement existe déjà (par nom)
            const existingQuery = await db.collection('combatEquipment')
                .where('name', '==', equipment.name)
                .limit(1)
                .get();

            if (!existingQuery.empty && !RESET) {
                console.log(`  ⏭️  "${equipment.name}" existe déjà (ignoré)`);
                skipped++;
                continue;
            }

            const data = {
                ...equipment,
                createdAt: admin.firestore.Timestamp.now()
            };

            console.log(`  ✅ "${equipment.name}" (${equipment.category})`);
            if (equipment.hasSubEquipment && equipment.subEquipments) {
                equipment.subEquipments.forEach(sub => {
                    console.log(`     └─ ${sub.name}`);
                });
            }

            if (!DRY_RUN) {
                await db.collection('combatEquipment').add(data);
            }

            added++;
        } catch (error) {
            console.log(`  ❌ Erreur pour "${equipment.name}": ${error.message}`);
        }
    }

    console.log(`\n  📊 Résumé:`);
    console.log(`     Ajoutés: ${added}`);
    console.log(`     Ignorés: ${skipped}`);
}

async function displaySummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RAPPORT FINAL');
    console.log('='.repeat(80));

    const snapshot = await db.collection('combatEquipment').get();

    console.log(`\nTotal équipements combat: ${snapshot.size}\n`);

    // Grouper par catégorie
    const byCategory = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const category = data.category || 'אחר';

        if (!byCategory[category]) {
            byCategory[category] = [];
        }

        byCategory[category].push({
            name: data.name,
            hasSubEquipment: data.hasSubEquipment,
            subCount: data.subEquipments?.length || 0
        });
    });

    // Afficher par catégorie
    Object.entries(byCategory).forEach(([category, items]) => {
        console.log(`${category} (${items.length} items):`);
        items.forEach(item => {
            const sub = item.hasSubEquipment ? ` [${item.subCount} sous-équipements]` : '';
            console.log(`  • ${item.name}${sub}`);
        });
        console.log('');
    });

    console.log('='.repeat(80));
}

async function main() {
    try {
        // Réinitialiser si demandé
        if (RESET) {
            await resetCatalog();
        }

        // Ajouter les équipements
        await addEquipments();

        // Afficher le résumé
        await displaySummary();

        console.log('');
        if (DRY_RUN) {
            console.log('✅ SIMULATION TERMINÉE');
            console.log('');
            console.log('Pour exécuter l\'ajout réel:');
            console.log('  node scripts/populate-combat-catalog.js');
            console.log('');
            console.log('Pour réinitialiser et recréer le catalogue:');
            console.log('  node scripts/populate-combat-catalog.js --reset');
        } else {
            console.log('✅ CATALOGUE COMBAT PEUPLÉ AVEC SUCCÈS');
            console.log('');
            console.log('Le catalogue est maintenant prêt à être utilisé dans l\'application.');
        }
        console.log('='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERREUR:', error);
        process.exit(1);
    }
}

main();
