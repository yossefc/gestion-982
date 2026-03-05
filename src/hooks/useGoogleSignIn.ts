/**
 * Hook pour le login via Google avec Firebase
 * Utilise expo-auth-session pour lancer le Google OAuth
 * Firebase's onAuthStateChanged détecte automatiquement la connexion
 *
 * CONFIGURATION REQUISE dans Google Cloud Console :
 * - Ajouter "gestion982://" aux Authorized Redirect URIs du client OAuth Web
 * - OU créer des clients OAuth pour iOS (com.gestion982.app) et Android (com.gestion982.app)
 *   et renseigner GOOGLE_IOS_CLIENT_ID et GOOGLE_ANDROID_CLIENT_ID ci-dessous
 */

import { useState, useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';

const GOOGLE_WEB_CLIENT_ID = '624248239778-dk7ol95h5n9oki3q5jdijo82skupu8da.apps.googleusercontent.com';
// Renseigner ces IDs si vous avez créé des clients OAuth natifs dans Google Cloud Console :
const GOOGLE_IOS_CLIENT_ID = '';     // ex: 'XXXXXXXXXX-xxxxxxxx.apps.googleusercontent.com'
const GOOGLE_ANDROID_CLIENT_ID = ''; // ex: 'XXXXXXXXXX-xxxxxxxx.apps.googleusercontent.com'

export const useGoogleSignIn = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    ...(GOOGLE_ANDROID_CLIENT_ID ? { androidClientId: GOOGLE_ANDROID_CLIENT_ID } : {}),
    scopes: ['openid', 'email', 'profile'],
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'gestion982' }),
  });

  // Gérer la réponse Google OAuth automatiquement
  useEffect(() => {
    const handleResponse = async () => {
      if (!response) return;

      if (response.type === 'success') {
        setError(null);
        try {
          const { authentication } = response;
          const idToken = authentication?.idToken ?? null;
          const accessToken = authentication?.accessToken ?? null;

          if (idToken || accessToken) {
            // idToken seul suffit, ou on peut utiliser les deux
            const credential = GoogleAuthProvider.credential(idToken, accessToken);
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
      } else if (response.type === 'dismiss' || response.type === 'cancel') {
        setError(null); // User cancelled, not an error
      } else if (response.type === 'error') {
        console.error('[Google OAuth] error response:', response.error);
        setError('שגיאה בהתחברות עם Google');
      }

      setGoogleLoading(false);
    };

    handleResponse();
  }, [response]);

  const signInWithGoogle = async () => {
    if (!request) {
      console.warn('[Google OAuth] request not ready yet');
      setError('Google OAuth אינו מוכן, נסה שנית');
      return;
    }
    setError(null);
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (err) {
      console.error('[Google OAuth] promptAsync error:', err);
      setGoogleLoading(false);
    }
  };

  return {
    signInWithGoogle,
    googleLoading,
    googleReady: !!request,
    googleError: error,
    clearGoogleError: () => setError(null),
  };
};
