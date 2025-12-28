// Écran d'accueil principal
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/colors';
import { soldierService, assignmentService } from '../../services/firebaseService';
import { StatCard, ModuleCard } from '../../components';
import { confirmAction } from '../../utils/notify';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, signOut, hasPermission } = useAuth();
  const [stats, setStats] = useState({
    totalSoldiers: 0,
    todayAssignments: 0,
    pendingSignatures: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const soldiers = await soldierService.getAll();
      // TODO: Charger les vraies stats
      setStats({
        totalSoldiers: soldiers.length,
        todayAssignments: 0,
        pendingSignatures: 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharger les stats à chaque fois que l'écran devient actif
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const handleSignOut = () => {
    confirmAction(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      signOut
    );
  };

  const modules = [
    {
      id: 'arme',
      title: 'נשקייה',
      subtitle: 'ניהול נשק וציוד קרבי',
      icon: '🔫',
      color: Colors.modules.arme,
      permission: 'arme',
      screen: 'ArmeHome',
    },
    {
      id: 'vetement',
      title: 'אפסנאות',
      subtitle: 'ניהול ביגוד והחתמות',
      icon: '👕',
      color: Colors.modules.vetement,
      permission: 'vetement',
      screen: 'VetementHome',
    },
    {
      id: 'admin',
      title: 'ניהול מערכת',
      subtitle: 'משתמשים והגדרות',
      icon: '⚙️',
      color: Colors.military.olive,
      permission: 'admin',
      screen: 'AdminPanel',
    },
  ];

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'מנהל מערכת';
      case 'both': return 'גישה מלאה';
      case 'arme': return 'ציוד לחימה';
      case 'vetement': return 'ביגוד';
      default: return role;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
            <Text style={styles.logoutText}>🚪 התנתק</Text>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>שלום,</Text>
            <Text style={styles.userName}>{user?.name || 'משתמש'}</Text>
          </View>
        </View>
        <View style={styles.roleContainer}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleText(user?.role || '')}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>מערכת ניהול גדוד 982</Text>
          <Text style={styles.subtitle}>ניהול ציוד והחתמות</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <StatCard
            value={stats.totalSoldiers}
            label="חיילים"
            backgroundColor={Colors.status.info}
            textColor={Colors.text.white}
          />
          <StatCard
            value={stats.todayAssignments}
            label="היום"
            backgroundColor={Colors.status.success}
            textColor={Colors.text.white}
          />
          <StatCard
            value={stats.pendingSignatures}
            label="ממתינים"
            backgroundColor={Colors.status.warning}
            textColor={Colors.text.white}
          />
        </View>

        {/* Modules */}
        <Text style={styles.sectionTitle}>בחר מודול</Text>

        <View style={styles.modulesContainer}>
          {modules.map((module) => {
            const hasAccess = hasPermission(module.permission as any);

            return (
              <ModuleCard
                key={module.id}
                title={module.title}
                subtitle={module.subtitle}
                icon={module.icon}
                onPress={() => navigation.navigate(module.screen)}
                disabled={!hasAccess}
                backgroundColor={Colors.background.card}
              />
            );
          })}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>פעולות מהירות</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('AddSoldier')}
          >
            <Text style={styles.quickActionIcon}>👤</Text>
            <Text style={styles.quickActionText}>הוסף חייל</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => hasPermission('vetement') && navigation.navigate('SoldierSearch', { mode: 'clothing' })}
            disabled={!hasPermission('vetement')}
          >
            <Text style={styles.quickActionIcon}>✍️</Text>
            <Text style={styles.quickActionText}>החתמה מהירה</Text>
          </TouchableOpacity>
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Shadows.large,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  logoutButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  roleContainer: {
    marginTop: 15,
    alignItems: 'flex-end',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleText: {
    color: Colors.text.white,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.small,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  modulesContainer: {
    marginBottom: 30,
    gap: 12,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  moduleDisabled: {
    opacity: 0.5,
  },
  moduleIcon: {
    width: 55,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  moduleIconText: {
    fontSize: 26,
  },
  moduleInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  moduleTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  moduleSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  textDisabled: {
    color: Colors.text.light,
  },
  chevron: {
    fontSize: 28,
    color: Colors.military.navyBlue,
    marginRight: 5,
  },
  lockBadge: {
    marginRight: 10,
  },
  lockText: {
    fontSize: 22,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
});

export default HomeScreen;
