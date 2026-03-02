// Écran de liste des Manot (מנות) pour le module Arme
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
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Mana } from '../../types';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { useData } from '../../contexts/DataContext';

const ManotListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { manot: cachedManot, refreshManot } = useData();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manot, setManot] = useState<Mana[]>([]);

  // Sync local state from DataContext whenever cachedManot changes
  useEffect(() => {
    setManot(cachedManot);
  }, [cachedManot]);

  useFocusEffect(
    useCallback(() => {
      loadManot();
    }, [])
  );

  const loadManot = async () => {
    try {
      await refreshManot(); // force-fetches Firestore + updates DataContext cache
    } catch (error) {
      console.error('Error loading manot:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת המנות');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadManot();
  };

  const handleManaPress = (manaId: string) => {
    navigation.navigate('ManotDetails', { manaId });
  };

  const handleAddMana = () => {
    navigation.navigate('AddMana');
  };

  const totalEquipments = manot.reduce((sum, m) => sum + m.equipments.length, 0);
  const totalItems = manot.reduce(
    (sum, m) => sum + m.equipments.reduce((s, e) => s + e.quantity, 0),
    0
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ניהול מנות</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
          <Text style={styles.loadingText}>טוען מנות...</Text>
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
          <Text style={styles.headerTitle}>ניהול מנות וערכות</Text>
          <Text style={styles.headerSubtitle}>
            📦 {manot.length} חבילות במערכת
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddMana}>
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
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#E53935' }]}>
            <Text style={styles.statNumber}>{manot.length}</Text>
            <Text style={styles.statLabel}>מנות/ערכות</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#43A047' }]}>
            <Text style={styles.statNumber}>{totalEquipments}</Text>
            <Text style={styles.statLabel}>סוגי ציוד</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#1E88E5' }]}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>סה"כ פריטים</Text>
          </View>
        </View>

        {/* Quick Add Button */}
        <TouchableOpacity style={styles.quickAddButton} onPress={handleAddMana}>
          <View style={styles.quickAddIcon}>
            <Text style={styles.quickAddIconText}>+</Text>
          </View>
          <View style={styles.quickAddContent}>
            <Text style={styles.quickAddTitle}>הוסף מנה/ערכה חדשה</Text>
            <Text style={styles.quickAddSubtitle}>צור חבילת ציוד מוכנה להנפקה</Text>
          </View>
          <Text style={styles.quickAddChevron}>‹</Text>
        </TouchableOpacity>

        {/* Manot List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionCount}>({manot.length})</Text>
          <Text style={styles.sectionTitle}>רשימת מנות וערכות</Text>
        </View>

        <View style={styles.manotList}>
          {manot.map((mana) => {
            const itemCount = mana.equipments.reduce((sum, e) => sum + e.quantity, 0);
            const isMana = mana.type === 'מנה' || !mana.type;

            return (
              <TouchableOpacity
                key={mana.id}
                style={styles.manaCard}
                onPress={() => handleManaPress(mana.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.manaIcon,
                  { backgroundColor: isMana ? Colors.arme : '#7C3AED' }
                ]}>
                  <Text style={styles.manaIconText}>{isMana ? '📦' : '🧰'}</Text>
                </View>

                <View style={styles.manaInfo}>
                  <View style={styles.manaHeader}>
                    <Text style={styles.manaName}>{mana.name}</Text>
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: isMana ? Colors.armeLight : '#EDE9FE' }
                    ]}>
                      <Text style={[
                        styles.typeBadgeText,
                        { color: isMana ? Colors.arme : '#7C3AED' }
                      ]}>
                        {mana.type || 'מנה'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.manaStats}>
                    <View style={styles.manaStat}>
                      <Text style={styles.manaStatValue}>{mana.equipments.length}</Text>
                      <Text style={styles.manaStatLabel}>סוגים</Text>
                    </View>
                    <View style={styles.manaStatDivider} />
                    <View style={styles.manaStat}>
                      <Text style={styles.manaStatValue}>{itemCount}</Text>
                      <Text style={styles.manaStatLabel}>פריטים</Text>
                    </View>
                  </View>

                  {/* Equipment Preview */}
                  <View style={styles.equipmentPreview}>
                    {mana.equipments.slice(0, 3).map((eq, idx) => (
                      <View key={idx} style={styles.previewItem}>
                        <Text style={styles.previewText}>
                          {eq.equipmentName} ({eq.quantity})
                        </Text>
                      </View>
                    ))}
                    {mana.equipments.length > 3 && (
                      <Text style={styles.previewMore}>
                        +{mana.equipments.length - 3} נוספים
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.chevronContainer}>
                  <Text style={styles.chevron}>‹</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {manot.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>אין מנות במערכת</Text>
              <Text style={styles.emptySubtext}>
                לחץ על הכפתור למעלה להוספת מנה ראשונה
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddMana}>
                <Text style={styles.emptyButtonText}>+ צור מנה חדשה</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddMana}>
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

  // Quick Add Button
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.success,
    borderStyle: 'dashed',
  },
  quickAddIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  quickAddIconText: {
    fontSize: 24,
    color: Colors.textWhite,
    fontWeight: 'bold',
  },
  quickAddContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  quickAddTitle: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.successDark,
  },
  quickAddSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.success,
    marginTop: 2,
  },
  quickAddChevron: {
    fontSize: 24,
    color: Colors.success,
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

  // Manot List
  manotList: {
    gap: Spacing.md,
  },
  manaCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  manaIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  manaIconText: {
    fontSize: 28,
  },
  manaInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  manaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  manaName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  manaStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  manaStat: {
    alignItems: 'center',
  },
  manaStatValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.arme,
  },
  manaStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  manaStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  equipmentPreview: {
    alignItems: 'flex-end',
    gap: 2,
  },
  previewItem: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  previewText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  previewMore: {
    fontSize: FontSize.sm,
    color: Colors.info,
    fontWeight: '600',
    marginTop: 2,
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: Spacing.sm,
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
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  emptyButtonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.textWhite,
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

export default ManotListScreen;