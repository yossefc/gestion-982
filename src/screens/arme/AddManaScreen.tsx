// Écran pour ajouter ou éditer une מנה ou ערכה
// Design professionnel avec UX améliorée
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,

  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { AppModal, ModalType } from '../../components';
import { PackageType, CombatEquipment, RootStackParamList } from '../../types';
import { manaService, combatEquipmentService } from '../../services/firebaseService';

type AddManaRouteProp = RouteProp<RootStackParamList, 'AddMana'>;

interface EquipmentSelection {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
}

const AddManaScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<AddManaRouteProp>();
  const manaId = route.params?.manaId;
  const isEditMode = !!manaId;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [availableEquipment, setAvailableEquipment] = useState<CombatEquipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<PackageType>('מנה');
  const [selectedEquipments, setSelectedEquipments] = useState<EquipmentSelection[]>([]);

  // AppModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadEquipment();

      if (isEditMode && manaId) {
        const manaData = await manaService.getById(manaId);
        if (manaData) {
          setName(manaData.name);
          setType(manaData.type || 'מנה');
          setSelectedEquipments(manaData.equipments.map(eq => ({
            equipmentId: eq.equipmentId,
            equipmentName: eq.equipmentName,
            quantity: eq.quantity,
          })));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      console.error('Error loading data:', error);
      setModalType('error');
      setModalMessage('נכשל בטעינת הנתונים');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadEquipment = async () => {
    try {
      const equipment = await combatEquipmentService.getAll();
      setAvailableEquipment(equipment);
    } catch (error) {
      console.error('Error loading equipment:', error);
    }
  };

  const addEquipment = (equipment: CombatEquipment) => {
    const exists = selectedEquipments.find(e => e.equipmentId === equipment.id);
    if (exists) {
      // Increase quantity instead of showing error
      updateQuantity(equipment.id, exists.quantity + 1);
      return;
    }

    setSelectedEquipments([
      ...selectedEquipments,
      {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        quantity: 1,
      },
    ]);
  };

  const removeEquipment = (equipmentId: string) => {
    setSelectedEquipments(selectedEquipments.filter(e => e.equipmentId !== equipmentId));
  };

  const updateQuantity = (equipmentId: string, quantity: number) => {
    if (quantity < 1) {
      removeEquipment(equipmentId);
      return;
    }

    setSelectedEquipments(
      selectedEquipments.map(e =>
        e.equipmentId === equipmentId ? { ...e, quantity } : e
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setModalType('error');
      setModalMessage('נא להזין שם');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    if (selectedEquipments.length === 0) {
      setModalType('error');
      setModalMessage('נא לבחור לפחות פריט ציוד אחד');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    try {
      setLoading(true);

      if (isEditMode && manaId) {
        await manaService.update(manaId, {
          name: name.trim(),
          type,
          equipments: selectedEquipments,
        });

        setModalType('success');
        setModalTitle('הצלחה');
        setModalMessage(`${type} "${name}" עודכנה בהצלחה`);
        setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => { setModalVisible(false); navigation.goBack(); } }]);
        setModalVisible(true);
      } else {
        await manaService.create({
          name: name.trim(),
          type,
          equipments: selectedEquipments,
        });

        setModalType('success');
        setModalTitle('הצלחה');
        setModalMessage(`${type} "${name}" נוספה בהצלחה`);
        setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => { setModalVisible(false); navigation.goBack(); } }]);
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Error saving mana:', error);
      setModalType('error');
      setModalMessage('נכשל בשמירת הנתונים');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = availableEquipment.filter(eq =>
    eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = selectedEquipments.reduce((sum, eq) => sum + eq.quantity, 0);

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>טוען...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
          <Text style={styles.loadingText}>טוען נתונים...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'עריכת מנה/ערכה' : 'יצירת מנה/ערכה'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isEditMode ? 'עדכן את הפרטים' : 'צור חבילת ציוד מוכנה'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* סוג */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>סוג החבילה</Text>
            <View style={styles.typeButtons}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'מנה' && styles.typeButtonActive,
                ]}
                onPress={() => setType('מנה')}
              >
                <Text style={styles.typeIcon}>📦</Text>
                <Text style={[
                  styles.typeButtonText,
                  type === 'מנה' && styles.typeButtonTextActive,
                ]}>
                  מנה
                </Text>
                <Text style={[
                  styles.typeDescription,
                  type === 'מנה' && styles.typeDescriptionActive,
                ]}>
                  חבילה סטנדרטית
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'ערכה' && styles.typeButtonActive,
                ]}
                onPress={() => setType('ערכה')}
              >
                <Text style={styles.typeIcon}>🧰</Text>
                <Text style={[
                  styles.typeButtonText,
                  type === 'ערכה' && styles.typeButtonTextActive,
                ]}>
                  ערכה
                </Text>
                <Text style={[
                  styles.typeDescription,
                  type === 'ערכה' && styles.typeDescriptionActive,
                ]}>
                  ערכה מיוחדת
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* שם */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.requiredStar}>*</Text>
              <Text style={styles.sectionTitle}>שם</Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={`לדוגמה: ${type === 'מנה' ? 'מנת מפקד' : 'ערכת מגדן'}`}
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          {/* ציוד נבחר */}
          {selectedEquipments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalItems}</Text>
                </View>
                <Text style={styles.sectionTitle}>ציוד נבחר</Text>
              </View>

              <View style={styles.selectedList}>
                {selectedEquipments.map(equipment => (
                  <View key={equipment.equipmentId} style={styles.selectedItem}>
                    <View style={styles.selectedItemInfo}>
                      <Text style={styles.selectedItemName}>{equipment.equipmentName}</Text>
                    </View>

                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(equipment.equipmentId, equipment.quantity - 1)}
                      >
                        <Text style={styles.quantityButtonText}>−</Text>
                      </TouchableOpacity>

                      <Text style={styles.quantityValue}>{equipment.quantity}</Text>

                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(equipment.equipmentId, equipment.quantity + 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeEquipment(equipment.equipmentId)}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* הוספת ציוד */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הוספת ציוד</Text>

            {/* חיפוש */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="חיפוש ציוד..."
                placeholderTextColor={Colors.placeholder}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearch}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* רשימת ציוד */}
            <View style={styles.equipmentList}>
              {filteredEquipment.map(equipment => {
                const selected = selectedEquipments.find(e => e.equipmentId === equipment.id);
                return (
                  <TouchableOpacity
                    key={equipment.id}
                    style={[
                      styles.equipmentItem,
                      selected && styles.equipmentItemSelected,
                    ]}
                    onPress={() => addEquipment(equipment)}
                  >
                    <View style={styles.equipmentInfo}>
                      <Text style={styles.equipmentName}>{equipment.name}</Text>
                      <Text style={styles.equipmentCategory}>{equipment.category}</Text>
                    </View>

                    {selected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>×{selected.quantity}</Text>
                      </View>
                    ) : (
                      <View style={styles.addBadge}>
                        <Text style={styles.addBadgeText}>+</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {filteredEquipment.length === 0 && (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>לא נמצא ציוד</Text>
                  <Text style={styles.emptyHint}>נסה חיפוש אחר</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerInfoText}>
            {selectedEquipments.length} סוגי ציוד • {totalItems} פריטים
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textWhite} />
          ) : (
            <>
              <Text style={styles.saveButtonIcon}>💾</Text>
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'שמור שינויים' : 'צור ' + type}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>


      {/* App Modal */}
      <AppModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    backgroundColor: Colors.arme,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerSpacer: {
    width: 40,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Content
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },

  // Section
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  requiredStar: {
    fontSize: FontSize.base,
    color: Colors.danger,
    marginLeft: 4,
  },
  badge: {
    backgroundColor: Colors.arme,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },

  // Type Buttons
  typeButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.armeLight,
    borderColor: Colors.arme,
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  typeButtonText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  typeButtonTextActive: {
    color: Colors.arme,
  },
  typeDescription: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: 4,
  },
  typeDescriptionActive: {
    color: Colors.arme,
  },

  // Input
  input: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
    color: Colors.text,
  },

  // Selected List
  selectedList: {
    gap: Spacing.sm,
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.armeLight,
    ...Shadows.xs,
  },
  selectedItemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  selectedItemName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.arme,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  quantityValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.danger,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  clearSearch: {
    fontSize: 16,
    color: Colors.textLight,
    padding: Spacing.sm,
  },

  // Equipment List
  equipmentList: {
    gap: Spacing.sm,
  },
  equipmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  equipmentItemSelected: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  equipmentCategory: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  addBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.armeLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.arme,
  },

  // Empty State
  emptyList: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyHint: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: 4,
  },

  bottomSpacer: {
    height: 120,
  },

  // Footer
  footer: {
    padding: Spacing.xl,
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.medium,
  },
  footerInfo: {
    marginBottom: Spacing.md,
  },
  footerInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.arme,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.small,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    fontSize: 18,
  },
  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
});

export default AddManaScreen;