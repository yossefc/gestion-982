import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// Need the full firebase config since this is standalone
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSoldier() {
    console.log('Querying soldiers for "עידו כהן"...');
    try {
        const q1 = query(collection(db, 'soldiers'), where('name', '==', 'עידו כהן'));
        const snap1 = await getDocs(q1);

        if (snap1.empty) {
            console.log('No soldier found named עידו כהן');
        } else {
            snap1.forEach(doc => {
                console.log('Soldier Data:', doc.id, doc.data());
            });
        }

        console.log('\nQuerying combat_holdings for "עידו כהן"...');
        const q2 = query(collection(db, 'combat_holdings'), where('soldierName', '==', 'עידו כהן'));
        const snap2 = await getDocs(q2);

        if (snap2.empty) {
            console.log('No combat holdings found for עידו כהן');
        } else {
            snap2.forEach(doc => {
                console.log('Holding Data:', doc.id, JSON.stringify(doc.data(), null, 2));
            });
        }
    } catch (e) {
        console.error('Error querying firestore:', e);
    }
}

checkSoldier();
