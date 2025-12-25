// Configuration Firebase pour l'application Gestion 982
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB229X5qoI8v5KOQ_gG0RtyIJAWZ-GfU50",
  authDomain: "gestion-982.firebaseapp.com",
  projectId: "gestion-982",
  storageBucket: "gestion-982.firebasestorage.app",
  messagingSenderId: "624248239778",
  appId: "1:624248239778:android:497ded1eeec435330cc9fb"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser Auth
const auth = getAuth(app);

// Initialiser Firestore
const db = getFirestore(app);

// Initialiser Storage
const storage = getStorage(app);

export { app, auth, db, storage };
