// Écran du panneau d'administration
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
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/colors';
import { soldierService } from '../../services/firebaseService';
import { getAssignmentsByType } from '../../services/assignmentService';
import { initializeDefaultData } from '../../services/equipmentService';
import { getUserCount } from '../../services/userService';
import { notifyError } from '../../utils/notify';

const AdminPanelScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSoldiers: 0,
    totalAssignments: 0,
    todayAssignments: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [soldiers, clothingAssignments, combatAssignments, userCount] = await Promise.all([
        soldierService.getAll(1000), // Charger tous pour les stats
        getAssignmentsByType('clothing'),
        getAssignmentsByType('combat'),
        getUserCount(),
      ]);

      const allAssignments = [...clothingAssignments, ...combatAssignments];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCount = allAssignments.filter(a => {
        const assignmentDate = new Date(a.timestamp);
        assignmentDate.setHours(0, 0, 0, 0);
        return assignmentDate.getTime() === today.getTime();
      }).length;

      setStats({
        totalUsers: userCount,
        totalSoldiers: soldiers.length,
        totalAssignments: allAssignments.length,
        todayAssignments: todayCount,
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הסטטיסטיקות');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeData = () => {
    Alert.alert(
      'אתחול נתונים',
      'פעולה זו תוסיף ציוד וממנות ברירת מחדל למערכת. להמשיך?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אתחל',
          onPress: async () => {
            try {
              await initializeDefaultData();
            } catch (error) {
              console.error('Error initializing data:', error);
              Alert.alert('שגיאה', 'נכשל באתחול הנתונים');
            }
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert('בקרוב', 'תכונת ייצוא נתונים תהיה זמינה בקרוב');
  };

  const handleBackup = () => {
    Alert.alert('בקרוב', 'תכונת גיבוי תהיה זמינה בקרוב');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>ניהול מערכת</Text>
            <Text style={styles.subtitle}>⚙️ Admin Panel</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.status.info} />
        </View>
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
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>ניהול מערכת</Text>
          <Text style={styles.subtitle}>⚙️ Admin Panel</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ניהול משתמשים */}
        <Text style={styles.sectionTitle}>ניהול משתמשים</Text>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => navigation.navigate('UserManagement')}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#9b59b6' }]}>
            <Text style={styles.menuIconText}>👥</Text>
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>ניהול משתמשים</Text>
            <Text style={styles.menuSubtitle}>הוספה, עריכה והרשאות</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* סטטיסטיקות כלליות */}
        <Text style={styles.sectionTitle}>סטטיסטיקות כלליות</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#9b59b6' }]}>
            <Text style={styles.statNumber}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>סה"כ משתמשים</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.status.info }]}>
            <Text style={styles.statNumber}>{stats.totalSoldiers}</Text>
            <Text style={styles.statLabel}>סה"כ חיילים</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.status.success }]}>
            <Text style={styles.statNumber}>{stats.totalAssignments}</Text>
            <Text style={styles.statLabel}>סה"כ החתמות</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.status.warning }]}>
            <Text style={styles.statNumber}>{stats.todayAssignments}</Text>
            <Text style={styles.statLabel}>החתמות היום</Text>
          </View>
        </View>

        {/* ניהול נתונים */}
        <Text style={styles.sectionTitle}>ניהול נתונים</Text>
        <View style={styles.actionsList}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleInitializeData}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionText}>אתחול נתוני ברירת מחדל</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleExportData}>
            <Text style={styles.actionIcon}>📥</Text>
            <Text style={styles.actionText}>ייצוא נתונים</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleBackup}>
            <Text style={styles.actionIcon}>💾</Text>
            <Text style={styles.actionText}>גיבוי</Text>
          </TouchableOpacity>
        </View>

        {/* הגדרות מערכת */}
        <Text style={styles.sectionTitle}>הגדרות מערכת</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>1.0.0</Text>
            <Text style={styles.infoLabel}>גרסת אפליקציה:</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>✅ מחובר</Text>
            <Text style={styles.infoLabel}>Firebase:</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>גדוד 982</Text>
            <Text style={styles.infoLabel}>יחידה:</Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'right',
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 25,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.small,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  actionsList: {
    gap: 12,
    marginBottom: 25,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  actionIcon: {
    fontSize: 24,
    marginLeft: 15,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 20,
    ...Shadows.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text.primary,
  },
});

export default AdminPanelScreen;
