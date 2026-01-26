// Écran pour ajouter ou éditer un équipement de combat
// Design professionnel avec UX améliorée
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { RootStackParamList, SubEquipment } from '../../types';
import { combatEquipmentService } from '../../services/firebaseService';

type AddCombatEquipmentRouteProp = RouteProp<RootStackParamList, 'AddCombatEquipment'>;

const CATEGORIES = [
  { id: 'נשק', label: 'נשק', icon: '🔫' },
  { id: 'אופטיקה', label: 'אופטיקה', icon: '🔭' },
  { id: 'ציוד מגן', label: 'ציוד מגן', icon: '🛡️' },
  { id: 'אביזרים', label: 'אביזרים', icon: '🔧' },
  { id: 'ציוד לוחם', label: 'ציוד לוחם', icon: '🎒' },
  { id: 'אחר', label: 'אחר', icon: '📦' },
];

const AddCombatEquipmentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<AddCombatEquipmentRouteProp>();
  const equipmentId = route.params?.equipmentId;
  const isEditMode = !!equipmentId;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('נשק');
  const [requiresSerial, setRequiresSerial] = useState(false);
  const [hasSubEquipment, setHasSubEquipment] = useState(false);
  const [subEquipments, setSubEquipments] = useState<SubEquipment[]>([]);
  const [newSubEquipmentName, setNewSubEquipmentName] = useState('');

  useEffect(() => {
    if (isEditMode && equipmentId) {
      loadEquipment();
    } else {
      setInitialLoading(false);
    }
  }, []);

  const loadEquipment = async () => {
    try {
      const equipment = await combatEquipmentService.getById(equipmentId!);
      if (equipment) {
        setName(equipment.name);
        setCategory(equipment.category);
        setRequiresSerial((equipment as any).requiresSerial || false);
        setHasSubEquipment(equipment.hasSubEquipment);
        setSubEquipments(equipment.subEquipments || []);
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הציוד');
    } finally {
      setInitialLoading(false);
    }
  };

  const addSubEquipment = () => {
    if (!newSubEquipmentName.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם רכיב');
      return;
    }

    const newSub: SubEquipment = {
      id: Date.now().toString(),
      name: newSubEquipmentName.trim(),
    };

    setSubEquipments([...subEquipments, newSub]);
    setNewSubEquipmentName('');
  };

  const removeSubEquipment = (id: string) => {
    setSubEquipments(subEquipments.filter(sub => sub.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם ציוד');
      return;
    }

    if (!category) {
      Alert.alert('שגיאה', 'נא לבחור קטגוריה');
      return;
    }

    try {
      setLoading(true);

      const equipmentData: any = {
        name: name.trim(),
        category,
        hasSubEquipment,
        subEquipments: hasSubEquipment ? subEquipments : [],
        requiresSerial,
      };

      if (isEditMode && equipmentId) {
        await combatEquipmentService.update(equipmentId, equipmentData);
        Alert.alert('הצלחה', 'הציוד עודכן בהצלחה', [
          { text: 'אישור', onPress: () => navigation.goBack() },
        ]);
      } else {
        await combatEquipmentService.create(equipmentData);
        Alert.alert('הצלחה', 'הציוד נוסף בהצלחה', [
          { text: 'אישור', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving equipment:', error);
      Alert.alert('שגיאה', 'נכשל בשמירת הציוד');
    } finally {
      setLoading(false);
    }
  };

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
            {isEditMode ? 'עריכת ציוד' : 'הוספת ציוד חדש'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isEditMode ? 'עדכן את פרטי הציוד' : 'הוסף ציוד לחימה למערכת'}
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
          {/* שם הציוד */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.requiredStar}>*</Text>
              <Text style={styles.label}>שם הציוד</Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="לדוגמה: M16, משקפת לילה, אפוד מגן"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          {/* קטגוריה */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.requiredStar}>*</Text>
              <Text style={styles.label}>קטגוריה</Text>
            </View>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    category === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat.id && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* דורש מסטב */}
          <View style={styles.section}>
            <View style={styles.toggleContainer}>
              <Switch
                value={requiresSerial}
                onValueChange={setRequiresSerial}
                trackColor={{ false: Colors.border, true: Colors.arme }}
                thumbColor={Colors.backgroundCard}
                ios_backgroundColor={Colors.border}
              />
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>דורש מספר סידורי (מסטב)</Text>
                <Text style={styles.toggleHint}>
                  סמן אם כל יחידה של ציוד זה דורשת מסטב ייחודי בהחתמה
                </Text>
              </View>
            </View>
          </View>

          {/* רכיבים נוספים */}
          <View style={styles.section}>
            <View style={styles.toggleContainer}>
              <Switch
                value={hasSubEquipment}
                onValueChange={setHasSubEquipment}
                trackColor={{ false: Colors.border, true: Colors.arme }}
                thumbColor={Colors.backgroundCard}
                ios_backgroundColor={Colors.border}
              />
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>יש רכיבים נוספים?</Text>
                <Text style={styles.toggleHint}>
                  רכיבים נלווים כמו מחסניות, רצועות וכו'
                </Text>
              </View>
            </View>
          </View>

          {/* רשימת רכיבים */}
          {hasSubEquipment && (
            <View style={styles.section}>
              <Text style={styles.label}>רכיבים נוספים</Text>

              {/* הוספת רכיב חדש */}
              <View style={styles.addSubContainer}>
                <TouchableOpacity
                  style={styles.addSubButton}
                  onPress={addSubEquipment}
                >
                  <Text style={styles.addSubButtonText}>+</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.subInput}
                  value={newSubEquipmentName}
                  onChangeText={setNewSubEquipmentName}
                  placeholder="שם הרכיב (לדוגמה: מחסנית)"
                  placeholderTextColor={Colors.placeholder}
                  onSubmitEditing={addSubEquipment}
                  returnKeyType="done"
                />
              </View>

              {/* רשימת רכיבים */}
              {subEquipments.length > 0 ? (
                <View style={styles.subList}>
                  {subEquipments.map((sub, index) => (
                    <View key={sub.id} style={styles.subItem}>
                      <TouchableOpacity
                        style={styles.removeSubButton}
                        onPress={() => removeSubEquipment(sub.id)}
                      >
                        <Text style={styles.removeSubButtonText}>✕</Text>
                      </TouchableOpacity>
                      <View style={styles.subItemContent}>
                        <Text style={styles.subItemNumber}>{index + 1}</Text>
                        <Text style={styles.subItemText}>{sub.name}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptySubList}>
                  <Text style={styles.emptySubText}>
                    לא נוספו רכיבים עדיין
                  </Text>
                  <Text style={styles.emptySubHint}>
                    הזן שם רכיב ולחץ על + להוספה
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* כפתור שמירה */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textWhite} />
          ) : (
            <>
              <Text style={styles.saveButtonIcon}>
                {isEditMode ? '✓' : '💾'}
              </Text>
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'שמור שינויים' : 'הוסף ציוד'}
              </Text>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  labelHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  requiredStar: {
    fontSize: FontSize.base,
    color: Colors.danger,
    marginLeft: 4,
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
  inputRequired: {
    borderColor: Colors.arme,
    borderWidth: 2,
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  categoryButton: {
    width: '31%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  categoryButtonActive: {
    backgroundColor: Colors.armeLight,
    borderColor: Colors.arme,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  categoryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  categoryButtonTextActive: {
    color: Colors.arme,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
    alignItems: 'flex-end',
  },
  toggleLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Sub Equipment
  addSubContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  subInput: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
    color: Colors.text,
  },
  addSubButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  addSubButtonText: {
    fontSize: 24,
    color: Colors.textWhite,
    fontWeight: 'bold',
  },
  subList: {
    gap: Spacing.sm,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  subItemNumber: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.armeLight,
    color: Colors.arme,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
  },
  subItemText: {
    fontSize: FontSize.base,
    color: Colors.text,
  },
  removeSubButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeSubButtonText: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: 'bold',
  },
  emptySubList: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptySubText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  emptySubHint: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },

  bottomSpacer: {
    height: 100,
  },

  // Footer
  footer: {
    padding: Spacing.xl,
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.medium,
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

export default AddCombatEquipmentScreen;