/**
 * AssignWeaponScreen.tsx - Assignation d'une arme à un soldat
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { soldierService } from '../../services/firebaseService';
import { WeaponInventoryItem, Soldier } from '../../types';

const AssignWeaponScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { weaponId } = (route.params as { weaponId: string }) || {};

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [weapon, setWeapon] = useState<WeaponInventoryItem | null>(null);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [filteredSoldiers, setFilteredSoldiers] = useState<Soldier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSoldiers(soldiers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredSoldiers(
        soldiers.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.personalNumber.includes(query) ||
            s.company?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, soldiers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [weaponData, soldiersData] = await Promise.all([
        weaponInventoryService.getWeaponById(weaponId),
        soldierService.getAll(1000), // Limite à 1000 soldats
      ]);

      setWeapon(weaponData);
      setSoldiers(soldiersData);
      setFilteredSoldiers(soldiersData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון נתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (soldier: Soldier) => {
    if (!weapon) return;

    Alert.alert(
      'הקצאת נשק',
      `להקצות ${weapon.category} ${weapon.serialNumber} ל${soldier.name}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: async () => {
            try {
              setAssigning(true);
              await weaponInventoryService.assignWeaponToSoldier(weaponId, {
                soldierId: soldier.id,
                soldierName: soldier.name,
                soldierPersonalNumber: soldier.personalNumber,
              });
              Alert.alert('הצלחה', 'הנשק הוקצה בהצלחה', [
                { text: 'אישור', onPress: () => navigation.navigate('WeaponInventoryList') },
              ]);
            } catch (error: any) {
              console.error('Error assigning weapon:', error);
              Alert.alert('שגיאה', error.message || 'לא ניתן להקצות את הנשק');
            } finally {
              setAssigning(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !weapon) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>הקצאת נשק</Text>
          <Text style={styles.headerSubtitle}>
            {weapon.category} {weapon.serialNumber}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="חפש חייל..."
          placeholderTextColor={Colors.textLight}
          textAlign="right"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Soldiers List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {filteredSoldiers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>אין חיילים</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין חיילים במערכת'}
            </Text>
          </View>
        ) : (
          filteredSoldiers.map((soldier) => (
            <TouchableOpacity
              key={soldier.id}
              style={styles.soldierCard}
              onPress={() => handleAssign(soldier)}
              disabled={assigning}
            >
              <View style={styles.soldierAvatar}>
                <Ionicons name="person" size={24} color={Colors.arme} />
              </View>
              <View style={styles.soldierInfo}>
                <Text style={styles.soldierName}>{soldier.name}</Text>
                <View style={styles.soldierMeta}>
                  <Text style={styles.soldierMetaText}>מ.א: {soldier.personalNumber}</Text>
                  {soldier.company && (
                    <>
                      <Text style={styles.soldierMetaDivider}>•</Text>
                      <Text style={styles.soldierMetaText}>{soldier.company}</Text>
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {assigning && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.arme} />
          <Text style={styles.overlayText}>מקצה נשק...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Header
  header: {
    backgroundColor: Colors.arme,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  headerSpacer: {
    width: 44,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },

  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },

  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    marginTop: Spacing.sm,
  },

  // Soldier Card
  soldierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  soldierAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.armeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  soldierInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  soldierName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  soldierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },

  soldierMetaText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  soldierMetaDivider: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  overlayText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textWhite,
  },
});

export default AssignWeaponScreen;
