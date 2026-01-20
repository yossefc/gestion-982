const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function analyzeFirestore() {
    console.log('='.repeat(60));
    console.log('ANALYSE DE LA BASE DE DONNÉES FIRESTORE');
    console.log('='.repeat(60));

    const collections = [
        'soldiers',
        'users',
        'assignments',
        'combatEquipment',
        'clothingEquipment',
        'manot',
        'soldier_holdings'
    ];

    const results = {};

    for (const collName of collections) {
        try {
            const snapshot = await db.collection(collName).get();
            results[collName] = {
                count: snapshot.size,
                docs: []
            };

            console.log(`\n${'='.repeat(60)}`);
            console.log(`Collection: ${collName}`);
            console.log(`Total documents: ${snapshot.size}`);

            if (snapshot.size > 0) {
                // Analyser les doublons potentiels
                const fieldValues = {};

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    results[collName].docs.push({
                        id: doc.id,
                        data: data
                    });

                    // Vérifier les champs clés pour détecter les doublons
                    if (collName === 'soldiers' && data.personalNumber) {
                        if (!fieldValues[data.personalNumber]) {
                            fieldValues[data.personalNumber] = [];
                        }
                        fieldValues[data.personalNumber].push(doc.id);
                    }

                    if (collName === 'users' && data.email) {
                        if (!fieldValues[data.email]) {
                            fieldValues[data.email] = [];
                        }
                        fieldValues[data.email].push(doc.id);
                    }
                });

                // Afficher les doublons détectés
                let duplicatesFound = false;
                Object.entries(fieldValues).forEach(([value, ids]) => {
                    if (ids.length > 1) {
                        if (!duplicatesFound) {
                            console.log('\n⚠️  DOUBLONS DÉTECTÉS:');
                            duplicatesFound = true;
                        }
                        console.log(`  - Valeur "${value}" trouvée ${ids.length} fois:`);
                        ids.forEach(id => console.log(`    • Document ID: ${id}`));
                    }
                });

                if (!duplicatesFound) {
                    console.log('✅ Aucun doublon détecté');
                }

                // Afficher un échantillon de documents
                if (snapshot.size <= 3) {
                    console.log('\nÉchantillon de documents:');
                    snapshot.docs.forEach((doc, idx) => {
                        console.log(`\n  Document ${idx + 1} (ID: ${doc.id}):`);
                        const data = doc.data();
                        Object.entries(data).slice(0, 5).forEach(([key, value]) => {
                            let displayValue = value;
                            if (value && typeof value === 'object' && value.toDate) {
                                displayValue = value.toDate().toISOString();
                            } else if (typeof value === 'object') {
                                displayValue = JSON.stringify(value).substring(0, 50) + '...';
                            }
                            console.log(`    ${key}: ${displayValue}`);
                        });
                    });
                } else {
                    console.log(`\n📊 Trop de documents pour afficher (${snapshot.size}). Affichage des 2 premiers:`);
                    snapshot.docs.slice(0, 2).forEach((doc, idx) => {
                        console.log(`\n  Document ${idx + 1} (ID: ${doc.id}):`);
                        const data = doc.data();
                        Object.entries(data).slice(0, 3).forEach(([key, value]) => {
                            let displayValue = value;
                            if (value && typeof value === 'object' && value.toDate) {
                                displayValue = value.toDate().toISOString();
                            } else if (typeof value === 'object') {
                                displayValue = JSON.stringify(value).substring(0, 30) + '...';
                            }
                            console.log(`    ${key}: ${displayValue}`);
                        });
                    });
                }
            } else {
                console.log('📭 Collection vide');
            }
        } catch (error) {
            console.log(`❌ Erreur lors de l'analyse de ${collName}:`, error.message);
        }
    }

    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('RÉSUMÉ');
    console.log('='.repeat(60));
    Object.entries(results).forEach(([name, data]) => {
        console.log(`${name.padEnd(25)} : ${data.count} documents`);
    });
    console.log('='.repeat(60));
}

analyzeFirestore()
    .then(() => {
        console.log('\n✅ Analyse terminée');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Erreur:', err);
        process.exit(1);
    });
