// Écran de liste des équipements de combat
// Design professionnel avec UX améliorée
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CombatEquipment } from '../../types';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import {
  getAllCombatEquipment,
  addCombatEquipment,
  deleteCombatEquipment,
  DEFAULT_COMBAT_EQUIPMENT
} from '../../services/equipmentService';

const CATEGORY_CONFIG: { [key: string]: { icon: string; color: string } } = {
  'נשק': { icon: '🔫', color: '#E53935' },
  'אופטיקה': { icon: '🔭', color: '#8E24AA' },
  'ציוד מגן': { icon: '🛡️', color: '#43A047' },
  'אביזרים': { icon: '🔧', color: '#FB8C00' },
  'ציוד לוחם': { icon: '🎒', color: '#1E88E5' },
  'אחר': { icon: '📦', color: '#757575' },
};

const CombatEquipmentListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [equipment, setEquipment] = useState<CombatEquipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('הכל');

  useFocusEffect(
    useCallback(() => {
      loadEquipment();
    }, [])
  );

  const loadEquipment = async () => {
    try {
      const data = await getAllCombatEquipment();

      if (data.length === 0) {
        Alert.alert(
          'אין ציוד במערכת',
          'האם ברצונך להוסיף ציוד ברירת מחדל?',
          [
            { text: 'לא', style: 'cancel' },
            {
              text: 'כן, הוסף',
              onPress: async () => {
                try {
                  for (const eq of DEFAULT_COMBAT_EQUIPMENT) {
                    await addCombatEquipment(eq);
                  }
                  loadEquipment();
                } catch (error) {
                  console.error('Error adding default equipment:', error);
                  Alert.alert('שגיאה', 'נכשל בהוספת ציוד ברירת מחדל');
                }
              },
            },
          ]
        );
      }

      setEquipment(data);
    } catch (error) {
      console.error('Error loading equipment:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הציוד');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEquipment();
  };

  const categories = ['הכל', ...Object.keys(CATEGORY_CONFIG)];

  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'הכל' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category] || CATEGORY_CONFIG['אחר'];
  };

  const handleAddEquipment = () => {
    navigation.navigate('AddCombatEquipment');
  };

  const handleEquipmentPress = (equipmentId: string) => {
    navigation.navigate('AddCombatEquipment', { equipmentId });
  };

  const handleDeleteEquipment = (item: CombatEquipment) => {
    Alert.alert(
      'מחיקת ציוד',
      `האם אתה בטוח שברצונך למחוק את "${item.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCombatEquipment(item.id);
              Alert.alert('הצלחה', 'הציוד נמחק בהצלחה');
              loadEquipment();
            } catch (error) {
              console.error('Error deleting equipment:', error);
              Alert.alert('שגיאה', 'נכשל במחיקת הציוד');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ניהול ציוד</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
          <Text style={styles.loadingText}>טוען ציוד...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>ניהול ציוד לוחם</Text>
          <Text style={styles.headerSubtitle}>
            🔫 {equipment.length} פריטים במערכת
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddEquipment}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.arme]} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.arme }]}>
            <Text style={styles.statNumber}>{equipment.length}</Text>
            <Text style={styles.statLabel}>סה"כ ציוד</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.info }]}>
            <Text style={styles.statNumber}>
              {new Set(equipment.map(e => e.category)).size}
            </Text>
            <Text style={styles.statLabel}>קטגוריות</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.success }]}>
            <Text style={styles.statNumber}>
              {equipment.filter(e => e.hasSubEquipment).length}
            </Text>
            <Text style={styles.statLabel}>עם רכיבים</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש לפי שם או מסטב..."
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const config = cat !== 'הכל' ? getCategoryConfig(cat) : null;

            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                {config && <Text style={styles.categoryChipIcon}>{config.icon}</Text>}
                <Text style={[
                  styles.categoryChipText,
                  isActive && styles.categoryChipTextActive,
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Equipment List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionCount}>({filteredEquipment.length})</Text>
          <Text style={styles.sectionTitle}>רשימת ציוד</Text>
        </View>

        <View style={styles.equipmentList}>
          {filteredEquipment.map((item) => {
            const config = getCategoryConfig(item.category);

            return (
              <View key={item.id} style={styles.equipmentCard}>
                <TouchableOpacity
                  style={styles.equipmentMainContent}
                  onPress={() => handleEquipmentPress(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.equipmentIcon, { backgroundColor: config.color }]}>
                    <Text style={styles.equipmentIconText}>{config.icon}</Text>
                  </View>

                  <View style={styles.equipmentInfo}>
                    <Text style={styles.equipmentName}>{item.name}</Text>
                    <View style={styles.equipmentMeta}>
                      <Text style={[styles.equipmentCategory, { color: config.color }]}>
                        {item.category}
                      </Text>
                      {(item as any).requiresSerial && (
                        <View style={styles.requiresSerialBadge}>
                          <Text style={styles.requiresSerialText}>דורש מסטב</Text>
                        </View>
                      )}
                    </View>
                    {item.hasSubEquipment && item.subEquipments && (
                      <View style={styles.subBadge}>
                        <Text style={styles.subBadgeText}>
                          {item.subEquipments.length} רכיבים
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => handleEquipmentPress(item.id)}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.info} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteEquipment(item)}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredEquipment.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>לא נמצא ציוד</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'נסה חיפוש אחר או שנה את הפילטר'
                  : 'לחץ על + להוספת ציוד חדש'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddEquipment}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    backgroundColor: Colors.arme,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.textWhite,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerSpacer: {
    width: 40,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: Colors.textWhite,
    fontWeight: 'bold',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
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
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.xs,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  clearButton: {
    padding: Spacing.sm,
  },
  clearButtonText: {
    fontSize: 16,
    color: Colors.textLight,
  },

  // Category Filter
  categoryScroll: {
    marginBottom: Spacing.lg,
  },
  categoryContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: Colors.arme,
    borderColor: Colors.arme,
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.textWhite,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  sectionCount: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  // Equipment List
  equipmentList: {
    gap: Spacing.sm,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  equipmentMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  equipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  equipmentIconText: {
    fontSize: 24,
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  equipmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  equipmentCategory: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  equipmentSerial: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  subBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  subBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
  },
  requiresSerialBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  requiresSerialText: {
    fontSize: FontSize.xs,
    color: Colors.warningDark,
    fontWeight: '600',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundInput,
  },
  editButton: {
    backgroundColor: Colors.infoLight,
  },
  deleteButton: {
    backgroundColor: Colors.dangerLight,
  },

  chevronContainer: {
    marginLeft: Spacing.sm,
  },
  chevron: {
    fontSize: 24,
    color: Colors.textLight,
  },

  // Empty State
  emptyCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.xs,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  bottomSpacer: {
    height: 80,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.arme,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
  },
  fabIcon: {
    fontSize: 28,
    color: Colors.textWhite,
    fontWeight: 'bold',
  },
});

export default CombatEquipmentListScreen;