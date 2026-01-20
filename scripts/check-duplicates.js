const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkDuplicates() {
    const report = [];

    report.push('='.repeat(70));
    report.push('RAPPORT D\'ANALYSE FIRESTORE - DÉTECTION DE DOUBLONS');
    report.push('='.repeat(70));
    report.push('');

    // Analyser soldiers
    report.push('\n📊 COLLECTION: soldiers');
    report.push('-'.repeat(70));
    const soldiersSnap = await db.collection('soldiers').get();
    report.push(`Total: ${soldiersSnap.size} documents`);

    const personalNumbers = {};
    soldiersSnap.forEach(doc => {
        const data = doc.data();
        if (data.personalNumber) {
            if (!personalNumbers[data.personalNumber]) {
                personalNumbers[data.personalNumber] = [];
            }
            personalNumbers[data.personalNumber].push({
                id: doc.id,
                name: data.name
            });
        }
    });

    let duplicatesFound = false;
    Object.entries(personalNumbers).forEach(([pn, docs]) => {
        if (docs.length > 1) {
            if (!duplicatesFound) {
                report.push('\n⚠️  DOUBLONS DÉTECTÉS:');
                duplicatesFound = true;
            }
            report.push(`  Numéro personnel "${pn}" - ${docs.length} occurrences:`);
            docs.forEach(d => report.push(`    - ID: ${d.id}, Nom: ${d.name}`));
        }
    });

    if (!duplicatesFound) {
        report.push('✅ Aucun doublon de numéro personnel');
    }

    // Analyser users
    report.push('\n\n📊 COLLECTION: users');
    report.push('-'.repeat(70));
    const usersSnap = await db.collection('users').get();
    report.push(`Total: ${usersSnap.size} documents`);

    const emails = {};
    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.email) {
            if (!emails[data.email]) {
                emails[data.email] = [];
            }
            emails[data.email].push({
                id: doc.id,
                role: data.role
            });
        }
    });

    duplicatesFound = false;
    Object.entries(emails).forEach(([email, docs]) => {
        if (docs.length > 1) {
            if (!duplicatesFound) {
                report.push('\n⚠️  DOUBLONS DÉTECTÉS:');
                duplicatesFound = true;
            }
            report.push(`  Email "${email}" - ${docs.length} occurrences:`);
            docs.forEach(d => report.push(`    - ID: ${d.id}, Rôle: ${d.role}`));
        }
    });

    if (!duplicatesFound) {
        report.push('✅ Aucun doublon d\'email');
    }

    // Analyser assignments
    report.push('\n\n📊 COLLECTION: assignments');
    report.push('-'.repeat(70));
    const assignmentsSnap = await db.collection('assignments').get();
    report.push(`Total: ${assignmentsSnap.size} documents`);

    const assignmentKeys = {};
    assignmentsSnap.forEach(doc => {
        const data = doc.data();
        const key = `${data.soldierId}_${data.type}_${data.action || 'issue'}`;
        if (!assignmentKeys[key]) {
            assignmentKeys[key] = [];
        }
        assignmentKeys[key].push({
            id: doc.id,
            soldierName: data.soldierName,
            status: data.status
        });
    });

    duplicatesFound = false;
    Object.entries(assignmentKeys).forEach(([key, docs]) => {
        if (docs.length > 1) {
            if (!duplicatesFound) {
                report.push('\n⚠️  DOUBLONS POTENTIELS DÉTECTÉS:');
                duplicatesFound = true;
            }
            report.push(`  Clé "${key}" - ${docs.length} occurrences:`);
            docs.forEach(d => report.push(`    - ID: ${d.id}, Soldat: ${d.soldierName}, Statut: ${d.status}`));
        }
    });

    if (!duplicatesFound) {
        report.push('✅ Aucun doublon d\'assignment');
    }

    // Résumé des collections
    report.push('\n\n' + '='.repeat(70));
    report.push('RÉSUMÉ DES COLLECTIONS');
    report.push('='.repeat(70));

    const collections = ['soldiers', 'users', 'assignments', 'combatEquipment', 'clothingEquipment', 'manot'];
    for (const coll of collections) {
        const snap = await db.collection(coll).get();
        report.push(`${coll.padEnd(25)} : ${snap.size} documents`);
    }

    // Sauvegarder le rapport
    const reportText = report.join('\n');
    fs.writeFileSync('firestore-analysis-report.txt', reportText, 'utf8');

    console.log(reportText);
    console.log('\n\n✅ Rapport sauvegardé dans: firestore-analysis-report.txt');
}

checkDuplicates()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erreur:', err);
        process.exit(1);
    });
