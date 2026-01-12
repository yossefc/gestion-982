// Écran pour ajouter une nouvelle מנה ou ערכה
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/colors';
import { PackageType, CombatEquipment } from '../../types';
import { addMana, getAllCombatEquipment } from '../../services/equipmentService';

interface EquipmentSelection {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
}

const AddManaScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [availableEquipment, setAvailableEquipment] = useState<CombatEquipment[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<PackageType>('מנה');
  const [selectedEquipments, setSelectedEquipments] = useState<EquipmentSelection[]>([]);

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const equipment = await getAllCombatEquipment();
      setAvailableEquipment(equipment);
    } catch (error) {
      console.error('Error loading equipment:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הציוד');
    }
  };

  const addEquipment = (equipment: CombatEquipment) => {
    const exists = selectedEquipments.find(e => e.equipmentId === equipment.id);
    if (exists) {
      Alert.alert('שגיאה', 'ציוד זה כבר נוסף');
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
    // Validation
    if (!name.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם');
      return;
    }

    if (selectedEquipments.length === 0) {
      Alert.alert('שגיאה', 'נא לבחור לפחות פריט ציוד אחד');
      return;
    }

    try {
      setLoading(true);

      await addMana({
        name: name.trim(),
        type,
        equipments: selectedEquipments,
      });

      Alert.alert('הצלחה', `${type} "${name}" נוספה בהצלחה`, [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error adding mana:', error);
      Alert.alert('שגיאה', 'נכשל בשמירת הנתונים');
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
        <View style={styles.headerContent}>
          <Text style={styles.title}>הוספת מנה/ערכה חדשה</Text>
          <Text style={styles.subtitle}>צור מנת ציוד מוכנה</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>סוג</Text>
          <View style={styles.typeButtons}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'מנה' && styles.typeButtonActive,
              ]}
              onPress={() => setType('מנה')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'מנה' && styles.typeButtonTextActive,
                ]}
              >
                מנה
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'ערכה' && styles.typeButtonActive,
              ]}
              onPress={() => setType('ערכה')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'ערכה' && styles.typeButtonTextActive,
                ]}
              >
                ערכה
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>שם</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={`לדוגמה: ${type === 'מנה' ? 'מנת מפקד' : 'ערכת מגדן'}`}
            placeholderTextColor={Colors.textLight}
          />
        </View>

        {/* Selected Equipments */}
        {selectedEquipments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ציוד נבחר ({selectedEquipments.length})</Text>
            {selectedEquipments.map(equipment => (
              <View key={equipment.equipmentId} style={styles.selectedItem}>
                <Text style={styles.selectedItemName}>{equipment.equipmentName}</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() =>
                      updateQuantity(equipment.equipmentId, equipment.quantity - 1)
                    }
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{equipment.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() =>
                      updateQuantity(equipment.equipmentId, equipment.quantity + 1)
                    }
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
        )}

        {/* Available Equipment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>הוספת ציוד</Text>
          {availableEquipment.map(equipment => {
            const isSelected = selectedEquipments.some(
              e => e.equipmentId === equipment.id
            );
            return (
              <TouchableOpacity
                key={equipment.id}
                style={[
                  styles.equipmentItem,
                  isSelected && styles.equipmentItemDisabled,
                ]}
                onPress={() => addEquipment(equipment)}
                disabled={isSelected}
              >
                <View>
                  <Text style={styles.equipmentName}>{equipment.name}</Text>
                  <Text style={styles.equipmentCategory}>{equipment.category}</Text>
                </View>
                {isSelected && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>שמור</Text>
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
  header: {
    backgroundColor: Colors.modules.arme,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFF',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.modules.arme,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlign: 'right',
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 8,
    ...Shadows.small,
  },
  selectedItemName: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.modules.arme,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.statusColors.pending,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    fontSize: 18,
    color: '#FFF',
  },
  equipmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 8,
    ...Shadows.small,
  },
  equipmentItemDisabled: {
    opacity: 0.5,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  equipmentCategory: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: Colors.modules.arme,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: Colors.modules.arme,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    ...Shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
});

export default AddManaScreen;
