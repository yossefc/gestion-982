// Écran d'accueil du module Arme (מנות וציוד לחימה)
// Design professionnel avec UX améliorée
// OPTIMISÉ: Utilise le cache centralisé au lieu d'appels Firebase directs
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { AppModal, ModalType } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { useData, useCombatStats, useManot, useCombatEquipment } from '../../contexts/DataContext';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { exportWeaponInventoryByCompanyToExcel } from '../../utils/exportExcel';
import { soldierService } from '../../services/soldierService';

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

  // OPTIMISÉ: Utilisation du cache centralisé - plus d'appels Firebase à chaque navigation
  const { refreshAll, isInitialized } = useData();
  const { stats: combatStats, loading: statsLoading } = useCombatStats();
  const { manot, loading: manotLoading } = useManot();
  const { equipment, loading: equipmentLoading } = useCombatEquipment();

  const [refreshing, setRefreshing] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const reportSheetAnim = useRef(new Animated.Value(0)).current;
  const reportBackdropAnim = useRef(new Animated.Value(0)).current;
  const isClosingReportMenuRef = useRef(false);

  // Rapport menu
  useEffect(() => {
    if (!reportMenuVisible) {
      return;
    }

    isClosingReportMenuRef.current = false;
    reportSheetAnim.setValue(0);
    reportBackdropAnim.setValue(0);

    Animated.parallel([
      Animated.timing(reportBackdropAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(reportSheetAnim, {
        toValue: 1,
        tension: 80,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reportMenuVisible, reportSheetAnim, reportBackdropAnim]);

  const closeReportMenu = (afterClose?: () => void) => {
    if (!reportMenuVisible || isClosingReportMenuRef.current) {
      return;
    }

    isClosingReportMenuRef.current = true;

    Animated.parallel([
      Animated.timing(reportBackdropAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(reportSheetAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      isClosingReportMenuRef.current = false;
      if (finished) {
        setReportMenuVisible(false);
        if (afterClose) {
          afterClose();
        }
      }
    });
  };


  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const allWeapons = await weaponInventoryService.getAllWeapons();
      const allSoldiers = await soldierService.getAll();

      // Export only soldiers with active weapons (assigned/stored).
      // Excludes soldiers who already returned all their weapons.
      await exportWeaponInventoryByCompanyToExcel(allWeapons, allSoldiers);

      setModalType('success');
      setModalMessage('קובץ Excel יוצא בהצלחה!');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } catch (error) {
      console.error('Error exporting weapon inventory:', error);
      setModalType('error');
      setModalMessage('שגיאה בייצוא לאקסל');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setExportLoading(false);
      closeReportMenu();
    }
  };

  const openReportScreen = (screen: 'InventoryReport' | 'PlugaReport') => {
    closeReportMenu(() => navigation.navigate(screen));
  };

  const showReportMenu = () => {
    if (reportMenuVisible || isClosingReportMenuRef.current) {
      return;
    }
    setReportMenuVisible(true);
  };

  // Calcul des stats depuis le cache
  const stats = {
    activeManot: manot.length,
    equipmentItems: equipment.length,
    signed: combatStats?.signedSoldiers || 0,
    pending: combatStats?.pendingSoldiers || 0,
  };

  // Loading global optimisé - affiche le contenu dès que possible
  const loading = !isInitialized || (statsLoading && manotLoading && equipmentLoading);

  // AppModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  // Refresh manuel uniquement - plus de useFocusEffect qui recharge à chaque navigation
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const primaryActions = [
    {
      id: 'signature',
      title: 'החתמת חייל',
      color: Colors.success,
      action: () => navigation.navigate('SoldierSearch', { mode: 'signature', type: 'combat' }),
    },
    {
      id: 'return',
      title: 'זיכוי חייל',
      color: Colors.warning,
      action: () => navigation.navigate('SoldierSearch', { mode: 'return', type: 'combat' }),
    },
    {
      id: 'storage',
      title: 'אפסון ציוד',
      color: '#FF6F00',
      action: () => navigation.navigate('SoldierSearch', { mode: 'storage', type: 'combat' }),
    },
    {
      id: 'retrieve',
      title: 'החזרת ציוד\nמאפסון',
      color: '#00897B',
      action: () => navigation.navigate('SoldierSearch', { mode: 'retrieve', type: 'combat' }),
    },
  ];

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
      title: 'הדפסה',
      icon: '📄',
      color: '#9C27B0',
      action: () => navigation.navigate('UnprintedSignatures'),
    },
    {
      id: 'quick-report',
      title: 'דוחות',
      icon: '📊',
      color: '#FF5722',
      action: showReportMenu,
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
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => navigation.navigate('UserProfile')}
          activeOpacity={0.7}
        >
          <Ionicons name="person-circle-outline" size={26} color={Colors.textWhite} />
          {(!user?.signature || !user?.personalNumber) && (
            <View style={styles.profileWarningBadge} />
          )}
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

        {/* Primary Actions Grid */}
        <Text style={styles.sectionTitle}>פעולות אפסנאות</Text>
        <View style={styles.primaryGridContainer}>
          {primaryActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.primaryGridCard, { backgroundColor: action.color }]}
              onPress={action.action}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryGridTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Menu */}
        <Text style={styles.sectionTitle}>ניהול</Text>
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

      <Modal
        visible={reportMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeReportMenu()}
      >
        <View style={styles.reportModalOverlay}>
          <Pressable style={styles.reportModalBackdrop} onPress={() => closeReportMenu()}>
            <Animated.View
              pointerEvents="none"
              style={[styles.reportModalBackdropTint, { opacity: reportBackdropAnim }]}
            />
          </Pressable>
          <Animated.View
            style={[
              styles.reportModalSheet,
              {
                opacity: reportSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
                transform: [
                  {
                    translateY: reportSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [280, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.reportModalHandle} />
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>דוחות</Text>
              <Text style={styles.reportSubtitle}>בחר סוג דוח להצגה או להדפסה</Text>
            </View>

            <TouchableOpacity
              style={styles.reportOptionCard}
              onPress={() => openReportScreen('InventoryReport')}
              activeOpacity={0.85}
            >
              <View style={[styles.reportOptionIcon, styles.reportOptionIconInventory]}>
                <Ionicons name="cube-outline" size={20} color={Colors.textWhite} />
              </View>
              <View style={styles.reportOptionContent}>
                <Text style={styles.reportOptionTitle}>סגירה/פתיחה</Text>
                <Text style={styles.reportOptionDescription}>מצב מחסן לפי פריטים ומלאי</Text>
              </View>
              <Ionicons
                name="chevron-back"
                size={20}
                color={Colors.textLight}
                style={styles.reportOptionChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportOptionCard}
              onPress={() => openReportScreen('PlugaReport')}
              activeOpacity={0.85}
            >
              <View style={[styles.reportOptionIcon, styles.reportOptionIconCompany]}>
                <Ionicons name="people-outline" size={20} color={Colors.textWhite} />
              </View>
              <View style={styles.reportOptionContent}>
                <Text style={styles.reportOptionTitle}>דוח ציוד חתום לפי פלוגה</Text>
                <Text style={styles.reportOptionDescription}>רכזת ציוד חתום לפי שיוך פלוגתי</Text>
              </View>
              <Ionicons
                name="chevron-back"
                size={20}
                color={Colors.textLight}
                style={styles.reportOptionChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportOptionCard}
              onPress={handleExportExcel}
              activeOpacity={0.85}
              disabled={exportLoading}
            >
              <View style={[styles.reportOptionIcon, { backgroundColor: Colors.arme }]}>
                {exportLoading ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <Ionicons name="document-text-outline" size={20} color={Colors.textWhite} />
                )}
              </View>
              <View style={styles.reportOptionContent}>
                <Text style={styles.reportOptionTitle}>
                  {exportLoading ? 'מייצא לאקסל...' : 'ייצוא לאקסל (לפי פלוגות)'}
                </Text>
                <Text style={styles.reportOptionDescription}>מלאי החתמות כרגע בכל הפלוגות</Text>
              </View>
              <Ionicons
                name="chevron-back"
                size={20}
                color={Colors.textLight}
                style={styles.reportOptionChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportCancelButton}
              onPress={() => closeReportMenu()}
              activeOpacity={0.85}
            >
              <Text style={styles.reportCancelText}>ביטול</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* App Modal */}
      <AppModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
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
    position: 'relative',
  },
  profileWarningBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.warning,
    borderWidth: 1.5,
    borderColor: Colors.arme,
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

  // Primary Actions Grid
  primaryGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  primaryGridCard: {
    width: '48%',
    aspectRatio: 1.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  primaryGridTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textWhite,
    textAlign: 'center',
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

  // Report menu modal
  reportModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  reportModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  reportModalBackdropTint: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  reportModalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    ...Shadows.large,
  },
  reportModalHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderMedium,
    marginBottom: Spacing.md,
  },
  reportHeader: {
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
  reportTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  reportSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  reportOptionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reportOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  reportOptionIconInventory: {
    backgroundColor: Colors.arme,
  },
  reportOptionIconCompany: {
    backgroundColor: Colors.info,
  },
  reportOptionContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  reportOptionTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  reportOptionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },
  reportOptionChevron: {
    marginRight: Spacing.sm,
  },
  reportCancelButton: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
  },
  reportCancelText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});

export default ArmeHomeScreen;
