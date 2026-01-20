/**
 * CombatStockScreen.tsx - Tableau de stock d'équipements de combat
 * Affiche la distribution par statut (Dispo, Stocké, Emporté) et par compagnie
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/Colors';
import { combatStockService, EquipmentStock } from '../../services/combatStockService';

const CombatStockScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stocks, setStocks] = useState<EquipmentStock[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const data = await combatStockService.getAllEquipmentStocks();
      setStocks(data);
    } catch (error) {
      console.error('Error loading stocks:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את נתוני המלאי');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleExpanded = (equipmentId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(equipmentId)) {
        newSet.delete(equipmentId);
      } else {
        newSet.add(equipmentId);
      }
      return newSet;
    });
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'נשק': '#EF4444',
      'אמצעי לחימה': '#F59E0B',
      'אמל״ח': '#10B981',
      'ציוד לוחם': '#3B82F6',
      'אביזרים': '#8B5CF6',
    };
    return colors[category] || '#64748B';
  };

  const renderTableRow = (stock: EquipmentStock, index: number) => {
    const isExpanded = expandedItems.has(stock.equipmentId);
    const categoryColor = getCategoryColor(stock.category);
    const isEven = index % 2 === 0;

    return (
      <View key={stock.equipmentId}>
        {/* Main Row */}
        <TouchableOpacity
          style={[styles.tableRow, isEven && styles.tableRowEven]}
          onPress={() => toggleExpanded(stock.equipmentId)}
          activeOpacity={0.7}
        >
          {/* Status Columns (Left Side) */}
          <View style={styles.statusColumns}>
            <View style={styles.cellStatus}>
              <Text style={[styles.statusValue, stock.available > 0 && styles.statusValueAvailable]}>
                {stock.available}
              </Text>
            </View>
            <View style={styles.cellStatus}>
              <Text style={[styles.statusValue, stock.storage > 0 && styles.statusValueStorage]}>
                {stock.storage}
              </Text>
            </View>
            <View style={styles.cellStatus}>
              <Text style={[styles.statusValue, stock.issued > 0 && styles.statusValueIssued]}>
                {stock.issued}
              </Text>
            </View>
          </View>

          {/* Equipment Info (Right Side) */}
          <View style={styles.equipmentInfoCell}>
            <View style={styles.nameAndCategory}>
              <Text style={styles.equipmentName} numberOfLines={1}>
                {stock.equipmentName}
              </Text>
              <View style={styles.categoryRow}>
                <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                <Text style={styles.categoryLabel}>{stock.category}</Text>
              </View>
            </View>

            <View style={styles.cellExpand}>
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-back'}
                size={16}
                color={Colors.textSecondary}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Details */}
        {isExpanded && stock.byCompany.length > 0 && (
          <View style={styles.expandedSection}>
            {/* Sub-table Header */}
            <View style={styles.subTableHeader}>
              <Text style={[styles.subHeaderText, styles.subCellStatus]}>אפסון</Text>
              <Text style={[styles.subHeaderText, styles.subCellStatus]}>הונפק</Text>
              <Text style={[styles.subHeaderText, styles.subCellSoldiers]}>חיילים</Text>
              <Text style={[styles.subHeaderText, styles.subCellCompany]}>פלוגה</Text>
            </View>

            {/* Sub-table Rows */}
            {stock.byCompany.map((company, idx) => (
              <View
                key={company.company}
                style={[
                  styles.subTableRow,
                  idx % 2 === 0 && styles.subTableRowEven,
                ]}
              >
                <Text style={[styles.subCellText, styles.subCellStatus, company.storage > 0 && styles.boldText]}>
                  {company.storage}
                </Text>
                <Text style={[styles.subCellText, styles.subCellStatus, company.issued > 0 && styles.boldText]}>
                  {company.issued}
                </Text>
                <Text style={[styles.subCellText, styles.subCellSoldiers]}>
                  {company.soldiers}
                </Text>
                <Text style={[styles.subCellText, styles.subCellCompany]}>
                  {company.company}
                </Text>
              </View>
            ))}
          </View>
        )}

        {isExpanded && stock.byCompany.length === 0 && (
          <View style={styles.noDataRow}>
            <Text style={styles.noDataText}>לא הוקצה לאף פלוגה</Text>
          </View>
        )}
      </View>
    );
  };

  const totalIssued = stocks.reduce((sum, s) => sum + s.issued, 0);
  const totalStorage = stocks.reduce((sum, s) => sum + s.storage, 0);
  const totalAvailable = stocks.reduce((sum, s) => sum + s.available, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען מלאי...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={22} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>מלאי נשק וציוד</Text>

        <TouchableOpacity style={styles.headerButton} onPress={loadStocks}>
          <Ionicons name="refresh" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStocks();
            }}
            colors={[Colors.arme]}
          />
        }
      >
        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{totalIssued}</Text>
            <Text style={styles.statLabel}>הונפק</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxMiddle]}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{totalStorage}</Text>
            <Text style={styles.statLabel}>אפסון</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{totalAvailable}</Text>
            <Text style={styles.statLabel}>זמין</Text>
          </View>
        </View>

        {/* Main Table */}
        {stocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>אין ציוד במערכת</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.statusColumns}>
                <Text style={[styles.headerCell, styles.cellStatus]}>זמין</Text>
                <Text style={[styles.headerCell, styles.cellStatus]}>אפסון</Text>
                <Text style={[styles.headerCell, styles.cellStatus]}>הונפק</Text>
              </View>
              <Text style={[styles.headerCell, styles.equipmentInfoCell, { textAlign: 'right', paddingRight: 40 }]}>ציוד</Text>
            </View>

            {/* Table Body */}
            <View style={styles.tableBody}>
              {stocks.map((stock, index) => renderTableRow(stock, index))}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  // Header
  header: {
    backgroundColor: Colors.arme,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    ...Shadows.small,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statBoxMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  // Table
  tableContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    ...Shadows.small,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  headerCell: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  tableBody: {
    // Container for rows
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowEven: {
    backgroundColor: '#FAFBFC',
  },
  // Status Columns
  statusColumns: {
    flexDirection: 'row',
    width: 180,
  },
  cellStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94A3B8',
  },
  statusValueAvailable: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  statusValueStorage: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  statusValueIssued: {
    color: '#10B981',
    fontWeight: '700',
  },
  // Equipment Info
  equipmentInfoCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  nameAndCategory: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 8,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  categoryLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cellExpand: {
    width: 24,
    alignItems: 'center',
  },
  // Expanded Section
  expandedSection: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
    justifyContent: 'flex-end',
  },
  subHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  subTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  subTableRowEven: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  subCellText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
    color: '#1E293B',
  },
  subCellStatus: {
    width: 50,
  },
  subCellSoldiers: {
    width: 60,
  },
  subCellCompany: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 8,
    fontWeight: '600',
    color: '#334155',
  },
  noDataRow: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  noDataText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
});

export default CombatStockScreen;

