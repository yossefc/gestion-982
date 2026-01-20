/**
 * ClothingSignatureScreen.tsx - Signature de vêtements
 * Design militaire professionnel
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { clothingEquipmentService } from '../../services/clothingEquipmentService';
import { assignmentService } from '../../services/assignmentService';
import { clothingStockService } from '../../services/clothingStockService';
import { useAuth } from '../../contexts/AuthContext';

interface Equipment {
  id: string;
  name: string;
  yamach?: number;
  requiresSerial?: boolean;
}

interface SelectedItem {
  equipment: Equipment;
  quantity: number;
  serial?: string;
  availableStock?: number; // Stock disponible pour cet équipement
}

const SERIAL_REQUIRED_ITEMS = ['קסדה', 'וסט לוחם', 'וסט קרמי'];

const ClothingSignatureScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { soldier } = route.params as { soldier: any };
  const { user, authLoading } = useAuth();
  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const equipmentData = await clothingEquipmentService.getAll();
      setEquipment(equipmentData);

      // Charger ce que le soldat a actuellement pour pré-remplir
      const currentHoldings = await assignmentService.calculateCurrentHoldings(soldier.id, 'clothing');

      if (currentHoldings && currentHoldings.length > 0) {
        const preSelected = new Map<string, SelectedItem>();
        currentHoldings.forEach((item: any) => {
          const eq = equipmentData.find((e: any) => e.id === item.equipmentId);
          if (eq) {
            preSelected.set(eq.id, {
              equipment: eq,
              quantity: item.quantity,
              serial: item.serial,
            });
          }
        });
        setSelectedItems(preSelected);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (eq: Equipment) => {
    if (selectedItems.has(eq.id)) {
      // Désélectionner
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(eq.id);
        return newMap;
      });
    } else {
      // Sélectionner directement sans vérifier le stock
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        newMap.set(eq.id, {
          equipment: eq,
          quantity: 1,
        });
        return newMap;
      });
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    const item = selectedItems.get(id);
    if (!item) return;

    const newQty = Math.max(1, item.quantity + delta);

    // Vérification locale du stock (rapide, pas de requête réseau)
    if (item.availableStock !== undefined && newQty > item.availableStock) {
      Alert.alert(
        'מלאי לא מספיק',
        `זמין: ${item.availableStock} יחידות\nמבוקש: ${newQty} יחידות\n\nאי אפשר להקצות יותר מהמלאי הזמין.`
      );
      return;
    }

    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(id, { ...item, quantity: newQty });
      return newMap;
    });
  };

  const updateSerial = (id: string, serial: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(id);
      if (item) {
        newMap.set(id, { ...item, serial });
      }
      return newMap;
    });
  };

  const requiresSerial = (name: string) => {
    return SERIAL_REQUIRED_ITEMS.some(item => name.includes(item));
  };

  const handleSignatureEnd = () => {
    signatureRef.current?.readSignature();
  };

  const handleSignatureChange = (signature: string) => {
    setSignatureData(signature);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clearSignature();
    setSignatureData(null);
  };

  const validateAndSubmit = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות פריט אחד');
      return;
    }

    // Check serial numbers
    for (const [id, item] of selectedItems) {
      if (requiresSerial(item.equipment.name) && !item.serial?.trim()) {
        Alert.alert('שגיאה', `יש להזין מספר סידורי עבור ${item.equipment.name}`);
        return;
      }
    }

    // Vérification finale du stock pour tous les items sélectionnés
    for (const [id, item] of selectedItems) {
      if (item.equipment.yamach !== undefined && item.equipment.yamach !== null) {
        const { available, stock } = await clothingStockService.isQuantityAvailable(id, item.quantity);

        if (!available && stock) {
          Alert.alert(
            'מלאי לא מספיק',
            `הציוד "${item.equipment.name}"\nזמין: ${stock.available} יחידות\nמבוקש: ${item.quantity} יחידות\n\nאנא הפחת את הכמות.`
          );
          return;
        }
      }
    }

    setShowSignature(true);
  };

  const handleSubmit = async () => {
    if (!signatureData) {
      Alert.alert('שגיאה', 'יש לחתום על הטופס');
      return;
    }

    console.log('[ClothingSignature] Starting submit...');
    console.log('[ClothingSignature] User:', user);
    console.log('[ClothingSignature] Soldier:', soldier);
    console.log('[ClothingSignature] Selected items count:', selectedItems.size);

    try {
      setSaving(true);

      const items = Array.from(selectedItems.values()).map(item => ({
        equipmentId: item.equipment.id,
        equipmentName: item.equipment.name,
        quantity: item.quantity,
        serial: item.serial || '',
      }));

      console.log('[ClothingSignature] Items to save:', items);

      // Create assignment with correct field names
      // La signature est automatiquement uploadée par createAssignment
      const assignmentId = await assignmentService.create({
        soldierId: soldier.id,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        type: 'clothing',
        action: 'issue',
        items,
        status: 'נופק לחייל',
        assignedBy: user?.uid || '',
        assignedByName: user?.displayName || user?.email || '',
        assignedByEmail: user?.email || '',
      }, signatureData);

      console.log('[ClothingSignature] Assignment created successfully with ID:', assignmentId);

      Alert.alert('הצלחה', 'ההחתמה בוצעה בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('[ClothingSignature] Error saving:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את ההחתמה: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.vetement} />
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
          <Text style={styles.headerTitle}>החתמת ביגוד</Text>
          <Text style={styles.headerSubtitle}>{soldier.name}</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {/* Soldier Info Card */}
        <View style={styles.soldierCard}>
          <View style={styles.soldierAvatar}>
            <Ionicons name="person" size={32} color={Colors.vetement} />
          </View>
          <View style={styles.soldierInfo}>
            <Text style={styles.soldierName}>{soldier.name}</Text>
            <Text style={styles.soldierNumber}>מ.א: {soldier.personalNumber}</Text>
          </View>
        </View>

        {!showSignature ? (
          <>
            {/* Equipment Selection */}
            <Text style={styles.sectionTitle}>בחירת ציוד</Text>
            <View style={styles.equipmentList}>
              {equipment.map((eq) => {
                const isSelected = selectedItems.has(eq.id);
                const item = selectedItems.get(eq.id);

                return (
                  <View key={eq.id} style={styles.equipmentCard}>
                    <TouchableOpacity
                      style={styles.equipmentRow}
                      onPress={() => toggleItem(eq)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color={Colors.textWhite} />
                        )}
                      </View>
                      <View style={styles.equipmentInfo}>
                        <Text style={styles.equipmentName}>{eq.name}</Text>
                        <View style={styles.equipmentMetaRow}>
                          {eq.yamach !== undefined && eq.yamach !== null && (
                            <Text style={styles.equipmentYamach}>ימ״ח: {eq.yamach}</Text>
                          )}
                          {isSelected && item?.availableStock !== undefined && (
                            <Text style={styles.equipmentAvailable}>
                              זמין: {item.availableStock}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={styles.itemDetails}>
                        {/* Quantity Controls */}
                        <View style={styles.quantityRow}>
                          <Text style={styles.quantityLabel}>כמות:</Text>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => updateQuantity(eq.id, -1)}
                            >
                              <Ionicons name="remove" size={20} color={Colors.danger} />
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{item?.quantity}</Text>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => updateQuantity(eq.id, 1)}
                            >
                              <Ionicons name="add" size={20} color={Colors.success} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Serial Input */}
                        {requiresSerial(eq.name) && (
                          <View style={styles.serialRow}>
                            <Text style={styles.serialLabel}>מספר סידורי: *</Text>
                            <TextInput
                              style={styles.serialInput}
                              placeholder="הזן מספר סידורי"
                              placeholderTextColor={Colors.placeholder}
                              value={item?.serial || ''}
                              onChangeText={(text) => updateSerial(eq.id, text)}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Summary */}
            {selectedItems.size > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>סיכום</Text>
                <Text style={styles.summaryText}>
                  {selectedItems.size} פריטים נבחרו
                </Text>
              </View>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                selectedItems.size === 0 && styles.buttonDisabled,
              ]}
              onPress={validateAndSubmit}
              disabled={selectedItems.size === 0}
            >
              <Text style={styles.continueButtonText}>המשך לחתימה</Text>
              <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Signature Section */}
            <Text style={styles.sectionTitle}>חתימת החייל</Text>

            <View style={styles.signatureContainer}>
              <View style={styles.signatureWrapper}>
                <SignatureCanvas
                  ref={signatureRef}
                  onEnd={handleSignatureEnd}
                  onOK={handleSignatureChange}
                  onBegin={() => setScrollEnabled(false)}
                  onEmpty={() => setSignatureData(null)}
                  descriptionText=""
                  clearText="נקה"
                  confirmText="אישור"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                  `}
                  backgroundColor={Colors.backgroundCard}
                  penColor={Colors.text}
                  style={styles.signatureCanvas}
                />
              </View>

              <TouchableOpacity
                style={styles.clearSignatureButton}
                onPress={handleClearSignature}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                <Text style={styles.clearSignatureText}>נקה חתימה</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.backToEquipmentButton}
                onPress={() => setShowSignature(false)}
              >
                <Text style={styles.backToEquipmentText}>חזור לבחירת ציוד</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!signatureData || saving) && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!signatureData || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.textWhite} />
                    <Text style={styles.submitButtonText}>שמור החתמה</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    textAlign: 'right',
  },

  // Soldier Card
  soldierCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.small,
  },

  soldierAvatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.vetementLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  soldierInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  soldierName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },

  soldierNumber: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Equipment List
  equipmentList: {
    gap: Spacing.md,
  },

  equipmentCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },

  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  checkboxSelected: {
    backgroundColor: Colors.vetement,
    borderColor: Colors.vetement,
  },

  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  equipmentName: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: Colors.text,
  },

  equipmentMetaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },

  equipmentYamach: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  equipmentAvailable: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '500',
  },

  itemDetails: {
    backgroundColor: Colors.backgroundInput,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  quantityLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },

  quantityValue: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 30,
    textAlign: 'center',
  },

  serialRow: {
    marginTop: Spacing.md,
  },

  serialLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'right',
  },

  serialInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },

  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.successDark,
    textAlign: 'right',
  },

  summaryText: {
    fontSize: FontSize.base,
    color: Colors.successDark,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  // Buttons
  continueButton: {
    backgroundColor: Colors.vetement,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    ...Shadows.small,
  },

  continueButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  buttonDisabled: {
    backgroundColor: Colors.disabled,
  },

  // Signature
  signatureContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },

  signatureWrapper: {
    height: 250,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  signatureCanvas: {
    flex: 1,
  },

  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.xs,
  },

  clearSignatureText: {
    fontSize: FontSize.md,
    color: Colors.danger,
  },

  // Action Buttons
  actionButtons: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },

  backToEquipmentButton: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  backToEquipmentText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  submitButton: {
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.small,
  },

  submitButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textWhite,
  },
});

export default ClothingSignatureScreen;