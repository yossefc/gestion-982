/**
 * WeaponStorageScreen.tsx - Mise en אפסון d'armes
 * Allows moving assigned weapons to אפסון with a storage confirmation PDF.
 * Supports multi-selection: tap a weapon card to select/deselect it,
 * then tap the bottom action bar to open the storage form + generate the document.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { generateStorageHTML, StoragePDFData } from '../../services/pdfService';
import { WeaponInventoryItem } from '../../types';
import { AppModal, ModalType } from '../../components';
import WeaponStorageFormModal, { StorageFormResult } from './WeaponStorageFormModal';
import StorageDocumentViewerModal from './StorageDocumentViewerModal';

const WeaponStorageScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [assignedWeapons, setAssignedWeapons] = useState<WeaponInventoryItem[]>([]);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form modal state
  const [formModalVisible, setFormModalVisible] = useState(false);

  // Document viewer state (shown after storage is confirmed)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerHTML, setViewerHTML] = useState('');
  const [viewerPdfData, setViewerPdfData] = useState<StoragePDFData | null>(null);

  // Feedback modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  useEffect(() => {
    loadAssignedWeapons();
  }, []);

  const loadAssignedWeapons = async () => {
    try {
      setLoading(true);
      const weapons = await weaponInventoryService.getAssignedWeapons();
      setAssignedWeapons(weapons);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error loading assigned weapons:', error);
      showModal('error', 'לא ניתן לטעון נשקים מוקצים');
    } finally {
      setLoading(false);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedWeapons = assignedWeapons.filter((w) => selectedIds.has(w.id));

  // ── Feedback modal helper ─────────────────────────────────────────────────

  const showModal = (type: ModalType, message: string, title?: string) => {
    setModalType(type);
    setModalMessage(message);
    setModalTitle(title);
    setModalButtons([
      { text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) },
    ]);
    setModalVisible(true);
  };

  // ── Storage confirmation ──────────────────────────────────────────────────

  const handleConfirmStorage = async (formData: StorageFormResult) => {
    if (selectedWeapons.length === 0) return;
    setFormLoading(true);
    try {
      // 1. Move all selected weapons to storage in Firestore
      await Promise.all(
        selectedWeapons.map((w) => weaponInventoryService.moveWeaponToStorage(w.id))
      );

      // 2. Build PDF data — use first weapon's owner as the signing soldier
      const firstWeapon = selectedWeapons[0];
      const pdfData: StoragePDFData = {
        ownerName: firstWeapon.assignedTo?.soldierName || '',
        ownerPersonalNumber: firstWeapon.assignedTo?.soldierPersonalNumber || '',
        voucherNumber: firstWeapon.assignedTo?.voucherNumber,
        // rank / company not available in WeaponInventoryItem.assignedTo
        depositorName: formData.depositor?.name,
        depositorPersonalNumber: formData.depositor?.personalNumber,
        depositorPhone: formData.depositor?.phone,
        storageDate: new Date(),
        plannedReturnDate: formData.plannedReturnDate,
        weapons: selectedWeapons.map((w) => ({
          category: w.category,
          serialNumber: w.serialNumber,
        })),
      };

      // 3. Build HTML and open document viewer
      const html = generateStorageHTML(pdfData);
      setViewerPdfData(pdfData);
      setViewerHTML(html);

      setFormModalVisible(false);
      setSelectedIds(new Set());
      setViewerVisible(true);
      loadAssignedWeapons();
    } catch (error) {
      console.error('Error during storage:', error);
      setFormModalVisible(false);
      showModal('error', 'שגיאה בתהליך האפסון');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>אפסון נשק</Text>
          <Text style={styles.headerSubtitle}>
            {assignedWeapons.length} מוקצים
            {selectedIds.size > 0 ? ` · ${selectedIds.size} נבחרו` : ''}
          </Text>
        </View>
        {/* Tap to deselect all when something is selected */}
        {selectedIds.size > 0 ? (
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setSelectedIds(new Set())}>
            <Ionicons name="close-circle-outline" size={26} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {assignedWeapons.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="archive-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>אין נשקים מוקצים</Text>
            <Text style={styles.emptySubtitle}>כל הנשקים זמינים או באפסון</Text>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={22} color={Colors.info} />
              <Text style={styles.infoText}>
                לחץ על נשק לבחירה. לאחר הבחירה לחץ על &quot;אפסן נבחרים&quot; לאישור ויצירת מסמך.
              </Text>
            </View>

            {assignedWeapons.map((weapon) => {
              const isSelected = selectedIds.has(weapon.id);
              return (
                <TouchableOpacity
                  key={weapon.id}
                  style={[styles.weaponCard, isSelected && styles.weaponCardSelected]}
                  onPress={() => toggleSelection(weapon.id)}
                  activeOpacity={0.75}
                >
                  {/* Card header: name + checkbox */}
                  <View style={styles.weaponHeader}>
                    <Text style={styles.weaponCategory}>{weapon.category}</Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </View>

                  {/* Serial number */}
                  <View style={styles.serialContainer}>
                    <Ionicons name="barcode-outline" size={20} color={Colors.arme} />
                    <Text style={styles.serialNumber}>{weapon.serialNumber}</Text>
                  </View>

                  {/* Soldier info */}
                  {weapon.assignedTo && (
                    <View style={styles.soldierInfo}>
                      <View style={styles.soldierRow}>
                        <Text style={styles.soldierValue}>{weapon.assignedTo.soldierName}</Text>
                        <Text style={styles.soldierLabel}>חייל:</Text>
                      </View>
                      <View style={styles.soldierRow}>
                        <Text style={styles.soldierValue}>
                          {weapon.assignedTo.soldierPersonalNumber}
                        </Text>
                        <Text style={styles.soldierLabel}>מ.א:</Text>
                      </View>
                      <View style={styles.soldierRow}>
                        <Text style={styles.soldierValue}>
                          {weapon.assignedTo.assignedDate.toLocaleDateString('he-IL')}
                        </Text>
                        <Text style={styles.soldierLabel}>תאריך הקצאה:</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}
        {/* Bottom padding to avoid action bar overlap */}
        <View style={{ height: selectedIds.size > 0 ? 88 : 20 }} />
      </ScrollView>

      {/* Bottom action bar — visible when ≥1 weapon is selected */}
      {selectedIds.size > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setFormModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="archive" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>
              אפסן נבחרים ({selectedIds.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Storage form modal */}
      <WeaponStorageFormModal
        visible={formModalVisible}
        weapons={selectedWeapons}
        loading={formLoading}
        onClose={() => !formLoading && setFormModalVisible(false)}
        onConfirm={handleConfirmStorage}
      />

      {/* Document viewer — shown after successful storage */}
      {viewerPdfData && (
        <StorageDocumentViewerModal
          visible={viewerVisible}
          html={viewerHTML}
          pdfData={viewerPdfData}
          onClose={() => setViewerVisible(false)}
        />
      )}

      {/* Feedback modal */}
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
    backgroundColor: Colors.arme,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
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
  headerSpacer: {
    width: 44,
    height: 44,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: { flex: 1 },
  scrollContent: { padding: Spacing.lg },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.infoDark,
    textAlign: 'right',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    marginTop: Spacing.sm,
  },

  // Weapon card
  weaponCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.small,
  },
  weaponCardSelected: {
    borderColor: Colors.arme,
    backgroundColor: '#EFF6FF',
  },
  weaponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  weaponCategory: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: Colors.arme,
    borderColor: Colors.arme,
  },

  // Serial
  serialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: Colors.armeLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  serialNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.arme,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Soldier info
  soldierInfo: {
    backgroundColor: Colors.backgroundInput,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  soldierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  soldierLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  soldierValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },

  // Bottom action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Shadows.medium,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.arme,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  actionButtonText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#fff',
  },
});

export default WeaponStorageScreen;
