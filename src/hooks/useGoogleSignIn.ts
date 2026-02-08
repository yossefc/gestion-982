/**
 * Hook pour le login via Google avec Firebase
 * Utilise expo-auth-session pour lancer le Google OAuth
 * Firebase's onAuthStateChanged détecte automatiquement la connexion
 */

import { useState, useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';

const GOOGLE_WEB_CLIENT_ID = '624248239778-dk7ol95h5n9oki3q5jdijo82skupu8da.apps.googleusercontent.com';

export const useGoogleSignIn = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
    redirectUri: AuthSession.makeRedirectUri(),
  });

  // Gérer la réponse Google OAuth automatiquement
  useEffect(() => {
    const handleResponse = async () => {
      if (!response) return;

      if (response.type === 'success') {
        setError(null);
        try {
          const { authentication } = response;
          if (authentication?.idToken) {
            const credential = GoogleAuthProvider.credential(
              authentication.idToken,
              authentication.accessToken
            );
            await signInWithCredential(auth, credential);
            // Firebase's onAuthStateChanged dans AuthContext va gérer le reste
          } else {
            setError('לא נמצא token מ-Google');
          }
        } catch (err: any) {
          console.error('Google sign in error:', err);
          if (err.code === 'auth/account-exists-with-different-credential') {
            setError('חשבון כבר קיים עם פרטי התחברות שונים');
          } else {
            setError('שגיאה בהתחברות עם Google');
          }
        }
      } else if (response.type === 'dismiss') {
        setError(null); // User cancelled, not an error
      } else {
        setError('Google OAuth נפתל');
      }

      setGoogleLoading(false);
    };

    handleResponse();
  }, [response]);

  const signInWithGoogle = async () => {
    if (!request) {
      setError('Google OAuth לא מכין');
      return;
    }
    setError(null);
    setGoogleLoading(true);
    await promptAsync();
  };

  return {
    signInWithGoogle,
    googleLoading,
    googleReady: !!request,
    googleError: error,
    clearGoogleError: () => setError(null),
  };
};
