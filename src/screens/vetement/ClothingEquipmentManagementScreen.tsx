// Écran de gestion des équipements de vêtement
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/colors';
import { clothingEquipmentService } from '../../services/firebaseService';
import { ClothingEquipment } from '../../types';

const ClothingEquipmentManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<ClothingEquipment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingEquipment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    yamach: '',
  });

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const data = await clothingEquipmentService.getAll();
      setEquipment(data);
    } catch (error) {
      console.error('Error loading equipment:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הציוד');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', yamach: '' });
    setModalVisible(true);
  };

  const handleEdit = (item: ClothingEquipment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      yamach: item.yamach?.toString() || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('שגיאה', 'אנא הזן שם ציוד');
      return;
    }

    try {
      const equipmentData = {
        name: formData.name.trim(),
        yamach: formData.yamach ? parseInt(formData.yamach) : undefined,
      };

      if (editingItem) {
        // Update
        await clothingEquipmentService.update(editingItem.id, equipmentData);
        Alert.alert('הצלחה', 'הציוד עודכן בהצלחה');
      } else {
        // Create
        await clothingEquipmentService.create(equipmentData);
        Alert.alert('הצלחה', 'הציוד נוסף בהצלחה');
      }

      setModalVisible(false);
      loadEquipment();
    } catch (error) {
      console.error('Error saving equipment:', error);
      Alert.alert('שגיאה', 'נכשל בשמירת הציוד');
    }
  };

  const handleDelete = (item: ClothingEquipment) => {
    Alert.alert(
      'מחיקת ציוד',
      `האם אתה בטוח שברצונך למחוק את "${item.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await clothingEquipmentService.delete(item.id);
              Alert.alert('הצלחה', 'הציוד נמחק בהצלחה');
              loadEquipment();
            } catch (error) {
              console.error('Error deleting equipment:', error);
              Alert.alert('שגיאה', 'נכשל במחיקת הציוד');
            }
          },
        },
      ]
    );
  };

  // Ajouter les équipements par défaut
  const addDefaultEquipment = async () => {
    const defaultItems = [
      { name: 'חולצה ב', yamach: undefined },
      { name: 'מכנסיים ב', yamach: undefined },
      { name: 'חולצה א', yamach: undefined },
      { name: 'מכנסיים א', yamach: undefined },
      { name: 'נעליים', yamach: undefined },
      { name: 'כומתה', yamach: undefined },
      { name: 'קסדה', yamach: undefined },
      { name: 'וסט לוחם', yamach: undefined },
      { name: 'שק שינה', yamach: undefined },
      { name: 'תרמיל', yamach: undefined },
      { name: 'מימייה', yamach: undefined },
      { name: 'פונצ\'ו', yamach: undefined },
      { name: 'חגורה', yamach: undefined },
      { name: 'גרביים', yamach: undefined },
      { name: 'תחתונים', yamach: undefined },
    ];

    Alert.alert(
      'הוספת ציוד ברירת מחדל',
      'פעולה זו תוסיף 15 פריטי ציוד בסיסיים. להמשיך?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הוסף',
          onPress: async () => {
            try {
              for (const item of defaultItems) {
                await clothingEquipmentService.create(item);
              }
              Alert.alert('הצלחה', 'ציוד ברירת מחדל נוסף בהצלחה');
              loadEquipment();
            } catch (error) {
              console.error('Error adding default equipment:', error);
              Alert.alert('שגיאה', 'נכשל בהוספת ציוד ברירת מחדל');
            }
          },
        },
      ]
    );
  };

  if (loading) {
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
            <Text style={styles.title}>ניהול ציוד ביגוד</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.vetement} />
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
          <Text style={styles.title}>ניהול ציוד ביגוד</Text>
          <Text style={styles.subtitle}>👕 {equipment.length} פריטים</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>+ הוסף ציוד</Text>
          </TouchableOpacity>

          {equipment.length === 0 && (
            <TouchableOpacity
              style={styles.defaultButton}
              onPress={addDefaultEquipment}
            >
              <Text style={styles.defaultButtonText}>📋 הוסף ציוד ברירת מחדל</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Equipment List */}
        {equipment.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין ציוד במערכת</Text>
            <Text style={styles.emptySubtext}>
              לחץ על "הוסף ציוד ברירת מחדל" להתחיל
            </Text>
          </View>
        ) : (
          <View style={styles.equipmentList}>
            {equipment.map((item) => (
              <View key={item.id} style={styles.equipmentCard}>
                <View style={styles.equipmentInfo}>
                  <Text style={styles.equipmentName}>{item.name}</Text>
                  {item.yamach !== undefined && (
                    <Text style={styles.equipmentYamach}>ימח: {item.yamach}</Text>
                  )}
                </View>
                <View style={styles.equipmentActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEdit(item)}
                  >
                    <Text style={styles.editButtonText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'עריכת ציוד' : 'הוספת ציוד'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>שם הציוד *</Text>
              <TextInput
                style={styles.input}
                placeholder="לדוגמה: חולצה ב"
                placeholderTextColor={Colors.text.light}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                textAlign="right"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ימח (אופציונלי)</Text>
              <TextInput
                style={styles.input}
                placeholder="כמות"
                placeholderTextColor={Colors.text.light}
                value={formData.yamach}
                onChangeText={(text) =>
                  setFormData({ ...formData, yamach: text.replace(/[^0-9]/g, '') })
                }
                keyboardType="numeric"
                textAlign="right"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerContent: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  addButton: {
    flex: 1,
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.small,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  defaultButton: {
    flex: 1,
    backgroundColor: Colors.status.info,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.small,
  },
  defaultButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  equipmentList: {
    gap: 12,
  },
  equipmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  equipmentYamach: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  equipmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.status.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Shadows.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 20,
    textAlign: 'right',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.status.success,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
});

export default ClothingEquipmentManagementScreen;
