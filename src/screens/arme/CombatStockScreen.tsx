/**
 * CombatStockScreen.tsx - Tableau de stock d'équipements de combat
 * Tableau avec colonne fixe et scroll horizontal/vertical fluide.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/Colors';
import { combatStockService, EquipmentStock } from '../../services/combatStockService';

const FIXED_COLUMN_WIDTH = 110;
const DATA_CELL_WIDTH = 46;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;

const COLUMNS = [
  { key: 'standard', label: 'תקן', width: DATA_CELL_WIDTH },
  { key: 'shelf', label: 'מדף', width: DATA_CELL_WIDTH },
  { key: 'loans', label: 'השאלות', width: DATA_CELL_WIDTH + 10 },
  { key: 'compA', label: "א'", width: DATA_CELL_WIDTH - 6 },
  { key: 'compB', label: "ב'", width: DATA_CELL_WIDTH - 6 },
  { key: 'compC', label: "ג'", width: DATA_CELL_WIDTH - 6 },
  { key: 'compD', label: "ד'", width: DATA_CELL_WIDTH - 6 },
  { key: 'hq', label: 'מפקדה', width: DATA_CELL_WIDTH + 10 },
  { key: 'stored', label: 'אפסון', width: DATA_CELL_WIDTH + 10 },
  { key: 'total', label: 'סה"כ', width: DATA_CELL_WIDTH },
];

const CombatStockScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stocks, setStocks] = useState<EquipmentStock[]>([]);

  // Refs pour la synchronisation verticale
  const namesScrollRef = useRef<ScrollView>(null);
  const dataScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const data = await combatStockService.getAllEquipmentStocks();

      // DEBUG: Vérifier les doublons
      console.log('📊 [CombatStock] Total stocks reçus:', data.length);
      const nameCount = new Map<string, number>();
      data.forEach(stock => {
        const count = nameCount.get(stock.equipmentName) || 0;
        nameCount.set(stock.equipmentName, count + 1);
      });
      nameCount.forEach((count, name) => {
        if (count > 1) {
          console.warn(`⚠️ [CombatStock] DOUBLON: "${name}" apparaît ${count} fois`);
        }
      });

      setStocks(data);
    } catch (error) {
      console.error('Error loading stocks:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את נתוני המלאי');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getCompanyValue = (stock: EquipmentStock, companyName: string): number => {
    const company = stock.byCompany.find(c => c.company === companyName);
    return company ? (company.issued + company.stored) : 0;
  };

  const getRowValues = (stock: EquipmentStock) => {
    const headquarters = getCompanyValue(stock, 'מפקדה/אגמ') + getCompanyValue(stock, 'מפקדה') + getCompanyValue(stock, 'ניוד');
    return {
      standard: '-',
      shelf: stock.available,
      loans: stock.issued,
      compA: getCompanyValue(stock, 'פלוגה א'),
      compB: getCompanyValue(stock, 'פלוגה ב'),
      compC: getCompanyValue(stock, 'פלוגה ג'),
      compD: getCompanyValue(stock, 'פלוגה ד'),
      hq: headquarters,
      stored: stock.stored,
      total: stock.total,
    };
  };

  const getValueColor = (key: string, value: number | string) => {
    if (value === '-' || value === 0) return '#94A3B8';
    switch (key) {
      case 'shelf': return '#2563EB';
      case 'loans': return '#059669';
      case 'stored': return '#D97706';
      case 'total': return '#1E293B';
      default: return '#7C3AED'; // Compagnies
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען מלאי...</Text>
      </View>
    );
  }

  const totalContentWidth = COLUMNS.reduce((sum, col) => sum + col.width, 0);

  return (
    <View style={styles.container}>
      {/* Header compact */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>טבלת מלאי ({stocks.length})</Text>
        <TouchableOpacity style={styles.headerButton} onPress={loadStocks}>
          <Ionicons name="refresh" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {stocks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>אין ציוד במערכת</Text>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          {/* 1. Zone Fixe (Noms) */}
          <View style={styles.leftColumn}>
            <View style={styles.headerCellFix}>
              <Text style={styles.headerText}>ציוד</Text>
            </View>
            <ScrollView
              ref={namesScrollRef}
              style={styles.verticalList}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false} // Désactivé, scrollé via dataScrollRef
            >
              {stocks.map((stock, index) => (
                <View key={index} style={[styles.cellFix, index % 2 === 0 && styles.rowEven]}>
                  <Text style={styles.equipmentName} numberOfLines={1}>{stock.equipmentName}</Text>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>

          {/* 2. Zone Scrollable (Données) */}
          <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={true}>
            <View style={{ width: totalContentWidth }}>
              {/* Header des données */}
              <View style={styles.dataHeaderRow}>
                {COLUMNS.map((col) => (
                  <View key={col.key} style={[styles.headerCellData, { width: col.width }]}>
                    <Text style={styles.headerTextSmall}>{col.label}</Text>
                  </View>
                ))}
              </View>

              {/* Corps des données (Scroll Vertical) */}
              <ScrollView
                ref={dataScrollRef}
                style={styles.verticalList}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  namesScrollRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
                }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); loadStocks(); }}
                    colors={[Colors.arme]}
                  />
                }
              >
                {stocks.map((stock, index) => {
                  const values = getRowValues(stock);
                  return (
                    <View key={index} style={[styles.dataRow, index % 2 === 0 && styles.rowEven]}>
                      {COLUMNS.map((col) => (
                        <View key={col.key} style={[styles.dataCell, { width: col.width }, col.key === 'total' && styles.totalCell]}>
                          <Text style={[styles.cellValue, { color: getValueColor(col.key, values[col.key as keyof typeof values]) }, col.key === 'total' && styles.totalValue]}>
                            {values[col.key as keyof typeof values]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#64748B' },
  header: {
    backgroundColor: Colors.arme,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  tableContainer: { flex: 1, flexDirection: 'row' },
  leftColumn: { width: FIXED_COLUMN_WIDTH, borderRightWidth: 1, borderRightColor: '#E2E8F0', backgroundColor: '#FFF', zIndex: 10 },
  verticalList: { flex: 1 },
  headerCellFix: { height: HEADER_HEIGHT, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerCellData: { height: HEADER_HEIGHT, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155', borderRightWidth: 1, borderRightColor: '#334155' },
  headerText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  headerTextSmall: { color: '#E2E8F0', fontWeight: '600', fontSize: 11 },
  cellFix: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  equipmentName: { fontSize: 12, fontWeight: '600', color: '#1E293B', textAlign: 'right' },
  dataHeaderRow: { flexDirection: 'row', height: HEADER_HEIGHT },
  dataRow: { flexDirection: 'row', height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  dataCell: { height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  rowEven: { backgroundColor: '#F8FAFC' },
  cellValue: { fontSize: 13, fontWeight: '600' },
  totalCell: { backgroundColor: '#F1F5F9' },
  totalValue: { fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 12, color: '#94A3B8' },
});

export default CombatStockScreen;
