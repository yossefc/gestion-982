// App.tsx - Point d'entrée principal de l'application
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { initializeDefaultData } from './src/services/equipmentService';

export default function App() {
  useEffect(() => {
    // Initialiser les données par défaut au démarrage
    const initData = async () => {
      try {
        await initializeDefaultData();
        console.log('App initialized successfully');
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    initData();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
