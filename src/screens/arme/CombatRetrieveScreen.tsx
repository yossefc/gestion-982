// Écran pour récupérer l'équipement du storage (החזרה מאפסון)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { deleteField } from 'firebase/firestore';
import { RootStackParamList, Soldier } from '../../types';
import { soldierService } from '../../services/firebaseService';
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { Colors, Shadows } from '../../theme/Colors';

type CombatRetrieveRouteProp = RouteProp<RootStackParamList, 'CombatRetrieve'>;

interface StoredItem {
  id: string; // equipmentId (pour soldier_holdings)
  weaponId?: string; // weaponId (pour weapons_inventory - doc ID)
  category: string;
  serialNumber: string;
  selected: boolean;
  type: 'weapon' | 'general';
}

const CombatRetrieveScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CombatRetrieveRouteProp>();
  const { soldierId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!soldierId) {
      Alert.alert('שגיאה', 'לא נמצא מזהה חייל');
      navigation.goBack();
      return;
    }
    loadData();
  }, [soldierId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [soldierData, weapons, holdings] = await Promise.all([
        soldierService.getById(soldierId),
        weaponInventoryService.getWeaponsBySoldier(soldierId),
        transactionalAssignmentService.getCurrentHoldings(soldierId, 'combat'),
      ]);

      setSoldier(soldierData);

      const items: StoredItem[] = [];

      // 1. Ajouter les armes stockées (supporte 'stored' et l'ancien 'storage')
      const weaponsInStorage = weapons.filter(w => (w.status as any) === 'stored' || (w.status as any) === 'storage');
      weaponsInStorage.forEach(w => {
        // Find matching holding to get correct equipmentId
        const matchingHolding = holdings.find(h =>
          ((h.status as any) === 'stored' || (h.status as any) === 'storage') &&
          h.serials && h.serials.some(s => s === w.serialNumber)
        );

        // Fallback: match by name if serial match fails
        const effectiveHolding = matchingHolding || holdings.find(h =>
          ((h.status as any) === 'stored' || (h.status as any) === 'storage') &&
          h.equipmentName === w.category
        );

        items.push({
          id: effectiveHolding ? effectiveHolding.equipmentId : w.id, // Prefer equipmentId, fallback to weaponId
          weaponId: w.id,
          category: w.category,
          serialNumber: w.serialNumber,
          selected: false,
          type: 'weapon',
        });
      });

      // 2. Ajouter les autres items stockés via soldier_holdings
      const otherStored = holdings.filter(h => h.status === 'stored');
      otherStored.forEach(h => {
        // Éviter les doublons si c'est déjà listé en temps qu'arme
        h.serials.forEach(serial => {
          if (!items.find(it => it.serialNumber === serial)) {
            items.push({
              id: h.equipmentId,
              category: h.equipmentName,
              serialNumber: serial,
              selected: false,
              type: 'general',
            });
          }
        });

        // Items sans serial
        if (h.serials.length === 0) {
          items.push({
            id: h.equipmentId,
            category: h.equipmentName,
            serialNumber: '',
            selected: false,
            type: 'general',
          });
        }
      });

      setStoredItems(items);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string, serial: string) => {
    setStoredItems(prev =>
      prev.map(it => (it.id === id && it.serialNumber === serial ? { ...it, selected: !it.selected } : it))
    );
  };

  const handleRetrieve = async () => {
    const selectedItems = storedItems.filter(it => it.selected);

    if (selectedItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד');
      return;
    }

    Alert.alert(
      'החזרה מאפסון',
      `האם להחזיר ${selectedItems.length} פריטים לחייל?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'החזר',
          onPress: async () => {
            setProcessing(true);
            try {
              // 1. Pour les armes, mettre à jour le weapon inventory
              for (const item of selectedItems) {
                if (item.type === 'weapon' && item.weaponId) {
                  await weaponInventoryService.updateWeapon(item.weaponId, {
                    status: 'assigned',
                    storageDate: deleteField() as any,
                  });
                }
              }

              // 2. Transaction pour mettre à jour les holdings (status stored -> active)
              console.log('[CombatRetrieve] Creating transactional retrieve assignment...');
              const requestId = `combat_retrieve_${soldierId}_${Date.now()}`;

              // Grouper par equipmentId pour l'assignment
              const groups = new Map<string, { name: string, qty: number, serials: string[] }>();
              selectedItems.forEach(it => {
                const group = groups.get(it.id) || { name: it.category, qty: 0, serials: [] };
                group.qty += 1;
                if (it.serialNumber) group.serials.push(it.serialNumber);
                groups.set(it.id, group);
              });

              const retrieveItems = Array.from(groups.entries()).map(([id, data]) => ({
                equipmentId: id,
                equipmentName: data.name,
                quantity: data.qty,
                serial: data.serials.join(','),
              }));

              await transactionalAssignmentService.retrieveEquipment(
                soldierId,
                soldier?.name || '',
                soldier?.personalNumber || '',
                'combat',
                retrieveItems,
                'system', // retrievedBy
                requestId
              );

              Alert.alert(
                'הצלחה',
                `${selectedItems.length} פריטים הוחזרו לחייל`,
                [{ text: 'אישור', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error retrieving items:', error);
              Alert.alert('שגיאה', 'נכשל בהחזרת הפריטים');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
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
            <Text style={styles.title}>החזרה מאפסון</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
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
          disabled={processing}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>החזרה מאפסון</Text>
          <Text style={styles.subtitle}>📤 החזרת ציוד לחייל</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {soldier && (
          <View style={styles.soldierCard}>
            <View style={styles.soldierInfo}>
              <Text style={styles.soldierName}>{soldier.name}</Text>
              <Text style={styles.soldierMeta}>
                {soldier.personalNumber} • {soldier.company}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 הנחיות</Text>
          <Text style={styles.instructionsText}>
            בחר את הפריטים להחזרה לחייל מהאפסון.{'\n'}
            הפריטים יחזרו למצב "פעיל" אצל החייל.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          פריטים באפסון ({storedItems.length})
        </Text>

        {storedItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין פריטים באפסון</Text>
            <Text style={styles.emptySubtext}>
              החייל לא הפקיד ציוד באפסון
            </Text>
          </View>
        ) : (
          <View style={styles.weaponsList}>
            {storedItems.map(item => (
              <TouchableOpacity
                key={`${item.id}-${item.serialNumber}`}
                style={[
                  styles.weaponCard,
                  item.selected && styles.weaponCardSelected,
                ]}
                onPress={() => toggleItem(item.id, item.serialNumber)}
                disabled={processing}
              >
                <View style={styles.checkbox}>
                  {item.selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.weaponInfo}>
                  <Text style={styles.weaponCategory}>{item.category}</Text>
                  <Text style={styles.weaponSerial}>{item.serialNumber}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {storedItems.some(it => it.selected) && (
          <TouchableOpacity
            style={[
              styles.retrieveButton,
              processing && styles.buttonDisabled,
            ]}
            onPress={handleRetrieve}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.retrieveButtonText}>
                📤 החזר ({storedItems.filter(it => it.selected).length})
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#00897B',
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
    color: Colors.textWhite,
  },
  headerContent: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textWhite,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldierCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  soldierInfo: {
    alignItems: 'flex-end',
  },
  soldierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  soldierMeta: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  instructionsCard: {
    backgroundColor: '#E0F2F1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#80CBC4',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
    textAlign: 'right',
  },
  weaponsList: {
    gap: 12,
    marginBottom: 20,
  },
  weaponCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  weaponCardSelected: {
    borderColor: '#00897B',
    backgroundColor: '#E0F2F1',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 18,
    color: '#00897B',
    fontWeight: 'bold',
  },
  weaponInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  weaponCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  weaponSerial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00897B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retrieveButton: {
    backgroundColor: '#00897B',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
    ...Shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  retrieveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
});

export default CombatRetrieveScreen;
