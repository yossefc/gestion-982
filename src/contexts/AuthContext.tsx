// Contexte d'authentification pour gérer l'état de connexion
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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
            // Utilisateur Firebase sans données Firestore
            // Créer un profil par défaut (pour le premier admin)
            setUser({
              id: fbUser.uid,
              email: fbUser.email || '',
              name: fbUser.email?.split('@')[0] || 'User',
              role: 'both', // Rôle par défaut
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
      if (error.code === 'auth/user-not-found') {
        message = 'משתמש לא קיים';
      } else if (error.code === 'auth/wrong-password') {
        message = 'סיסמה שגויה';
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
    signIn,
    signOut,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
