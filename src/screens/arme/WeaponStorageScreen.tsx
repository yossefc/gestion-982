/**
 * WeaponStorageScreen.tsx - Mise en אפסון d'armes
 * Permet de mettre des armes assignées en אפסון (dépôt/stockage)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { WeaponInventoryItem } from '../../types';

const WeaponStorageScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [assignedWeapons, setAssignedWeapons] = useState<WeaponInventoryItem[]>([]);

  useEffect(() => {
    loadAssignedWeapons();
  }, []);

  const loadAssignedWeapons = async () => {
    try {
      setLoading(true);
      const weapons = await weaponInventoryService.getAssignedWeapons();
      setAssignedWeapons(weapons);
    } catch (error) {
      console.error('Error loading assigned weapons:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון נשקים מוקצים');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToStorage = (weapon: WeaponInventoryItem) => {
    if (!weapon.assignedTo) return;

    Alert.alert(
      'העברה לאפסון',
      `להעביר ${weapon.category} ${weapon.serialNumber} של ${weapon.assignedTo.soldierName} לאפסון?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: async () => {
            try {
              setProcessing(true);
              await weaponInventoryService.moveWeaponToStorage(weapon.id);
              Alert.alert('הצלחה', 'הנשק הועבר לאפסון');
              loadAssignedWeapons();
            } catch (error) {
              console.error('Error moving to storage:', error);
              Alert.alert('שגיאה', 'לא ניתן להעביר את הנשק לאפסון');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
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
          <Text style={styles.headerTitle}>אפסון נשק</Text>
          <Text style={styles.headerSubtitle}>{assignedWeapons.length} נשקים מוקצים</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {assignedWeapons.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="archive-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>אין נשקים מוקצים</Text>
            <Text style={styles.emptySubtitle}>כל הנשקים זמינים או באפסון</Text>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color={Colors.info} />
              <Text style={styles.infoText}>
                בחר נשק להעברה לאפסון. הנשק יהיה מסומן כ"אפסון" ולא יהיה מוקצה לחייל.
              </Text>
            </View>

            {assignedWeapons.map((weapon) => (
              <View key={weapon.id} style={styles.weaponCard}>
                <View style={styles.weaponHeader}>
                  <Text style={styles.weaponCategory}>{weapon.category}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>מוקצה</Text>
                  </View>
                </View>

                <View style={styles.serialContainer}>
                  <Ionicons name="barcode-outline" size={20} color={Colors.arme} />
                  <Text style={styles.serialNumber}>{weapon.serialNumber}</Text>
                </View>

                {weapon.assignedTo && (
                  <View style={styles.soldierInfo}>
                    <View style={styles.soldierRow}>
                      <Text style={styles.soldierValue}>{weapon.assignedTo.soldierName}</Text>
                      <Text style={styles.soldierLabel}>חייל:</Text>
                    </View>
                    <View style={styles.soldierRow}>
                      <Text style={styles.soldierValue}>
                        {weapon.assignedTo.soldierPersonalNumber}
                      </Text>
                      <Text style={styles.soldierLabel}>מ.א:</Text>
                    </View>
                    <View style={styles.soldierRow}>
                      <Text style={styles.soldierValue}>
                        {weapon.assignedTo.assignedDate.toLocaleDateString('he-IL')}
                      </Text>
                      <Text style={styles.soldierLabel}>תאריך הקצאה:</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.storageButton}
                  onPress={() => handleMoveToStorage(weapon)}
                  disabled={processing}
                >
                  <Ionicons name="archive" size={20} color={Colors.textWhite} />
                  <Text style={styles.storageButtonText}>העבר לאפסון</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {processing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.arme} />
          <Text style={styles.overlayText}>מעביר לאפסון...</Text>
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
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },

  headerSpacer: {
    width: 44,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },

  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.infoDark,
    textAlign: 'right',
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

  // Weapon Card
  weaponCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  weaponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },

  weaponCategory: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },

  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.warning,
  },

  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Serial Number
  serialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: Colors.armeLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },

  serialNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.arme,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Soldier Info
  soldierInfo: {
    backgroundColor: Colors.backgroundInput,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },

  soldierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },

  soldierLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  soldierValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },

  // Storage Button
  storageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.info,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },

  storageButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
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

export default WeaponStorageScreen;
