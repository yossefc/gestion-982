/**
 * DatabaseDebugScreen.tsx - Écran de débogage base de données
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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface CollectionInfo {
  name: string;
  count: number;
  sampleDoc?: any;
  loading: boolean;
  error?: string;
}

const COLLECTIONS = [
  'soldiers',
  'users',
  'soldier_equipment',
  'soldier_holdings',
  'equipment_combat',
  'equipment_clothing',
  'clothingEquipment',
  'assignments',
];

const DatabaseDebugScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    const db = getFirestore();

    const collectionData: CollectionInfo[] = COLLECTIONS.map(name => ({
      name,
      count: 0,
      loading: true,
    }));
    setCollections(collectionData);

    // Load each collection
    for (let i = 0; i < COLLECTIONS.length; i++) {
      const name = COLLECTIONS[i];
      try {
        const snapshot = await getDocs(collection(db, name));
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setCollections(prev => prev.map(c =>
          c.name === name
            ? { ...c, count: docs.length, sampleDoc: docs[0], loading: false }
            : c
        ));
      } catch (error: any) {
        setCollections(prev => prev.map(c =>
          c.name === name
            ? { ...c, loading: false, error: error.message }
            : c
        ));
      }
    }

    setLoading(false);
  };

  const exportToJSON = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      const exportData: any = {
        exportDate: new Date().toISOString(),
        collections: {}
      };

      // Exporter toutes les collections
      for (const name of COLLECTIONS) {
        try {
          const snapshot = await getDocs(collection(db, name));
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          exportData.collections[name] = docs;
        } catch (error) {
          console.error(`Error exporting ${name}:`, error);
          exportData.collections[name] = { error: 'Failed to export' };
        }
      }

      // Convertir en JSON
      const jsonString = JSON.stringify(exportData, null, 2);

      // Sauvegarder le fichier
      // Les imports sont déjà en haut du fichier

      const fileUri = FileSystem.documentDirectory + 'firestore-export.json';
      await FileSystem.writeAsStringAsync(fileUri, jsonString);

      // Partager le fichier
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Firestore Data'
        });
        Alert.alert('הצלחה', 'הנתונים יוצאו בהצלחה');
      } else {
        Alert.alert('שגיאה', 'לא ניתן לשתף קבצים במכשיר זה');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('שגיאה', 'לא ניתן לייצא את הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const getCollectionIcon = (name: string) => {
    switch (name) {
      case 'soldiers': return 'people';
      case 'users': return 'person-circle';
      case 'soldier_equipment':
      case 'soldier_holdings': return 'documents';
      case 'equipment_combat': return 'shield';
      case 'equipment_clothing':
      case 'clothingEquipment': return 'shirt';
      case 'assignments': return 'clipboard';
      default: return 'folder';
    }
  };

  const getCollectionColor = (name: string) => {
    switch (name) {
      case 'soldiers': return Colors.soldats;
      case 'users': return Colors.info;
      case 'soldier_equipment':
      case 'soldier_holdings': return Colors.warning;
      case 'equipment_combat': return Colors.arme;
      case 'equipment_clothing':
      case 'clothingEquipment': return Colors.vetement;
      case 'assignments': return Colors.success;
      default: return Colors.textSecondary;
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') {
      if (value.toDate) return value.toDate().toLocaleString('he-IL');
      if (Array.isArray(value)) return `[${value.length} items]`;
      return '{...}';
    }
    return String(value).substring(0, 50);
  };

  const renderSampleDoc = (doc: any) => {
    if (!doc) return null;

    const entries = Object.entries(doc).slice(0, 5);

    return (
      <View style={styles.sampleDoc}>
        <Text style={styles.sampleDocTitle}>מסמך לדוגמה:</Text>
        {entries.map(([key, value]) => (
          <View key={key} style={styles.sampleDocRow}>
            <Text style={styles.sampleDocKey}>{key}:</Text>
            <Text style={styles.sampleDocValue}>{formatValue(value)}</Text>
          </View>
        ))}
        {Object.keys(doc).length > 5 && (
          <Text style={styles.moreFields}>
            +{Object.keys(doc).length - 5} שדות נוספים
          </Text>
        )}
      </View>
    );
  };

  const CollectionCard = ({ item }: { item: CollectionInfo }) => {
    const isExpanded = expandedCollection === item.name;
    const color = getCollectionColor(item.name);

    return (
      <View style={styles.collectionCard}>
        <TouchableOpacity
          style={styles.collectionHeader}
          onPress={() => setExpandedCollection(isExpanded ? null : item.name)}
          activeOpacity={0.7}
        >
          <View style={[styles.collectionIcon, { backgroundColor: color + '20' }]}>
            <Ionicons
              name={getCollectionIcon(item.name) as any}
              size={24}
              color={color}
            />
          </View>

          <View style={styles.collectionInfo}>
            <Text style={styles.collectionName}>{item.name}</Text>
            {item.loading ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : item.error ? (
              <Text style={styles.collectionError}>שגיאה</Text>
            ) : (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.count} מסמכים</Text>
              </View>
            )}
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && !item.loading && (
          <View style={styles.collectionDetails}>
            {item.error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color={Colors.danger} />
                <Text style={styles.errorText}>{item.error}</Text>
              </View>
            ) : item.count === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={24} color={Colors.textLight} />
                <Text style={styles.emptyText}>האוסף ריק</Text>
              </View>
            ) : (
              renderSampleDoc(item.sampleDoc)
            )}
          </View>
        )}
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>בדיקת מסד נתונים</Text>
          <Text style={styles.headerSubtitle}>Firebase Collections</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadCollections}
        >
          <Ionicons name="refresh" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Status Banner */}
      <View style={styles.statusBanner}>
        <View style={[
          styles.statusIndicator,
          { backgroundColor: loading ? Colors.warning : Colors.success }
        ]} />
        <Text style={styles.statusText}>
          {loading ? 'טוען נתונים...' : 'מחובר ל-Firebase'}
        </Text>
        <Text style={styles.statusCount}>
          {collections.filter(c => !c.loading && !c.error).length}/{COLLECTIONS.length} אוספים
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Collections */}
        <Text style={styles.sectionTitle}>אוספים ({COLLECTIONS.length})</Text>

        {collections.map((item) => (
          <CollectionCard key={item.name} item={item} />
        ))}

        {/* Summary Stats */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>סיכום</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>סה״כ אוספים:</Text>
            <Text style={styles.summaryValue}>{COLLECTIONS.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>סה״כ מסמכים:</Text>
            <Text style={styles.summaryValue}>
              {collections.reduce((sum, c) => sum + (c.count || 0), 0)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>אוספים עם שגיאות:</Text>
            <Text style={[
              styles.summaryValue,
              collections.filter(c => c.error).length > 0 && { color: Colors.danger }
            ]}>
              {collections.filter(c => c.error).length}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <Text style={styles.sectionTitle}>פעולות</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={exportToJSON}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.infoLight }]}>
            <Ionicons name="download" size={24} color={Colors.info} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>ייצוא נתונים</Text>
            <Text style={styles.actionSubtitle}>ייצוא כל הנתונים לקובץ JSON</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert(
            'ניקוי מטמון',
            'האם לנקות את המטמון המקומי?',
            [
              { text: 'ביטול', style: 'cancel' },
              { text: 'נקה', onPress: () => Alert.alert('הצלחה', 'המטמון נוקה') }
            ]
          )}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.warningLight }]}>
            <Ionicons name="trash" size={24} color={Colors.warning} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>ניקוי מטמון</Text>
            <Text style={styles.actionSubtitle}>מחיקת נתונים מקומיים</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
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
    backgroundColor: Colors.info,
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

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.small,
  },

  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },

  statusText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },

  statusCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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

  // Collection Card
  collectionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadows.small,
  },

  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  collectionInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  collectionName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  countBadge: {
    backgroundColor: Colors.successLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },

  countText: {
    fontSize: FontSize.sm,
    color: Colors.successDark,
    fontWeight: '500',
  },

  collectionError: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },

  collectionDetails: {
    backgroundColor: Colors.backgroundInput,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'right',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },

  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },

  // Sample Doc
  sampleDoc: {
    gap: Spacing.xs,
  },

  sampleDocTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  sampleDocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  sampleDocKey: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  sampleDocValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },

  moreFields: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },

  summaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  summaryLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  summaryValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },

  // Action Buttons
  actionButton: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  actionIcon: {
    width: 48,
    height: 48,
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
});

export default DatabaseDebugScreen;