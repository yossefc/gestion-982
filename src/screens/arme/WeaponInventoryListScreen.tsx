/**
 * WeaponInventoryListScreen.tsx - Liste de l'inventaire des armes
 * Affiche toutes les armes avec filtres par statut
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { WeaponInventoryItem, WeaponStatus } from '../../types';

type FilterTab = 'all' | 'available' | 'assigned' | 'storage';

const WeaponInventoryListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weapons, setWeapons] = useState<WeaponInventoryItem[]>([]);
  const [filteredWeapons, setFilteredWeapons] = useState<WeaponInventoryItem[]>([]);
  const [groupedWeapons, setGroupedWeapons] = useState<Map<string, WeaponInventoryItem[]>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    storage: 0,
  });

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponInventoryItem | null>(null);
  const [editedSerialNumber, setEditedSerialNumber] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadWeapons();
    }, [])
  );

  const loadWeapons = async () => {
    try {
      setLoading(true);

      // Clear states to force refresh
      setWeapons([]);
      setFilteredWeapons([]);
      setGroupedWeapons(new Map());

      const [allWeapons, inventoryStats] = await Promise.all([
        weaponInventoryService.getAllWeapons(),
        weaponInventoryService.getInventoryStats(),
      ]);

      console.log('Weapon Inventory Stats:', inventoryStats);
      console.log('Total weapons loaded:', allWeapons.length);

      setWeapons(allWeapons);
      setStats({
        total: inventoryStats.total,
        available: inventoryStats.available,
        assigned: inventoryStats.assigned,
        storage: inventoryStats.storage,
      });

      // Appliquer le filtre actuel
      applyFilter(activeFilter, allWeapons);
    } catch (error) {
      console.error('Error loading weapons:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את המלאי');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (filter: FilterTab, weaponsList: WeaponInventoryItem[] = weapons) => {
    setActiveFilter(filter);

    let filtered: WeaponInventoryItem[];
    switch (filter) {
      case 'all':
        filtered = weaponsList;
        break;
      case 'available':
        filtered = weaponsList.filter((w) => w.status === 'available');
        break;
      case 'assigned':
        filtered = weaponsList.filter((w) => w.status === 'assigned');
        break;
      case 'storage':
        filtered = weaponsList.filter((w) => w.status === 'storage');
        break;
      default:
        filtered = weaponsList;
    }

    setFilteredWeapons(filtered);

    // Grouper par catégorie
    const grouped = new Map<string, WeaponInventoryItem[]>();
    filtered.forEach((weapon) => {
      if (!grouped.has(weapon.category)) {
        grouped.set(weapon.category, []);
      }
      grouped.get(weapon.category)!.push(weapon);
    });

    // Trier les armes dans chaque catégorie par serial number
    grouped.forEach((weaponList) => {
      weaponList.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
    });

    setGroupedWeapons(grouped);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWeapons();
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const openWeaponModal = (weapon: WeaponInventoryItem) => {
    setSelectedWeapon(weapon);
    setEditedSerialNumber(weapon.serialNumber);
    setModalVisible(true);
  };

  const closeWeaponModal = () => {
    setModalVisible(false);
    setSelectedWeapon(null);
    setEditedSerialNumber('');
  };

  const handleEditSerialNumber = async () => {
    if (!selectedWeapon) return;

    if (!editedSerialNumber.trim()) {
      Alert.alert('שגיאה', 'יש להזין מסטב');
      return;
    }

    if (editedSerialNumber.trim() === selectedWeapon.serialNumber) {
      Alert.alert('שגיאה', 'המסטב זהה לקיים');
      return;
    }

    // Check if serial number already exists
    const existingWeapon = await weaponInventoryService.getWeaponBySerialNumber(editedSerialNumber.trim());
    if (existingWeapon) {
      Alert.alert('שגיאה', 'מסטב זה כבר קיים במערכת');
      return;
    }

    try {
      await weaponInventoryService.updateWeapon(selectedWeapon.id, {
        serialNumber: editedSerialNumber.trim(),
      });
      Alert.alert('הצלחה', 'המסטב עודכן בהצלחה');
      closeWeaponModal();
      loadWeapons();
    } catch (error) {
      console.error('Error updating serial number:', error);
      Alert.alert('שגיאה', 'לא ניתן לעדכן את המסטב');
    }
  };

  const handleDeleteWeaponFromModal = async () => {
    if (!selectedWeapon) return;

    if (selectedWeapon.status !== 'available') {
      Alert.alert('שגיאה', 'לא ניתן למחוק נשק שאינו זמין');
      return;
    }

    Alert.alert(
      'מחיקת נשק',
      `האם אתה בטוח שברצונך למחוק ${selectedWeapon.category} ${selectedWeapon.serialNumber}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await weaponInventoryService.deleteWeapon(selectedWeapon.id);
              Alert.alert('הצלחה', 'הנשק נמחק בהצלחה');
              closeWeaponModal();
              loadWeapons();
            } catch (error) {
              console.error('Error deleting weapon:', error);
              Alert.alert('שגיאה', 'לא ניתן למחוק את הנשק');
            }
          },
        },
      ]
    );
  };

  const handleDeleteWeapon = (weapon: WeaponInventoryItem) => {
    if (weapon.status !== 'available') {
      Alert.alert('שגיאה', 'לא ניתן למחוק נשק שאינו זמין');
      return;
    }

    Alert.alert('מחיקת נשק', `האם אתה בטוח שברצונך למחוק ${weapon.category} ${weapon.serialNumber}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await weaponInventoryService.deleteWeapon(weapon.id);
            Alert.alert('הצלחה', 'הנשק נמחק בהצלחה');
            loadWeapons();
          } catch (error) {
            console.error('Error deleting weapon:', error);
            Alert.alert('שגיאה', 'לא ניתן למחוק את הנשק');
          }
        },
      },
    ]);
  };

  const handleAssignWeapon = (weapon: WeaponInventoryItem) => {
    if (weapon.status !== 'available') {
      Alert.alert('שגיאה', 'הנשק אינו זמין להקצאה');
      return;
    }
    navigation.navigate('AssignWeapon', { weaponId: weapon.id });
  };

  const handleReturnWeapon = (weapon: WeaponInventoryItem) => {
    Alert.alert(
      'החזרת נשק',
      `האם להחזיר ${weapon.category} ${weapon.serialNumber} למלאי?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'החזר',
          onPress: async () => {
            try {
              await weaponInventoryService.returnWeapon(weapon.id);
              Alert.alert('הצלחה', 'הנשק הוחזר למלאי');
              loadWeapons();
            } catch (error) {
              console.error('Error returning weapon:', error);
              Alert.alert('שגיאה', 'לא ניתן להחזיר את הנשק');
            }
          },
        },
      ]
    );
  };

  const handleMoveToStorage = (weapon: WeaponInventoryItem) => {
    navigation.navigate('WeaponStorage');
  };

  const getStatusColor = (status: WeaponStatus) => {
    switch (status) {
      case 'available':
        return Colors.success;
      case 'assigned':
        return Colors.warning;
      case 'storage':
        return Colors.info;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusText = (status: WeaponStatus) => {
    switch (status) {
      case 'available':
        return 'זמין';
      case 'assigned':
        return 'מוקצה';
      case 'storage':
        return 'אפסון';
      default:
        return '';
    }
  };

  const renderCategoryGroup = (category: string, weaponsList: WeaponInventoryItem[]) => {
    const isExpanded = expandedCategories.has(category);

    return (
      <View key={category} style={styles.categoryCard}>
        {/* Category Header - Clickable */}
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryHeaderLeft}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={24}
              color={Colors.textWhite}
            />
            <Text style={styles.categoryCount}>{weaponsList.length}</Text>
          </View>
          <Text style={styles.categoryTitle}>{category}</Text>
        </TouchableOpacity>

        {/* Weapons Table - Only show if expanded */}
        {isExpanded && (
          <View style={styles.weaponsTable}>
            {weaponsList.map((weapon) => (
              <TouchableOpacity
                key={weapon.id}
                style={[
                  styles.weaponRow,
                  { borderRightWidth: 3, borderRightColor: getStatusColor(weapon.status) },
                ]}
                onPress={() => openWeaponModal(weapon)}
                activeOpacity={0.7}
              >
                <View style={styles.weaponRowContent}>
                  <Text style={styles.serialNumberTable}>{weapon.serialNumber}</Text>
                  <View style={styles.weaponStatus}>
                    {weapon.status === 'assigned' && weapon.assignedTo && (
                      <Text style={styles.soldierNameTable}>{weapon.assignedTo.soldierName}</Text>
                    )}
                    {weapon.status === 'available' && (
                      <Text style={styles.availableTextTable}>זמין</Text>
                    )}
                    {weapon.status === 'storage' && (
                      <Text style={styles.storageTextTable}>אפסון</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען מלאי...</Text>
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
          <Text style={styles.headerTitle}>מלאי נשק</Text>
          <Text style={styles.headerSubtitle}>{stats.total} נשקים</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddWeaponToInventory')}
        >
          <Ionicons name="add" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: Colors.success }]}>
          <Text style={styles.statNumber}>{stats.available}</Text>
          <Text style={styles.statLabel}>זמינים</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.warning }]}>
          <Text style={styles.statNumber}>{stats.assigned}</Text>
          <Text style={styles.statLabel}>מוקצים</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.info }]}>
          <Text style={styles.statNumber}>{stats.storage}</Text>
          <Text style={styles.statLabel}>אפסון</Text>
        </View>
      </View>

      {/* Import Button */}
      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate('BulkImportWeapons')}
        activeOpacity={0.7}
      >
        <Ionicons name="cloud-upload-outline" size={20} color={Colors.arme} />
        <Text style={styles.importButtonText}>ייבוא מסטבים מ-Excel</Text>
      </TouchableOpacity>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
          onPress={() => applyFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
            הכל
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'available' && styles.filterTabActive]}
          onPress={() => applyFilter('available')}
        >
          <Text
            style={[styles.filterText, activeFilter === 'available' && styles.filterTextActive]}
          >
            זמינים
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'assigned' && styles.filterTabActive]}
          onPress={() => applyFilter('assigned')}
        >
          <Text
            style={[styles.filterText, activeFilter === 'assigned' && styles.filterTextActive]}
          >
            מוקצים
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'storage' && styles.filterTabActive]}
          onPress={() => applyFilter('storage')}
        >
          <Text style={[styles.filterText, activeFilter === 'storage' && styles.filterTextActive]}>
            אפסון
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weapons List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {groupedWeapons.size === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>אין נשקים להצגה</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'all'
                ? 'לחץ על + להוספת נשק למלאי'
                : 'אין נשקים בסטטוס זה'}
            </Text>
          </View>
        ) : (
          Array.from(groupedWeapons.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([category, weaponsList]) => renderCategoryGroup(category, weaponsList))
        )}
      </ScrollView>

      {/* Weapon Actions Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeWeaponModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeWeaponModal}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedWeapon && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={closeWeaponModal} style={styles.modalCloseButton}>
                    <Ionicons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.modalHeaderInfo}>
                    <Text style={styles.modalTitle}>{selectedWeapon.category}</Text>
                    <Text style={styles.modalSubtitle}>עריכת מסטב</Text>
                  </View>
                </View>

                {/* Serial Number Input */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>מסטב (מספר סידורי)</Text>
                  <View style={styles.modalInputContainer}>
                    <TextInput
                      style={styles.modalInput}
                      value={editedSerialNumber}
                      onChangeText={setEditedSerialNumber}
                      placeholder="הזן מסטב"
                      placeholderTextColor={Colors.textLight}
                      textAlign="right"
                      autoCapitalize="characters"
                    />
                    <Ionicons name="barcode-outline" size={20} color={Colors.textSecondary} />
                  </View>
                </View>

                {/* Status Info */}
                <View style={styles.modalInfoCard}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoValue}>
                      {getStatusText(selectedWeapon.status)}
                    </Text>
                    <Text style={styles.modalInfoLabel}>סטטוס:</Text>
                  </View>
                  {selectedWeapon.status === 'assigned' && selectedWeapon.assignedTo && (
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoValue}>
                        {selectedWeapon.assignedTo.soldierName}
                      </Text>
                      <Text style={styles.modalInfoLabel}>מוקצה ל:</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonEdit]}
                    onPress={handleEditSerialNumber}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.textWhite} />
                    <Text style={styles.modalButtonText}>שמור שינויים</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonDelete,
                      selectedWeapon.status !== 'available' && styles.modalButtonDisabled,
                    ]}
                    onPress={handleDeleteWeaponFromModal}
                    disabled={selectedWeapon.status !== 'available'}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.textWhite} />
                    <Text style={styles.modalButtonText}>מחק נשק</Text>
                  </TouchableOpacity>
                </View>

                {selectedWeapon.status !== 'available' && (
                  <Text style={styles.modalWarning}>
                    ⚠️ ניתן למחוק רק נשק זמין
                  </Text>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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

  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.small,
  },

  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  statLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: Spacing.xs,
  },

  // Import Button
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.arme,
    borderStyle: 'dashed',
    ...Shadows.small,
  },

  importButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.arme,
  },

  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
  },

  filterTabActive: {
    backgroundColor: Colors.arme,
  },

  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  filterTextActive: {
    color: Colors.textWhite,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
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
    textAlign: 'center',
  },

  // Category Card
  categoryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.small,
    overflow: 'hidden',
  },

  categoryHeader: {
    backgroundColor: Colors.arme,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  categoryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textWhite,
    flex: 1,
    textAlign: 'right',
  },

  categoryCount: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minWidth: 32,
    textAlign: 'center',
  },

  // Weapons Table
  weaponsTable: {
    padding: Spacing.sm,
  },

  weaponRow: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },

  weaponRowContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },

  serialNumberTable: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  weaponStatus: {
    alignItems: 'flex-end',
  },

  soldierNameTable: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.warning,
  },

  availableTextTable: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },

  storageTextTable: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.info,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    ...Shadows.large,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  modalHeaderInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },

  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  modalSection: {
    marginBottom: Spacing.lg,
  },

  modalLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  modalInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },

  modalInfoCard: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },

  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },

  modalInfoLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  modalInfoValue: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  modalActions: {
    gap: Spacing.md,
  },

  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.small,
  },

  modalButtonEdit: {
    backgroundColor: Colors.arme,
  },

  modalButtonDelete: {
    backgroundColor: Colors.danger,
  },

  modalButtonDisabled: {
    backgroundColor: Colors.disabled,
    opacity: 0.5,
  },

  modalButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  modalWarning: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});

export default WeaponInventoryListScreen;
