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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Soldier } from '../../types';
import { useSoldierSearch } from '../../hooks/useSoldierSearch';
import { assignmentService } from '../../services/firebaseService';
import { Colors, Shadows } from '../../theme/colors';
import { notifyError } from '../../utils/notify';
import { ScreenHeader, SoldierCard, EmptyState, LoadingState } from '../../components';

const SoldierSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'clothing';
  const action = route.params?.action || 'signature'; // 'signature' ou 'return'

  const [searchQuery, setSearchQuery] = useState('');
  const { soldiers, loading, error, hasMore, search, loadMore } = useSoldierSearch();

  // Pour le mode retour: soldats avec équipements à rendre
  const [soldatsAvecEquipements, setSoldatsAvecEquipements] = useState<Soldier[]>([]);
  const [loadingReturnList, setLoadingReturnList] = useState(false);

  // Chargement initial
  useEffect(() => {
    if (action === 'return') {
      loadSoldiersWithOutstandingItems();
    } else {
      search('');
    }
  }, [action]);

  // Charger les soldats avec équipements à rendre (mode retour)
  const loadSoldiersWithOutstandingItems = async () => {
    try {
      setLoadingReturnList(true);
      const soldiersWithHoldings = await assignmentService.getSoldiersWithCurrentHoldings(mode);

      // Convertir en format Soldier pour l'UI
      const soldiersList: Soldier[] = soldiersWithHoldings.map(h => ({
        id: h.soldierId,
        name: h.soldierName,
        personalNumber: h.soldierPersonalNumber,
        company: '', // Pas disponible directement
        phone: '',
        createdAt: new Date(),
        // Ajouter un badge avec le nombre d'items
        _outstandingCount: h.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      } as any));

      setSoldatsAvecEquipements(soldiersList);
    } catch (error) {
      console.error('Error loading soldiers with outstanding items:', error);
      notifyError('שגיאה בטעינת רשימת חיילים', 'זיכוי');
    } finally {
      setLoadingReturnList(false);
    }
  };

  // Recherche avec debounce (seulement en mode signature)
  useEffect(() => {
    if (action === 'signature') {
      const timeoutId = setTimeout(() => {
        search(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, action]);

  // Filtrage local pour le mode retour
  const getFilteredSoldiers = () => {
    if (action === 'return') {
      if (!searchQuery.trim()) {
        return soldatsAvecEquipements;
      }
      const query = searchQuery.toLowerCase();
      return soldatsAvecEquipements.filter(
        s =>
          s.name.toLowerCase().includes(query) ||
          s.personalNumber.includes(query) ||
          (s.phone && s.phone.includes(query))
      );
    }
    return soldiers;
  };

  // Afficher erreur si présente
  useEffect(() => {
    if (error) {
      notifyError(error, 'חיפוש חיילים');
    }
  }, [error]);

  const handleSelectSoldier = (soldier: Soldier) => {
    if (action === 'return') {
      // Mode retour
      if (mode === 'combat') {
        navigation.navigate('CombatReturn', { soldierId: soldier.id });
      } else {
        navigation.navigate('ClothingReturn', { soldierId: soldier.id });
      }
    } else {
      // Mode signature
      if (mode === 'combat') {
        navigation.navigate('CombatAssignment', { soldierId: soldier.id });
      } else {
        navigation.navigate('ClothingSignature', { soldierId: soldier.id });
      }
    }
  };

  const handleAddSoldier = () => {
    navigation.navigate('AddSoldier');
  };

  const renderSoldierItem = ({ item }: { item: Soldier }) => {
    return (
      <SoldierCard
        soldier={item}
        onPress={() => handleSelectSoldier(item)}
      />
    );
  };

  const filteredSoldiers = getFilteredSoldiers();
  const isLoading = action === 'return' ? loadingReturnList : loading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title={action === 'return' ? 'זיכוי חייל' : 'חיפוש חייל'}
        subtitle={mode === 'combat' ? 'מנות וציוד לחימה' : 'ביגוד וציוד אישי'}
      />

      {/* Search Box */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            action === 'return'
              ? 'סנן לפי שם או מספר אישי...'
              : 'חפש לפי שם, מספר אישי או טלפון...'
          }
          placeholderTextColor="#666"
          textAlign="right"
        />
        {action === 'signature' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddSoldier}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner for return mode */}
      {action === 'return' && !isLoading && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ✅ מציג רק חיילים עם ציוד לזיכוי ({filteredSoldiers.length})
          </Text>
        </View>
      )}

      {/* Results Count */}
      {!isLoading && filteredSoldiers.length > 0 && action === 'signature' && (
        <Text style={styles.resultsCount}>
          {filteredSoldiers.length} חיילים נמצאו {hasMore && '(עוד תוצאות זמינות)'}
        </Text>
      )}

      {/* Soldiers List */}
      {isLoading && filteredSoldiers.length === 0 ? (
        <LoadingState message="טוען חיילים..." />
      ) : (
        <FlatList
          data={filteredSoldiers}
          keyExtractor={(item) => item.id}
          renderItem={renderSoldierItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onEndReached={action === 'signature' && hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            action === 'signature' && loading ? <LoadingState message="" size="small" style={styles.footerLoading} /> : null
          }
          ListEmptyComponent={
            action === 'signature' ? (
              <EmptyState
                icon="🔍"
                title="לא נמצאו חיילים"
                message="נסה לשנות את מילות החיפוש או הוסף חייל חדש"
                actionLabel="הוסף חייל חדש"
                onAction={handleAddSoldier}
              />
            ) : (
              <EmptyState
                icon="✅"
                title="אין ציוד לזיכוי"
                message="כל החיילים החזירו את הציוד שלהם"
              />
            )
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
  footerLoading: {
    paddingVertical: 10,
  },
  infoBanner: {
    backgroundColor: '#e8f4fd',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#b3d9f2',
  },
  infoBannerText: {
    fontSize: 14,
    color: Colors.text.primary,
    textAlign: 'right',
    fontWeight: '500',
  },
});

export default SoldierSearchScreen;
