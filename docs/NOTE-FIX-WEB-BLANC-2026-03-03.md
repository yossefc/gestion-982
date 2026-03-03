# Note de correction web blanc (2026-03-03)

## Contexte
- Symptome: `npm run web` ouvrait une page blanche.

## Diagnostic
- Le port `8081` etait occupe par un ancien process `node` (Expo).
- Cause principale confirmee dans la console web:
  - `Uncaught TypeError: (0, _firebaseAuth.getReactNativePersistence) is not a function`
- Le crash venait de l'initialisation Firebase Auth faite comme React Native, y compris sur Web.

## Correctif applique
- Fichier modifie: `src/config/firebase.ts`
- Changements:
  - Initialisation Firebase app securisee avec `getApps()/getApp()` pour eviter la double init.
  - Sur Web (`Platform.OS === 'web'`): utilisation de `getAuth(app)`.
  - Sur mobile: tentative `initializeAuth` avec `getReactNativePersistence` via `firebase/auth/react-native`.
  - Fallback robuste vers `getAuth(app)` si indisponible ou deja initialise.

## Verification
- Plus d'erreur `Uncaught ... getReactNativePersistence` dans les logs navigateur.
- L'app demarre (log navigateur: `Running application ...`).

## Relance recommandee
```bash
cmd /c "set EXPO_NO_DOCTOR=1&& npx expo start --web --clear --port 8083"
```

## Note
- Il reste 2 erreurs TypeScript non liees a ce fix dans:
  - `src/screens/arme/CombatAssignmentScreen.tsx` (ligne 946, styles `input` et `manualSerialInput`)
