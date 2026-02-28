/**
 * SoldierSearchScreen.tsx - Recherche de soldats
 * Design militaire professionnel
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { useSoldiers } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIsOnline } from '../../contexts/OfflineContext';
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { Soldier as BaseSoldier } from '../../types';

// Extend Soldier with computed property
interface Soldier extends BaseSoldier {
  outstandingCount?: number;
}

const SoldierSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userRole } = useAuth(); // Get user role
  const isOnline = useIsOnline(); // Check connectivity for offline mode
  const { mode, type } = (route.params as {
    mode: 'signature' | 'return' | 'storage' | 'retrieve' | 'rsp_issue' | 'rsp_credit';
    type?: 'combat' | 'clothing'
  }) || { mode: 'signature' };

  // Utiliser le cache des soldats depuis le contexte
  const { soldiers: cachedSoldiers, loading: cachLoading, refreshSoldiers } = useSoldiers();

  const [searchQuery, setSearchQuery] = useState('');
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [filteredSoldiers, setFilteredSoldiers] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSoldiers();
  }, [mode, cachedSoldiers]);

  // Gérer le rafraîchissement manuel (pull-to-refresh)
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSoldiers(); // Rafraîchir le cache
    await loadSoldiers(); // Recharger avec les nouveaux soldats
  };

  const loadSoldiers = async () => {
    let fallbackData = [...cachedSoldiers];
    try {
      setLoading(true);
      // Utiliser les soldats du cache au lieu de charger depuis le service
      let data = [...cachedSoldiers];
      fallbackData = data;

      if (mode === 'retrieve' && type === 'combat') {
        // Pour le mode retrieve, afficher uniquement les soldats avec des armes en storage
        const soldiersWithStorage = await weaponInventoryService.getSoldiersWithStoredWeapons();

        // Créer une map pour lookup rapide
        const storageMap = new Map(soldiersWithStorage.map(s => [s.soldierId, s.count]));

        // Filtrer uniquement les soldats qui ont des armes en storage
        data = data
          .filter((s: any) => storageMap.has(s.id))
          .map((s: any) => ({
            ...s,
            outstandingCount: storageMap.get(s.id) || 0,
          }));

        // Trier: soldats avec plus d'armes en premier
        data.sort((a: any, b: any) => (b.outstandingCount || 0) - (a.outstandingCount || 0));
      } else if ((mode === 'return' || mode === 'storage') && type) {
        // Obtenir tous les holdings directement depuis soldier_holdings (plus précis et rapide)
        const allHoldings = await transactionalAssignmentService.getAllHoldings(type as 'combat' | 'clothing');

        // Créer une map pour lookup rapide: [soldierId, totalQuantity]
        const holdingsMap = new Map<string, number>();
        allHoldings.forEach(holding => {
          const totalQty = (holding.items || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
          holdingsMap.set(holding.soldierId, totalQty);
        });

        // Ajouter le compte des items pour tous les soldats (0 si aucun)
        data = data.map((s: any) => ({
          ...s,
          outstandingCount: holdingsMap.get(s.id) || 0,
        }));

        // Trier: soldats avec équipement en premier
        data.sort((a: any, b: any) => (b.outstandingCount || 0) - (a.outstandingCount || 0));
      }

      if (mode === 'rsp_issue' || mode === 'rsp_credit') {
        data = data.filter((s: any) => s.isRsp === true);
      }

      // Filter by status for non-Shlishut roles
      // 'not_recruited' and 'released' soldiers should NOT appear in arme/vetement modules
      // They should only appear in Shlishut module
      // Also, admin/both can see all in Shlishut, but NOT in arme/vetement
      //
      // IMPORTANT: When OFFLINE, show ALL soldiers regardless of status
      // because status updates from Shlishut won't be available
      const isArmoryOrLogistics = type === 'combat' || type === 'clothing';

      if (isOnline) {
        // ONLINE: Apply normal status filtering
        if (isArmoryOrLogistics) {
          // In armory/logistics: show soldiers with status 'pre_recruitment', 'recruited', 'releasing_today', 'gimelim', 'pitzul', 'rianun'
          data = data.filter((s: any) => {
            const status = s.status || 'pre_recruitment';
            return ['pre_recruitment', 'recruited', 'releasing_today', 'gimelim', 'pitzul', 'rianun'].includes(status);
          });
        } else {
          // For non-type modes (like Shlishut), check user role
          const canViewPreRecruitment = userRole === 'admin' || userRole === 'both' || userRole === 'shlishut';
          if (!canViewPreRecruitment) {
            data = data.filter((s: any) => (s.status || 'pre_recruitment') !== 'pre_recruitment');
          }
        }

        // No extra restriction for return mode: any visible soldier can be credited
      }
      // OFFLINE: No status filtering - show all soldiers
      // Status updates from Shlishut are not available offline

      setSoldiers(data);
      setFilteredSoldiers(data);
    } catch (error) {
      console.error('Error loading soldiers:', error);
      // Fallback: afficher au moins la liste de base
      setSoldiers(fallbackData);
      setFilteredSoldiers(fallbackData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredSoldiers(soldiers);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = soldiers.filter(soldier =>
      soldier.name?.toLowerCase().includes(lowercaseQuery) ||
      soldier.personalNumber?.includes(query) ||
      soldier.phone?.includes(query)
    );
    setFilteredSoldiers(filtered);
  }, [soldiers]);

  const handleSelectSoldier = (soldier: Soldier) => {
    // Créer un objet serializable sans Date pour éviter les warnings React Navigation
    const serializableSoldier = {
      id: soldier.id,
      name: soldier.name,
      personalNumber: soldier.personalNumber,
      phone: soldier.phone,
      company: soldier.company,
      outstandingCount: soldier.outstandingCount,
    };

    if (mode === 'signature') {
      if (type === 'combat') {
        (navigation.navigate as any)('CombatAssignment', { soldier: serializableSoldier });
      } else {
        (navigation.navigate as any)('ClothingSignature', { soldier: serializableSoldier });
      }
    } else if (mode === 'return') {
      if (type === 'combat') {
        (navigation.navigate as any)('CombatReturn', { soldierId: serializableSoldier.id });
      } else {
        (navigation.navigate as any)('ClothingReturn', { soldier: serializableSoldier });
      }
    } else if (mode === 'storage') {
      if (type === 'combat') {
        (navigation.navigate as any)('CombatStorage', { soldierId: serializableSoldier.id });
      } else {
        (navigation.navigate as any)('ClothingStorage', { soldier: serializableSoldier });
      }
    } else if (mode === 'retrieve') {
      if (type === 'combat') {
        (navigation.navigate as any)('CombatRetrieve', { soldierId: serializableSoldier.id });
      } else {
        (navigation.navigate as any)('ClothingRetrieve', { soldier: serializableSoldier });
      }
    } else if (mode === 'rsp_issue') {
      (navigation.navigate as any)('RspAssignment', { soldier: serializableSoldier, action: 'issue' });
    } else if (mode === 'rsp_credit') {
      (navigation.navigate as any)('RspAssignment', { soldier: serializableSoldier, action: 'credit' });
    }
  };

  const handleEditSoldier = (soldier: Soldier) => {
    (navigation.navigate as any)('EditSoldier', { soldierId: soldier.id });
  };

  // Status config (duplicated for now)
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pre_recruitment: { label: 'טרום גיוס', color: '#6B7280', bg: '#F3F4F6' },
    recruited: { label: 'מגויס', color: '#059669', bg: '#D1FAE5' },
    gimelim: { label: 'גימלים', color: '#8B5CF6', bg: '#EDE9FE' },
    pitzul: { label: 'פיצול', color: '#F59E0B', bg: '#FEF3C7' },
    rianun: { label: 'רענון', color: '#EC4899', bg: '#FCE7F3' },
    releasing_today: { label: 'משתחרר היום', color: '#D97706', bg: '#FEF3C7' },
    released: { label: 'משוחרר', color: '#3B82F6', bg: '#DBEAFE' },
  };

  const renderSoldierItem = ({ item }: { item: Soldier }) => {
    const status = item.status || 'pre_recruitment';
    const statusConfig = STATUS_CONFIG[status];
    const showStatus = statusConfig && status !== 'recruited'; // Don't show badge for regular recruited soldiers to reduce noise, or show for all?
    // Let's show for all special statuses including releasing_today, gimelim, etc.

    return (
      <View style={styles.soldierCardContainer}>
        <TouchableOpacity
          style={styles.soldierCard}
          onPress={() => handleSelectSoldier(item)}
          onLongPress={() => handleEditSoldier(item)}
          activeOpacity={0.7}
        >
          <View style={styles.soldierAvatar}>
            <Text style={styles.avatarText}>
              {item.name?.charAt(0) || '?'}
            </Text>
          </View>

          <View style={styles.soldierInfo}>
            <Text style={styles.soldierName}>{item.name}</Text>
            <Text style={styles.soldierNumber}>מ.א: {item.personalNumber}</Text>
            {item.company && (
              <Text style={styles.soldierCompany}>{item.company}</Text>
            )}

            {/* Status Badge */}
            {statusConfig && status !== 'recruited' && (
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            )}
          </View>

          {mode === 'return' ? (
            <View style={[
              styles.outstandingBadge,
              (item.outstandingCount || 0) === 0 && styles.outstandingBadgeZero
            ]}>
              <Text style={[
                styles.outstandingText,
                (item.outstandingCount || 0) === 0 && styles.outstandingTextZero
              ]}>
                {item.outstandingCount || 0}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
          )}
        </TouchableOpacity>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditSoldier(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={searchQuery ? 'search' : 'people'}
        size={64}
        color={Colors.textLight}
      />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'לא נמצאו תוצאות' : 'אין חיילים'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'נסה לחפש לפי שם, מספר אישי או טלפון'
          : mode === 'return'
            ? 'אין חיילים עם ציוד להחזרה'
            : mode === 'storage'
              ? 'אין חיילים עם ציוד לאפסון'
              : mode === 'retrieve' ? 'אין חיילים עם ציוד באפסון'
                : mode.includes('rsp') ? 'לא נמצאו רס"פים. הגדר חיילים כרס"פים בעריכת חייל.'
                  : 'הוסף חיילים למערכת'
        }
      </Text>
    </View>
  );

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
          <Text style={styles.headerTitle}>
            {mode === 'signature' ? 'בחירת חייל להחתמה' :
              mode === 'return' ? 'בחירת חייל לזיכוי' :
                mode === 'storage' ? 'בחירת חייל לאפסון' :
                  mode === 'retrieve' ? 'בחירת חייל להחזרה מאפסון' :
                    mode === 'rsp_issue' ? 'בחירת רס"פ להחתמה' :
                      'בחירת רס"פ לזיכוי'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {filteredSoldiers.length} {mode.includes('rsp') ? 'רס"פים' : 'חיילים'}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {/* Offline Mode Banner */}
      {!isOnline && (type === 'combat' || type === 'clothing') && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#92400E" />
          <Text style={styles.offlineBannerText}>
            מצב לא מקוון - כל החיילים מוצגים (כולל לא מגויסים)
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש לפי שם, מ.א או טלפון..."
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <Ionicons name="search" size={20} color={Colors.textLight} />
        </View>
      </View>

      {/* Soldiers List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>טוען חיילים...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSoldiers}
          renderItem={renderSoldierItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
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
    backgroundColor: Colors.primary,
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
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },

  headerSpacer: {
    width: 44,
  },

  // Offline Banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
  },

  offlineBannerText: {
    fontSize: FontSize.sm,
    color: '#92400E',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
  },

  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },

  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginRight: Spacing.sm,
  },

  // List
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  soldierCardContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },

  soldierCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.small,
  },

  editButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  soldierAvatar: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.primary,
  },

  soldierInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  soldierName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  soldierNumber: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  soldierCompany: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },

  outstandingBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },

  outstandingBadgeZero: {
    backgroundColor: Colors.success,
  },

  outstandingText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  outstandingTextZero: {
    color: Colors.textWhite,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },

  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
  },

  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  statusBadge: {
    marginTop: 4,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 10,
    color: '#854D0E',
    fontWeight: '600',
  },
});

export default SoldierSearchScreen;

