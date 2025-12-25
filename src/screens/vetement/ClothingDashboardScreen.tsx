// Écran Dashboard pour le module Vêtement
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
import { DashboardStats } from '../../types';
import { Colors, Shadows } from '../../theme/colors';
import { getAssignmentStats, getAssignmentsByType } from '../../services/assignmentService';

const ClothingDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Charger les statistiques réelles depuis Firebase
      const statsData = await getAssignmentStats('clothing');
      const assignments = await getAssignmentsByType('clothing');

      // Calculer les statistiques par type d'équipement
      const equipmentByType: { [key: string]: { issued: number; returned: number; pending: number } } = {};

      assignments.forEach(assignment => {
        assignment.items.forEach(item => {
          if (!equipmentByType[item.equipmentName]) {
            equipmentByType[item.equipmentName] = { issued: 0, returned: 0, pending: 0 };
          }

          if (assignment.status === 'נופק לחייל') {
            equipmentByType[item.equipmentName].issued += item.quantity;
          } else if (assignment.status === 'זוכה') {
            equipmentByType[item.equipmentName].returned += item.quantity;
          } else if (assignment.status === 'לא חתום') {
            equipmentByType[item.equipmentName].pending += item.quantity;
          }
        });
      });

      const dashboardStats: DashboardStats = {
        totalSoldiers: statsData.total,
        signedSoldiers: statsData.signed,
        pendingSoldiers: statsData.pending,
        returnedEquipment: statsData.returned,
        equipmentByType: Object.entries(equipmentByType).map(([name, counts]) => ({
          name,
          ...counts,
        })),
      };

      setStats(dashboardStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>דאשבורד ביגוד</Text>
            <Text style={styles.subtitle}>סטטיסטיקות ודוחות</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.vetement} />
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
          <Text style={styles.title}>דאשבורד ביגוד</Text>
          <Text style={styles.subtitle}>📊 סטטיסטיקות ודוחות</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#3498db' }]}>
            <Text style={styles.statNumber}>{stats?.totalSoldiers || 0}</Text>
            <Text style={styles.statLabel}>סך הכל חיילים</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#27ae60' }]}>
            <Text style={styles.statNumber}>{stats?.signedSoldiers || 0}</Text>
            <Text style={styles.statLabel}>חתומים</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#e67e22' }]}>
            <Text style={styles.statNumber}>{stats?.pendingSoldiers || 0}</Text>
            <Text style={styles.statLabel}>ממתינים</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#9b59b6' }]}>
            <Text style={styles.statNumber}>{stats?.returnedEquipment || 0}</Text>
            <Text style={styles.statLabel}>זוכו</Text>
          </View>
        </View>

        {/* Equipment Breakdown */}
        <Text style={styles.sectionTitle}>פירוט לפי סוג ציוד</Text>
        {stats?.equipmentByType && stats.equipmentByType.length > 0 ? (
          <View style={styles.equipmentList}>
            {stats.equipmentByType.map((item, index) => (
              <View key={index} style={styles.equipmentCard}>
                <View style={styles.equipmentHeader}>
                  <Text style={styles.equipmentName}>{item.name}</Text>
                </View>
                <View style={styles.equipmentStats}>
                  <View style={styles.equipmentStat}>
                    <Text style={styles.equipmentStatValue}>{item.issued}</Text>
                    <Text style={styles.equipmentStatLabel}>הונפק</Text>
                  </View>
                  <View style={styles.equipmentStat}>
                    <Text style={styles.equipmentStatValue}>{item.pending}</Text>
                    <Text style={styles.equipmentStatLabel}>ממתין</Text>
                  </View>
                  <View style={styles.equipmentStat}>
                    <Text style={styles.equipmentStatValue}>{item.returned}</Text>
                    <Text style={styles.equipmentStatLabel}>הוחזר</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין נתוני ציוד זמינים</Text>
          </View>
        )}

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>פעילות אחרונה</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>אין פעילות אחרונה</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📥 ייצוא דוח Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📄 יצירת דוח PDF</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'right',
  },
  equipmentList: {
    gap: 12,
    marginBottom: 25,
  },
  equipmentCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  equipmentHeader: {
    marginBottom: 15,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'right',
  },
  equipmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  equipmentStat: {
    alignItems: 'center',
  },
  equipmentStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.status.info,
  },
  equipmentStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  actionButtonText: {
    fontSize: 16,
    color: Colors.status.info,
    fontWeight: '600',
  },
});

export default ClothingDashboardScreen;
