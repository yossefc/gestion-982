// Navigation principale de l'application
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/common/HomeScreen';
import SoldierSearchScreen from '../screens/common/SoldierSearchScreen';
import AddSoldierScreen from '../screens/common/AddSoldierScreen';
import VetementHomeScreen from '../screens/vetement/VetementHomeScreen';
import ClothingSignatureScreen from '../screens/vetement/ClothingSignatureScreen';
import ClothingDashboardScreen from '../screens/vetement/ClothingDashboardScreen';
import ClothingReturnScreen from '../screens/vetement/ClothingReturnScreen';
import ClothingEquipmentManagementScreen from '../screens/vetement/ClothingEquipmentManagementScreen';
import ArmeHomeScreen from '../screens/arme/ArmeHomeScreen';
import ManotListScreen from '../screens/arme/ManotListScreen';
import ManotDetailsScreen from '../screens/arme/ManotDetailsScreen';
import CombatEquipmentListScreen from '../screens/arme/CombatEquipmentListScreen';
import CombatAssignmentScreen from '../screens/arme/CombatAssignmentScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  // Écran de chargement
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_left',
          contentStyle: { backgroundColor: Colors.background.primary },
        }}
      >
        {!user ? (
          // Écrans non authentifiés
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          // Écrans authentifiés
          <>
            {/* Écran principal */}
            <Stack.Screen name="Home" component={HomeScreen} />
            
            {/* Écrans communs */}
            <Stack.Screen name="SoldierSearch" component={SoldierSearchScreen} />
            <Stack.Screen name="AddSoldier" component={AddSoldierScreen} />
            
            {/* Module Vêtement */}
            <Stack.Screen name="VetementHome" component={VetementHomeScreen} />
            <Stack.Screen name="ClothingSignature" component={ClothingSignatureScreen} />
            <Stack.Screen name="ClothingDashboard" component={ClothingDashboardScreen} />
            <Stack.Screen name="ClothingReturn" component={ClothingReturnScreen} />
            <Stack.Screen name="ClothingEquipmentManagement" component={ClothingEquipmentManagementScreen} />

            {/* Module Arme */}
            <Stack.Screen name="ArmeHome" component={ArmeHomeScreen} />
            <Stack.Screen name="ManotList" component={ManotListScreen} />
            <Stack.Screen name="ManotDetails" component={ManotDetailsScreen} />
            <Stack.Screen name="CombatEquipmentList" component={CombatEquipmentListScreen} />
            <Stack.Screen name="CombatAssignment" component={CombatAssignmentScreen} />

            {/* Signature commune */}
            <Stack.Screen name="SignatureScreen" component={ClothingSignatureScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
});

export default AppNavigator;
