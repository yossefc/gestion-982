/**
 * UnprintedSignaturesScreen - הדפסת טפסים
 * רשימת כל החתמות עם אפשרות הדפסה מרובה
 * שמות באדום = לא הודפסו מעולם
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { assignmentService } from '../../services/assignmentService';
import { Assignment } from '../../types';
import { generateAndPrintMultiPDF, PrintAssignmentData } from '../../utils/printUtils';
import { AppModal } from '../../components';

const UnprintedSignaturesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [search, setSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<any>('info');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  const showModal = (type: any, title: string, message: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
    setModalVisible(true);
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await assignmentService.getAssignmentsByType('combat');
      // Garder seulement les attributions valides (avec items et signature)
      const valid = data.filter(
        (a: Assignment) => a.items && a.items.length > 0 && a.signature
      );
      setAssignments(valid);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('[UnprintedSignatures] Error loading:', error);
      showModal('error', 'שגיאה', 'לא ניתן לטעון את רשימת הטפסים');
    } finally {
      setLoading(false);
    }
  };

  // Filtrage par recherche (nom ou numéro personnel)
  const filteredAssignments = useMemo(() => {
    if (!search.trim()) return assignments;
    const q = search.trim().toLowerCase();
    return assignments.filter(
      a =>
        a.soldierName.toLowerCase().includes(q) ||
        a.soldierPersonalNumber.toLowerCase().includes(q)
    );
  }, [assignments, search]);

  const neverPrintedCount = useMemo(
    () => assignments.filter(a => !a.isPrinted).length,
    [assignments]
  );

  const allFilteredSelected =
    filteredAssignments.length > 0 &&
    filteredAssignments.every(a => selectedIds.has(a.id!));

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredAssignments.forEach(a => next.delete(a.id!));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredAssignments.forEach(a => next.add(a.id!));
        return next;
      });
    }
  };

  const handlePrintSelected = async () => {
    if (selectedIds.size === 0) return;
    setPrinting(true);
    try {
      const selected = assignments.filter(a => selectedIds.has(a.id!));

      // Construire les données d'impression pour tous les formulaires sélectionnés
      const printDataList: PrintAssignmentData[] = selected.map(assignment => ({
        soldierName: assignment.soldierName,
        soldierPersonalNumber: assignment.soldierPersonalNumber,
        soldierPhone: assignment.soldierPhone,
        soldierCompany: assignment.soldierCompany,
        items: assignment.items || [],
        signature: assignment.signature || '',
        operatorSignature: undefined,
        operatorName: assignment.assignedByName || assignment.assignedByEmail || '',
        timestamp:
          assignment.timestamp instanceof Date
            ? assignment.timestamp
            : new Date(assignment.timestamp),
        assignmentId: assignment.id,
      }));

      // Un seul appel Print.printAsync avec toutes les pages — fonctionne sur iOS et Android
      await generateAndPrintMultiPDF(printDataList);

      // Marquer comme imprimés dans Firestore
      const idsToMark = Array.from(selectedIds);
      await assignmentService.markAssignmentsAsPrinted(idsToMark);

      // Mettre à jour l'état local sans rechargement
      setAssignments(prev =>
        prev.map(a => (selectedIds.has(a.id!) ? { ...a, isPrinted: true } : a))
      );
      setSelectedIds(new Set());

      showModal('success', 'הצלחה!', `${idsToMark.length} טפסים נשלחו להדפסה בהצלחה.`);
    } catch (error) {
      console.error('[UnprintedSignatures] Print error:', error);
      showModal('error', 'שגיאה', 'אירעה שגיאה במהלך ההדפסה.');
    } finally {
      setPrinting(false);
    }
  };

  const renderItem = ({ item }: { item: Assignment }) => {
    const isSelected = selectedIds.has(item.id!);
    const neverPrinted = !item.isPrinted;
    const date =
      item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp);
    const dateStr = date.toLocaleDateString('he-IL');
    const timeStr = date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => toggleSelection(item.id!)}
        activeOpacity={0.7}
      >
        {/* Checkbox carré */}
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && (
            <Ionicons name="checkmark" size={14} color={Colors.textWhite} />
          )}
        </View>

        {/* Contenu */}
        <View style={styles.rowContent}>
          {/* Ligne haute: nom + badge "לא הודפס" */}
          <View style={styles.rowTop}>
            <Text
              style={[styles.soldierName, neverPrinted && styles.soldierNameUnprinted]}
              numberOfLines={1}
            >
              {item.soldierName}
            </Text>
            {neverPrinted && (
              <View style={styles.unprintedBadge}>
                <Text style={styles.unprintedBadgeText}>לא הודפס</Text>
              </View>
            )}
          </View>

          {/* Ligne basse: numéro personnel + date/heure */}
          <View style={styles.rowBottom}>
            <Text style={styles.personalNumber}>
              מ"א: {item.soldierPersonalNumber}
            </Text>
            <Text style={styles.dateText}>
              {dateStr}{'  '}{timeStr}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען טפסים...</Text>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>הדפסת טפסים</Text>
          <Text style={styles.headerSubtitle}>
            {assignments.length} טפסים • {neverPrintedCount} לא הודפסו
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש שם חייל / מספר אישי..."
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Barre d'action: compteur + "בחר הכל" */}
      <View style={styles.actionBar}>
        <Text style={styles.actionBarCount}>
          {filteredAssignments.length} תוצאות
          {selectedIds.size > 0 && ` • ${selectedIds.size} נבחרו`}
        </Text>
        <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
          <Text style={styles.selectAllText}>
            {allFilteredSelected ? 'בטל הכל' : 'בחר הכל'}
          </Text>
        </TouchableOpacity>
      </View>

      {filteredAssignments.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="documents-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>
            {search.trim() ? 'לא נמצאו תוצאות לחיפוש זה' : 'אין טפסים זמינים'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAssignments}
          keyExtractor={item => item.id!}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Footer: bouton d'impression */}
      {selectedIds.size > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.printBtn, printing && styles.printBtnDisabled]}
            onPress={handlePrintSelected}
            disabled={printing}
          >
            {printing ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <>
                <Ionicons name="print" size={22} color={Colors.textWhite} />
                <Text style={styles.printBtnText}>
                  הדפס {selectedIds.size} טפסים
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <AppModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Header
  header: {
    backgroundColor: Colors.arme,
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

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  headerSpacer: {
    width: 44,
  },

  // Barre de recherche
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },

  // Barre d'action
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  actionBarCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  selectAllBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.armeLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.arme + '40',
  },

  selectAllText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.arme,
  },

  // Liste
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },

  // Ligne de la liste
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Spacing.md,
    ...Shadows.small,
  },

  rowSelected: {
    borderColor: Colors.arme,
    backgroundColor: Colors.armeLight,
  },

  // Checkbox carré
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    flexShrink: 0,
  },

  checkboxSelected: {
    backgroundColor: Colors.arme,
    borderColor: Colors.arme,
  },

  rowContent: {
    flex: 1,
    gap: 4,
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },

  soldierName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    flexShrink: 1,
  },

  soldierNameUnprinted: {
    color: Colors.danger,
  },

  unprintedBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.danger + '50',
    flexShrink: 0,
  },

  unprintedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.danger,
  },

  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  personalNumber: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  dateText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },

  emptyText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.large,
  },

  printBtn: {
    backgroundColor: Colors.arme,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.small,
  },

  printBtnDisabled: {
    opacity: 0.6,
  },

  printBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});

export default UnprintedSignaturesScreen;
