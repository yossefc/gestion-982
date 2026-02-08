// App.tsx - Point d'entrée principal de l'application
// OPTIMISÉ: Utilise DataProvider pour un cache centralisé de toutes les données Firebase
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { DataProvider } from './src/contexts/DataContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // NOTE: L'initialisation des données par défaut se fait maintenant
  // via le panneau admin (AdminPanelScreen) pour éviter les erreurs
  // de permissions avant que l'auth soit prête
  //
  // OPTIMISATION: DataProvider remplace SoldiersProvider et ajoute:
  // - Cache centralisé pour toutes les collections Firebase
  // - Chargement optimiste (affichage immédiat depuis le cache)
  // - Préchargement parallèle de toutes les données au démarrage
  // - Pas de rechargement à chaque navigation

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineProvider>
          <DataProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </DataProvider>
        </OfflineProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
