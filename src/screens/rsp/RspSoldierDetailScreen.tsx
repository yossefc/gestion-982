/**
 * RspSoldierDetailScreen.tsx
 * Tout le détail d'un soldat en un seul écran : armes, vêtements, ציוד RSP
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { RspSoldierWithHoldings } from '../../services/rspDashboardService';

const RspSoldierDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();

  const data: RspSoldierWithHoldings = useMemo(() => {
    return JSON.parse(route.params?.soldierData || '{}');
  }, [route.params?.soldierData]);

  const soldier = data.soldier;
  if (!soldier) return null;

  const hasCombat = data.combatHoldings?.length > 0;
  const hasClothing = data.clothingHoldings?.length > 0;
  const hasRsp = data.rspHoldings?.length > 0;
  const hasAnything = hasCombat || hasClothing || hasRsp;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{soldier.name}</Text>
          <Text style={styles.headerNumber}>{soldier.personalNumber}</Text>
        </View>
        <View style={styles.headerCompanyBadge}>
          <Text style={styles.headerCompanyText}>{soldier.company}</Text>
        </View>
      </View>

      {/* Badges résumé */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBadge, styles.summaryBadgeCombat]}>
          <Ionicons name="shield" size={18} color={Colors.arme} />
          <Text style={styles.summaryBadgeValue}>{data.totalCombatItems}</Text>
          <Text style={styles.summaryBadgeLabel}>נשק</Text>
        </View>
        <View style={[styles.summaryBadge, styles.summaryBadgeClothing]}>
          <Ionicons name="shirt" size={18} color={Colors.vetement} />
          <Text style={styles.summaryBadgeValue}>{data.totalClothingItems}</Text>
          <Text style={styles.summaryBadgeLabel}>אפסנאות</Text>
        </View>
        <View style={[styles.summaryBadge, styles.summaryBadgeRsp]}>
          <Ionicons name="cube" size={18} color={Colors.warning} />
          <Text style={styles.summaryBadgeValue}>{data.totalRspItems}</Text>
          <Text style={styles.summaryBadgeLabel}>רס"פ</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* --- SECTION: ARMES --- */}
        {hasCombat && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderCombat]}>
              <Ionicons name="shield" size={20} color={Colors.textWhite} />
              <Text style={styles.sectionHeaderTitle}>ציוד לחימה</Text>
              <View style={styles.sectionHeaderCount}>
                <Text style={styles.sectionHeaderCountText}>{data.totalCombatItems}</Text>
              </View>
            </View>
            {data.combatHoldings.map((item, idx) => (
              <View key={`combat-${idx}`} style={styles.equipmentRow}>
                <View style={styles.equipmentRowLeft}>
                  <View style={[styles.equipDot, { backgroundColor: Colors.arme }]} />
                  <Text style={styles.equipName}>{item.equipmentName}</Text>
                </View>
                <Text style={styles.equipQty}>x{item.quantity}</Text>
              </View>
            ))}
          </View>
        )}

        {/* --- SECTION: VÊTEMENTS --- */}
        {hasClothing && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderClothing]}>
              <Ionicons name="shirt" size={20} color={Colors.textWhite} />
              <Text style={styles.sectionHeaderTitle}>אפסנאות</Text>
              <View style={styles.sectionHeaderCount}>
                <Text style={styles.sectionHeaderCountText}>{data.totalClothingItems}</Text>
              </View>
            </View>
            {data.clothingHoldings.map((item, idx) => (
              <View key={`clothing-${idx}`} style={styles.equipmentRow}>
                <View style={styles.equipmentRowLeft}>
                  <View style={[styles.equipDot, { backgroundColor: Colors.vetement }]} />
                  <Text style={styles.equipName}>{item.equipmentName}</Text>
                </View>
                <Text style={styles.equipQty}>x{item.quantity}</Text>
              </View>
            ))}
          </View>
        )}

        {/* --- SECTION: ציוד RSP --- */}
        {hasRsp && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderRsp]}>
              <Ionicons name="cube" size={20} color={Colors.textWhite} />
              <Text style={styles.sectionHeaderTitle}>ציוד רס"פ</Text>
              <View style={styles.sectionHeaderCount}>
                <Text style={styles.sectionHeaderCountText}>{data.totalRspItems}</Text>
              </View>
            </View>
            {data.rspHoldings.map((item, idx) => (
              <View key={`rsp-${idx}`} style={styles.equipmentRow}>
                <View style={styles.equipmentRowLeft}>
                  <View style={[styles.equipDot, { backgroundColor: Colors.warning }]} />
                  <Text style={styles.equipName}>{item.equipmentName}</Text>
                </View>
                <View style={styles.rspRowRight}>
                  <Text style={styles.equipQty}>x{item.quantity}</Text>
                  <View style={[
                    styles.statusPill,
                    item.status === 'signed' ? styles.statusPillSigned :
                      item.status === 'credited' ? styles.statusPillCredited :
                        styles.statusPillGap
                  ]}>
                    <Text style={styles.statusPillText}>
                      {item.status === 'signed' ? 'הוחתם' :
                        item.status === 'credited' ? 'זוכה' : 'פער'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* --- RIEN --- */}
        {!hasAnything && (
          <View style={styles.emptySection}>
            <Ionicons name="information-circle-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptySectionTitle}>לחייל זה אין ציוד רשום</Text>
            <Text style={styles.emptySectionText}>לא נמצא ציוד קרבי, אפסנאות ולא ציוד רס"פ</Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backButton: {
    width: 44, height: 44, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1, alignItems: 'flex-end', marginRight: Spacing.md },
  headerName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textWhite, textAlign: 'right' },
  headerNumber: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.75)', marginTop: Spacing.xs },
  headerCompanyBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  headerCompanyText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textWhite },

  // Summary badges
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryBadge: {
    flex: 1, marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    alignItems: 'center', ...Shadows.small,
  },
  summaryBadgeCombat: { backgroundColor: Colors.armeLight },
  summaryBadgeClothing: { backgroundColor: Colors.vetementLight },
  summaryBadgeRsp: { backgroundColor: Colors.warningLight },
  summaryBadgeValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  summaryBadgeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Scroll
  scrollContent: { flex: 1 },

  // Sections
  section: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  sectionHeaderCombat: { backgroundColor: Colors.arme },
  sectionHeaderClothing: { backgroundColor: Colors.vetement },
  sectionHeaderRsp: { backgroundColor: Colors.warning },
  sectionHeaderTitle: { flex: 1, fontSize: FontSize.base, fontWeight: '600', color: Colors.textWhite, textAlign: 'right' },
  sectionHeaderCount: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 2, paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  sectionHeaderCountText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textWhite },

  // Equipment rows
  equipmentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs, ...Shadows.xs,
  },
  equipmentRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.sm },
  equipDot: { width: 8, height: 8, borderRadius: 4 },
  equipName: { flex: 1, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  equipQty: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textSecondary },

  // RSP row (avec status)
  rspRowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusPill: { paddingVertical: 2, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.xs },
  statusPillSigned: { backgroundColor: Colors.successLight },
  statusPillCredited: { backgroundColor: Colors.infoLight },
  statusPillGap: { backgroundColor: Colors.warningLight },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text },

  // Empty
  emptySection: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  emptySectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginTop: Spacing.lg, textAlign: 'center' },
  emptySectionText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },

  bottomPadding: { height: 40 },
});

export default RspSoldierDetailScreen;
