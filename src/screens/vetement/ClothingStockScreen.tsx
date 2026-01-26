/**
 * ClothingStockScreen.tsx - Tableau de stock par compagnie
 * Affiche la distribution des équipements par compagnie et les quantités restantes
 * Version améliorée avec tableau propre
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
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { clothingStockService, EquipmentStock } from '../../services/clothingStockService';

const ClothingStockScreen: React.FC = () => {
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
      const data = await clothingStockService.getAllEquipmentStocks();
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

  const getStockStatus = (stock: EquipmentStock) => {
    if (stock.yamach === 0) {
      return { color: Colors.textLight, text: 'לא הוגדר', icon: 'help-circle' };
    }
    const percentage = Math.max(0, (stock.available / stock.yamach) * 100);
    if (percentage > 50) {
      return { color: '#10B981', text: 'תקין', icon: 'checkmark-circle' };
    } else if (percentage > 20) {
      return { color: '#F59E0B', text: 'נמוך', icon: 'warning' };
    } else {
      return { color: '#EF4444', text: 'קריטי', icon: 'alert-circle' };
    }
  };

  const renderTableRow = (stock: EquipmentStock, index: number) => {
    const isExpanded = expandedItems.has(stock.equipmentId);
    const status = getStockStatus(stock);
    const isEven = index % 2 === 0;

    return (
      <View key={stock.equipmentId}>
        {/* Main Row */}
        <TouchableOpacity
          style={[styles.tableRow, isEven && styles.tableRowEven]}
          onPress={() => toggleExpanded(stock.equipmentId)}
          activeOpacity={0.7}
        >
          {/* Expand Icon */}
          <View style={styles.cellExpand}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-back'}
              size={16}
              color={Colors.textSecondary}
            />
          </View>

          {/* Status */}
          <View style={styles.cellStatus}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          </View>

          {/* Available */}
          <View style={styles.cellNumber}>
            <Text style={[styles.cellValue, { color: status.color }]}>
              {stock.available}
            </Text>
          </View>

          {/* Assigned */}
          <View style={styles.cellNumber}>
            <Text style={styles.cellValue}>{stock.totalAssigned}</Text>
          </View>

          {/* Yamach */}
          <View style={styles.cellNumber}>
            <Text style={styles.cellValue}>
              {stock.yamach || '-'}
            </Text>
          </View>

          {/* Equipment Name */}
          <View style={styles.cellName}>
            <Text style={styles.equipmentName} numberOfLines={1}>
              {stock.equipmentName}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Expanded Details */}
        {isExpanded && stock.byCompany.length > 0 && (
          <View style={styles.expandedSection}>
            {/* Sub-table Header */}
            <View style={styles.subTableHeader}>
              <Text style={[styles.subHeaderText, styles.subCellPercent]}>%</Text>
              <Text style={[styles.subHeaderText, styles.subCellQty]}>כמות</Text>
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
                <Text style={[styles.subCellText, styles.subCellPercent]}>
                  {stock.totalAssigned > 0 ? Math.max(0, Math.round((company.quantity / stock.totalAssigned) * 100)) : 0}%
                </Text>
                <Text style={[styles.subCellText, styles.subCellQty, styles.subCellBold]}>
                  {company.quantity}
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

  const totalYamach = stocks.reduce((sum, s) => sum + (s.yamach || 0), 0);
  const totalAssigned = stocks.reduce((sum, s) => sum + s.totalAssigned, 0);
  const totalAvailable = stocks.reduce((sum, s) => sum + s.available, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.vetement} />
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

        <Text style={styles.headerTitle}>מלאי אפנאות</Text>

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
            colors={[Colors.vetement]}
          />
        }
      >
        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalYamach}</Text>
            <Text style={styles.statLabel}>ימ״ח</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxMiddle]}>
            <Text style={styles.statValue}>{totalAssigned}</Text>
            <Text style={styles.statLabel}>מוקצה</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{totalAvailable}</Text>
            <Text style={styles.statLabel}>זמין</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>תקין</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>נמוך</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>קריטי</Text>
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
              <View style={styles.cellExpand} />
              <Text style={[styles.headerCell, styles.cellStatus]}>סטטוס</Text>
              <Text style={[styles.headerCell, styles.cellNumber]}>זמין</Text>
              <Text style={[styles.headerCell, styles.cellNumber]}>מוקצה</Text>
              <Text style={[styles.headerCell, styles.cellNumber]}>ימ״ח</Text>
              <Text style={[styles.headerCell, styles.cellName]}>ציוד</Text>
            </View>

            {/* Table Body */}
            <View style={styles.tableBody}>
              {stocks.map((stock, index) => renderTableRow(stock, index))}
            </View>

            {/* Table Footer */}
            <View style={styles.tableFooter}>
              <View style={styles.cellExpand} />
              <View style={styles.cellStatus} />
              <Text style={[styles.footerValue, styles.cellNumber, { color: '#10B981' }]}>
                {totalAvailable}
              </Text>
              <Text style={[styles.footerValue, styles.cellNumber]}>
                {totalAssigned}
              </Text>
              <Text style={[styles.footerValue, styles.cellNumber]}>
                {totalYamach}
              </Text>
              <Text style={[styles.footerLabel, styles.cellName]}>סה״כ</Text>
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
    backgroundColor: Colors.vetement,
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
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  legendText: {
    fontSize: 12,
    color: '#64748B',
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
    fontSize: 12,
    fontWeight: '600',
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

  // Cell styles
  cellExpand: {
    width: 28,
    alignItems: 'center',
  },

  cellStatus: {
    width: 50,
    alignItems: 'center',
  },

  cellNumber: {
    width: 55,
    alignItems: 'center',
  },

  cellName: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 8,
  },

  cellValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  equipmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    textAlign: 'right',
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Table Footer
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },

  footerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },

  footerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
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

  subCellBold: {
    fontWeight: '600',
    color: '#1E293B',
  },

  subCellPercent: {
    width: 45,
  },

  subCellQty: {
    width: 50,
  },

  subCellSoldiers: {
    width: 60,
  },

  subCellCompany: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 8,
    fontWeight: '500',
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

export default ClothingStockScreen;