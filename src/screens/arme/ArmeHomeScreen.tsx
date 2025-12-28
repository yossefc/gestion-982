// Écran d'accueil du module Arme (מנות וציוד לחימה)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/colors';
import { dashboardService, manaService, combatEquipmentService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';

const ArmeHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeManot: 0,
    equipmentItems: 0,
    signed: 0,
  });

  useEffect(() => {
    // Attendre que l'auth soit prête avant de charger les stats
    if (!authLoading && user) {
      loadStats();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user]);

  const loadStats = async () => {
    try {
      const [dashboardStats, manot, equipment] = await Promise.all([
        dashboardService.getCombatStats(),
        manaService.getAll(),
        combatEquipmentService.getAll(),
      ]);

      setStats({
        activeManot: manot.length,
        equipmentItems: equipment.length,
        signed: dashboardStats.signedSoldiers,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      id: 'manot',
      title: 'ניהול מנות',
      subtitle: 'מנת מפקד, מנת לוחם, וכו\'',
      icon: '📦',
      color: Colors.modules.arme,
      action: () => navigation.navigate('ManotList'),
    },
    {
      id: 'equipment',
      title: 'ניהול ציוד',
      subtitle: 'נשק, אופטיקה, ציוד לוחם',
      icon: '🔫',
      color: Colors.military.darkGreen,
      action: () => navigation.navigate('CombatEquipmentList'),
    },
    {
      id: 'signature',
      title: 'החתמת חייל',
      subtitle: 'הנפקת ציוד לחימה',
      icon: '✍️',
      color: Colors.status.success,
      action: () => navigation.navigate('SoldierSearch', { mode: 'combat' }),
    },
    {
      id: 'pdf',
      title: 'יצירת טופס 982',
      subtitle: 'הפקת מסמך חתימה',
      icon: '📄',
      color: Colors.status.info,
      action: () => navigation.navigate('SoldierSearch', { mode: 'combat' }),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>נשקיה</Text>
          <Text style={styles.subtitle}>🔫 מערכת ניהול גדוד 982</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Quick Stats */}
        {loading ? (
          <View style={styles.loadingStats}>
            <ActivityIndicator size="small" color={Colors.modules.arme} />
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.modules.arme }]}>
              <Text style={styles.statNumber}>{stats.activeManot}</Text>
              <Text style={styles.statLabel}>מנות פעילות</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.military.darkGreen }]}>
              <Text style={styles.statNumber}>{stats.equipmentItems}</Text>
              <Text style={styles.statLabel}>פריטי ציוד</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.status.success }]}>
              <Text style={styles.statNumber}>{stats.signed}</Text>
              <Text style={styles.statLabel}>חתומים</Text>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <Text style={styles.sectionTitle}>פעולות</Text>
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
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>פעילות אחרונה</Text>
        <View style={styles.activityCard}>
          <Text style={styles.emptyActivityText}>אין פעילות אחרונה</Text>
          <Text style={styles.emptyActivitySubtext}>
            החתמות והנפקות יופיעו כאן
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>⚠️ חשוב</Text>
          <Text style={styles.infoText}>
            יש לוודא תקינות הציוד לפני החתמה. כל הנפקה מתועדת במערכת ונשמרת לצורכי ביקורת.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    backgroundColor: Colors.background.header,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...Shadows.medium,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    color: Colors.text.white,
  },
  headerContent: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingStats: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.small,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  menuContainer: {
    gap: 12,
    marginBottom: 25,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  menuIcon: {
    width: 55,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  menuIconText: {
    fontSize: 26,
  },
  menuInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  chevron: {
    fontSize: 28,
    color: Colors.military.navyBlue,
    marginRight: 5,
  },
  activityCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  emptyActivityText: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyActivitySubtext: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0e68c',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  infoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    textAlign: 'right',
  },
});

export default ArmeHomeScreen;
