// Écran de liste des équipements de combat
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CombatEquipment } from '../../types';
import { Colors, Shadows } from '../../theme/colors';
import { getAllCombatEquipment, addCombatEquipment, DEFAULT_COMBAT_EQUIPMENT } from '../../services/equipmentService';

const CombatEquipmentListScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<CombatEquipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('הכל');

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const data = await getAllCombatEquipment();

      // Si aucun équipement n'existe, proposer d'initialiser les données par défaut
      if (data.length === 0) {
        Alert.alert(
          'אין ציוד במערכת',
          'האם ברצונך להוסיף ציוד ברירת מחדל?',
          [
            { text: 'לא', style: 'cancel' },
            {
              text: 'כן',
              onPress: async () => {
                try {
                  for (const equipment of DEFAULT_COMBAT_EQUIPMENT) {
                    await addCombatEquipment(equipment);
                  }
                  loadEquipment(); // Recharger après ajout
                } catch (error) {
                  console.error('Error adding default equipment:', error);
                  Alert.alert('שגיאה', 'נכשל בהוספת ציוד ברירת מחדל');
                }
              },
            },
          ]
        );
      }

      setEquipment(data);
    } catch (error) {
      console.error('Error loading equipment:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הציוד');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['הכל', 'נשק', 'אופטיקה', 'ציוד מגן', 'ציוד נוסף'];

  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'הכל' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddEquipment = () => {
    Alert.alert('בקרוב', 'תכונה זו תהיה זמינה בקרוב');
  };

  const handleEquipmentPress = (equipmentId: string) => {
    Alert.alert('בקרוב', 'תכונת עריכה תהיה זמינה בקרוב');
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
            <Text style={styles.title}>ניהול ציוד</Text>
            <Text style={styles.subtitle}>ציוד לוחם ונשק</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.arme} />
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
          <Text style={styles.title}>ניהול ציוד</Text>
          <Text style={styles.subtitle}>🔫 {equipment.length} פריטים</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש לפי שם או מסטב..."
            placeholderTextColor={Colors.text.light}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Add Equipment Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddEquipment}>
          <Text style={styles.addButtonText}>+ הוסף ציוד חדש</Text>
        </TouchableOpacity>

        {/* Equipment List */}
        <ScrollView
          style={styles.equipmentList}
          showsVerticalScrollIndicator={false}
        >
          {filteredEquipment.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.equipmentCard}
              onPress={() => handleEquipmentPress(item.id)}
            >
              <View style={styles.equipmentIcon}>
                <Text style={styles.equipmentIconText}>
                  {item.category === 'נשק' ? '🔫' :
                   item.category === 'אופטיקה' ? '🔭' :
                   item.category === 'ציוד מגן' ? '🛡️' : '📦'}
                </Text>
              </View>
              <View style={styles.equipmentInfo}>
                <Text style={styles.equipmentName}>{item.name}</Text>
                <View style={styles.equipmentMeta}>
                  <Text style={styles.equipmentCategory}>{item.category}</Text>
                  {item.serial && (
                    <Text style={styles.equipmentSerial}>מסטב: {item.serial}</Text>
                  )}
                </View>
                {item.hasSubEquipment && item.subEquipments && (
                  <View style={styles.subEquipmentContainer}>
                    <Text style={styles.subEquipmentLabel}>
                      {item.subEquipments.length} רכיבים נוספים
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          {filteredEquipment.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>לא נמצא ציוד</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'נסה חיפוש אחר או שנה את הפילטר'
                  : 'לחץ על "הוסף ציוד חדש" להתחיל'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
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
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'right',
  },
  categoryScroll: {
    marginBottom: 15,
  },
  categoryContainer: {
    gap: 8,
    paddingVertical: 5,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  categoryChipActive: {
    backgroundColor: Colors.status.info,
    borderColor: Colors.status.info,
  },
  categoryChipText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  categoryChipTextActive: {
    color: Colors.text.white,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 15,
    ...Shadows.small,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  equipmentList: {
    flex: 1,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  equipmentIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.modules.arme,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  equipmentIconText: {
    fontSize: 24,
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  equipmentMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  equipmentCategory: {
    fontSize: 13,
    color: Colors.status.info,
  },
  equipmentSerial: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  subEquipmentContainer: {
    marginTop: 4,
  },
  subEquipmentLabel: {
    fontSize: 12,
    color: Colors.status.success,
  },
  chevron: {
    fontSize: 24,
    color: Colors.military.navyBlue,
    marginRight: 5,
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  emptyText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default CombatEquipmentListScreen;
