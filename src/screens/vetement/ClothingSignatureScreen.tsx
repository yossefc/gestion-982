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
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { clothingStockService, EquipmentStock } from '../../services/clothingStockService';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { openWhatsAppChat } from '../../services/whatsappService';
import { AppModal, ModalType } from '../../components';

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
}

const SERIAL_REQUIRED_ITEMS = ['קסדה', 'וסט לוחם', 'וסט קרמי'];

const ClothingSignatureScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { soldier } = route.params as { soldier: any };
  const { user, authLoading } = useAuth();
  const signatureRef = useRef<any>(null);

  // OPTIMISÉ: Utiliser le cache centralisé pour les équipements
  const { clothingEquipment, isInitialized } = useData();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showSignature, setShowSignature] = useState(false);
  const [stockData, setStockData] = useState<Map<string, EquipmentStock>>(new Map());
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  // OPTIMISE: Utiliser les donnees du cache des qu'elles sont disponibles
  // Mode offline: continuer meme si pas completement initialise
  useEffect(() => {
    // Ne pas recharger si deja en mode offline ou si donnees deja chargees
    if (isOfflineMode || dataLoaded) return;

    // Charger des qu'on a des donnees OU que le cache est initialise
    if (clothingEquipment.length > 0 || isInitialized) {
      setEquipment(clothingEquipment as Equipment[]);
      loadSoldierSpecificData();
      setDataLoaded(true);
    }
  }, [isInitialized, clothingEquipment, isOfflineMode, dataLoaded]);

  // Timeout de securite: apres 3 secondes, continuer quand meme (mode offline)
  // Ce timeout gere TOUS les cas de blocage: authLoading, Firebase lent, etc.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('[ClothingSignature] Timeout (3s) - proceeding in offline mode');
        setIsOfflineMode(true);
        setEquipment(clothingEquipment as Equipment[]);
        setLoading(false);
      }
    }, 3000); // Reduit a 3 secondes pour une meilleure UX
    return () => clearTimeout(timeout);
  }, [loading, clothingEquipment]);

  // Charger uniquement les données spécifiques au soldat (pas en cache global)
  const loadSoldierSpecificData = async () => {
    try {
      setLoading(true);

      // Mode offline: charger ce qu'on peut, ignorer les erreurs
      let stocks: EquipmentStock[] = [];
      let currentHoldings: any[] = [];

      try {
        stocks = await clothingStockService.getAllEquipmentStocks();
      } catch (error) {
        console.warn('[ClothingSignature] Could not load stocks (offline?):', error);
      }

      try {
        currentHoldings = await transactionalAssignmentService.getCurrentHoldings(soldier.id, 'clothing');
      } catch (error) {
        console.warn('[ClothingSignature] Could not load holdings (offline?):', error);
      }

      const stockMap = new Map<string, EquipmentStock>();
      stocks.forEach(stock => stockMap.set(stock.equipmentId, stock));
      setStockData(stockMap);

      // Pré-remplir avec les holdings actuels du soldat
      if (currentHoldings && currentHoldings.length > 0) {
        const preSelected = new Map<string, SelectedItem>();
        currentHoldings.forEach((item: any) => {
          const eq = clothingEquipment.find((e: any) => e.id === item.equipmentId);
          if (eq) {
            preSelected.set(eq.id, {
              equipment: eq as Equipment,
              quantity: item.quantity,
              serial: item.serial,
            });
          }
        });
        setSelectedItems(preSelected);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // En mode offline, ne pas afficher d'erreur - continuer avec ce qu'on a
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

    // Pas de vérification de stock - permet d'aller en négatif
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

  const handleConfirmSignature = () => {
    signatureRef.current?.readSignature();
  };

  const validateAndSubmit = () => {
    if (selectedItems.size === 0) {
      setModalType('error');
      setModalMessage('יש לבחור לפחות פריט אחד');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    // Check serial numbers
    for (const [id, item] of selectedItems) {
      if (requiresSerial(item.equipment.name) && !item.serial?.trim()) {
        setModalType('error');
        setModalMessage(`יש להזין מספר סידורי עבור ${item.equipment.name}`);
        setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
        setModalVisible(true);
        return;
      }
    }

    // Pas de vérification de stock - on permet d'aller en négatif
    setShowSignature(true);
  };

  const handleSubmit = async () => {
    if (!signatureData) {
      setModalType('error');
      setModalMessage('יש לחתום על הטופס');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
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

      // Create transactional assignment with requestId
      console.log('[ClothingSignature] Creating transactional assignment...');

      const requestId = `clothing_issue_${soldier.id}_${Date.now()}`;

      const assignmentId = await transactionalAssignmentService.issueEquipment({
        soldierId: soldier.id,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        type: 'clothing',
        items,
        signature: signatureData,
        assignedBy: user?.id || '',
        requestId,
      });

      console.log('[ClothingSignature] Assignment created successfully with ID:', assignmentId);

      // Generate WhatsApp message
      let whatsappMessage = `שלום ${soldier.name},\n\nההחתמה בוצעה בהצלחה.\n\n`;
      whatsappMessage += 'ציוד שהוחתם:\n';
      for (const item of Array.from(selectedItems.values())) {
        whatsappMessage += `• ${item.equipment.name} - כמות: ${item.quantity}`;
        if (item.serial) {
          whatsappMessage += ` (מסטב: ${item.serial})`;
        }
        whatsappMessage += '\n';
      }
      whatsappMessage += `\nהציוד רשום על שמך ובאחריותך.\nתודה,\nגדוד 982`;

      // Show success modal
      setModalType('success');
      setModalMessage('ההחתמה בוצעה בהצלחה');
      const buttons: any[] = [
        {
          text: 'סגור',
          style: 'primary',
          icon: 'checkmark-circle' as const,
          onPress: () => {
            setModalVisible(false);
            navigation.goBack();
          },
        },
      ];
      if (soldier.phone) {
        buttons.push({
          text: 'שלח WhatsApp',
          style: 'outline',
          icon: 'logo-whatsapp' as const,
          onPress: async () => {
            try {
              await openWhatsAppChat(soldier.phone, whatsappMessage);
            } catch (e) {
              console.error('WhatsApp error:', e);
            }
            setModalVisible(false);
            navigation.goBack();
          },
        });
      }
      setModalButtons(buttons);
      setModalVisible(true);
    } catch (error) {
      console.error('[ClothingSignature] Error saving:', error);
      setModalType('error');
      setModalMessage('לא ניתן לשמור את ההחתמה: ' + (error as Error).message);
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  // Afficher le loading seulement si on charge ET qu'on n'est pas en mode offline
  // Le timeout de 3s garantit qu'on ne reste jamais bloque indefiniment
  if (loading && !isOfflineMode) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.vetement} />
        <Text style={styles.loadingText}>טוען ציוד...</Text>
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
          <Text style={styles.headerTitle}>זיכוי אפסנאות</Text>
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
                        {(() => {
                          const stock = stockData.get(eq.id);
                          const currentSelection = item?.quantity || 0;
                          const originalAvailable = stock?.available ?? (eq.yamach || 0);
                          const remainingAfterSelection = isSelected
                            ? originalAvailable - currentSelection
                            : originalAvailable;
                          return (
                            <Text style={[
                              styles.equipmentYamach,
                              remainingAfterSelection < 0 && { color: '#EF4444' }
                            ]}>
                              נותר: {remainingAfterSelection} (ימ״ח: {stock?.yamach ?? eq.yamach ?? 0})
                            </Text>
                          );
                        })()}
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
            {/* Summary at signature step */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>סיכום הציוד:</Text>
              {Array.from(selectedItems.values()).map((item, idx) => (
                <View key={idx} style={{ marginTop: 4 }}>
                  <Text style={styles.summaryText}>
                    • {item.equipment.name} x {item.quantity}
                  </Text>
                  {item.serial && (
                    <Text style={[styles.summaryText, { fontSize: 12, color: '#666', marginLeft: 16 }]}>
                      מסטב: {item.serial}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Signature Section */}
            <Text style={styles.sectionTitle}>חתימת החייל</Text>
            <Text style={styles.signatureInstruction}>אנא חתום באזור המסומן למטה</Text>

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
                    .m-signature-pad {
                      box-shadow: none;
                      border: 2px dashed #E5E7EB;
                      border-radius: 8px;
                    }
                    .m-signature-pad--body {
                      border: none;
                    }
                    .m-signature-pad--footer {
                      display: none;
                    }
                    canvas {
                      touch-action: none;
                    }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#000000"
                  minWidth={3}
                  maxWidth={5}
                  style={styles.signatureCanvas}
                />
              </View>

              <View style={styles.excludeSignatureActions}>
                <TouchableOpacity
                  style={styles.clearSignatureButton}
                  onPress={handleClearSignature}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  <Text style={styles.clearSignatureText}>נקה חתימה</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmSignatureButton}
                  onPress={handleConfirmSignature}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.textWhite} />
                  <Text style={styles.confirmSignatureText}>קלוט חתימה</Text>
                </TouchableOpacity>
              </View>
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

      {/* App Modal */}
      <AppModal
        visible={modalVisible}
        type={modalType}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
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
    paddingBottom: 200,
  },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    textAlign: 'right',
  },

  signatureInstruction: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontStyle: 'italic',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    margin: 1,
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

  excludeSignatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  confirmSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.info,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },

  confirmSignatureText: {
    fontSize: FontSize.md,
    color: Colors.textWhite,
    fontWeight: '600',
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