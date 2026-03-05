const admin = require('firebase-admin');
const serviceAccount = require('../gestion-982-firebase-adminsdk-fbsvc-756554fc52.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSoldier() {
    const assignmentsRef = db.collection('assignments');
    const snapshot = await assignmentsRef.where('soldierId', '==', 'Iq31DYlQhpSGf0nca5xF').get();

    if (snapshot.empty) {
        console.log('No assignments for this soldier.');
    } else {
        // Sort array in memory
        const docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
        docs.sort((a, b) => (a.data.timestamp?._seconds || 0) - (b.data.timestamp?._seconds || 0));

        docs.forEach(doc => {
            const data = doc.data;
            console.log('---- Assignment:', doc.id);
            console.log('Type:', data.type);
            console.log('Action:', data.action);
            console.log('Company:', data.soldierCompany);
            console.log('Time:', data.timestamp ? new Date(data.timestamp._seconds * 1000).toLocaleString() : 'N/A');
            console.log('Status:', data.status);
            console.log('Items:', JSON.stringify(data.items, null, 2));
        });
    }
}

checkSoldier().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
