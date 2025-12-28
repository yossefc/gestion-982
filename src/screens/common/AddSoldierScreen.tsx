// Écran d'ajout de nouveau soldat
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { soldierService } from '../../services/firebaseService';
import { Company } from '../../types';
import { Colors, Shadows } from '../../theme/colors';
import { notifyError, notifySuccess } from '../../utils/notify';

const COMPANIES: Company[] = ['פלוגה א', 'פלוגה ב', 'פלוגה ג', 'פלוגה ד', 'מפקדה', 'ניוד'];

const AddSoldierScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    personalNumber: '',
    name: '',
    phone: '',
    company: '' as Company | '',
    department: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.personalNumber.trim()) {
      Alert.alert('שגיאה', 'נא להזין מספר אישי');
      return false;
    }
    if (!formData.name.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם');
      return false;
    }
    if (!formData.company) {
      Alert.alert('שגיאה', 'נא לבחור פלוגה');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await soldierService.create({
        personalNumber: formData.personalNumber.trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        company: formData.company as Company,
        department: formData.department.trim() || undefined,
      });
      
      navigation.goBack();
    } catch (error) {
      notifyError(error, 'הוספת חייל');
    } finally {
      setLoading(false);
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
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הוספת חייל חדש</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Personal Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>מספר אישי *</Text>
          <TextInput
            style={styles.input}
            value={formData.personalNumber}
            onChangeText={(value) => handleInputChange('personalNumber', value)}
            placeholder="הזן מספר אישי"
            placeholderTextColor="#666"
            keyboardType="numeric"
            textAlign="right"
          />
        </View>

        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>שם מלא *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder="הזן שם מלא"
            placeholderTextColor="#666"
            textAlign="right"
          />
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>טלפון</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(value) => handleInputChange('phone', value)}
            placeholder="050-0000000"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            textAlign="right"
          />
        </View>

        {/* Company Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>פלוגה *</Text>
          <View style={styles.companyContainer}>
            {COMPANIES.map((company) => (
              <TouchableOpacity
                key={company}
                style={[
                  styles.companyButton,
                  formData.company === company && styles.companyButtonSelected,
                ]}
                onPress={() => handleInputChange('company', company)}
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

        {/* Department */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>מחלקה</Text>
          <TextInput
            style={styles.input}
            value={formData.department}
            onChangeText={(value) => handleInputChange('department', value)}
            placeholder="הזן מחלקה (אופציונלי)"
            placeholderTextColor="#666"
            textAlign="right"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>הוסף חייל</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    backgroundColor: Colors.background.header,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...Shadows.medium,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    color: Colors.text.white,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  companyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  companyButton: {
    backgroundColor: Colors.background.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  companyButtonSelected: {
    backgroundColor: Colors.status.info,
    borderColor: Colors.status.info,
  },
  companyButtonText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  companyButtonTextSelected: {
    color: Colors.text.white,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    ...Shadows.medium,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
});

export default AddSoldierScreen;
