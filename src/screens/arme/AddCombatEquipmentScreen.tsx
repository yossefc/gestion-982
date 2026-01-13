// Écran pour ajouter ou éditer un équipement de combat
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/colors';
import { RootStackParamList, SubEquipment } from '../../types';
import { addCombatEquipment, getAllCombatEquipment } from '../../services/equipmentService';
import { combatEquipmentService } from '../../services/firebaseService';

type AddCombatEquipmentRouteProp = RouteProp<RootStackParamList, 'AddCombatEquipment'>;

const CATEGORIES = ['נשק', 'אופטיקה', 'אביזרים', 'ציוד לוחם'];

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
  const [serial, setSerial] = useState('');
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
        setSerial(equipment.serial || '');
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
    // Validation
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

      const equipmentData = {
        name: name.trim(),
        category,
        serial: serial.trim() || undefined,
        hasSubEquipment,
        subEquipments: hasSubEquipment ? subEquipments : [],
      };

      if (isEditMode && equipmentId) {
        // Mode édition
        await combatEquipmentService.update(equipmentId, equipmentData);
        Alert.alert('הצלחה', 'הציוד עודכן בהצלחה', [
          { text: 'אישור', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Mode ajout
        await addCombatEquipment(equipmentData);
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>טוען...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.arme} />
        </View>
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
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>
            {isEditMode ? 'עריכת ציוד' : 'הוספת ציוד חדש'}
          </Text>
          <Text style={styles.subtitle}>
            {isEditMode ? 'עדכן את הפרטים' : 'הוסף ציוד לוחם חדש'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name Input */}
        <View style={styles.section}>
          <Text style={styles.label}>שם הציוד *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="לדוגמה: M16, אופטיקה, אפוד"
            placeholderTextColor={Colors.text.light}
          />
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>קטגוריה *</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Serial Input */}
        <View style={styles.section}>
          <Text style={styles.label}>מסטב (אופציונלי)</Text>
          <TextInput
            style={styles.input}
            value={serial}
            onChangeText={setSerial}
            placeholder="הזן מספר סידורי..."
            placeholderTextColor={Colors.text.light}
          />
        </View>

        {/* Has Sub Equipment Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <Switch
              value={hasSubEquipment}
              onValueChange={setHasSubEquipment}
              trackColor={{ false: '#ccc', true: Colors.modules.arme }}
              thumbColor="#fff"
            />
            <Text style={styles.label}>יש רכיבים נוספים?</Text>
          </View>
        </View>

        {/* Sub Equipments */}
        {hasSubEquipment && (
          <View style={styles.section}>
            <Text style={styles.label}>רכיבים נוספים</Text>

            {/* Add Sub Equipment */}
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
                placeholder="שם רכיב (לדוגמה: מחסנית, רצועה)"
                placeholderTextColor={Colors.text.light}
              />
            </View>

            {/* Sub Equipment List */}
            {subEquipments.map((sub) => (
              <View key={sub.id} style={styles.subItem}>
                <TouchableOpacity
                  style={styles.removeSubButton}
                  onPress={() => removeSubEquipment(sub.id)}
                >
                  <Text style={styles.removeSubButtonText}>×</Text>
                </TouchableOpacity>
                <Text style={styles.subItemText}>{sub.name}</Text>
              </View>
            ))}

            {subEquipments.length === 0 && (
              <Text style={styles.noSubText}>
                לא נוספו רכיבים. הוסף רכיבים למעלה.
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
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
            <Text style={styles.saveButtonText}>
              {isEditMode ? 'עדכן ציוד' : 'שמור ציוד'}
            </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  categoryButtonActive: {
    backgroundColor: Colors.modules.arme,
    borderColor: Colors.modules.arme,
  },
  categoryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryButtonTextActive: {
    color: '#FFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'flex-end',
  },
  addSubContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  subInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlign: 'right',
  },
  addSubButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSubButtonText: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  subItemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'right',
  },
  removeSubButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  removeSubButtonText: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: 'bold',
  },
  noSubText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
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

export default AddCombatEquipmentScreen;
