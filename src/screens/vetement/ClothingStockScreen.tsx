/**
 * ClothingStockScreen.tsx - Tableau de stock par compagnie
 * Affiche la distribution des équipements par compagnie et les quantités restantes
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
      return { color: Colors.textLight, text: 'אין ימ״ח מוגדר', icon: 'help-circle' };
    }

    const percentage = (stock.available / stock.yamach) * 100;

    if (percentage > 50) {
      return { color: Colors.success, text: 'מלאי תקין', icon: 'checkmark-circle' };
    } else if (percentage > 20) {
      return { color: Colors.warning, text: 'מלאי נמוך', icon: 'warning' };
    } else {
      return { color: Colors.danger, text: 'מלאי קריטי', icon: 'alert-circle' };
    }
  };

  const renderStockItem = (stock: EquipmentStock) => {
    const isExpanded = expandedItems.has(stock.equipmentId);
    const status = getStockStatus(stock);

    return (
      <View key={stock.equipmentId} style={styles.stockCard}>
        <TouchableOpacity
          style={styles.stockHeader}
          onPress={() => toggleExpanded(stock.equipmentId)}
          activeOpacity={0.7}
        >
          <View style={styles.stockHeaderLeft}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-back'}
              size={20}
              color={Colors.textSecondary}
            />
          </View>

          <View style={styles.stockHeaderContent}>
            <Text style={styles.stockName}>{stock.equipmentName}</Text>
            <View style={styles.stockMetaRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                <Ionicons name={status.icon as any} size={12} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
              </View>
            </View>
          </View>

          <View style={styles.stockHeaderRight}>
            <Text style={styles.stockTotal}>{stock.totalAssigned}</Text>
            <Text style={styles.stockTotalLabel}>מוקצה</Text>
            {stock.yamach > 0 && (
              <>
                <Text style={[styles.stockAvailable, { color: status.color }]}>
                  {stock.available}
                </Text>
                <Text style={styles.stockAvailableLabel}>זמין</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.stockDetails}>
            <View style={styles.stockSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>{stock.yamach || 'לא הוגדר'}</Text>
                <Text style={styles.summaryLabel}>ימ״ח כולל</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>{stock.totalAssigned}</Text>
                <Text style={styles.summaryLabel}>סה״כ מוקצה</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryValue, { color: status.color }]}>
                  {stock.available}
                </Text>
                <Text style={styles.summaryLabel}>זמין עכשיו</Text>
              </View>
            </View>

            {stock.byCompany.length > 0 ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.companyTitle}>פילוח לפי פלוגות</Text>
                <View style={styles.companyList}>
                  {stock.byCompany.map((company, index) => (
                    <View
                      key={company.company}
                      style={[
                        styles.companyRow,
                        index < stock.byCompany.length - 1 && styles.companyRowBorder,
                      ]}
                    >
                      <View style={styles.companyLeft}>
                        <View style={styles.companyBar}>
                          <View
                            style={[
                              styles.companyBarFill,
                              {
                                width: `${(company.quantity / stock.totalAssigned) * 100}%`,
                                backgroundColor: Colors.vetement,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={styles.companyCenter}>
                        <Text style={styles.companyName}>{company.company}</Text>
                        <Text style={styles.companySoldiers}>
                          {company.soldiers} חיילים
                        </Text>
                      </View>
                      <View style={styles.companyRight}>
                        <Text style={styles.companyQuantity}>{company.quantity}</Text>
                        <Text style={styles.companyPercentage}>
                          {Math.round((company.quantity / stock.totalAssigned) * 100)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.divider} />
                <View style={styles.emptyCompanies}>
                  <Ionicons name="information-circle-outline" size={32} color={Colors.info} />
                  <Text style={styles.emptyCompaniesText}>
                    לא הוקצה ציוד זה לאף פלוגה
                  </Text>
                </View>
              </>
            )}
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>מלאי ביגוד</Text>
          <Text style={styles.headerSubtitle}>פילוח לפי פלוגות</Text>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadStocks}>
          <Ionicons name="refresh" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
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
        {/* Summary Cards */}
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.info }]}>
            <Ionicons name="albums" size={24} color={Colors.info} />
            <Text style={styles.summaryCardValue}>{totalYamach}</Text>
            <Text style={styles.summaryCardLabel}>סה״כ ימ״ח</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.warning }]}>
            <Ionicons name="people" size={24} color={Colors.warning} />
            <Text style={styles.summaryCardValue}>{totalAssigned}</Text>
            <Text style={styles.summaryCardLabel}>מוקצה</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            <Text style={styles.summaryCardValue}>{totalAvailable}</Text>
            <Text style={styles.summaryCardLabel}>זמין</Text>
          </View>
        </View>

        {/* Stock List */}
        <Text style={styles.sectionTitle}>ציוד ({stocks.length})</Text>

        {stocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>אין ציוד במערכת</Text>
            <Text style={styles.emptySubtitle}>הוסף ציוד דרך ניהול הציוד</Text>
          </View>
        ) : (
          <View style={styles.stockList}>
            {stocks.map(renderStockItem)}
          </View>
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

  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Header
  header: {
    backgroundColor: Colors.vetement,
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
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    textAlign: 'right',
  },

  // Summary Cards
  summaryCards: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: -Spacing.xl,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderLeftWidth: 4,
    ...Shadows.small,
  },

  summaryCardValue: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.xs,
  },

  summaryCardLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Stock List
  stockList: {
    gap: Spacing.md,
  },

  stockCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },

  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  stockHeaderLeft: {
    marginLeft: Spacing.sm,
  },

  stockHeaderContent: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: Spacing.md,
  },

  stockName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  stockMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },

  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },

  stockHeaderRight: {
    alignItems: 'center',
    minWidth: 60,
  },

  stockTotal: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },

  stockTotalLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  stockAvailable: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },

  stockAvailableLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Stock Details
  stockDetails: {
    backgroundColor: Colors.backgroundInput,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },

  stockSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
  },

  summaryRow: {
    alignItems: 'center',
  },

  summaryValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },

  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },

  companyTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },

  companyList: {
    gap: Spacing.sm,
  },

  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },

  companyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  companyLeft: {
    width: 60,
    marginLeft: Spacing.md,
  },

  companyBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },

  companyBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },

  companyCenter: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: Spacing.md,
  },

  companyName: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },

  companySoldiers: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  companyRight: {
    alignItems: 'center',
    minWidth: 50,
  },

  companyQuantity: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },

  companyPercentage: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  emptyCompanies: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },

  emptyCompaniesText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
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
  },
});

export default ClothingStockScreen;
