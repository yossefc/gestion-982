/**
 * ClothingDashboardScreen.tsx - Tableau de bord vêtements
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
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { assignmentService } from '../../services/assignmentService';
import { soldierService } from '../../services/soldierService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DashboardStats {
  totalAssignments: number;
  openAssignments: number;
  returnedAssignments: number;
  totalSoldiers: number;
  soldiersWithEquipment: number;
  todayActivity: number;
  weekActivity: number;
}

const ClothingDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalAssignments: 0,
    openAssignments: 0,
    returnedAssignments: 0,
    totalSoldiers: 0,
    soldiersWithEquipment: 0,
    todayActivity: 0,
    weekActivity: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [assignments, soldiers] = await Promise.all([
        assignmentService.getAssignmentsByType('clothing'),
        soldierService.getAll(),
      ]);

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const openAssignments = assignments.filter((a: any) => a.action === 'issue');
      const returnedAssignments = assignments.filter((a: any) => a.action === 'credit');

      const todayActivity = assignments.filter((a: any) => {
        const date = a.timestamp?.toDate?.() || new Date(a.timestamp);
        return date >= today;
      });

      const weekActivity = assignments.filter((a: any) => {
        const date = a.timestamp?.toDate?.() || new Date(a.timestamp);
        return date >= weekAgo;
      });

      // Calculer le nombre de soldats qui ont actuellement de l'équipement
      const allHoldings = await transactionalAssignmentService.getAllHoldings('clothing');
      const soldiersWithEquipment = allHoldings.filter(h => (h.items || []).length > 0).length;

      setStats({
        totalAssignments: assignments.length,
        openAssignments: openAssignments.length,
        returnedAssignments: returnedAssignments.length,
        totalSoldiers: soldiers.length,
        soldiersWithEquipment,
        todayActivity: todayActivity.length,
        weekActivity: weekActivity.length,
      });

      // Recent activity
      const recent = assignments
        .sort((a: any, b: any) => {
          const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);
      setRecentActivity(recent);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon,
    color,
    lightColor,
    subtitle,
  }: {
    title: string;
    value: number;
    icon: string;
    color: string;
    lightColor: string;
    subtitle?: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconContainer, { backgroundColor: lightColor }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const formatDate = (date: any) => {
    const d = date?.toDate?.() || new Date(date);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

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
          <Text style={styles.headerTitle}>דאשבורד אפנאות</Text>
          <Text style={styles.headerSubtitle}>סטטיסטיקות ודוחות</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadDashboardData}
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
              loadDashboardData();
            }}
            colors={[Colors.vetement]}
          />
        }
      >
        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={[styles.quickStat, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="today" size={20} color={Colors.success} />
            <Text style={[styles.quickStatValue, { color: Colors.success }]}>{stats.todayActivity}</Text>
            <Text style={styles.quickStatLabel}>היום</Text>
          </View>
          <View style={[styles.quickStat, { backgroundColor: Colors.infoLight }]}>
            <Ionicons name="calendar" size={20} color={Colors.info} />
            <Text style={[styles.quickStatValue, { color: Colors.info }]}>{stats.weekActivity}</Text>
            <Text style={styles.quickStatLabel}>השבוע</Text>
          </View>
          <View style={[styles.quickStat, { backgroundColor: Colors.warningLight }]}>
            <Ionicons name="people" size={20} color={Colors.warning} />
            <Text style={[styles.quickStatValue, { color: Colors.warning }]}>{stats.soldiersWithEquipment}</Text>
            <Text style={styles.quickStatLabel}>עם ציוד</Text>
          </View>
        </View>

        {/* Main Stats */}
        <Text style={styles.sectionTitle}>סטטיסטיקות כלליות</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="סה״כ החתמות"
            value={stats.totalAssignments}
            icon="documents"
            color={Colors.vetement}
            lightColor={Colors.vetementLight}
          />
          <StatCard
            title="החתמות פתוחות"
            value={stats.openAssignments}
            icon="time"
            color={Colors.warning}
            lightColor={Colors.warningLight}
          />
          <StatCard
            title="הוחזרו"
            value={stats.returnedAssignments}
            icon="checkmark-done"
            color={Colors.success}
            lightColor={Colors.successLight}
          />
          <StatCard
            title="חיילים במערכת"
            value={stats.totalSoldiers}
            icon="people"
            color={Colors.info}
            lightColor={Colors.infoLight}
          />
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>פעילות אחרונה</Text>
        <View style={styles.activityCard}>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyActivityText}>אין פעילות אחרונה</Text>
            </View>
          ) : (
            recentActivity.map((activity, index) => (
              <TouchableOpacity
                key={activity.id || index}
                style={[
                  styles.activityItem,
                  index < recentActivity.length - 1 && styles.activityItemBorder,
                ]}
                onPress={() => {
                  // Afficher les détails de l'activité
                  const itemsList = activity.items?.map((item: any) => `• ${item.equipmentName} (${item.quantity})`).join('\n') || 'אין פריטים';
                  const validatorName = activity.assignedByName && !activity.assignedByName.includes('@')
                    ? activity.assignedByName
                    : (activity.assignedByEmail ? activity.assignedByEmail.split('@')[0] : 'לא ידוע');

                  Alert.alert(
                    `${activity.action === 'credit' ? 'זיכוי' : 'החתמה'} - ${activity.soldierName}`,
                    `תאריך: ${formatDate(activity.timestamp)}\nאושר על ידי: ${validatorName}\n\nפריטים:\n${itemsList}`,
                    [{ text: 'סגור', style: 'cancel' }]
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.activityIcon,
                  { backgroundColor: activity.action === 'credit' ? Colors.successLight : Colors.infoLight },
                ]}>
                  <Ionicons
                    name={activity.action === 'credit' ? 'return-up-back' : 'create'}
                    size={20}
                    color={activity.action === 'credit' ? Colors.success : Colors.info}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    {activity.action === 'credit' ? 'זיכוי' : 'החתמה'} - {activity.soldierName}
                  </Text>
                  <Text style={styles.activitySubtitle}>
                    {activity.items?.length || 0} פריטים • {formatDate(activity.timestamp)}
                  </Text>
                  <Text style={styles.activityValidator}>
                    {activity.assignedByName && !activity.assignedByName.includes('@')
                      ? activity.assignedByName
                      : (activity.assignedByEmail ? activity.assignedByEmail.split('@')[0] : 'לא ידוע')} ✓
                  </Text>
                </View>
                <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>פעולות מהירות</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('SoldierSearch', { mode: 'signature', type: 'clothing' })}
          >
            <Ionicons name="create" size={24} color={Colors.vetement} />
            <Text style={styles.actionButtonText}>החתמה חדשה</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('SoldierSearch', { mode: 'return', type: 'clothing' })}
          >
            <Ionicons name="return-down-back" size={24} color={Colors.warning} />
            <Text style={styles.actionButtonText}>זיכוי</Text>
          </TouchableOpacity>
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

  // Quick Stats Row
  quickStatsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: -Spacing.xl,
  },

  quickStat: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.small,
  },

  quickStatValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },

  quickStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },

  statCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: (SCREEN_WIDTH - Spacing.lg * 3) / 2,
    borderLeftWidth: 4,
    ...Shadows.small,
  },

  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  statValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.text,
  },

  statTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  statSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },

  // Activity Card
  activityCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },

  emptyActivity: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },

  emptyActivityText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  activityContent: {
    flex: 1,
    alignItems: 'flex-end',
  },

  activityTitle: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: Colors.text,
  },

  activitySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  activityValidator: {
    fontSize: FontSize.xs,
    color: Colors.success,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },

  // Actions Row
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  actionButton: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.small,
  },

  actionButtonText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
});

export default ClothingDashboardScreen;