// Écran de recherche de soldat
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Soldier } from '../../types';
import { searchSoldiersByName, getAllSoldiers } from '../../services/soldierService';
import { Colors, Shadows } from '../../theme/colors';

const SoldierSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'clothing';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [filteredSoldiers, setFilteredSoldiers] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSoldiers();
  }, []);

  useEffect(() => {
    filterSoldiers();
  }, [searchQuery, soldiers]);

  const loadSoldiers = async () => {
    try {
      setLoading(true);
      const data = await getAllSoldiers();
      setSoldiers(data);
    } catch (error) {
      console.error('Error loading soldiers:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת החיילים');
    } finally {
      setLoading(false);
    }
  };

  const filterSoldiers = () => {
    if (!searchQuery.trim()) {
      setFilteredSoldiers(soldiers);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = soldiers.filter(soldier =>
      soldier.name.toLowerCase().includes(query) ||
      soldier.personalNumber.includes(query) ||
      soldier.phone?.includes(query)
    );
    setFilteredSoldiers(filtered);
  };

  const handleSelectSoldier = (soldier: Soldier) => {
    if (mode === 'combat') {
      navigation.navigate('CombatAssignment', { soldierId: soldier.id });
    } else {
      navigation.navigate('ClothingSignature', { soldierId: soldier.id });
    }
  };

  const handleAddSoldier = () => {
    navigation.navigate('AddSoldier');
  };

  const renderSoldierItem = ({ item }: { item: Soldier }) => (
    <TouchableOpacity 
      style={styles.soldierCard}
      onPress={() => handleSelectSoldier(item)}
    >
      <View style={styles.soldierAvatar}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0)}
        </Text>
      </View>
      <View style={styles.soldierInfo}>
        <Text style={styles.soldierName}>{item.name}</Text>
        <Text style={styles.soldierDetails}>
          מ.א: {item.personalNumber} | {item.company}
        </Text>
        {item.phone && (
          <Text style={styles.soldierPhone}>{item.phone}</Text>
        )}
      </View>
      <View style={styles.chevron}>
        <Text style={styles.chevronText}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>חיפוש חייל</Text>
        <Text style={styles.subtitle}>
          {mode === 'combat' ? 'מנות וציוד לחימה' : 'ביגוד וציוד אישי'}
        </Text>
      </View>

      {/* Search Box */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="חפש לפי שם, מספר אישי או טלפון..."
          placeholderTextColor="#666"
          textAlign="right"
        />
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddSoldier}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      {!loading && (
        <Text style={styles.resultsCount}>
          {filteredSoldiers.length} חיילים נמצאו
        </Text>
      )}

      {/* Soldiers List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90d9" />
          <Text style={styles.loadingText}>טוען חיילים...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSoldiers}
          keyExtractor={(item) => item.id}
          renderItem={renderSoldierItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>לא נמצאו חיילים</Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={handleAddSoldier}
              >
                <Text style={styles.emptyButtonText}>הוסף חייל חדש</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
    alignItems: 'flex-end',
    ...Shadows.medium,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  addButton: {
    backgroundColor: Colors.status.info,
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  addButtonText: {
    fontSize: 28,
    color: Colors.text.white,
    fontWeight: 'bold',
  },
  resultsCount: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    color: Colors.text.secondary,
    fontSize: 14,
    textAlign: 'right',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  soldierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  soldierAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.status.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  soldierInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  soldierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  soldierDetails: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  soldierPhone: {
    fontSize: 12,
    color: Colors.text.light,
  },
  chevron: {
    marginRight: 10,
  },
  chevronText: {
    fontSize: 24,
    color: Colors.military.navyBlue,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    color: Colors.text.secondary,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.text.secondary,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: Colors.status.info,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    ...Shadows.small,
  },
  emptyButtonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SoldierSearchScreen;
