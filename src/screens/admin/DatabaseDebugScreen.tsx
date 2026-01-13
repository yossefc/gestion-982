// Écran de debug pour inspecter la base de données Firestore
import React, { useState, useEffect } from 'react';
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
import {
  combatEquipmentService,
  clothingEquipmentService,
  soldierService,
  manaService,
  assignmentService,
} from '../../services/firebaseService';

interface CollectionInfo {
  name: string;
  count: number;
  samples?: any[];
  error?: string;
}

const DatabaseDebugScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);

  useEffect(() => {
    loadAllCollections();
  }, []);

  const loadAllCollections = async () => {
    setLoading(true);
    const results: CollectionInfo[] = [];

    // 1. Combat Equipment
    try {
      const combatEquipment = await combatEquipmentService.getAll();
      results.push({
        name: 'combatEquipment',
        count: combatEquipment.length,
        samples: combatEquipment.slice(0, 3),
      });
    } catch (error: any) {
      results.push({
        name: 'combatEquipment',
        count: 0,
        error: error.message,
      });
    }

    // 2. Clothing Equipment
    try {
      const clothingEquipment = await clothingEquipmentService.getAll();
      results.push({
        name: 'clothingEquipment',
        count: clothingEquipment.length,
        samples: clothingEquipment.slice(0, 3),
      });
    } catch (error: any) {
      results.push({
        name: 'clothingEquipment',
        count: 0,
        error: error.message,
      });
    }

    // 3. Manot
    try {
      const manot = await manaService.getAll();
      results.push({
        name: 'manot',
        count: manot.length,
        samples: manot.slice(0, 3),
      });
    } catch (error: any) {
      results.push({
        name: 'manot',
        count: 0,
        error: error.message,
      });
    }

    // 4. Soldiers
    try {
      const soldiers = await soldierService.getAll(10);
      results.push({
        name: 'soldiers',
        count: soldiers.length,
        samples: soldiers.slice(0, 3),
      });
    } catch (error: any) {
      results.push({
        name: 'soldiers',
        count: 0,
        error: error.message,
      });
    }

    // 5. Assignments (combat)
    try {
      const assignments = await assignmentService.getByType('combat');
      results.push({
        name: 'assignments (combat)',
        count: assignments.length,
        samples: assignments.slice(0, 3),
      });
    } catch (error: any) {
      results.push({
        name: 'assignments (combat)',
        count: 0,
        error: error.message,
      });
    }

    setCollections(results);
    setLoading(false);
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
            <Text style={styles.title}>Database Debug</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.arme} />
          <Text style={styles.loadingText}>Loading database info...</Text>
        </View>
      </View>
    );
  }

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
          <Text style={styles.title}>🔍 Database Debug</Text>
          <Text style={styles.subtitle}>Firestore Collections Inspector</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadAllCollections}
        >
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {collections.map((collection, index) => (
          <View key={index} style={styles.collectionCard}>
            <View style={styles.collectionHeader}>
              <Text style={styles.collectionName}>{collection.name}</Text>
              <View style={[
                styles.countBadge,
                collection.count === 0 ? styles.countBadgeEmpty : styles.countBadgeOk
              ]}>
                <Text style={styles.countText}>{collection.count}</Text>
              </View>
            </View>

            {collection.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>❌ Error: {collection.error}</Text>
              </View>
            )}

            {collection.count === 0 && !collection.error && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>⚠️ Collection vide</Text>
              </View>
            )}

            {collection.samples && collection.samples.length > 0 && (
              <View style={styles.samplesContainer}>
                <Text style={styles.samplesTitle}>Exemples ({collection.samples.length}):</Text>
                {collection.samples.map((sample, idx) => (
                  <View key={idx} style={styles.sampleItem}>
                    <Text style={styles.sampleId}>ID: {sample.id}</Text>
                    <Text style={styles.sampleData} numberOfLines={3}>
                      {JSON.stringify(sample, null, 2).substring(0, 200)}...
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Diagnostic Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📊 Diagnostic Summary</Text>

          {collections.find(c => c.name === 'combatEquipment')?.count === 0 && (
            <View style={styles.issueItem}>
              <Text style={styles.issueIcon}>🔴</Text>
              <Text style={styles.issueText}>
                PROBLÈME: Collection 'combatEquipment' vide!{'\n'}
                Solution: Créer des équipements via "ניהול ציוד לוחם"
              </Text>
            </View>
          )}

          {collections.find(c => c.name === 'manot')?.count > 0 &&
           collections.find(c => c.name === 'combatEquipment')?.count === 0 && (
            <View style={styles.issueItem}>
              <Text style={styles.issueIcon}>🟠</Text>
              <Text style={styles.issueText}>
                INCOHÉRENCE: Des manot existent mais pas d'équipements!{'\n'}
                Les manot référencent des équipements inexistants.
              </Text>
            </View>
          )}

          {collections.every(c => c.count > 0 || c.name.includes('assignment')) && (
            <View style={styles.issueItem}>
              <Text style={styles.issueIcon}>✅</Text>
              <Text style={styles.issueText}>
                Toutes les collections principales sont remplies.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 50 }} />
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
    backgroundColor: '#2c3e50',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFF',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Colors.text.secondary,
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  collectionCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  collectionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countBadgeOk: {
    backgroundColor: Colors.status.success,
  },
  countBadgeEmpty: {
    backgroundColor: Colors.status.danger,
  },
  countText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  errorBox: {
    backgroundColor: '#fee',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: Colors.status.danger,
  },
  warningBox: {
    backgroundColor: '#ffeaa7',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#d63031',
  },
  samplesContainer: {
    marginTop: 10,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: 10,
  },
  samplesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  sampleItem: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  sampleId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.modules.arme,
    marginBottom: 4,
  },
  sampleData: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  summaryCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    borderWidth: 2,
    borderColor: Colors.status.info,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingVertical: 8,
  },
  issueIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  issueText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
});

export default DatabaseDebugScreen;
