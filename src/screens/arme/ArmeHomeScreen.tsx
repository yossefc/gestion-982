// Écran d'accueil du module Arme (מנות וציוד לחימה)
// Design professionnel avec UX améliorée
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { dashboardService, manaService } from '../../services/firebaseService';
import { getAllCombatEquipment } from '../../services/equipmentService';
import { useAuth } from '../../contexts/AuthContext';

interface MenuItemProps {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  badge?: number;
  action: () => void;
}

const ArmeHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    activeManot: 0,
    equipmentItems: 0,
    signed: 0,
    pending: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (!authLoading && user) {
        loadStats();
      } else if (!authLoading) {
        setLoading(false);
      }
    }, [authLoading, user])
  );

  const loadStats = async () => {
    try {
      const [dashboardStats, manot, equipment] = await Promise.all([
        dashboardService.getCombatStats(),
        manaService.getAll(),
        getAllCombatEquipment(),
      ]);

      setStats({
        activeManot: manot.length,
        equipmentItems: equipment.length,
        signed: dashboardStats.signedSoldiers || 0,
        pending: dashboardStats.pendingSoldiers || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const menuItems: MenuItemProps[] = [
    {
      id: 'manot',
      title: 'ניהול מנות',
      subtitle: 'מנת מפקד, מנת לוחם, ערכות',
      icon: '📦',
      color: '#E53935',
      badge: stats.activeManot,
      action: () => navigation.navigate('ManotList'),
    },
    {
      id: 'equipment',
      title: 'ניהול ציוד',
      subtitle: 'נשק, אופטיקה, ציוד לוחם',
      icon: '🔫',
      color: Colors.arme,
      badge: stats.equipmentItems,
      action: () => navigation.navigate('CombatEquipmentList'),
    },
    {
      id: 'inventory',
      title: 'מלאי נשק',
      subtitle: 'ניהול מסטבים והקצאות',
      icon: '📋',
      color: '#9C27B0',
      action: () => navigation.navigate('WeaponInventoryList'),
    },
    {
      id: 'signature',
      title: 'החתמת חייל',
      subtitle: 'הנפקת ציוד לחימה',
      icon: '✍️',
      color: Colors.success,
      action: () => navigation.navigate('SoldierSearch', { mode: 'signature', type: 'combat' }),
    },
    {
      id: 'return',
      title: 'זיכוי חייל',
      subtitle: 'החזרת ציוד לחימה',
      icon: '↩️',
      color: Colors.warning,
      action: () => navigation.navigate('SoldierSearch', { mode: 'return', type: 'combat' }),
    },
    {
      id: 'storage',
      title: 'אפסון ציוד',
      subtitle: 'שמירת ציוד בנשקייה',
      icon: '🏦',
      color: '#FF6F00',
      action: () => navigation.navigate('SoldierSearch', { mode: 'storage', type: 'combat' }),
    },
    {
      id: 'retrieve',
      title: 'החזרת ציוד מאפסון',
      subtitle: 'החזרה לחייל מהנשקייה',
      icon: '📤',
      color: '#00897B',
      action: () => navigation.navigate('SoldierSearch', { mode: 'retrieve', type: 'combat' }),
    },
  ];

  const quickActions = [
    {
      id: 'stock-table',
      title: 'טבלה',
      icon: '📊',
      color: Colors.info,
      action: () => navigation.navigate('CombatStock'),
    },
    {
      id: 'quick-pdf',
      title: 'טופס 982',
      icon: '📄',
      color: '#9C27B0',
      action: () => Alert.alert('בקרוב', 'יצירת טופס 982 תהיה זמינה בקרוב'),
    },
    {
      id: 'quick-report',
      title: 'דוחות',
      icon: '📊',
      color: '#FF5722',
      action: () => Alert.alert('בקרוב', 'מסך דוחות יהיה זמין בקרוב'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>נשקייה</Text>
          <Text style={styles.headerSubtitle}>מערכת ניהול ציוד לחימה</Text>
        </View>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🔫</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.arme]} />
        }
      >
        {/* Quick Stats */}
        {loading ? (
          <View style={styles.loadingStats}>
            <ActivityIndicator size="small" color={Colors.arme} />
            <Text style={styles.loadingStatsText}>טוען נתונים...</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardLarge]}>
              <Text style={styles.statIcon}>📦</Text>
              <Text style={styles.statNumber}>{stats.activeManot}</Text>
              <Text style={styles.statLabel}>מנות פעילות</Text>
            </View>
            <View style={styles.statColumn}>
              <View style={[styles.statCardSmall, { backgroundColor: Colors.arme }]}>
                <Text style={styles.statNumberSmall}>{stats.equipmentItems}</Text>
                <Text style={styles.statLabelSmall}>פריטי ציוד</Text>
              </View>
              <View style={[styles.statCardSmall, { backgroundColor: Colors.success }]}>
                <Text style={styles.statNumberSmall}>{stats.signed}</Text>
                <Text style={styles.statLabelSmall}>חתומים</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionButton}
              onPress={action.action}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
                <Text style={styles.quickActionIconText}>{action.icon}</Text>
              </View>
              <Text style={styles.quickActionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Menu */}
        <Text style={styles.sectionTitle}>פעולות עיקריות</Text>
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
                <Text style={styles.menuIconText}>{item.icon}</Text>
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              {item.badge !== undefined && item.badge > 0 && (
                <View style={[styles.menuBadge, { backgroundColor: item.color }]}>
                  <Text style={styles.menuBadgeText}>{item.badge}</Text>
                </View>
              )}
              <Text style={styles.menuChevron}>‹</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Text style={styles.infoIcon}>⚠️</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>חשוב לדעת</Text>
            <Text style={styles.infoText}>
              יש לוודא תקינות הציוד לפני החתמה. כל הנפקה מתועדת במערכת ונשמרת לצורכי ביקורת.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

// Alert component placeholder
const Alert = {
  alert: (title: string, message: string) => {
    console.log(`${title}: ${message}`);
  },
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
    paddingBottom: 24,
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
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },

  // Loading Stats
  loadingStats: {
    height: 120,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.small,
  },
  loadingStatsText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  statCardLarge: {
    flex: 1,
    justifyContent: 'center',
  },
  statColumn: {
    flex: 1,
    gap: Spacing.md,
  },
  statCardSmall: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  statNumber: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    color: Colors.arme,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statNumberSmall: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  statLabelSmall: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.xs,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickActionIconText: {
    fontSize: 24,
  },
  quickActionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },

  // Section Title
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },

  // Menu
  menuContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  menuIconText: {
    fontSize: 26,
  },
  menuInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menuTitle: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  menuBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  menuBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  menuChevron: {
    fontSize: 24,
    color: Colors.textLight,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFE082',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoTitle: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 4,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: '#795548',
    lineHeight: 20,
    textAlign: 'right',
  },

  bottomSpacer: {
    height: Spacing.xxl,
  },
});

export default ArmeHomeScreen;