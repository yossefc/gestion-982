/**
 * EditSoldierScreen.tsx - Modification d'un soldat existant
 * Design militaire professionnel
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { soldierService } from '../../services/firebaseService';
import { useSoldiers } from '../../contexts/SoldiersContext';

const COMPANIES = ['פלוגה א', 'פלוגה ב', 'פלוגה ג', 'פלוגה ד', 'מפקדה/אגמ', 'מפקדה', 'ניוד'];

interface InputFieldProps {
  label: string;
  field: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
  value: string;
  error?: string;
  focused: boolean;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

const InputField: React.FC<InputFieldProps> = React.memo(({
  label,
  field,
  placeholder,
  keyboardType = 'default',
  required = false,
  value,
  error,
  focused,
  onChangeText,
  onFocus,
  onBlur,
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    <View style={[
      styles.inputContainer,
      focused && styles.inputContainerFocused,
      error && styles.inputContainerError,
    ]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.placeholder}
        textAlign="right"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
    {error && (
      <Text style={styles.errorText}>{error}</Text>
    )}
  </View>
));

const EditSoldierScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { soldierId } = (route.params as { soldierId: string }) || {};
  const { refreshSoldiers } = useSoldiers();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    personalNumber: '',
    name: '',
    phone: '',
    company: '',
    department: '',
    isRsp: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSoldier();
  }, [soldierId]);

  const loadSoldier = async () => {
    try {
      setLoading(true);
      const soldier = await soldierService.getById(soldierId);

      if (soldier) {
        setFormData({
          personalNumber: soldier.personalNumber || '',
          name: soldier.name || '',
          phone: soldier.phone || '',
          company: soldier.company || '',
          department: soldier.department || '',
          isRsp: soldier.isRsp || false,
        });
      } else {
        Alert.alert('שגיאה', 'החייל לא נמצא', [
          { text: 'אישור', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Error loading soldier:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את פרטי החייל');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.personalNumber.trim()) {
      newErrors.personalNumber = 'מספר אישי הוא שדה חובה';
    } else if (formData.personalNumber.length < 5) {
      newErrors.personalNumber = 'מספר אישי חייב להכיל לפחות 5 ספרות';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'שם הוא שדה חובה';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      await soldierService.update(soldierId, formData);

      // Rafraîchir le cache des soldats après modification
      await refreshSoldiers();

      Alert.alert('הצלחה', 'פרטי החייל עודכנו בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('שגיאה', error.message || 'לא ניתן לעדכן את פרטי החייל');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'מחיקת חייל',
      'האם אתה בטוח שברצונך למחוק את החייל? פעולה זו אינה ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await soldierService.delete(soldierId);

              // Rafraîchir le cache après suppression
              await refreshSoldiers();

              Alert.alert('הצלחה', 'החייל נמחק בהצלחה', [
                { text: 'אישור', onPress: () => navigation.goBack() }
              ]);
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן למחוק את החייל');
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleFieldChange = (field: keyof typeof formData, text: string) => {
    setFormData(prev => ({ ...prev, [field]: text }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>טוען נתונים...</Text>
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

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>עריכת חייל</Text>
          <Text style={styles.headerSubtitle}>{formData.name}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={saving}
        >
          <Ionicons name="trash-outline" size={22} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Form */}
          <View style={styles.formCard}>
            <InputField
              label="מספר אישי"
              field="personalNumber"
              placeholder="הזן מספר אישי"
              keyboardType="numeric"
              required
              value={formData.personalNumber}
              error={errors.personalNumber}
              focused={focusedInput === 'personalNumber'}
              onChangeText={(text) => handleFieldChange('personalNumber', text)}
              onFocus={() => setFocusedInput('personalNumber')}
              onBlur={() => setFocusedInput(null)}
            />

            <InputField
              label="שם מלא"
              field="name"
              placeholder="הזן שם מלא"
              required
              value={formData.name}
              error={errors.name}
              focused={focusedInput === 'name'}
              onChangeText={(text) => handleFieldChange('name', text)}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
            />

            <InputField
              label="טלפון"
              field="phone"
              placeholder="הזן מספר טלפון"
              keyboardType="phone-pad"
              value={formData.phone}
              error={errors.phone}
              focused={focusedInput === 'phone'}
              onChangeText={(text) => handleFieldChange('phone', text)}
              onFocus={() => setFocusedInput('phone')}
              onBlur={() => setFocusedInput(null)}
            />

            {/* Company Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>פלוגה</Text>
              <View style={styles.companyGrid}>
                {COMPANIES.map((company) => (
                  <TouchableOpacity
                    key={company}
                    style={[
                      styles.companyChip,
                      formData.company === company && styles.companyChipActive,
                    ]}
                    onPress={() => handleFieldChange('company', company)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.companyChipText,
                        formData.company === company && styles.companyChipTextActive,
                      ]}
                    >
                      {company}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <InputField
              label="מחלקה"
              field="department"
              placeholder="הזן מחלקה (אופציונלי)"
              value={formData.department}
              error={errors.department}
              focused={focusedInput === 'department'}
              onChangeText={(text) => handleFieldChange('department', text)}
              onFocus={() => setFocusedInput('department')}
              onBlur={() => setFocusedInput(null)}
            />

            {/* RSP Toggle */}
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>רס"פ פלוגתי</Text>
              <Switch
                value={formData.isRsp}
                onValueChange={(value) => setFormData(prev => ({ ...prev, isRsp: value }))}
                trackColor={{ false: '#D1D5DB', true: Colors.soldats }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (formData.isRsp ? Colors.soldatsDark : '#F3F4F6')}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color={Colors.textWhite} />
                <Text style={styles.saveButtonText}>שמור שינויים</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.primary,
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
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },

  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.xl,
  },

  // Form
  formCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },

  inputGroup: {
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  required: {
    color: Colors.danger,
  },

  inputContainer: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.md,
  },

  inputContainerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundCard,
  },

  inputContainerError: {
    borderColor: Colors.danger,
  },

  input: {
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },

  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  // Company Selector
  companyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  companyChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundInput,
    borderWidth: 2,
    borderColor: 'transparent',
  },

  companyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  companyChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  companyChipTextActive: {
    color: Colors.textWhite,
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    ...Shadows.medium,
  },

  saveButtonDisabled: {
    backgroundColor: Colors.disabled,
    opacity: 0.6,
  },

  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  bottomSpacer: {
    height: Spacing.xxxl,
  },
  switchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  switchLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
});

export default EditSoldierScreen;
