/**
 * HomeScreen.tsx - Écran d'accueil principal
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
import { useAuth } from '../../contexts/AuthContext';
import { soldierService } from '../../services/soldierService';
import { assignmentService } from '../../services/assignmentService';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalSoldiers: 0,
    todayAssignments: 0,
    pendingSignatures: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const soldiers = await soldierService.getAll();
      const assignments = await assignmentService.getAll();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAssignments = assignments.filter((a: any) => {
        const date = a.createdAt?.toDate?.() || new Date(a.createdAt);
        return date >= today;
      });

      const pending = assignments.filter((a: any) => a.status === 'OPEN');

      setStats({
        totalSoldiers: soldiers.length,
        todayAssignments: todayAssignments.length,
        pendingSignatures: pending.length,
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

  const canAccessArme = userRole === 'admin' || userRole === 'both' || userRole === 'arme';
  const canAccessVetement = userRole === 'admin' || userRole === 'both' || userRole === 'vetement';
  const canAccessAdmin = userRole === 'admin';

  const getRoleBadge = () => {
    const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
      admin: { label: 'מנהל', color: Colors.soldatsDark, bg: Colors.soldatsLight },
      both: { label: 'מלא', color: Colors.successDark, bg: Colors.successLight },
      arme: { label: 'נשק', color: Colors.armeDark, bg: Colors.armeLight },
      vetement: { label: 'ביגוד', color: Colors.vetementDark, bg: Colors.vetementLight },
    };
    return roleConfig[userRole || ''] || { label: 'משתמש', color: Colors.textSecondary, bg: Colors.backgroundSecondary };
  };

  const roleBadge = getRoleBadge();

  const ModuleCard = ({
    title,
    subtitle,
    icon,
    color,
    lightColor,
    onPress,
  }: {
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    lightColor: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.moduleCard, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.moduleIconContainer, { backgroundColor: lightColor }]}>
        <Ionicons name={icon as any} size={32} color={color} />
      </View>
      <View style={styles.moduleContent}>
        <Text style={styles.moduleTitle}>{title}</Text>
        <Text style={styles.moduleSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-back" size={24} color={Colors.textLight} />
    </TouchableOpacity>
  );

  const QuickActionButton = ({
    title,
    icon,
    onPress,
  }: {
    title: string;
    icon: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon as any} size={24} color={Colors.primary} />
      </View>
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>982</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>שלום,</Text>
          <Text style={styles.userName}>{user?.displayName || user?.email?.split('@')[0]}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.infoLight }]}>
            <Ionicons name="people" size={24} color={Colors.info} />
            <Text style={[styles.statValue, { color: Colors.info }]}>{stats.totalSoldiers}</Text>
            <Text style={styles.statLabel}>חיילים</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="today" size={24} color={Colors.success} />
            <Text style={[styles.statValue, { color: Colors.success }]}>{stats.todayAssignments}</Text>
            <Text style={styles.statLabel}>היום</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.warningLight }]}>
            <Ionicons name="time" size={24} color={Colors.warning} />
            <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.pendingSignatures}</Text>
            <Text style={styles.statLabel}>ממתינים</Text>
          </View>
        </View>

        {/* Module Cards */}
        <Text style={styles.sectionTitle}>מודולים</Text>

        {canAccessArme && (
          <ModuleCard
            title="נשק וציוד לוחם"
            subtitle="החתמה וזיכוי ציוד קרבי"
            icon="shield"
            color={Colors.arme}
            lightColor={Colors.armeLight}
            onPress={() => navigation.navigate('ArmeHome' as never)}
          />
        )}

        {canAccessVetement && (
          <ModuleCard
            title="ביגוד"
            subtitle="החתמה וזיכוי ציוד אישי"
            icon="shirt"
            color={Colors.vetement}
            lightColor={Colors.vetementLight}
            onPress={() => navigation.navigate('VetementHome' as never)}
          />
        )}

        {canAccessAdmin && (
          <ModuleCard
            title="ניהול מערכת"
            subtitle="הגדרות, משתמשים ודוחות"
            icon="cog"
            color={Colors.soldats}
            lightColor={Colors.soldatsLight}
            onPress={() => navigation.navigate('AdminPanel' as never)}
          />
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>פעולות מהירות</Text>
        <View style={styles.quickActionsRow}>
          <QuickActionButton
            title="חייל חדש"
            icon="person-add"
            onPress={() => navigation.navigate('AddSoldier' as never)}
          />
          <QuickActionButton
            title="החתמה מהירה"
            icon="create"
            onPress={() => navigation.navigate('SoldierSearch' as never, { mode: 'signature' })}
          />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="information-circle" size={24} color={Colors.olive} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>מערכת ניהול ציוד</Text>
            <Text style={styles.infoText}>גדוד 982 - גרסה 1.0.0</Text>
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

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    ...Shadows.medium,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },

  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoContainer: {
    alignItems: 'center',
  },

  logo: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textWhite,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },

  logoText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
  },

  welcomeSection: {
    alignItems: 'center',
  },

  welcomeText: {
    fontSize: FontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  userName: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: Spacing.xs,
  },

  roleBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },

  roleBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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

  // Module Cards
  moduleCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.small,
  },

  moduleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  moduleContent: {
    flex: 1,
    alignItems: 'flex-end',
  },

  moduleTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },

  moduleSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  quickAction: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.small,
  },

  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  quickActionText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },

  // Info Card
  infoCard: {
    backgroundColor: Colors.olive + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.olive + '30',
  },

  infoIconContainer: {
    marginLeft: Spacing.md,
  },

  infoContent: {
    flex: 1,
    alignItems: 'flex-end',
  },

  infoTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.olive,
  },

  infoText: {
    fontSize: FontSize.sm,
    color: Colors.olive,
    marginTop: Spacing.xs,
  },
});

export default HomeScreen;