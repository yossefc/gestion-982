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
import { RootStackParamList, Soldier } from '../../types';
import { soldierService } from '../../services/firebaseService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { Colors, Shadows } from '../../theme/Colors';

type CombatRetrieveRouteProp = RouteProp<RootStackParamList, 'CombatRetrieve'>;

interface StoredWeapon {
  id: string;
  category: string;
  serialNumber: string;
  selected: boolean;
}

const CombatRetrieveScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CombatRetrieveRouteProp>();
  const { soldierId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [storedWeapons, setStoredWeapons] = useState<StoredWeapon[]>([]);
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

      const [soldierData, weapons] = await Promise.all([
        soldierService.getById(soldierId),
        weaponInventoryService.getWeaponsBySoldier(soldierId),
      ]);

      setSoldier(soldierData);

      // Filtrer uniquement les armes en storage
      const weaponsInStorage = weapons.filter(w => w.status === 'storage');

      setStoredWeapons(
        weaponsInStorage.map(w => ({
          id: w.id,
          category: w.category,
          serialNumber: w.serialNumber,
          selected: false,
        }))
      );
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const toggleWeapon = (weaponId: string) => {
    setStoredWeapons(prev =>
      prev.map(w => (w.id === weaponId ? { ...w, selected: !w.selected } : w))
    );
  };

  const handleRetrieve = async () => {
    const selectedWeapons = storedWeapons.filter(w => w.selected);

    if (selectedWeapons.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות נשק אחד');
      return;
    }

    Alert.alert(
      'החזרה מאפסון',
      `האם להחזיר ${selectedWeapons.length} נשקים לחייל?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'החזר',
          onPress: async () => {
            setProcessing(true);
            try {
              for (const weapon of selectedWeapons) {
                // Changer le statut de storage à assigned
                await weaponInventoryService.updateWeapon(weapon.id, {
                  status: 'assigned',
                  storageDate: undefined,
                });
              }

              Alert.alert(
                'הצלחה',
                `${selectedWeapons.length} נשקים הוחזרו לחייל`,
                [{ text: 'אישור', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error retrieving weapons:', error);
              Alert.alert('שגיאה', 'נכשל בהחזרת הנשקים');
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
            בחר את הנשקים להחזרה לחייל מהאפסון.{'\n'}
            הנשקים יחזרו למצב "מוקצה" לחייל.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          נשקים באפסון ({storedWeapons.length})
        </Text>

        {storedWeapons.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין נשקים באפסון</Text>
            <Text style={styles.emptySubtext}>
              החייל לא הפקיד ציוד בנשקייה
            </Text>
          </View>
        ) : (
          <View style={styles.weaponsList}>
            {storedWeapons.map(weapon => (
              <TouchableOpacity
                key={weapon.id}
                style={[
                  styles.weaponCard,
                  weapon.selected && styles.weaponCardSelected,
                ]}
                onPress={() => toggleWeapon(weapon.id)}
                disabled={processing}
              >
                <View style={styles.checkbox}>
                  {weapon.selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.weaponInfo}>
                  <Text style={styles.weaponCategory}>{weapon.category}</Text>
                  <Text style={styles.weaponSerial}>{weapon.serialNumber}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {storedWeapons.some(w => w.selected) && (
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
                📤 החזר ({storedWeapons.filter(w => w.selected).length})
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
