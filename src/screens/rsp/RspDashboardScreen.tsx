/**
 * RspDashboardScreen.tsx - Dashboard liste des soldats pour RSP/Admin
 * Tap sur un soldat → écran détaillé avec tout son équipement
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { rspDashboardService, RspSoldierWithHoldings, RspCompanyStats } from '../../services/rspDashboardService';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';

const COMPANIES = ['פלוגה א', 'פלוגה ב', 'פלוגה ג', 'פלוגה ד', 'מפקדה', 'ניוד'];

const RspDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user, userCompany, signOut } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [company, setCompany] = useState<string>(
    isAdmin ? (route.params?.company || '') : (userCompany || '')
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [soldiers, setSoldiers] = useState<RspSoldierWithHoldings[]>([]);
  const [stats, setStats] = useState<RspCompanyStats | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'nshk' | 'afsnot' | 'both'>('all');

  const loadData = useCallback(async () => {
    if (!company) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [holdingsData, statsData] = await Promise.all([
        rspDashboardService.getCompanyHoldings(company),
        rspDashboardService.getCompanyStats(company),
      ]);
      setSoldiers(holdingsData);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectCompany = (newCompany: string) => {
    setCompany(newCompany);
    setSearchText('');
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Contact Actions
  const handleCall = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    // Basic cleanup for IL numbers (remove leading 0, add 972)
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('0')) formatted = '972' + formatted.substring(1);

    // For WhatsApp, usually just the number is enough, but adding country code is safer
    // If user enters full international format, it might already be correct.
    // Assuming mostly local IL numbers starting with 05...
    Linking.openURL(`https://wa.me/${formatted}`);
  };

  const filteredSoldiers = soldiers.filter(s => {
    // Filtre recherche textuelle
    const matchesSearch =
      s.soldier.name.includes(searchText) ||
      s.soldier.personalNumber.includes(searchText) ||
      (s.soldier.phone && s.soldier.phone.includes(searchText));
    if (!matchesSearch) return false;

    // Filtre équipement non rendu
    switch (filterType) {
      case 'nshk': return s.totalCombatItems > 0;
      case 'afsnot': return s.totalClothingItems > 0;
      case 'both': return s.totalCombatItems > 0 && s.totalClothingItems > 0;
      default: return true;
    }
  });

  // Naviguer vers le détail du soldat
  const openSoldierDetail = (item: RspSoldierWithHoldings) => {
    (navigation as any).navigate('RspSoldierDetail', {
      soldierData: JSON.stringify(item),
    });
  };

  // --- ADMIN sans company → sélecteur ---
  if (isAdmin && !company) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>דאשבורד רס"פ</Text>
              <Text style={styles.headerSubtitle}>בחר פלוגה לצפייה</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-forward" size={22} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.companyPickerContainer}>
          {COMPANIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={styles.companyPickerItem}
              onPress={() => handleSelectCompany(c)}
              activeOpacity={0.7}
            >
              <View style={styles.companyPickerIcon}>
                <Ionicons name="shield" size={24} color={Colors.warning} />
              </View>
              <Text style={styles.companyPickerText}>{c}</Text>
              <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // --- RSP sans company ---
  if (!isAdmin && !company) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={64} color={Colors.warning} />
        <Text style={styles.errorTitle}>לא הוגדרה פלוגה</Text>
        <Text style={styles.errorText}>פנה למנהל המערכת להגדרת הפלוגה שלך</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>התנתק</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.warning} />
        <Text style={styles.loadingText}>טוען נתונים...</Text>
      </View>
    );
  }

  // --- Render carte simple du soldat ---
  const renderSoldierCard = ({ item }: { item: RspSoldierWithHoldings }) => (
    <TouchableOpacity
      style={styles.soldierCard}
      onPress={() => openSoldierDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.soldierAvatar}>
        <Text style={styles.avatarText}>{item.soldier.name.charAt(0)}</Text>
      </View>

      {/* Contact Actions - Buttons on the left (LTR) / right of text (visually next to name) */}
      {item.soldier.phone && (
        <View style={styles.contactActions}>
          <TouchableOpacity
            onPress={() => handleCall(item.soldier.phone)}
            style={[styles.contactButton, { backgroundColor: Colors.info }]}
          >
            <Ionicons name="call" size={16} color={Colors.textWhite} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleWhatsApp(item.soldier.phone)}
            style={[styles.contactButton, { backgroundColor: '#25D366' }]}
          >
            <Ionicons name="logo-whatsapp" size={16} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.soldierInfo}>
        <Text style={styles.soldierName}>{item.soldier.name}</Text>
        <Text style={styles.soldierNumber}>{item.soldier.personalNumber}</Text>
      </View>
      <View style={styles.soldierBadges}>
        {item.totalCombatItems > 0 && (
          <View style={styles.miniBadge}>
            <Ionicons name="shield" size={12} color={Colors.arme} />
            <Text style={styles.miniBadgeText}>{item.totalCombatItems}</Text>
          </View>
        )}
        {item.totalClothingItems > 0 && (
          <View style={styles.miniBadge}>
            <Ionicons name="shirt" size={12} color={Colors.vetement} />
            <Text style={styles.miniBadgeText}>{item.totalClothingItems}</Text>
          </View>
        )}
        {item.totalRspItems > 0 && (
          <View style={styles.miniBadge}>
            <Ionicons name="cube" size={12} color={Colors.warning} />
            <Text style={styles.miniBadgeText}>{item.totalRspItems}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );

  // --- Main render ---
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{company}</Text>
            <Text style={styles.headerSubtitle}>דאשבורד רס"פ</Text>
          </View>
          {isAdmin ? (
            <TouchableOpacity style={styles.headerButton} onPress={() => setCompany('')}>
              <Ionicons name="arrow-forward" size={22} color={Colors.textWhite} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.headerButton} onPress={signOut}>
              <Ionicons name="log-out-outline" size={22} color={Colors.textWhite} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.readOnlyBadge}>
          <Ionicons name="eye-outline" size={14} color={Colors.warningDark} />
          <Text style={styles.readOnlyText}>צפייה בלבד</Text>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={22} color={Colors.soldats} />
            <Text style={styles.statValue}>{stats.totalSoldiers}</Text>
            <Text style={styles.statLabel}>חיילים</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cube" size={22} color={Colors.warning} />
            <Text style={styles.statValue}>{stats.soldiersWithRsp}</Text>
            <Text style={styles.statLabel}>רס"פ</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shield" size={22} color={Colors.arme} />
            <Text style={styles.statValue}>{stats.soldiersWithCombat}</Text>
            <Text style={styles.statLabel}>נשק</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shirt" size={22} color={Colors.vetement} />
            <Text style={styles.statValue}>{stats.soldiersWithClothing}</Text>
            <Text style={styles.statLabel}>אפסנאות</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="חיפוש לפי שם או מספר אישי..."
          placeholderTextColor={Colors.placeholder}
          value={searchText}
          onChangeText={setSearchText}
          textAlign="right"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres équipement */}
      <View style={styles.filterRow}>
        {([
          { key: 'all', label: 'כל' },
          { key: 'nshk', label: 'נשק', icon: 'shield', color: Colors.arme },
          { key: 'afsnot', label: 'אפסנאות', icon: 'shirt', color: Colors.vetement },
          { key: 'both', label: 'שניהם', icon: 'layers', color: Colors.primary },
        ] as { key: string; label: string; icon?: string; color?: string }[]).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filterType === f.key && styles.filterPillActive]}
            onPress={() => setFilterType(f.key as any)}
            activeOpacity={0.7}
          >
            {f.icon && (
              <Ionicons
                size={13}
                color={filterType === f.key ? Colors.textWhite : (f.color || Colors.textSecondary)}
              />
            )}
            <Text style={[styles.filterPillText, filterType === f.key && styles.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste soldats */}
      <FlatList
        data={filteredSoldiers}
        renderItem={renderSoldierCard}
        keyExtractor={item => item.soldier.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.warning]}
            tintColor={Colors.warning}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>
              {searchText || filterType !== 'all' ? 'לא נמצאו חיילים תואמים' : 'אין חיילים בפלוגה זו'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Loading / Error
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: Spacing.md, fontSize: FontSize.base, color: Colors.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.xl },
  errorTitle: { fontSize: FontSize.xl, fontWeight: '600', color: Colors.text, marginTop: Spacing.lg, textAlign: 'center' },
  errorText: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
  logoutButton: { marginTop: Spacing.xl, backgroundColor: Colors.warning, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md },
  logoutButtonText: { color: Colors.textWhite, fontSize: FontSize.base, fontWeight: '600' },

  // Header
  header: {
    backgroundColor: Colors.warning,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    ...Shadows.medium,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.textWhite, textAlign: 'right' },
  headerSubtitle: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.xs, textAlign: 'right' },
  headerButton: {
    width: 44, height: 44, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  readOnlyBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
    backgroundColor: Colors.warningLight, paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.md, gap: Spacing.xs,
  },
  readOnlyText: { fontSize: FontSize.sm, color: Colors.warningDark, fontWeight: '500' },

  // Stats
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginTop: -Spacing.md, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginHorizontal: Spacing.xs, alignItems: 'center', ...Shadows.small },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, ...Shadows.xs },
  searchIcon: { marginLeft: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSize.base, color: Colors.text },

  // List
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },

  // Soldier Card
  soldierCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, flexDirection: 'row',
    alignItems: 'center', ...Shadows.small,
  },
  soldierAvatar: {
    width: 44, height: 44, borderRadius: BorderRadius.full,
    backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.md,
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.warningDark },
  soldierInfo: { flex: 1, alignItems: 'flex-end', marginRight: Spacing.sm },
  soldierName: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  soldierNumber: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  soldierBadges: { flexDirection: 'row', gap: Spacing.xs, marginRight: Spacing.sm },
  miniBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundInput, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs, gap: 3 },
  miniBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  // Filtres
  filterRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.xs },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundInput, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full },
  filterPillActive: { backgroundColor: Colors.primary },
  filterPillText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextActive: { color: Colors.textWhite },

  // Company picker (admin)
  companyPickerContainer: { flex: 1, padding: Spacing.lg },
  companyPickerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.small },
  companyPickerIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.md },
  companyPickerText: { flex: 1, fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, textAlign: 'right' },

  // Contact Actions
  contactActions: { flexDirection: 'row', gap: 8, marginLeft: Spacing.md },
  contactButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

export default RspDashboardScreen;
