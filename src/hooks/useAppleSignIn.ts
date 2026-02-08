/**
 * Hook pour le login via Apple avec Firebase
 * Utilise expo-apple-authentication (native iOS) + Firebase AppleAuthProvider
 */

import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Platform } from 'react-native';

// Génère un nonce aléatoire pour la sécurité Apple Sign In
const generateNonce = (length = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// SHA-256 hash via SubtleCrypto (disponible sur iOS)
const sha256 = async (plain: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const useAppleSignIn = () => {
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appleAvailable = Platform.OS === 'ios';

  const signInWithApple = async () => {
    if (!appleAvailable) {
      setError('Apple Sign In est uniquement disponible sur iOS');
      return;
    }

    setError(null);
    setAppleLoading(true);

    try {
      const rawNonce = generateNonce();
      const hashedNonce = await sha256(rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const provider = new OAuthProvider('apple.com');
        const firebaseCredential = provider.credential({
          idToken: credential.identityToken,
          rawNonce: rawNonce,
        });
        await signInWithCredential(auth, firebaseCredential);
        // Firebase onAuthStateChanged dans AuthContext gère le reste
      } else {
        setError('לא נמצא identity token מ-Apple');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // L'utilisateur a annulé — pas une erreur
        return;
      }
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('חשבון כבר קיים עם פרטי התחברות שונים');
      } else {
        setError('שגיאה בהתחברות עם Apple');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return {
    signInWithApple,
    appleLoading,
    appleAvailable,
    appleError: error,
    clearAppleError: () => setError(null),
  };
};
