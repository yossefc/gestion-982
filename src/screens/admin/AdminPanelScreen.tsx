/**
 * AdminPanelScreen.tsx - Panneau d'administration
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
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { soldierService } from '../../services/soldierService';
import { userService } from '../../services/userService';
import { assignmentService } from '../../services/assignmentService';

const AdminPanelScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSoldiers: 0,
    todayAssignments: 0,
    totalAssignments: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [soldiers, users, assignments] = await Promise.all([
        soldierService.getAll(),
        userService.getAll(),
        assignmentService.getAll(),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAssignments = assignments.filter((a: any) => {
        const assignmentDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
        return assignmentDate >= today;
      });

      setStats({
        totalUsers: users.length,
        totalSoldiers: soldiers.length,
        todayAssignments: todayAssignments.length,
        totalAssignments: assignments.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeData = () => {
    Alert.alert(
      'אתחול נתוני ברירת מחדל',
      'האם אתה בטוח? פעולה זו תוסיף ציוד ברירת מחדל למערכת.',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'אישור', onPress: () => initializeDefaultData() },
      ]
    );
  };

  const initializeDefaultData = async () => {
    try {
      setLoading(true);
      // Initialize default equipment logic here
      Alert.alert('הצלחה', 'הנתונים אותחלו בהצלחה');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לאתחל את הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon,
    color
  }: {
    title: string;
    value: number;
    icon: string;
    color: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  const ActionCard = ({
    title,
    subtitle,
    icon,
    onPress,
    color = Colors.primary,
    disabled = false,
  }: {
    title: string;
    subtitle: string;
    icon: string;
    onPress: () => void;
    color?: string;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.actionCard, disabled && styles.actionCardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.actionIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={28} color={disabled ? Colors.disabled : color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, disabled && styles.textDisabled]}>{title}</Text>
        <Text style={[styles.actionSubtitle, disabled && styles.textDisabled]}>{subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-back"
        size={20}
        color={disabled ? Colors.disabled : Colors.textLight}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
          <Text style={styles.headerTitle}>פאנל ניהול</Text>
          <Text style={styles.headerSubtitle}>ניהול מערכת גדוד 982</Text>
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
      >
        {/* Stats Section */}
        <Text style={styles.sectionTitle}>סטטיסטיקות מערכת</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="משתמשים"
            value={stats.totalUsers}
            icon="people"
            color={Colors.info}
          />
          <StatCard
            title="חיילים"
            value={stats.totalSoldiers}
            icon="person"
            color={Colors.success}
          />
          <StatCard
            title="החתמות היום"
            value={stats.todayAssignments}
            icon="today"
            color={Colors.warning}
          />
          <StatCard
            title="סה״כ החתמות"
            value={stats.totalAssignments}
            icon="documents"
            color={Colors.soldats}
          />
        </View>

        {/* Management Actions */}
        <Text style={styles.sectionTitle}>ניהול משתמשים</Text>
        <ActionCard
          title="ניהול משתמשים"
          subtitle="הוספה, עריכה והרשאות משתמשים"
          icon="people-circle"
          color={Colors.soldats}
          onPress={() => navigation.navigate('UserManagement' as never)}
        />

        {/* Database Actions */}
        <Text style={styles.sectionTitle}>כלי מסד נתונים</Text>
        <ActionCard
          title="בדיקת מסד נתונים"
          subtitle="סקירת אוספים ואבחון בעיות"
          icon="server"
          color={Colors.info}
          onPress={() => navigation.navigate('DatabaseDebug' as never)}
        />
        <ActionCard
          title="אתחול נתוני ברירת מחדל"
          subtitle="הוספת ציוד ומנות ברירת מחדל"
          icon="refresh-circle"
          color={Colors.warning}
          onPress={handleInitializeData}
        />

        {/* Export Actions */}
        <Text style={styles.sectionTitle}>ייצוא נתונים</Text>
        <ActionCard
          title="ייצוא לאקסל"
          subtitle="ייצוא כל הנתונים לקובץ Excel"
          icon="download"
          color={Colors.success}
          onPress={() => Alert.alert('בקרוב', 'פיצ׳ר זה יהיה זמין בקרוב')}
          disabled
        />
        <ActionCard
          title="גיבוי מערכת"
          subtitle="יצירת גיבוי מלא של המערכת"
          icon="cloud-upload"
          color={Colors.primary}
          onPress={() => Alert.alert('בקרוב', 'פיצ׳ר זה יהיה זמין בקרוב')}
          disabled
        />

        {/* System Info */}
        <View style={styles.systemInfo}>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>גרסה:</Text>
            <Text style={styles.systemInfoValue}>1.0.0</Text>
          </View>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>סטטוס Firebase:</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>מחובר</Text>
            </View>
          </View>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>יחידה:</Text>
            <Text style={styles.systemInfoValue}>גדוד 982</Text>
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
    backgroundColor: Colors.soldats,
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
    width: '47%',
    borderLeftWidth: 4,
    ...Shadows.small,
  },

  statIconContainer: {
    width: 48,
    height: 48,
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

  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Action Cards
  actionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  actionCardDisabled: {
    opacity: 0.6,
  },

  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
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

  actionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  textDisabled: {
    color: Colors.disabled,
  },

  // System Info
  systemInfo: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    ...Shadows.small,
  },

  systemInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  systemInfoLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  systemInfoValue: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: Spacing.xs,
  },

  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.successDark,
  },
});

export default AdminPanelScreen;