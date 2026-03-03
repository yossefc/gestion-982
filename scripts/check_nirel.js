const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../serviceAccountKey.json'), 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'gestion-982'
    });
}

const db = admin.firestore();
// Force using the prod Firestore host
db.settings({ host: 'firestore.googleapis.com', ssl: true });

const soldierName = "\u05E0\u05D9\u05E8\u05D0\u05DC \u05D9\u05E9\u05E9\u05DB\u05E8";

async function check() {
    const report = { soldierName, weaponsAssigned: [], allWeaponsWithThisSoldier: [], soldiers: [], holdings: [] };

    console.log('Checking soldiers collection...');
    const soldiersSnap = await db.collection('soldiers').where('name', '==', soldierName).get();
    soldiersSnap.forEach(doc => {
        const data = doc.data();
        report.soldiers.push({ id: doc.id, name: data.name, grade: data.grade });
    });
    console.log(`  Found ${report.soldiers.length} soldiers`);

    console.log('Checking weapons_inventory...');
    const allWeaponsSnap = await db.collection('weapons_inventory').get();
    console.log(`  Total weapons: ${allWeaponsSnap.size}`);
    allWeaponsSnap.forEach(doc => {
        const data = doc.data();
        if (data.assignedTo && data.assignedTo.soldierName === soldierName) {
            report.allWeaponsWithThisSoldier.push({
                id: doc.id,
                status: data.status,
                category: data.category,
                serialNumber: data.serialNumber,
                assignedTo: {
                    soldierName: data.assignedTo.soldierName,
                    soldierId: data.assignedTo.soldierId,
                    assignedDate: data.assignedTo.assignedDate ? data.assignedTo.assignedDate.toDate().toISOString() : null,
                }
            });
        }
    });
    console.log(`  Weapons assigned to ${soldierName}: ${report.allWeaponsWithThisSoldier.length}`);

    for (const s of report.soldiers) {
        console.log(`Checking holdings for ${s.id}...`);
        const holdingsSnap = await db.collection(`soldiers/${s.id}/holdings`).get();
        holdingsSnap.forEach(doc => {
            const data = doc.data();
            report.holdings.push({ id: doc.id, soldierId: s.id, type: data.type, equipmentName: data.equipmentName, quantity: data.quantity, serials: data.serials || [] });
        });
        console.log(`  Holdings: ${holdingsSnap.size}`);
    }

    fs.writeFileSync(path.join(__dirname, 'nirel_report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log('Report done at scripts/nirel_report.json');
}

check().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e.message, e.code); process.exit(1); });
