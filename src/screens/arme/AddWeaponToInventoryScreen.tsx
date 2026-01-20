/**
 * AddWeaponToInventoryScreen.tsx - Ajout multiple d'armes dans l'inventaire
 * Interface simplifiée: choisir catégorie et ajouter plusieurs מסטב en une fois
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { getAllCombatEquipment } from '../../services/equipmentService';

const AddWeaponToInventoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [serialNumbers, setSerialNumbers] = useState<string[]>(['']);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const equipment = await getAllCombatEquipment();
      const uniqueCategories = Array.from(
        new Set(equipment.map((e) => e.name).filter((name) => name))
      );
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const addSerialNumberField = () => {
    setSerialNumbers([...serialNumbers, '']);
  };

  const removeSerialNumberField = (index: number) => {
    if (serialNumbers.length > 1) {
      const newSerials = serialNumbers.filter((_, i) => i !== index);
      setSerialNumbers(newSerials);
    }
  };

  const updateSerialNumber = (index: number, value: string) => {
    const newSerials = [...serialNumbers];
    newSerials[index] = value;
    setSerialNumbers(newSerials);
  };

  const handleSave = async () => {
    if (!category.trim()) {
      Alert.alert('שגיאה', 'יש לבחור קטגוריה');
      return;
    }

    const validSerials = serialNumbers.filter((s) => s.trim() !== '');
    if (validSerials.length === 0) {
      Alert.alert('שגיאה', 'יש להזין לפחות מסטב אחד');
      return;
    }

    // Vérifier les doublons
    const uniqueSerials = new Set(validSerials.map((s) => s.trim()));
    if (uniqueSerials.size !== validSerials.length) {
      Alert.alert('שגיאה', 'יש מסטבים כפולים ברשימה');
      return;
    }

    try {
      setSaving(true);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const serial of validSerials) {
        try {
          await weaponInventoryService.addWeapon({
            category: category.trim(),
            serialNumber: serial.trim(),
            status: 'available',
          });
          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`${serial.trim()}: ${error.message || 'שגיאה'}`);
        }
      }

      if (errorCount === 0) {
        Alert.alert('הצלחה', `${successCount} נשקים נוספו למלאי בהצלחה`, [
          { text: 'אישור', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(
          'הושלם חלקית',
          `${successCount} נשקים נוספו בהצלחה\n${errorCount} נכשלו:\n${errors.join('\n')}`,
          [{ text: 'אישור', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      console.error('Error saving weapons:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את הנשקים');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>הוספת נשקים למלאי</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>בחר קטגוריה *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="M16, M203, מאג..."
              placeholderTextColor={Colors.textLight}
              textAlign="right"
            />
            <Ionicons name="rifle-outline" size={20} color={Colors.textSecondary} />
          </View>

          {/* Suggestions */}
          {categories.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>קטגוריות קיימות:</Text>
              <View style={styles.suggestionsList}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.suggestionChip,
                      category === cat && styles.suggestionChipSelected,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.suggestionText,
                        category === cat && styles.suggestionTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Serial Numbers */}
        <View style={styles.section}>
          <View style={styles.serialHeader}>
            <TouchableOpacity style={styles.addButton} onPress={addSerialNumberField}>
              <Ionicons name="add-circle" size={24} color={Colors.success} />
              <Text style={styles.addButtonText}>הוסף מסטב</Text>
            </TouchableOpacity>
            <Text style={styles.label}>מסטבים (מספרים סידוריים) *</Text>
          </View>

          {serialNumbers.map((serial, index) => (
            <View key={index} style={styles.serialRow}>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeSerialNumberField(index)}
                disabled={serialNumbers.length === 1}
              >
                <Ionicons
                  name="close-circle"
                  size={24}
                  color={serialNumbers.length === 1 ? Colors.disabled : Colors.danger}
                />
              </TouchableOpacity>

              <View style={[styles.inputContainer, styles.serialInput]}>
                <TextInput
                  style={styles.input}
                  value={serial}
                  onChangeText={(value) => updateSerialNumber(index, value)}
                  placeholder={`מסטב ${index + 1}`}
                  placeholderTextColor={Colors.textLight}
                  textAlign="right"
                  autoCapitalize="characters"
                />
                <Ionicons name="barcode-outline" size={20} color={Colors.textSecondary} />
              </View>
            </View>
          ))}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={Colors.info} />
          <Text style={styles.infoText}>
            כל הנשקים יתווספו כ"זמינים" ויהיו ניתנים להקצאה לחיילים.
          </Text>
        </View>

        {/* Summary */}
        {category && serialNumbers.filter((s) => s.trim()).length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>סיכום</Text>
            <Text style={styles.summaryText}>
              קטגוריה: {category}
              {'\n'}
              כמות: {serialNumbers.filter((s) => s.trim()).length} נשקים
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={Colors.textWhite} />
              <Text style={styles.saveButtonText}>שמור הכל</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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

  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },

  headerSpacer: {
    width: 44,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  section: {
    marginBottom: Spacing.xl,
  },

  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },

  // Suggestions
  suggestionsContainer: {
    marginTop: Spacing.md,
  },

  suggestionsTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },

  suggestionChip: {
    backgroundColor: Colors.armeLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },

  suggestionChipSelected: {
    backgroundColor: Colors.arme,
    borderColor: Colors.armeDark,
  },

  suggestionText: {
    fontSize: FontSize.sm,
    color: Colors.arme,
    fontWeight: '600',
  },

  suggestionTextSelected: {
    color: Colors.textWhite,
  },

  // Serial Numbers
  serialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },

  addButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },

  serialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },

  serialInput: {
    flex: 1,
  },

  removeButton: {
    padding: Spacing.xs,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },

  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.infoDark,
    textAlign: 'right',
  },

  // Summary
  summaryCard: {
    backgroundColor: Colors.successLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },

  summaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.successDark,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  summaryText: {
    fontSize: FontSize.base,
    color: Colors.successDark,
    textAlign: 'right',
    lineHeight: 24,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.backgroundCard,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.medium,
  },

  saveButton: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.small,
  },

  saveButtonDisabled: {
    backgroundColor: Colors.disabled,
  },

  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textWhite,
  },
});

export default AddWeaponToInventoryScreen;
