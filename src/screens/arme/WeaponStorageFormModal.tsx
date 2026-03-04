/**
 * WeaponStorageFormModal.tsx
 * Form modal shown before confirming אפסון.
 * Captures: planned return date + optional גורם מאפסן (if different from owner).
 * Uses a dependency-free custom date spinner (no native modules needed).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { WeaponInventoryItem, Soldier } from '../../types';
import { useSoldierSearch } from '../../hooks/useSoldierSearch';

export interface StorageFormResult {
  plannedReturnDate: Date;
  depositor: Soldier | null;
}

interface Props {
  visible: boolean;
  weapons: WeaponInventoryItem[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (data: StorageFormResult) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const daysInMonth = (month: number, year: number) =>
  new Date(year, month, 0).getDate();

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDate = (day: number, month: number, year: number) =>
  `${pad2(day)}/${pad2(month)}/${year}`;

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

// ── DateSpinner: a single-field (day / month / year) +/- spinner ─────────────

interface DateSpinnerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

const DateSpinner: React.FC<DateSpinnerProps> = ({ label, value, min, max, onChange }) => (
  <View style={spinnerStyles.container}>
    <Text style={spinnerStyles.label}>{label}</Text>
    <TouchableOpacity
      style={spinnerStyles.btn}
      onPress={() => onChange(value >= max ? min : value + 1)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="chevron-up" size={18} color={Colors.arme} />
    </TouchableOpacity>
    <Text style={spinnerStyles.value}>{pad2(value)}</Text>
    <TouchableOpacity
      style={spinnerStyles.btn}
      onPress={() => onChange(value <= min ? max : value - 1)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="chevron-down" size={18} color={Colors.arme} />
    </TouchableOpacity>
  </View>
);

const spinnerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: FontSize.xs,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  btn: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    marginVertical: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 36,
    textAlign: 'center',
  },
});

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_DAYS_AHEAD = 30;

const WeaponStorageFormModal: React.FC<Props> = ({
  visible,
  weapons,
  loading = false,
  onClose,
  onConfirm,
}) => {
  const initDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + DEFAULT_DAYS_AHEAD);
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
  };

  const [dateState, setDateState] = useState(initDate);
  const [isDifferentDepositor, setIsDifferentDepositor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepositor, setSelectedDepositor] = useState<Soldier | null>(null);

  const { soldiers, loading: searchLoading, search, reset } = useSoldierSearch();

  // Reset on open
  useEffect(() => {
    if (visible) {
      setDateState(initDate());
      setIsDifferentDepositor(false);
      setSearchQuery('');
      setSelectedDepositor(null);
      reset();
    }
  }, [visible]);

  // Keep day in valid range when month/year changes
  const setDay = (v: number) =>
    setDateState((prev) => ({ ...prev, day: clamp(v, 1, daysInMonth(prev.month, prev.year)) }));
  const setMonth = (v: number) =>
    setDateState((prev) => {
      const maxDay = daysInMonth(v, prev.year);
      return { day: clamp(prev.day, 1, maxDay), month: v, year: prev.year };
    });
  const setYear = (v: number) =>
    setDateState((prev) => {
      const maxDay = daysInMonth(prev.month, v);
      return { day: clamp(prev.day, 1, maxDay), month: prev.month, year: v };
    });

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.length >= 2) search(query);
      else reset();
    },
    [search, reset]
  );

  const handleSelectDepositor = (soldier: Soldier) => {
    setSelectedDepositor(soldier);
    setSearchQuery('');
    reset();
  };

  const handleToggleDepositor = (value: boolean) => {
    setIsDifferentDepositor(value);
    if (!value) {
      setSelectedDepositor(null);
      setSearchQuery('');
      reset();
    }
  };

  const isConfirmDisabled = loading || (isDifferentDepositor && !selectedDepositor);

  const handleConfirm = () => {
    const { day, month, year } = dateState;
    onConfirm({
      plannedReturnDate: new Date(year, month - 1, day),
      depositor: isDifferentDepositor ? selectedDepositor : null,
    });
  };

  const today = new Date();
  const currentYear = today.getFullYear();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={loading}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>פרטי האפסון</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Selected weapons */}
            <Text style={styles.sectionTitle}>נשקים לאפסון ({weapons.length})</Text>
            {weapons.map((w) => (
              <View key={w.id} style={styles.weaponRow}>
                <Ionicons name="shield-outline" size={15} color={Colors.arme} />
                <Text style={styles.weaponName}>{w.category}</Text>
                <Text style={styles.weaponSerial}>{w.serialNumber}</Text>
              </View>
            ))}

            {/* Date spinner */}
            <Text style={styles.sectionTitle}>תאריך מתוכנן לחזרת החייל</Text>
            <View style={styles.dateCard}>
              <Text style={styles.dateSummary}>
                {formatDate(dateState.day, dateState.month, dateState.year)}
              </Text>
              <View style={styles.spinnersRow}>
                <DateSpinner
                  label="יום"
                  value={dateState.day}
                  min={1}
                  max={daysInMonth(dateState.month, dateState.year)}
                  onChange={setDay}
                />
                <View style={styles.spinnerDivider} />
                <DateSpinner
                  label="חודש"
                  value={dateState.month}
                  min={1}
                  max={12}
                  onChange={setMonth}
                />
                <View style={styles.spinnerDivider} />
                <DateSpinner
                  label="שנה"
                  value={dateState.year}
                  min={currentYear}
                  max={currentYear + 5}
                  onChange={setYear}
                />
              </View>
            </View>

            {/* Depositor toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>המאפסן שונה מהחייל</Text>
              <Switch
                value={isDifferentDepositor}
                onValueChange={handleToggleDepositor}
                trackColor={{ false: '#CBD5E1', true: Colors.arme }}
                thumbColor="#fff"
              />
            </View>

            {/* Depositor search / selected card */}
            {isDifferentDepositor && (
              <View style={styles.depositorSection}>
                {selectedDepositor ? (
                  <View style={styles.selectedCard}>
                    <View style={styles.selectedInfo}>
                      <Text style={styles.selectedName}>{selectedDepositor.name}</Text>
                      <Text style={styles.selectedDetail}>
                        מ.א: {selectedDepositor.personalNumber}
                        {selectedDepositor.company ? `  ·  ${selectedDepositor.company}` : ''}
                      </Text>
                      {selectedDepositor.phone ? (
                        <Text style={styles.selectedDetail}>טל': {selectedDepositor.phone}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedDepositor(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={handleSearchChange}
                      placeholder="חפש לפי שם או מספר אישי..."
                      placeholderTextColor="#94A3B8"
                      textAlign="right"
                      autoCorrect={false}
                    />
                    {searchLoading && (
                      <ActivityIndicator
                        size="small"
                        color={Colors.arme}
                        style={{ marginVertical: 8 }}
                      />
                    )}
                    {soldiers.slice(0, 6).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.searchResult}
                        onPress={() => handleSelectDepositor(s)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.resultName}>{s.name}</Text>
                        <Text style={styles.resultDetail}>
                          {s.personalNumber}
                          {s.company ? `  ·  ${s.company}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {!searchLoading && searchQuery.length >= 2 && soldiers.length === 0 && (
                      <Text style={styles.noResults}>לא נמצאו חיילים</Text>
                    )}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, isConfirmDisabled && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={isConfirmDisabled}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="archive" size={18} color="#fff" />
                  <Text style={styles.confirmText}>אפסן והפק מסמך</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.arme,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  body: { flexGrow: 0 },
  bodyContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  weaponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weaponName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    textAlign: 'right',
  },
  weaponSerial: {
    fontSize: FontSize.sm,
    color: Colors.arme,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // Date card
  dateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    alignItems: 'center',
  },
  dateSummary: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.arme,
    marginBottom: Spacing.md,
    letterSpacing: 1,
  },
  spinnersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  spinnerDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginTop: Spacing.lg,
  },
  toggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#1E40AF',
  },
  // Depositor
  depositorSection: {
    marginTop: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  selectedInfo: { flex: 1, alignItems: 'flex-end' },
  selectedName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#1E293B',
  },
  selectedDetail: {
    fontSize: FontSize.sm,
    color: '#64748B',
    marginTop: 2,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    fontSize: FontSize.sm,
    color: '#1E293B',
    marginBottom: 4,
  },
  searchResult: {
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'flex-end',
  },
  resultName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#1E293B',
  },
  resultDetail: {
    fontSize: FontSize.xs,
    color: '#64748B',
    marginTop: 2,
  },
  noResults: {
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.arme,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#fff',
  },
});

export default WeaponStorageFormModal;
