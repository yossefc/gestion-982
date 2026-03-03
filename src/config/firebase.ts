// Firebase configuration for Gestion 982
import { getApp, getApps, initializeApp } from 'firebase/app';
// @ts-ignore - Firebase v12 sometimes has missing type definition for this export
import { Auth, getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyB229X5qoI8v5KOQ_gG0RtyIJAWZ-GfU50',
  authDomain: 'gestion-982.firebaseapp.com',
  projectId: 'gestion-982',
  storageBucket: 'gestion-982.firebasestorage.app',
  messagingSenderId: '624248239778',
  appId: '1:624248239778:android:497ded1eeec435330cc9fb',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  // Web bundle must not use React Native persistence API.
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch (error: any) {
    // If auth is already initialized, getAuth will return the existing instance
    if (error?.code !== 'auth/already-initialized') {
      console.warn(
        '[Firebase] React Native persistence error, using default auth fallback.',
        error
      );
    }
    return getAuth(app);
  }
}

const auth = createAuth();
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
