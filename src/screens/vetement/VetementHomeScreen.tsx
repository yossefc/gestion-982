// Écran d'accueil du module Vêtement
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
import { dashboardService } from '../../services/firebaseService';

const VetementHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    signed: 0,
    pending: 0,
    returned: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const dashboardStats = await dashboardService.getClothingStats();
      setStats({
        signed: dashboardStats.signedSoldiers,
        pending: dashboardStats.pendingSoldiers,
        returned: dashboardStats.returnedEquipment,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      id: 'signature',
      title: 'החתמת חייל',
      subtitle: 'הנפקת ביגוד וציוד אישי',
      icon: '✍️',
      color: Colors.status.success,
      action: () => navigation.navigate('SoldierSearch', { mode: 'clothing' }),
    },
    {
      id: 'return',
      title: 'זיכוי חייל',
      subtitle: 'החזרת ציוד',
      icon: '↩️',
      color: Colors.status.warning,
      action: () => navigation.navigate('SoldierSearch', { mode: 'clothing' }),
    },
    {
      id: 'dashboard',
      title: 'דאשבורד',
      subtitle: 'סטטיסטיקות ודוחות',
      icon: '📊',
      color: Colors.status.info,
      action: () => navigation.navigate('ClothingDashboard'),
    },
    {
      id: 'equipmentManagement',
      title: 'ניהול ציוד',
      subtitle: 'הוספה, עריכה ומחיקת ציוד',
      icon: '⚙️',
      color: Colors.military.olive,
      action: () => navigation.navigate('ClothingEquipmentManagement'),
    },
    {
      id: 'addSoldier',
      title: 'הוספת חייל',
      subtitle: 'רישום חייל חדש במערכת',
      icon: '👤',
      color: Colors.military.navyBlue,
      action: () => navigation.navigate('AddSoldier'),
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
          <Text style={styles.title}>ביגוד וציוד אישי</Text>
          <Text style={styles.subtitle}>👕 מערכת ניהול גדוד 982</Text>
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
            <ActivityIndicator size="small" color={Colors.modules.vetement} />
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.status.success }]}>
              <Text style={styles.statNumber}>{stats.signed}</Text>
              <Text style={styles.statLabel}>חתומים</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.status.warning }]}>
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>ממתינים</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.status.info }]}>
              <Text style={styles.statNumber}>{stats.returned}</Text>
              <Text style={styles.statLabel}>זוכו</Text>
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

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 טיפ</Text>
          <Text style={styles.infoText}>
            לחץ על "החתמת חייל" כדי להתחיל הנפקת ציוד חדש, או על "זיכוי חייל" להחזרת ציוד.
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
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
    marginBottom: 20,
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
  infoCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#b3d9f2',
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

export default VetementHomeScreen;
