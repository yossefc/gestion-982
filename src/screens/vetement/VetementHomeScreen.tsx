/**
 * VetementHomeScreen.tsx - Écran d'accueil module Vêtements
 * Design militaire professionnel
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { dashboardService } from '../../services/firebaseService';

const VetementHomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    signed: 0,
    returned: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const dashboardStats = await dashboardService.getClothingStats();

      setStats({
        signed: dashboardStats.signedSoldiers || 0,
        returned: dashboardStats.returnedEquipment || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const menuItems = [
    {
      title: 'החתמת חייל',
      subtitle: 'הנפקת ציוד ביגוד',
      icon: 'create',
      color: Colors.success,
      lightColor: Colors.successLight,
      onPress: () => navigation.navigate('SoldierSearch' as never, { mode: 'signature', type: 'clothing' } as never),
    },
    {
      title: 'זיכוי חייל',
      subtitle: 'החזרת ציוד ביגוד',
      icon: 'return-down-back',
      color: Colors.warning,
      lightColor: Colors.warningLight,
      onPress: () => navigation.navigate('SoldierSearch' as never, { mode: 'return', type: 'clothing' } as never),
    },
    {
      title: 'מלאי ביגוד',
      subtitle: 'פילוח לפי פלוגות',
      icon: 'cube',
      color: Colors.vetement,
      lightColor: Colors.vetementLight,
      onPress: () => navigation.navigate('ClothingStock' as never),
    },
    {
      title: 'דאשבורד',
      subtitle: 'סטטיסטיקות ודוחות',
      icon: 'stats-chart',
      color: Colors.info,
      lightColor: Colors.infoLight,
      onPress: () => navigation.navigate('ClothingDashboard' as never),
    },
    {
      title: 'ניהול ציוד',
      subtitle: 'עריכת רשימת הציוד',
      icon: 'settings',
      color: Colors.olive,
      lightColor: Colors.olive + '20',
      onPress: () => navigation.navigate('ClothingEquipmentManagement' as never),
    },
    {
      title: 'הוספת חייל',
      subtitle: 'רישום חייל חדש',
      icon: 'person-add',
      color: Colors.soldats,
      lightColor: Colors.soldatsLight,
      onPress: () => navigation.navigate('AddSoldier' as never),
    },
  ];

  const StatCard = ({
    title,
    value,
    icon,
    color,
    lightColor,
  }: {
    title: string;
    value: number;
    icon: string;
    color: string;
    lightColor: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: lightColor }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  const MenuItem = ({
    title,
    subtitle,
    icon,
    color,
    lightColor,
    onPress
  }: {
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    lightColor: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: lightColor }]}>
        <Ionicons name={icon as any} size={28} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.vetement} />
        <Text style={styles.loadingText}>טוען נתונים...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>ביגוד</Text>
          <Text style={styles.headerSubtitle}>ניהול ציוד אישי</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadStats}
        >
          <Ionicons name="refresh" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStats();
            }}
            colors={[Colors.vetement]}
          />
        }
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="הוחתמו"
            value={stats.signed}
            icon="checkmark-done"
            color={Colors.success}
            lightColor={Colors.successLight}
          />
          <StatCard
            title="הוחזרו"
            value={stats.returned}
            icon="return-up-back"
            color={Colors.info}
            lightColor={Colors.infoLight}
          />
        </View>

        {/* Menu Items */}
        <Text style={styles.sectionTitle}>פעולות</Text>
        {menuItems.map((item, index) => (
          <MenuItem key={index} {...item} />
        ))}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="shirt-outline" size={24} color={Colors.vetement} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>מודול ביגוד</Text>
            <Text style={styles.infoText}>ניהול ציוד אישי וביגוד לחיילים</Text>
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: Colors.vetement,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
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

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    textAlign: 'right',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: -Spacing.xl,
  },

  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.small,
  },

  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },

  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Menu Items
  menuItem: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  menuContent: {
    flex: 1,
    alignItems: 'flex-end',
  },

  menuTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  menuSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Info Card
  infoCard: {
    backgroundColor: Colors.vetementLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.vetement + '30',
  },

  infoContent: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: Spacing.md,
  },

  infoTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.vetement,
  },

  infoText: {
    fontSize: FontSize.sm,
    color: Colors.vetement,
    marginTop: Spacing.xs,
  },
});

export default VetementHomeScreen;