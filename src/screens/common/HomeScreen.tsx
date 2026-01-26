/**
 * HomeScreen.tsx - Écran d'accueil principal
 * Design militaire moderne - équilibré et plaisant
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
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { soldierService } from '../../services/soldierService';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalSoldiers: 0,
    byCompany: {} as Record<string, number>,
  });

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const soldiers = await soldierService.getAll();
      const companyCount: Record<string, number> = {};
      soldiers.forEach((soldier: any) => {
        const company = soldier.company || 'לא משויך';
        companyCount[company] = (companyCount[company] || 0) + 1;
      });

      setStats({
        totalSoldiers: soldiers.length,
        byCompany: companyCount,
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

  const getRoleConfig = () => {
    const config: Record<string, { label: string; color: string }> = {
      admin: { label: 'מנהל מערכת', color: '#6366F1' },
      both: { label: 'הרשאה מלאה', color: '#10B981' },
      arme: { label: 'נשקייה', color: '#F59E0B' },
      vetement: { label: 'אפנאות', color: '#3B82F6' },
    };
    return config[userRole || ''] || { label: 'משתמש', color: '#64748B' };
  };

  const roleConfig = getRoleConfig();

  // Couleurs pour les compagnies
  const companyColors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4F6D7A" />
        <Text style={styles.loadingText}>טוען נתונים...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header avec gradient subtil */}
      <LinearGradient
        colors={['#4F6D7A', '#3D5A6C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.userSection}>
            <Text style={styles.greeting}>שלום,</Text>
            <Text style={styles.userName}>{user?.displayName || user?.email?.split('@')[0]}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleConfig.color + '30' }]}>
              <View style={[styles.roleDot, { backgroundColor: roleConfig.color }]} />
              <Text style={[styles.roleText, { color: '#FFFFFF' }]}>{roleConfig.label}</Text>
            </View>
          </View>

          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/logo-982.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4F6D7A"
          />
        }
      >
        {/* Carte statistique principale */}
        <View style={styles.mainStatCard}>
          <View style={styles.mainStatHeader}>
            <Text style={styles.mainStatLabel}>סה״כ חיילים במערכת</Text>
          </View>
          <Text style={styles.mainStatValue}>{stats.totalSoldiers}</Text>
          <View style={styles.mainStatBar}>
            <View style={[styles.mainStatBarFill, { width: '100%' }]} />
          </View>
        </View>

        {/* Répartition par compagnie */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>פילוח לפי פלוגות</Text>
        </View>

        <View style={styles.companiesCard}>
          {Object.entries(stats.byCompany)
            .sort(([a], [b]) => a.localeCompare(b, 'he'))
            .map(([company, count], index) => {
              const color = companyColors[index % companyColors.length];
              const percentage = stats.totalSoldiers > 0 ? (count / stats.totalSoldiers) * 100 : 0;

              return (
                <View key={company} style={styles.companyItem}>
                  <View style={styles.companyInfo}>
                    <View style={[styles.companyDot, { backgroundColor: color }]} />
                    <Text style={styles.companyName}>{company}</Text>
                  </View>
                  <View style={styles.companyStats}>
                    <View style={styles.companyBarContainer}>
                      <View
                        style={[
                          styles.companyBar,
                          { width: `${percentage}%`, backgroundColor: color + '40' }
                        ]}
                      />
                    </View>
                    <Text style={styles.companyCount}>{count}</Text>
                  </View>
                </View>
              );
            })}
        </View>

        {/* Modules */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>מודולים</Text>
        </View>

        <View style={styles.modulesContainer}>
          {canAccessArme && (
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('ArmeHome' as never)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moduleAccent}
              />
              <View style={styles.moduleContent}>
                <Text style={styles.moduleTitle}>נשקייה</Text>
                <Text style={styles.moduleDesc}>החתמה וזיכוי ציוד קרבי</Text>
              </View>
              <Text style={styles.moduleArrow}>←</Text>
            </TouchableOpacity>
          )}

          {canAccessVetement && (
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('VetementHome' as never)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moduleAccent}
              />
              <View style={styles.moduleContent}>
                <Text style={styles.moduleTitle}>אפסנאות</Text>
                <Text style={styles.moduleDesc}>החתמה וזיכוי ציוד אישי</Text>
              </View>
              <Text style={styles.moduleArrow}>←</Text>
            </TouchableOpacity>
          )}

          {canAccessAdmin && (
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('AdminPanel' as never)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moduleAccent}
              />
              <View style={styles.moduleContent}>
                <Text style={styles.moduleTitle}>ניהול מערכת</Text>
                <Text style={styles.moduleDesc}>הגדרות, משתמשים ודוחות</Text>
              </View>
              <Text style={styles.moduleArrow}>←</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Actions rapides */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>פעולות מהירות</Text>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('AddSoldier' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconBg, { backgroundColor: '#10B98120' }]}>
              <Text style={[styles.quickActionIcon, { color: '#10B981' }]}>+</Text>
            </View>
            <Text style={styles.quickActionText}>הוספת חייל</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => (navigation as any).navigate('SoldierSearch', { mode: 'signature', type: 'combat' })}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconBg, { backgroundColor: '#3B82F620' }]}>
              <Text style={[styles.quickActionIcon, { color: '#3B82F6' }]}>⌕</Text>
            </View>
            <Text style={styles.quickActionText}>חיפוש חייל</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>מערכת ניהול ציוד • גדוד 982</Text>
          <Text style={styles.footerVersion}>גרסה 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  userSection: {
    flex: 1,
    alignItems: 'flex-end',
  },

  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
  },

  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    gap: 6,
  },

  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },

  logoContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },

  logoImage: {
    width: 38,
    height: 38,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },

  // Main stat card
  mainStatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#4F6D7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  mainStatHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  mainStatLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  mainStatValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    marginTop: 8,
    letterSpacing: -1,
  },

  mainStatBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },

  mainStatBarFill: {
    height: '100%',
    backgroundColor: '#4F6D7A',
    borderRadius: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 14,
    marginTop: 8,
    gap: 8,
  },

  sectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F6D7A',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },

  // Companies
  companiesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
    shadowColor: '#4F6D7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  companyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  companyName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },

  companyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },

  companyBarContainer: {
    width: 60,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },

  companyBar: {
    height: '100%',
    borderRadius: 3,
  },

  companyCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 28,
    textAlign: 'left',
  },

  // Modules
  modulesContainer: {
    gap: 12,
    marginBottom: 24,
  },

  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#4F6D7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },

  moduleAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },

  moduleContent: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 8,
  },

  moduleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },

  moduleDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },

  moduleArrow: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '300',
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },

  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#4F6D7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  quickActionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  quickActionIcon: {
    fontSize: 24,
    fontWeight: '500',
  },

  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },

  footerLine: {
    width: 40,
    height: 3,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    marginBottom: 16,
  },

  footerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  footerVersion: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
});

export default HomeScreen;