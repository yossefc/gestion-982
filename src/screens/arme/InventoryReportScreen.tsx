import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useCombatEquipment } from '../../contexts/DataContext';
import { getAllEquipmentStocks, EquipmentStock } from '../../services/combatStockService';
import { printInventoryReport } from '../../services/inventoryReportService';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';

const InventoryReportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { equipment } = useCombatEquipment();

  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [stocks, setStocks] = useState<EquipmentStock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllEquipmentStocks();
      // Include weapons (tracked by serial in weapons_inventory) AND
      // any combat gear that requires a מסט"ב (requiresSerial / requiresManualSerial)
      const serialGearIds = new Set(
        equipment
          .filter(e => e.requiresSerial || e.requiresManualSerial)
          .map(e => e.id)
      );
      setStocks(
        data.filter(s =>
          (s.equipmentId.startsWith('WEAPON_') || serialGearIds.has(s.equipmentId)) &&
          s.total > 0
        )
      );
    } catch (err) {
      console.error('[InventoryReport] Failed to load stocks:', err);
      setError('לא ניתן לטעון את נתוני המלאי');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (stocks.length === 0) {
      Alert.alert('שגיאה', 'אין נתוני מלאי להדפסה');
      return;
    }
    setPrinting(true);
    try {
      await printInventoryReport({
        stocks,
        operatorName: user?.name || '',
        operatorPersonalNumber: user?.personalNumber,
        operatorRank: user?.rank,
        operatorSignature: user?.signature,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('[InventoryReport] Print error:', err);
      Alert.alert('שגיאה', 'שגיאה בהפקת הדוח');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>ספירת מחסן</Text>
          <Text style={styles.headerSubtitle}>ארמו"ן - פתיחה / סגירה</Text>
        </View>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>📋</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Loading state */}
        {loading && (
          <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={Colors.arme} />
            <Text style={styles.loadingText}>טוען נתוני מלאי...</Text>
          </View>
        )}

        {/* Error state */}
        {!loading && error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadStocks}>
              <Text style={styles.retryButtonText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stock preview table */}
        {!loading && !error && stocks.length > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>תצוגה מקדימה — {stocks.length} פריטים עם מסט"ב</Text>
            {stocks.map((stock, i) => (
              <View
                key={stock.equipmentId}
                style={[styles.previewRow, i % 2 === 0 && styles.previewRowAlt]}
              >
                <Text style={styles.previewName}>{stock.equipmentName}</Text>
                <View style={styles.previewValues}>
                  <Text style={styles.previewValue}>תקן: {stock.total}</Text>
                  <Text style={styles.previewValue}>מצאי: {stock.available}</Text>
                  <Text style={styles.previewValue}>אפסון: {stock.stored}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No data state */}
        {!loading && !error && stocks.length === 0 && (
          <View style={styles.centerCard}>
            <Text style={styles.emptyText}>לא נמצאו פריטים עם מסט"ב במלאי</Text>
          </View>
        )}

        {/* Print button */}
        {!loading && !error && (
          <TouchableOpacity
            style={[styles.printButton, (printing || stocks.length === 0) && styles.printButtonDisabled]}
            onPress={handlePrint}
            disabled={printing || stocks.length === 0}
          >
            {printing ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <>
                <Text style={styles.printButtonIcon}>🖨️</Text>
                <Text style={styles.printButtonText}>הדפסת דוח ספירת מחסן</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Info note */}
        {!loading && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              הדוח מופק בפורמט A4 לאורך ומכיל את פרטי ומ.א. המנפק, תאריך ושעה אוטומטיים.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.arme,
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.textWhite,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  centerCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#FECACA',
    ...Shadows.small,
  },
  errorText: {
    fontSize: FontSize.base,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.arme,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  retryButtonText: {
    color: Colors.textWhite,
    fontWeight: 'bold',
    fontSize: FontSize.sm,
  },
  previewCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  previewTitle: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  previewRowAlt: {
    backgroundColor: Colors.background,
  },
  previewName: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
  },
  previewValues: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  previewValue: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  printButton: {
    backgroundColor: Colors.arme,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  printButtonDisabled: {
    opacity: 0.6,
  },
  printButtonIcon: {
    fontSize: 20,
  },
  printButtonText: {
    color: Colors.textWhite,
    fontSize: FontSize.base,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: Spacing.md,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: '#1D4ED8',
    textAlign: 'right',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
});

export default InventoryReportScreen;
