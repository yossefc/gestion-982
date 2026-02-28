/**
 * ClothingEquipmentManagementScreen.tsx - Gestion des équipements vestimentaires
 * Design militaire professionnel
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { clothingEquipmentService } from '../../services/clothingEquipmentService';
import { AppModal, ModalType } from '../../components';
import { useData } from '../../contexts/DataContext';

interface Equipment {
  id: string;
  name: string;
  yamach?: number;
  category?: string;
  requiresSerial?: boolean;
  sources?: { name: string; quantity: number }[];
}

const CATEGORIES = ['כללי', 'אפסנאות עליון', 'אפסנאות תחתון', 'הנעלה', 'אביזרים'];

const ClothingEquipmentManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { refreshClothingEquipment } = useData();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    // yamach: '', // REMOVED: Using sources instead
    category: 'כללי',
    requiresSerial: false,
    sources: [] as { name: string; quantity: string }[],
  });
  const [saving, setSaving] = useState(false);

  // AppModal state
  const [appModalVisible, setAppModalVisible] = useState(false);
  const [appModalType, setAppModalType] = useState<ModalType>('info');
  const [appModalMessage, setAppModalMessage] = useState('');
  const [appModalTitle, setAppModalTitle] = useState<string | undefined>(undefined);
  const [appModalButtons, setAppModalButtons] = useState<any[]>([]);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    filterEquipment();
  }, [searchQuery, selectedCategory, equipment]);

  const loadEquipment = async () => {
    try {
      setLoading(true);
      const data = await clothingEquipmentService.getAll();
      setEquipment(data);
      setFilteredEquipment(data);
    } catch (error) {
      console.error('Error loading equipment:', error);
      setAppModalType('error');
      setAppModalMessage('לא ניתן לטעון את רשימת הציוד');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const filterEquipment = () => {
    let filtered = [...equipment];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(eq =>
        eq.name.toLowerCase().includes(query) ||
        eq.yamach?.toString().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(eq => eq.category === selectedCategory);
    }

    setFilteredEquipment(filtered);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      sources: [{ name: 'ימ״ח', quantity: '' }], // Default source
      category: 'כללי',
      requiresSerial: false,
    });
    setModalVisible(true);
  };

  const openEditModal = (item: Equipment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || 'כללי',
      requiresSerial: item.requiresSerial || false,
      sources: item.sources && item.sources.length > 0
        ? item.sources.map(s => ({ name: s.name, quantity: s.quantity.toString() }))
        : [{ name: 'ימ״ח', quantity: item.yamach?.toString() || '' }],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setAppModalType('error');
      setAppModalMessage('יש להזין שם לציוד');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    try {
      setSaving(true);
      const totalQuantity = formData.sources.reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0);

      const data: any = {
        name: formData.name.trim(),
        category: formData.category,
        requiresSerial: formData.requiresSerial,
        sources: formData.sources.map(s => ({
          name: s.name.trim() || 'מקור לא ידוע',
          quantity: parseInt(s.quantity) || 0,
        })),
        yamach: totalQuantity, // Synced for backward compatibility
      };

      if (editingItem) {
        await clothingEquipmentService.update(editingItem.id, data);
        setEquipment(prev => prev.map(eq =>
          eq.id === editingItem.id ? { id: eq.id, ...data } : eq
        ));
      } else {
        const newItem = await clothingEquipmentService.create(data);
        setEquipment(prev => [...prev, newItem]);
      }

      // Mettre à jour le cache global pour que les écrans de signature aient les nouvelles données
      refreshClothingEquipment().catch(console.error);

      setModalVisible(false);
      setAppModalType('success');
      setAppModalMessage(editingItem ? 'הציוד עודכן בהצלחה' : 'הציוד נוסף בהצלחה');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    } catch (error) {
      setAppModalType('error');
      setAppModalMessage('לא ניתן לשמור את הציוד');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: Equipment) => {
    setAppModalType('warning');
    setAppModalTitle('מחיקת ציוד');
    setAppModalMessage(`האם למחוק את "${item.name}"?`);
    setAppModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setAppModalVisible(false) },
      {
        text: 'מחק',
        style: 'danger',
        icon: 'trash' as const,
        onPress: async () => {
          setAppModalVisible(false);
          try {
            await clothingEquipmentService.delete(item.id);
            setEquipment(prev => prev.filter(eq => eq.id !== item.id));

            // Mettre à jour le cache global
            refreshClothingEquipment().catch(console.error);

            setAppModalType('success');
            setAppModalTitle(undefined);
            setAppModalMessage('הציוד נמחק בהצלחה');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
          } catch (error) {
            setAppModalType('error');
            setAppModalTitle(undefined);
            setAppModalMessage('לא ניתן למחוק את הציוד');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
          }
        },
      },
    ]);
    setAppModalVisible(true);
  };

  const renderEquipmentItem = ({ item }: { item: Equipment }) => {
    const totalQuantity = item.sources && item.sources.length > 0
      ? item.sources.reduce((sum, s) => sum + (s.quantity || 0), 0)
      : (item.yamach || 0);

    return (
      <View style={styles.equipmentCard}>
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.equipmentName}>{item.name}</Text>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.equipmentActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openEditModal(item)}
            >
              <Ionicons name="create-outline" size={18} color={Colors.info} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sources Section */}
        <View style={styles.sourcesSection}>
          <View style={styles.sourcesRow}>
            {item.sources && item.sources.length > 0 ? (
              item.sources.slice(0, 3).map((source, index) => (
                <View key={index} style={styles.sourceChip}>
                  <Text style={styles.sourceChipName}>{source.name}</Text>
                  <View style={styles.sourceChipQuantity}>
                    <Text style={styles.sourceChipQuantityText}>{source.quantity}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.sourceChip}>
                <Text style={styles.sourceChipName}>ימ״ח</Text>
                <View style={styles.sourceChipQuantity}>
                  <Text style={styles.sourceChipQuantityText}>{item.yamach || 0}</Text>
                </View>
              </View>
            )}
            {item.sources && item.sources.length > 3 && (
              <View style={[styles.sourceChip, { backgroundColor: Colors.textLight }]}>
                <Text style={[styles.sourceChipName, { color: Colors.textWhite }]}>+{item.sources.length - 3}</Text>
              </View>
            )}
          </View>

          {/* Total Badge */}
          <View style={styles.totalBadge}>
            <Ionicons name="cube" size={14} color={Colors.textWhite} />
            <Text style={styles.totalBadgeText}>{totalQuantity}</Text>
          </View>
        </View>
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>ניהול ציוד אפסנאות</Text>
          <Text style={styles.headerSubtitle}>{equipment.length} פריטים</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש לפי שם או ימ״ח..."
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Ionicons name="search" size={20} color={Colors.textLight} />
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryFilterContainer}>
        <FlatList
          horizontal
          data={[null, ...CATEGORIES]}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterList}
          keyExtractor={(item) => item || 'all'}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryFilterButton,
                selectedCategory === item && styles.categoryFilterButtonActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[
                styles.categoryFilterText,
                selectedCategory === item && styles.categoryFilterTextActive,
              ]}>
                {item || 'הכל'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Equipment List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.vetement} />
          <Text style={styles.loadingText}>טוען ציוד...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEquipment}
          renderItem={renderEquipmentItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadEquipment}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>לא נמצא ציוד</Text>
              <Text style={styles.emptySubtitle}>הוסף ציוד חדש או שנה את החיפוש</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingItem ? 'עריכת ציוד' : 'הוספת ציוד'}
              </Text>
              <View style={styles.modalCloseButton} />
            </View>

            <View style={styles.modalContent}>
              {/* Name Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>שם הציוד *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="הזן שם"
                  placeholderTextColor={Colors.placeholder}
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                />
              </View>

              {/* Sources Section */}
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.inputLabel}>מקורות ציוד</Text>
                  <TouchableOpacity onPress={() => setFormData(prev => ({
                    ...prev,
                    sources: [...prev.sources, { name: '', quantity: '' }]
                  }))}>
                    <Text style={{ color: Colors.vetement, fontWeight: '600' }}>+ הוסף מקור</Text>
                  </TouchableOpacity>
                </View>

                {formData.sources.map((source, index) => (
                  <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="כמות"
                      keyboardType="numeric"
                      value={source.quantity}
                      onChangeText={(t) => {
                        const newSources = [...formData.sources];
                        newSources[index].quantity = t;
                        setFormData(prev => ({ ...prev, sources: newSources }));
                      }}
                    />
                    <TextInput
                      style={[styles.input, { flex: 2 }]}
                      placeholder="שם המקור (למשל: ימ״ח)"
                      value={source.name}
                      onChangeText={(t) => {
                        const newSources = [...formData.sources];
                        newSources[index].name = t;
                        setFormData(prev => ({ ...prev, sources: newSources }));
                      }}
                    />
                    {formData.sources.length > 1 && (
                      <TouchableOpacity
                        style={{ justifyContent: 'center', padding: 4 }}
                        onPress={() => {
                          const newSources = formData.sources.filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, sources: newSources }));
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <Text style={{ textAlign: 'right', color: Colors.textSecondary, marginTop: 4 }}>
                  סה״כ כמות: {formData.sources.reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0)}
                </Text>
              </View>

              {/* Category Selector */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>קטגוריה</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        formData.category === cat && styles.categoryOptionSelected,
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, category: cat }))}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        formData.category === cat && styles.categoryOptionTextSelected,
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Requires Serial Toggle */}
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={() => setFormData(prev => ({ ...prev, requiresSerial: !prev.requiresSerial }))}
              >
                <View style={[
                  styles.toggleBox,
                  formData.requiresSerial && styles.toggleBoxActive,
                ]}>
                  {formData.requiresSerial && (
                    <Ionicons name="checkmark" size={16} color={Colors.textWhite} />
                  )}
                </View>
                <Text style={styles.toggleLabel}>דורש מספר סידורי</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <Text style={styles.saveButtonText}>שמור</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* App Modal */}
      <AppModal
        visible={appModalVisible}
        type={appModalType}
        title={appModalTitle}
        message={appModalMessage}
        buttons={appModalButtons}
        onClose={() => setAppModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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

  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
  },

  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },

  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginRight: Spacing.sm,
  },

  // Category Filter
  categoryFilterContainer: {
    marginTop: Spacing.md,
  },

  categoryFilterList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },

  categoryFilterButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  categoryFilterButtonActive: {
    backgroundColor: Colors.vetement,
    borderColor: Colors.vetement,
  },

  categoryFilterText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  categoryFilterTextActive: {
    color: Colors.textWhite,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // List
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  equipmentCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },

  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },

  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  equipmentName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },

  equipmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },

  // Sources Section - Modern Chip Design
  sourcesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    flex: 1,
  },

  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.vetementLight,
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
  },

  sourceChipName: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.vetementDark,
  },

  sourceChipQuantity: {
    backgroundColor: Colors.vetement,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },

  sourceChipQuantityText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.vetement,
    borderRadius: BorderRadius.lg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    marginLeft: Spacing.sm,
  },

  totalBadgeText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  // Legacy styles kept for compatibility
  sourcesContainer: {
    height: 60,
    width: '100%',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },

  sourceText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 4,
  },

  categoryBadge: {
    backgroundColor: Colors.vetementLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },

  categoryText: {
    fontSize: FontSize.xs,
    color: Colors.vetementDark,
    fontWeight: '500',
  },

  equipmentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editButton: {
    backgroundColor: Colors.infoLight,
  },

  deleteButton: {
    backgroundColor: Colors.dangerLight,
  },

  // Empty State
  emptyContainer: {
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  modalContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    ...Shadows.large,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },

  modalContent: {
    padding: Spacing.lg,
  },

  inputContainer: {
    marginBottom: Spacing.lg,
  },

  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  input: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  categoryOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  categoryOptionSelected: {
    backgroundColor: Colors.vetement,
    borderColor: Colors.vetement,
  },

  categoryOptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  categoryOptionTextSelected: {
    color: Colors.textWhite,
    fontWeight: '600',
  },

  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.md,
  },

  toggleBox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },

  toggleBoxActive: {
    backgroundColor: Colors.vetement,
    borderColor: Colors.vetement,
  },

  toggleLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },

  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  cancelButtonText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  saveButton: {
    flex: 1,
    backgroundColor: Colors.vetement,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },

  saveButtonText: {
    fontSize: FontSize.base,
    color: Colors.textWhite,
    fontWeight: '600',
  },

  buttonDisabled: {
    backgroundColor: Colors.disabled,
  },
});

export default ClothingEquipmentManagementScreen;