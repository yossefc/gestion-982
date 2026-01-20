// Contexte d'authentification pour gérer l'état de connexion
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authLoading: boolean; // Alias for loading
  userRole: string | null; // User's role
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (module: 'arme' | 'vetement' | 'admin') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Récupérer les données utilisateur depuis Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: fbUser.uid,
              email: fbUser.email || '',
              name: userData.name || '',
              phone: userData.phone,
              role: userData.role as UserRole,
              createdAt: userData.createdAt?.toDate() || new Date(),
            });
          } else {
            // Utilisateur Firebase sans données Firestore - plus nécessaire si on utilise signUp correctement
            // mais on le garde par sécurité pour les comptes existants
            console.log(`Creating Firestore profile for user: ${fbUser.email}`);

            const defaultUserData = {
              email: fbUser.email || '',
              name: fbUser.email?.split('@')[0] || 'User',
              role: 'both' as UserRole, // Rôle par défaut
              createdAt: Timestamp.now(),
            };

            // Sauvegarder dans Firestore
            await setDoc(doc(db, 'users', fbUser.uid), defaultUserData);

            setUser({
              id: fbUser.uid,
              ...defaultUserData,
              createdAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      let message = 'שגיאה בהתחברות';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        message = 'אימייל או סיסמה שגויים';
      } else if (error.code === 'auth/wrong-password') {
        message = 'סיסמה שגויה';
      } else if (error.code === 'auth/invalid-email') {
        message = 'אימייל לא תקין';
      }
      throw new Error(message);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // Créer le profil Firestore immédiatement
      const userData = {
        email,
        name,
        role: 'both' as UserRole, // Accès complet par défaut
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'users', fbUser.uid), userData);

      setUser({
        id: fbUser.uid,
        ...userData,
        createdAt: new Date(),
      });
    } catch (error: any) {
      let message = 'שגיאה בהרשמה';
      if (error.code === 'auth/email-already-in-use') {
        message = 'כתובת האימייל כבר בשימוש';
      } else if (error.code === 'auth/weak-password') {
        message = 'הסיסמה חלשה מדי (לפחות 6 תווים)';
      } else if (error.code === 'auth/invalid-email') {
        message = 'אימייל לא תקין';
      }
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Vérifier les permissions selon le rôle
  const hasPermission = (module: 'arme' | 'vetement' | 'admin'): boolean => {
    if (!user) return false;

    switch (user.role) {
      case 'admin':
        return true; // Admin a accès à tout
      case 'both':
        return module !== 'admin'; // Accès arme et vêtement, pas admin
      case 'arme':
        return module === 'arme';
      case 'vetement':
        return module === 'vetement';
      default:
        return false;
    }
  };

  const value = {
    user,
    firebaseUser,
    loading,
    authLoading: loading, // Alias for compatibility
    userRole: user?.role || null,
    signIn,
    signUp,
    signOut,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
