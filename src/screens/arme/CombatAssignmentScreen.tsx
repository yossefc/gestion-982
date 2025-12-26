// Écran de signature pour ציוד לחימה - Combat Equipment Assignment
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { RootStackParamList } from '../../types';
import { assignmentService, soldierService, combatEquipmentService, manaService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/colors';

type CombatAssignmentRouteProp = RouteProp<RootStackParamList, 'CombatAssignment'>;

interface SubEquipment {
  id: string;
  name: string;
  selected: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  selected: boolean;
  serial?: string;
  needsSerial: boolean;
  subEquipments?: SubEquipment[];
}

const CombatAssignmentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CombatAssignmentRouteProp>();
  const { soldierId } = route.params;
  const { user } = useAuth();

  const signatureRef = useRef<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<any>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [manot, setManot] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadSoldierData();
  }, []);

  const loadSoldierData = async () => {
    try {
      // Charger toutes les données en parallèle
      const [soldierData, combatEquipment, manotData] = await Promise.all([
        soldierService.getById(soldierId),
        combatEquipmentService.getAll(),
        manaService.getAll(),
      ]);

      setSoldier(soldierData);

      // Transformer les équipements Firebase en EquipmentItem pour l'UI
      const equipmentItems: EquipmentItem[] = combatEquipment.map(eq => ({
        id: eq.id,
        name: eq.name,
        category: eq.category,
        quantity: 1,
        selected: false,
        needsSerial: eq.serial !== undefined || ['נשק', 'אופטיקה'].includes(eq.category),
        subEquipments: eq.hasSubEquipment && eq.subEquipments
          ? eq.subEquipments.map(sub => ({
              id: sub.id,
              name: sub.name,
              selected: false,
            }))
          : undefined,
      }));

      setEquipment(equipmentItems);
      setManot(manotData);

      // Extraire les catégories uniques depuis les équipements
      const uniqueCategories = Array.from(
        new Set(combatEquipment.map(e => e.category))
      );

      const categoryColors: { [key: string]: string } = {
        'נשק': '#e74c3c',
        'אופטיקה': '#9b59b6',
        'ציוד מגן': '#27ae60',
        'ציוד נוסף': '#3498db',
      };

      const categoriesData = uniqueCategories.map(cat => ({
        name: cat,
        color: categoryColors[cat] || '#95a5a6',
      }));

      setCategories(categoriesData);
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בטעינת הנתונים');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const webStyle = `.m-signature-pad {
    box-shadow: none;
    border: none;
    background-color: #ffffff;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
  body,html {
    width: 100%;
    height: 100%;
  }`;

  const handleOK = (sig: string) => {
    setSignature(sig);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setSignature(null);
  };

  const selectMana = (manaId: string) => {
    const mana = manot.find(m => m.id === manaId);
    if (!mana) return;

    // Créer un Set des noms d'équipements dans la מנה
    const manaEquipmentNames = new Set(
      mana.equipments.map((eq: any) => eq.equipmentName)
    );

    setEquipment(prev =>
      prev.map(item => {
        const isInMana = manaEquipmentNames.has(item.name);
        return {
          ...item,
          selected: isInMana,
          quantity: isInMana
            ? mana.equipments.find((eq: any) => eq.equipmentName === item.name)?.quantity || 1
            : item.quantity,
          subEquipments: item.subEquipments?.map(sub => ({
            ...sub,
            selected: isInMana,
          })),
        };
      })
    );

    Alert.alert('הצלחה', `${mana.name} נבחרה`);
  };

  const toggleCategory = (categoryName: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const toggleEquipment = (id: string) => {
    setEquipment(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateQuantity = (id: string, delta: number) => {
    setEquipment(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const updateSerial = (id: string, serial: string) => {
    setEquipment(prev =>
      prev.map(item =>
        item.id === id ? { ...item, serial } : item
      )
    );
  };

  const toggleSubEquipment = (equipmentId: string, subId: string) => {
    setEquipment(prev =>
      prev.map(item => {
        if (item.id === equipmentId && item.subEquipments) {
          return {
            ...item,
            subEquipments: item.subEquipments.map(sub =>
              sub.id === subId ? { ...sub, selected: !sub.selected } : sub
            ),
          };
        }
        return item;
      })
    );
  };

  const handleSaveAndSign = async () => {
    const selectedItems = equipment.filter(item => item.selected);
    if (selectedItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד');
      return;
    }

    const missingSerials = selectedItems.filter(
      item => item.needsSerial && !item.serial
    );
    if (missingSerials.length > 0) {
      Alert.alert(
        'שגיאה',
        `אנא הזן מסטב עבור: ${missingSerials.map(i => i.name).join(', ')}`
      );
      return;
    }

    if (!signature) {
      Alert.alert('שגיאה', 'אנא חתום לפני שמירה');
      return;
    }

    setSaving(true);
    try {
      const assignmentItems = selectedItems.map(item => ({
        equipmentId: item.id,
        equipmentName: item.name,
        quantity: item.quantity,
        serial: item.serial || undefined,
        subEquipments: item.subEquipments
          ?.filter(sub => sub.selected)
          .map(sub => ({ name: sub.name, serial: undefined })),
      }));

      await assignmentService.create({
        soldierId,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        type: 'combat',
        items: assignmentItems,
        signature,
        status: 'נופק לחייל',
        assignedBy: user?.id || '',
      });

      Alert.alert('הצלחה', 'החתימה נשמרה בהצלחה', [
        {
          text: 'אישור',
          onPress: () => {
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]);
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בשמירת החתימה');
      console.error('Error saving signature:', error);
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.title}>החתמת ציוד לחימה</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.arme} />
        </View>
      </View>
    );
  }

  if (!soldier) {
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
            <Text style={styles.title}>שגיאה</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>החייל לא נמצא</Text>
        </View>
      </View>
    );
  }

  if (equipment.length === 0) {
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
            <Text style={styles.title}>החתמת ציוד לחימה</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>אין ציוד במערכת</Text>
          <Text style={{
            fontSize: 14,
            color: Colors.text.secondary,
            marginTop: 10,
            textAlign: 'center',
          }}>
            אנא הוסף ציוד דרך ניהול ציוד
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: Colors.status.info,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
              marginTop: 20,
              ...Shadows.small,
            }}
            onPress={() => navigation.navigate('CombatEquipmentList' as never)}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: Colors.text.white,
            }}>
              ⚙️ ניהול ציוד
            </Text>
          </TouchableOpacity>
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
          disabled={saving}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>החתמת ציוד לחימה</Text>
          <Text style={styles.subtitle}>🔫 נשקיה</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. פרטי החייל */}
        <View style={styles.soldierCard}>
          <View style={styles.soldierRow}>
            <Text style={styles.soldierValue}>{soldier.name}</Text>
            <Text style={styles.soldierLabel}>שם החייל:</Text>
          </View>
          <View style={styles.soldierRow}>
            <Text style={styles.soldierValue}>{soldier.personalNumber}</Text>
            <Text style={styles.soldierLabel}>מספר אישי:</Text>
          </View>
          <View style={styles.soldierRow}>
            <Text style={styles.soldierValue}>{soldier.company}</Text>
            <Text style={styles.soldierLabel}>פלוגה:</Text>
          </View>
          {soldier.phone && (
            <View style={styles.soldierRow}>
              <Text style={styles.soldierValue}>{soldier.phone}</Text>
              <Text style={styles.soldierLabel}>טלפון:</Text>
            </View>
          )}
        </View>

        {/* 2. בחירת מנה */}
        <Text style={styles.sectionTitle}>בחירת מנה (אופציונלי)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.manaScroll}
          contentContainerStyle={styles.manaContainer}
        >
          {manot.map(mana => (
            <TouchableOpacity
              key={mana.id}
              style={styles.manaChip}
              onPress={() => selectMana(mana.id)}
            >
              <Text style={styles.manaChipText}>{mana.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 3. רשימת ציוד לפי קטגוריות */}
        <Text style={styles.sectionTitle}>בחירת ציוד</Text>

        {categories.map(category => {
          const categoryEquipment = equipment.filter(e => e.category === category.name);
          const isCollapsed = collapsedCategories.has(category.name);

          return (
            <View key={category.name} style={styles.categorySection}>
              <TouchableOpacity
                style={[styles.categoryHeader, { borderRightColor: category.color }]}
                onPress={() => toggleCategory(category.name)}
              >
                <Text style={styles.categoryToggle}>{isCollapsed ? '▼' : '▲'}</Text>
                <Text style={styles.categoryTitle}>{category.name}</Text>
              </TouchableOpacity>

              {!isCollapsed && (
                <View style={styles.categoryContent}>
                  {categoryEquipment.map(item => (
                    <View key={item.id} style={styles.equipmentItem}>
                      <View style={styles.equipmentRow}>
                        {/* Checkbox */}
                        <TouchableOpacity
                          style={styles.checkbox}
                          onPress={() => toggleEquipment(item.id)}
                        >
                          {item.selected && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>

                        {/* Info */}
                        <View style={styles.equipmentMain}>
                          <View style={styles.equipmentInfo}>
                            <Text style={styles.equipmentName}>{item.name}</Text>
                          </View>

                          {/* Quantité */}
                          {item.selected && (
                            <View style={styles.quantityControls}>
                              <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => updateQuantity(item.id, 1)}
                              >
                                <Text style={styles.quantityButtonText}>+</Text>
                              </TouchableOpacity>
                              <Text style={styles.quantityText}>{item.quantity}</Text>
                              <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => updateQuantity(item.id, -1)}
                              >
                                <Text style={styles.quantityButtonText}>-</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* מסטב */}
                        {item.selected && item.needsSerial && (
                          <TextInput
                            style={styles.serialInput}
                            placeholder="מסטב"
                            placeholderTextColor={Colors.text.light}
                            value={item.serial || ''}
                            onChangeText={(text) => updateSerial(item.id, text)}
                            textAlign="right"
                          />
                        )}
                      </View>

                      {/* תת-ציוד */}
                      {item.selected && item.subEquipments && item.subEquipments.length > 0 && (
                        <View style={styles.subEquipmentContainer}>
                          <Text style={styles.subEquipmentTitle}>תת-ציוד:</Text>
                          {item.subEquipments.map(sub => (
                            <TouchableOpacity
                              key={sub.id}
                              style={styles.subEquipmentRow}
                              onPress={() => toggleSubEquipment(item.id, sub.id)}
                            >
                              <View style={styles.subCheckbox}>
                                {sub.selected && <Text style={styles.subCheckmark}>✓</Text>}
                              </View>
                              <Text style={styles.subEquipmentName}>{sub.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* 4. חתימה */}
        <Text style={styles.sectionTitle}>חתימה</Text>
        <View style={styles.signatureContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleOK}
            descriptionText=""
            clearText="נקה"
            confirmText="אשר"
            webStyle={webStyle}
            backgroundColor="#ffffff"
            penColor="#000000"
          />
        </View>

        <TouchableOpacity
          style={styles.clearSignatureButton}
          onPress={handleClear}
          disabled={saving}
        >
          <Text style={styles.clearSignatureText}>🗑️ נקה חתימה</Text>
        </TouchableOpacity>

        {/* 5. כפתורי פעולה */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveAndSign}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>✓ שמור והחתם</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfButton}
            onPress={() => Alert.alert('בקרוב', 'יצירת טופס 982 תהיה זמינה בקרוב')}
          >
            <Text style={styles.pdfButtonText}>📄 צור טופס 982</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>❌ ביטול</Text>
          </TouchableOpacity>
        </View>
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
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 50,
  },
  soldierCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  soldierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  soldierLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  soldierValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'right',
  },
  manaScroll: {
    marginBottom: 20,
  },
  manaContainer: {
    gap: 10,
    paddingVertical: 5,
  },
  manaChip: {
    backgroundColor: Colors.modules.arme,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    ...Shadows.small,
  },
  manaChipText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  categorySection: {
    marginBottom: 15,
  },
  categoryHeader: {
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRightWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  categoryToggle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginRight: 10,
  },
  categoryContent: {
    marginTop: 10,
    gap: 8,
  },
  equipmentItem: {
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.status.success,
    fontWeight: 'bold',
  },
  equipmentMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.modules.arme,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    minWidth: 30,
    textAlign: 'center',
  },
  serialInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    minWidth: 100,
    marginRight: 10,
  },
  subEquipmentContainer: {
    marginTop: 12,
    marginRight: 40,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: 10,
  },
  subEquipmentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 8,
    textAlign: 'right',
  },
  subEquipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    justifyContent: 'flex-end',
  },
  subCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  subCheckmark: {
    fontSize: 14,
    color: Colors.status.success,
    fontWeight: 'bold',
  },
  subEquipmentName: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  signatureContainer: {
    height: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.military.navyBlue,
    marginBottom: 15,
    ...Shadows.medium,
  },
  clearSignatureButton: {
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: Colors.status.danger,
  },
  clearSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.status.danger,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 30,
  },
  saveButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    ...Shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  pdfButton: {
    backgroundColor: Colors.status.info,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.small,
  },
  pdfButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  cancelButton: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.status.danger,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.status.danger,
  },
});

export default CombatAssignmentScreen;
