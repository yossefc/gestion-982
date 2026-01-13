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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CombatEquipment } from '../../types';
import { Colors, Shadows } from '../../theme/colors';
import { getAllCombatEquipment, addCombatEquipment, DEFAULT_COMBAT_EQUIPMENT } from '../../services/equipmentService';

const CombatEquipmentListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<CombatEquipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('הכל');

  // Recharger à chaque fois qu'on revient sur l'écran
  useFocusEffect(
    React.useCallback(() => {
      loadEquipment();
    }, [])
  );

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
    navigation.navigate('AddCombatEquipment');
  };

  const handleEquipmentPress = (equipmentId: string) => {
    navigation.navigate('AddCombatEquipment', { equipmentId });
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
          <Text style={styles.title}>ניהול ציוד לוחם</Text>
          <Text style={styles.subtitle}>🔫 {equipment.length} פריטים במלאי</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={handleAddEquipment}
        >
          <Text style={styles.headerAddButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.modules.arme }]}>
            <Text style={styles.statNumber}>{equipment.length}</Text>
            <Text style={styles.statLabel}>סה"כ ציוד</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.status.info }]}>
            <Text style={styles.statNumber}>
              {new Set(equipment.map(e => e.category)).size}
            </Text>
            <Text style={styles.statLabel}>קטגוריות</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
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

        {/* Equipment List */}
        <Text style={styles.sectionTitle}>רשימת ציוד ({filteredEquipment.length})</Text>
        <View style={styles.equipmentList}>
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
                  : 'לחץ על + בראש העמוד להוסיף ציוד'}
              </Text>
            </View>
          )}

          <View style={{ height: 20 }} />
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
    backgroundColor: Colors.modules.arme,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerAddButtonText: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: -2,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.small,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 15,
    ...Shadows.small,
  },
  searchIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
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
  equipmentList: {
    gap: 12,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    ...Shadows.small,
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
