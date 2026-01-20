// Écran de détails d'une Mana
// Design professionnel avec UX améliorée
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, Mana } from '../../types';
import { manaService } from '../../services/firebaseService';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';

type ManotDetailsRouteProp = RouteProp<RootStackParamList, 'ManotDetails'>;

const ManotDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ManotDetailsRouteProp>();
  const { manaId } = route.params;

  const [loading, setLoading] = useState(true);
  const [mana, setMana] = useState<Mana | null>(null);

  useEffect(() => {
    loadMana();
  }, [manaId]);

  const loadMana = async () => {
    try {
      const manaData = await manaService.getById(manaId);
      setMana(manaData);
    } catch (error) {
      console.error('Error loading mana:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת המנה');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('AddMana', { manaId });
  };

  const handleDelete = () => {
    Alert.alert(
      'מחיקת מנה',
      `האם אתה בטוח שברצונך למחוק את "${mana?.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await manaService.delete(manaId);
              Alert.alert('הצלחה', 'המנה נמחקה בהצלחה');
              navigation.goBack();
            } catch (error) {
              Alert.alert('שגיאה', 'נכשל במחיקת המנה');
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = async () => {
    if (!mana) return;

    Alert.alert(
      'שכפול מנה',
      `האם ליצור עותק של "${mana.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שכפל',
          onPress: async () => {
            try {
              await manaService.create({
                name: `${mana.name} (עותק)`,
                type: mana.type,
                equipments: mana.equipments,
              });
              Alert.alert('הצלחה', 'המנה שוכפלה בהצלחה');
              navigation.goBack();
            } catch (error) {
              Alert.alert('שגיאה', 'נכשל בשכפול המנה');
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
          <Text style={styles.headerTitle}>טוען...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
          <Text style={styles.loadingText}>טוען פרטי מנה...</Text>
        </View>
      </View>
    );
  }

  if (!mana) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>מנה לא נמצאה</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>❓</Text>
          <Text style={styles.emptyText}>המנה לא נמצאה</Text>
          <Text style={styles.emptySubtext}>יתכן שהמנה נמחקה או שאין לך הרשאות</Text>
          <TouchableOpacity style={styles.backHomeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backHomeButtonText}>חזור לרשימה</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isMana = mana.type === 'מנה' || !mana.type;
  const totalItems = mana.equipments.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isMana ? Colors.arme : '#7C3AED' }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{mana.name}</Text>
          <Text style={styles.headerSubtitle}>
            {isMana ? '📦 מנה' : '🧰 ערכה'} • {mana.equipments.length} סוגים
          </Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isMana ? Colors.arme : '#7C3AED' }]}>
            <Text style={styles.statNumber}>{mana.equipments.length}</Text>
            <Text style={styles.statLabel}>סוגי ציוד</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.success }]}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>סה"כ פריטים</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{mana.name}</Text>
            <Text style={styles.infoLabel}>שם</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={[
              styles.typeBadgeLarge,
              { backgroundColor: isMana ? Colors.armeLight : '#EDE9FE' }
            ]}>
              <Text style={[
                styles.typeBadgeTextLarge,
                { color: isMana ? Colors.arme : '#7C3AED' }
              ]}>
                {mana.type || 'מנה'}
              </Text>
            </View>
            <Text style={styles.infoLabel}>סוג</Text>
          </View>
        </View>

        {/* Equipment List */}
        <View style={styles.sectionHeader}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{mana.equipments.length}</Text>
          </View>
          <Text style={styles.sectionTitle}>רשימת ציוד</Text>
        </View>

        <View style={styles.equipmentList}>
          {mana.equipments.map((eq, index) => (
            <View key={index} style={styles.equipmentCard}>
              <View style={[
                styles.equipmentIcon,
                { backgroundColor: isMana ? Colors.arme : '#7C3AED' }
              ]}>
                <Text style={styles.equipmentIconText}>🔫</Text>
              </View>

              <View style={styles.equipmentInfo}>
                <Text style={styles.equipmentName}>{eq.equipmentName}</Text>
                {eq.equipmentId && (
                  <Text style={styles.equipmentId}>מזהה: {eq.equipmentId}</Text>
                )}
              </View>

              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>×{eq.quantity}</Text>
              </View>
            </View>
          ))}

          {mana.equipments.length === 0 && (
            <View style={styles.emptyEquipment}>
              <Text style={styles.emptyEquipmentText}>אין ציוד במנה זו</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsSectionTitle}>פעולות</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.infoLight }]}>
              <Text style={styles.actionIconText}>✏️</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>עריכת מנה</Text>
              <Text style={styles.actionSubtitle}>שנה שם, הוסף או הסר ציוד</Text>
            </View>
            <Text style={styles.actionChevron}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleDuplicate}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.successLight }]}>
              <Text style={styles.actionIconText}>📋</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>שכפול מנה</Text>
              <Text style={styles.actionSubtitle}>צור עותק של מנה זו</Text>
            </View>
            <Text style={styles.actionChevron}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleDelete}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.dangerLight }]}>
              <Text style={styles.actionIconText}>🗑️</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, styles.actionTitleDanger]}>מחיקת מנה</Text>
              <Text style={styles.actionSubtitle}>פעולה זו אינה הפיכה</Text>
            </View>
            <Text style={[styles.actionChevron, styles.actionChevronDanger]}>‹</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 18,
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

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  backHomeButton: {
    backgroundColor: Colors.arme,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  backHomeButtonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.textWhite,
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
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.small,
  },
  statNumber: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },

  // Info Card
  infoCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  typeBadgeLarge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeTextLarge: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
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
  badge: {
    backgroundColor: Colors.arme,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },

  // Equipment List
  equipmentList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.xs,
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
    marginBottom: 2,
  },
  equipmentId: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  quantityBadge: {
    backgroundColor: Colors.arme,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 48,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  emptyEquipment: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyEquipmentText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Actions Section
  actionsSection: {
    marginBottom: Spacing.xl,
  },
  actionsSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.xs,
  },
  actionButtonDanger: {
    borderColor: Colors.dangerLight,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  actionIconText: {
    fontSize: 20,
  },
  actionContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  actionTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  actionTitleDanger: {
    color: Colors.danger,
  },
  actionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionChevron: {
    fontSize: 24,
    color: Colors.textLight,
  },
  actionChevronDanger: {
    color: Colors.danger,
  },

  bottomSpacer: {
    height: Spacing.xxl,
  },
});

export default ManotDetailsScreen;