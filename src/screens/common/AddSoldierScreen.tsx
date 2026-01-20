/**
 * AddSoldierScreen.tsx - Ajout d'un nouveau soldat
 * Design militaire professionnel
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { soldierService } from '../../services/soldierService';

const COMPANIES = ['פלוגה א', 'פלוגה ב', 'פלוגה ג', 'פלוגה ד', 'מפקדה', 'ניוד'];

// Composant InputField défini HORS du composant principal pour éviter les re-renders
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
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>
      {label}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
    <View style={[
      styles.inputWrapper,
      focused && styles.inputWrapperFocused,
      error && styles.inputWrapperError,
    ]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.placeholder}
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

const AddSoldierScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    personalNumber: '',
    name: '',
    phone: '',
    company: '',
    department: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setLoading(true);
      await soldierService.create({
        ...formData,
        createdAt: new Date(),
      });

      Alert.alert('הצלחה', 'החייל נוסף בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('שגיאה', error.message || 'לא ניתן להוסיף את החייל');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof typeof formData, text: string) => {
    setFormData(prev => ({ ...prev, [field]: text }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
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
          <Text style={styles.headerTitle}>הוספת חייל</Text>
          <Text style={styles.headerSubtitle}>רישום חייל חדש למערכת</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="person-add" size={24} color={Colors.primary} />
              <Text style={styles.formTitle}>פרטי החייל</Text>
            </View>

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
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>פלוגה</Text>
              <View style={styles.companyGrid}>
                {COMPANIES.map((company) => (
                  <TouchableOpacity
                    key={company}
                    style={[
                      styles.companyButton,
                      formData.company === company && styles.companyButtonSelected,
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, company }))}
                  >
                    <Text style={[
                      styles.companyButtonText,
                      formData.company === company && styles.companyButtonTextSelected,
                    ]}>
                      {company}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <InputField
              label="מחלקה/תפקיד"
              field="department"
              placeholder="הזן מחלקה או תפקיד"
              value={formData.department}
              error={errors.department}
              focused={focusedInput === 'department'}
              onChangeText={(text) => handleFieldChange('department', text)}
              onFocus={() => setFocusedInput('department')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.textWhite} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color={Colors.textWhite} />
                <Text style={styles.submitButtonText}>שמור חייל</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
            <Text style={styles.infoNoteText}>
              שדות המסומנים ב-* הם שדות חובה
            </Text>
          </View>
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
  },

  // Content
  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  // Form Card
  formCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.small,
  },

  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  formTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginRight: Spacing.sm,
  },

  // Input
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

  requiredMark: {
    color: Colors.danger,
  },

  inputWrapper: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  inputWrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundCard,
  },

  inputWrapperError: {
    borderColor: Colors.danger,
  },

  input: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },

  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  // Company Grid
  companyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  companyButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  companyButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  companyButtonText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  companyButtonTextSelected: {
    color: Colors.textWhite,
  },

  // Submit Button
  submitButton: {
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    ...Shadows.small,
  },

  submitButtonDisabled: {
    backgroundColor: Colors.disabled,
  },

  submitButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Info Note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },

  infoNoteText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});

export default AddSoldierScreen;