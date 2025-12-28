// Écran de recherche de soldat
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Soldier } from '../../types';
import { useSoldierSearch } from '../../hooks/useSoldierSearch';
import { Colors, Shadows } from '../../theme/colors';
import { notifyError } from '../../utils/notify';
import { ScreenHeader, SoldierCard, EmptyState, LoadingState } from '../../components';

const SoldierSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'clothing';
  
  const [searchQuery, setSearchQuery] = useState('');
  const { soldiers, loading, error, hasMore, search, loadMore } = useSoldierSearch();

  // Chargement initial : liste paginée sans filtre
  useEffect(() => {
    search('');
  }, []);

  // Recherche avec debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      search(searchQuery);
    }, 300); // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Afficher erreur si présente
  useEffect(() => {
    if (error) {
      notifyError(error, 'חיפוש חיילים');
    }
  }, [error]);

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
    <SoldierCard
      soldier={item}
      onPress={() => handleSelectSoldier(item)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="חיפוש חייל"
        subtitle={mode === 'combat' ? 'מנות וציוד לחימה' : 'ביגוד וציוד אישי'}
      />

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
      {!loading && soldiers.length > 0 && (
        <Text style={styles.resultsCount}>
          {soldiers.length} חיילים נמצאו {hasMore && '(עוד תוצאות זמינות)'}
        </Text>
      )}

      {/* Soldiers List */}
      {loading && soldiers.length === 0 ? (
        <LoadingState message="טוען חיילים..." />
      ) : (
        <FlatList
          data={soldiers}
          keyExtractor={(item) => item.id}
          renderItem={renderSoldierItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? <LoadingState message="" size="small" style={styles.footerLoading} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title="לא נמצאו חיילים"
              message="נסה לשנות את מילות החיפוש או הוסף חייל חדש"
              actionLabel="הוסף חייל חדש"
              onAction={handleAddSoldier}
            />
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
});

export default SoldierSearchScreen;
