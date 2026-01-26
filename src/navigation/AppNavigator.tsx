// Navigation principale de l'application
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/Colors';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/common/HomeScreen';
import SoldierSearchScreen from '../screens/common/SoldierSearchScreen';
import AddSoldierScreen from '../screens/common/AddSoldierScreen';
import EditSoldierScreen from '../screens/common/EditSoldierScreen';
import VetementHomeScreen from '../screens/vetement/VetementHomeScreen';
import ClothingSignatureScreen from '../screens/vetement/ClothingSignatureScreen';
import ClothingDashboardScreen from '../screens/vetement/ClothingDashboardScreen';
import ClothingReturnScreen from '../screens/vetement/ClothingReturnScreen';
import ClothingStockScreen from '../screens/vetement/ClothingStockScreen';
import ClothingEquipmentManagementScreen from '../screens/vetement/ClothingEquipmentManagementScreen';
import ArmeHomeScreen from '../screens/arme/ArmeHomeScreen';
import ManotListScreen from '../screens/arme/ManotListScreen';
import ManotDetailsScreen from '../screens/arme/ManotDetailsScreen';
import AddManaScreen from '../screens/arme/AddManaScreen';
import CombatEquipmentListScreen from '../screens/arme/CombatEquipmentListScreen';
import AddCombatEquipmentScreen from '../screens/arme/AddCombatEquipmentScreen';
import CombatAssignmentScreen from '../screens/arme/CombatAssignmentScreen';
import CombatReturnScreen from '../screens/arme/CombatReturnScreen';
import CombatStorageScreen from '../screens/arme/CombatStorageScreen';
import CombatRetrieveScreen from '../screens/arme/CombatRetrieveScreen';
import CombatStockScreen from '../screens/arme/CombatStockScreen';
import WeaponInventoryListScreen from '../screens/arme/WeaponInventoryListScreen';
import AddWeaponToInventoryScreen from '../screens/arme/AddWeaponToInventoryScreen';
import BulkImportWeaponsScreen from '../screens/arme/BulkImportWeaponsScreen';
import AssignWeaponScreen from '../screens/arme/AssignWeaponScreen';
import WeaponStorageScreen from '../screens/arme/WeaponStorageScreen';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import DatabaseDebugScreen from '../screens/admin/DatabaseDebugScreen';
import MigrationScreen from '../screens/admin/MigrationScreen';
import RspMigrationScreen from '../screens/admin/RspMigrationScreen';
import SoldierHistoryScreen from '../screens/admin/SoldierHistoryScreen';
import RspHomeScreen from '../screens/arme/RspHomeScreen';
import RspEquipmentScreen from '../screens/arme/RspEquipmentScreen';
import RspAssignmentScreen from '../screens/arme/RspAssignmentScreen';
import RspTableScreen from '../screens/arme/RspTableScreen';
import RspReadOnlyScreen from '../screens/arme/RspReadOnlyScreen';

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
          contentStyle: { backgroundColor: Colors.background },
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
            <Stack.Screen name="EditSoldier" component={EditSoldierScreen} />

            {/* Module Vêtement */}
            <Stack.Screen name="VetementHome" component={VetementHomeScreen} />
            <Stack.Screen name="ClothingSignature" component={ClothingSignatureScreen} />
            <Stack.Screen name="ClothingDashboard" component={ClothingDashboardScreen} />
            <Stack.Screen name="ClothingReturn" component={ClothingReturnScreen} />
            <Stack.Screen name="ClothingStock" component={ClothingStockScreen} />
            <Stack.Screen name="ClothingEquipmentManagement" component={ClothingEquipmentManagementScreen} />

            {/* Module Arme */}
            <Stack.Screen name="ArmeHome" component={ArmeHomeScreen} />
            <Stack.Screen name="ManotList" component={ManotListScreen} />
            <Stack.Screen name="ManotDetails" component={ManotDetailsScreen} />
            <Stack.Screen name="AddMana" component={AddManaScreen} />
            <Stack.Screen name="CombatEquipmentList" component={CombatEquipmentListScreen} />
            <Stack.Screen name="AddCombatEquipment" component={AddCombatEquipmentScreen} />
            <Stack.Screen name="CombatAssignment" component={CombatAssignmentScreen} />
            <Stack.Screen name="CombatReturn" component={CombatReturnScreen} />
            <Stack.Screen name="CombatStorage" component={CombatStorageScreen} />
            <Stack.Screen name="CombatRetrieve" component={CombatRetrieveScreen} />
            <Stack.Screen name="CombatStock" component={CombatStockScreen} />
            <Stack.Screen name="WeaponInventoryList" component={WeaponInventoryListScreen} />
            <Stack.Screen name="AddWeaponToInventory" component={AddWeaponToInventoryScreen} />
            <Stack.Screen name="BulkImportWeapons" component={BulkImportWeaponsScreen} />
            <Stack.Screen name="AssignWeapon" component={AssignWeaponScreen} />
            <Stack.Screen name="WeaponStorage" component={WeaponStorageScreen} />

            {/* Module Admin */}
            <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
            <Stack.Screen name="UserManagement" component={UserManagementScreen} />
            <Stack.Screen name="DatabaseDebug" component={DatabaseDebugScreen} />
            <Stack.Screen name="Migration" component={MigrationScreen} />
            <Stack.Screen name="RspMigration" component={RspMigrationScreen} />
            <Stack.Screen name="SoldierHistory" component={SoldierHistoryScreen} />

            {/* Module RSP */}
            <Stack.Screen name="RspHome" component={RspHomeScreen} />
            <Stack.Screen name="RspEquipment" component={RspEquipmentScreen} />
            <Stack.Screen name="RspAssignment" component={RspAssignmentScreen} />
            <Stack.Screen name="RspTable" component={RspTableScreen} />
            <Stack.Screen name="RspReadOnly" component={RspReadOnlyScreen} />

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
    backgroundColor: Colors.background,
  },
});

export default AppNavigator;
