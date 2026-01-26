// App.tsx - Point d'entrée principal de l'application
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { SoldiersProvider } from './src/contexts/SoldiersContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // NOTE: L'initialisation des données par défaut se fait maintenant
  // via le panneau admin (AdminPanelScreen) pour éviter les erreurs
  // de permissions avant que l'auth soit prête

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SoldiersProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SoldiersProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
