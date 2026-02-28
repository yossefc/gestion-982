// Écran de retour d'équipement לחימה (זיכוי חייל) avec signature et WhatsApp
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { RootStackParamList, Soldier, AssignmentItem } from '../../types';
import { soldierService, combatEquipmentService } from '../../services/firebaseService';
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/Colors';
import { openWhatsAppChat } from '../../services/whatsappService';
import { AppModal, ModalType } from '../../components';

type CombatReturnRouteProp = RouteProp<RootStackParamList, 'CombatReturn'> & {
  params: {
    soldierId: string;
    isClearance?: boolean;
  };
};

interface ReturnItem extends AssignmentItem {
  selected: boolean;
  returnQuantity: number;
  availableSerials: string[]; // Serials disponibles (depuis serial string)
  selectedSerials: string[]; // Serials sélectionnés pour le retour
  status?: 'assigned' | 'stored';
}

const CombatReturnScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CombatReturnRouteProp>();
  const { soldierId, isClearance } = route.params || {};
  const { user } = useAuth();

  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // AppModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  useEffect(() => {
    if (!soldierId) {
      console.error('[CombatReturn] No soldierId provided in route params!');
      setModalType('error');
      setModalMessage('לא נמצא מזהה חייל');
      setModalButtons([{
        text: 'סגור',
        style: 'primary',
        onPress: () => {
          setModalVisible(false);
          navigation.goBack();
        },
      }]);
      setModalVisible(true);
      return;
    }
    loadData();
  }, [soldierId]);

  const loadData = async () => {
    try {
      console.log(`[CombatReturn] Loading data for soldier: ${soldierId}`);

      const [soldierData, allEquipment, currentItems] = await Promise.all([
        soldierService.getById(soldierId),
        combatEquipmentService.getAll(),
        transactionalAssignmentService.getCurrentHoldings(soldierId, 'combat'),
      ]);

      console.log(`[CombatReturn] Soldier: ${soldierData?.name}`);
      console.log(`[CombatReturn] Current items from calculateCurrentHoldings:`, currentItems.length);
      console.log(`[CombatReturn] Items details:`, currentItems.map((i: any) => ({
        name: i.equipmentName,
        qty: i.quantity,
        serial: (i.serials || []).join(','),
      })));

      setSoldier(soldierData);

      // Convertir les items en ReturnItems
      // Convertir serial (string) en tableau de serials
      const returnItems: ReturnItem[] = currentItems.map((item: any) => {
        const serialsArray = item.serials || [];

        console.log(`[CombatReturn] Processing item ${item.equipmentName}: ${serialsArray.length} serials`);

        return {
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: item.quantity,
          serial: (item.serials || []).join(','), // Unified AssignmentItem field
          selected: false,
          returnQuantity: 0,
          availableSerials: serialsArray,
          selectedSerials: [], // Initialement vide
          status: item.status, // Transférer le statut
        };
      });

      console.log(`[CombatReturn] Return items prepared: ${returnItems.length}`);
      setItems(returnItems);
    } catch (error) {
      console.error('Error loading data:', error);
      setModalType('error');
      setModalMessage('נכשל בטעינת הנתונים');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (equipmentId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.equipmentId === equipmentId
          ? {
            ...item,
            selected: !item.selected,
            returnQuantity: !item.selected ? item.quantity : 0,
            selectedSerials: [],
          }
          : item
      )
    );
  };

  const updateReturnQuantity = (equipmentId: string, delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.equipmentId === equipmentId) {
          const newQuantity = Math.max(
            0,
            Math.min(item.quantity, item.returnQuantity + delta)
          );
          return { ...item, returnQuantity: newQuantity };
        }
        return item;
      })
    );
  };

  const toggleSerial = (equipmentId: string, serial: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.equipmentId === equipmentId) {
          const isSelected = item.selectedSerials.includes(serial);
          const selectedSerials = isSelected
            ? item.selectedSerials.filter(s => s !== serial)
            : [...item.selectedSerials, serial];

          return {
            ...item,
            selectedSerials,
            returnQuantity: selectedSerials.length,
          };
        }
        return item;
      })
    );
  };

  // Style du canvas de signature
  const webStyle = `
    .m-signature-pad {
      position: fixed;
      margin: auto;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 100%;
      box-shadow: none;
      border: 2px solid #2c5f7c;
      border-radius: 8px;
      background-color: #ffffff;
    }
    .m-signature-pad--body {
      border: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body,html {
      margin: 0px;
      padding: 0px;
    }
  `;

  const handleBegin = () => {
    setScrollEnabled(false);
  };

  const handleEnd = () => {
    setScrollEnabled(true);
    signatureRef.current?.readSignature();
  };

  const handleOK = (sig: string) => {
    setSignature(sig);
    setShowSignature(false);
    setScrollEnabled(true);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setSignature(null);
    setScrollEnabled(true);
  };

  const handleReturnEquipment = async () => {
    const selectedItems = items.filter(
      item => item.selected && item.returnQuantity > 0
    );

    if (selectedItems.length === 0) {
      setModalType('error');
      setModalMessage('אנא בחר לפחות פריט אחד לזיכוי');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    if (!signature) {
      setModalType('warning');
      setModalMessage('אנא חתום לפני ביצוע הזיכוי');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    setModalType('confirm');
    setModalTitle('זיכוי ציוד');
    setModalMessage(`האם אתה בטוח שברצונך לזכות ${selectedItems.length} פריטים?`);
    setModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setModalVisible(false) },
      {
        text: 'אשר',
        style: 'primary',
        icon: 'checkmark-circle' as const,
        onPress: async () => {
          setModalVisible(false);
          setProcessing(true);
          try {
            // Préparer les items pour le credit assignment
            const creditItems = selectedItems.map(item => {
              const itemData: any = {
                equipmentId: item.equipmentId,
                equipmentName: item.equipmentName,
                quantity: item.returnQuantity,
              };

              // Ajouter serial seulement s'il y a des serials sélectionnés
              if (item.selectedSerials.length > 0) {
                itemData.serial = item.selectedSerials.join(', ');
              }

              console.log('[CombatReturn] Credit item prepared:', {
                equipmentId: itemData.equipmentId,
                equipmentName: itemData.equipmentName,
                quantity: itemData.quantity,
                serial: itemData.serial,
              });

              return itemData;
            });

            // Create transactional return assignment with requestId
            console.log('[CombatReturn] Creating transactional return assignment...');

            const requestId = `combat_return_${soldierId}_${Date.now()}`;

            const assignmentId = await transactionalAssignmentService.returnEquipment({
              soldierId,
              soldierName: soldier?.name || '',
              soldierPersonalNumber: soldier?.personalNumber || '',
              type: 'combat',
              items: creditItems,
              returnedBy: user?.id || '',
              requestId,
            });

            console.log('[CombatReturn] Transactional return assignment created:', assignmentId);

            // Update weapon inventory status for returned weapons
            console.log('[CombatReturn] =====================================');
            console.log('[CombatReturn] DÉBUT MISE À JOUR weapons_inventory');
            console.log('[CombatReturn] =====================================');
            console.log('[CombatReturn] Selected items:', selectedItems.length);

            for (const item of selectedItems) {
              console.log(`[CombatReturn] Item: ${item.equipmentName}`);
              console.log(`[CombatReturn]   - selectedSerials:`, item.selectedSerials);
              console.log(`[CombatReturn]   - availableSerials:`, item.availableSerials);

              if (item.selectedSerials && item.selectedSerials.length > 0) {
                for (const serial of item.selectedSerials) {
                  console.log(`[CombatReturn] Processing serial: "${serial}" (trimmed: "${serial.trim()}")`);

                  if (serial.trim()) {
                    try {
                      // Find the weapon by serial number
                      console.log(`[CombatReturn] Searching weapon with serial: ${serial.trim()}`);
                      const weapon = await weaponInventoryService.getWeaponBySerialNumber(serial.trim());

                      if (weapon) {
                        console.log(`[CombatReturn] ✅ Weapon FOUND: ${weapon.serialNumber} (ID: ${weapon.id}, Status: ${weapon.status})`);
                        console.log(`[CombatReturn] Calling returnWeapon(${weapon.id})...`);

                        await weaponInventoryService.returnWeapon(weapon.id);

                        console.log(`[CombatReturn] ✅ Weapon ${weapon.serialNumber} status updated to 'available'`);
                      } else {
                        console.warn(`[CombatReturn] ⚠️ Weapon NOT FOUND for serial: ${serial}`);
                      }
                    } catch (error) {
                      console.error(`[CombatReturn] ❌ ERROR finding/updating weapon with serial ${serial}:`, error);
                    }
                  } else {
                    console.log(`[CombatReturn] ⚠️ Serial vide après trim, skip`);
                  }
                }
              } else {
                console.log(`[CombatReturn] Pas de serials sélectionnés pour ${item.equipmentName}`);
              }
            }

            console.log('[CombatReturn] =====================================');
            console.log('[CombatReturn] FIN MISE À JOUR weapons_inventory');
            console.log('[CombatReturn] =====================================');

            // Recalculer les holdings pour voir s'il reste quelque chose
            console.log('[CombatReturn] Final check of remaining items...');
            const remainingItems = await transactionalAssignmentService.getCurrentHoldings(
              soldierId,
              'combat'
            );

            console.log('[CombatReturn] Remaining items after credit:', remainingItems.length);
            console.log('[CombatReturn] Remaining items details:', remainingItems.map((i: any) => ({
              name: i.equipmentName,
              qty: i.quantity,
              serial: (i.serials || []).join(','),
            })));

            const hasRemainingItems = remainingItems.length > 0;
            console.log('[CombatReturn] hasRemainingItems:', hasRemainingItems);

            // Générer message WhatsApp
            let whatsappMessage = `שלום ${soldier?.name},\n\nהזיכוי בוצע בהצלחה.\n\n`;

            // Montrer ce qui a été retourné
            whatsappMessage += 'ציוד שהוחזר:\n';
            selectedItems.forEach(item => {
              whatsappMessage += `• ${item.equipmentName} - כמות: ${item.returnQuantity}`;
              if (item.selectedSerials && item.selectedSerials.length > 0) {
                whatsappMessage += ` (מסטב: ${item.selectedSerials.join(', ')})`;
              }
              whatsappMessage += '\n';
            });

            // Montrer ce qui reste (s'il reste quelque chose)
            if (hasRemainingItems) {
              whatsappMessage += '\nציוד שנותר בידיך:\n';
              remainingItems.forEach((item: any) => {
                whatsappMessage += `• ${item.equipmentName} - כמות: ${item.quantity}`;
                const serialStr = (item.serials || []).join(',');
                if (serialStr) {
                  whatsappMessage += ` (מסטב: ${serialStr})`;
                }
                whatsappMessage += '\n';
              });
            } else {
              whatsappMessage += '\nכל הציוד הוחזר. תודה!\n';
            }

            whatsappMessage += `\nתודה,\nגדוד 982`;

            // Afficher succès avec options WhatsApp
            const returnedCount = selectedItems.reduce((sum, item) => sum + item.returnQuantity, 0);

            setModalType('success');
            setModalTitle('הצלחה');
            setModalMessage(hasRemainingItems
              ? `הזיכוי בוצע בהצלחה!\n\n${returnedCount} פריטים הוחזרו.\nנותרו ${remainingItems.length} פריטים בידי החייל.`
              : `הזיכוי בוצע בהצלחה!\n\n${returnedCount} פריטים הוחזרו.\nהחייל החזיר את כל הציוד.`);
            setModalButtons([
              {
                text: 'שלח WhatsApp',
                style: 'primary',
                icon: 'logo-whatsapp' as const,
                onPress: async () => {
                  setModalVisible(false);
                  if (soldier?.phone) {
                    await openWhatsAppChat(soldier.phone, whatsappMessage);
                  } else {
                    setModalType('error');
                    setModalMessage('אין מספר טלפון לחייל');
                    setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
                    setModalVisible(true);
                    return;
                  }
                  navigation.goBack();
                },
              },
              {
                text: 'סגור',
                style: 'outline',
                onPress: () => {
                  setModalVisible(false);
                  navigation.goBack();
                },
              },
            ]);
            setModalVisible(true);
          } catch (error) {
            setModalType('error');
            setModalMessage('נכשל בזיכוי הציוד');
            setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
            setModalVisible(true);
            console.error('Error returning equipment:', error);
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
    setModalVisible(true);
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
            <Text style={styles.title}>זיכוי חייל</Text>
            <Text style={styles.subtitle}>החזרת ציוד</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
        </View>
      </View>
    );
  }

  if (showSignature) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowSignature(false)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>חתימת מקבל</Text>
          </View>
        </View>

        <View style={styles.signatureContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleOK}
            onBegin={handleBegin}
            onEnd={handleEnd}
            descriptionText=""
            clearText="נקה"
            confirmText="שמור"
            webStyle={webStyle}
            backgroundColor="#ffffff"
          />

          <View style={styles.signatureButtons}>
            <TouchableOpacity
              style={styles.endSignatureButton}
              onPress={handleEnd}
            >
              <Text style={styles.endSignatureText}>✓ סיים חתימה</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearSignatureButton}
              onPress={handleClear}
            >
              <Text style={styles.clearSignatureText}>🗑️ נקה</Text>
            </TouchableOpacity>
          </View>
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
          disabled={processing}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>זיכוי חייל</Text>
          <Text style={styles.subtitle}>↩️ החזרת ציוד</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
      >
        {/* Soldier Info */}
        {soldier && (
          <View style={styles.soldierCard}>
            <View style={styles.soldierInfo}>
              <Text style={styles.soldierName}>{soldier.name}</Text>
              <Text style={styles.soldierMeta}>
                {soldier.personalNumber} • {soldier.company}
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 הנחיות</Text>
          <Text style={styles.instructionsText}>
            • בחר את הפריטים שהחייל מחזיר{'\n'}
            • הגדר כמות לכל פריט{'\n'}
            • בחר מסטבים אם רלוונטי{'\n'}
            • חתום לאישור הזיכוי
          </Text>
        </View>

        {/* Items List */}
        <Text style={styles.sectionTitle}>ציוד פעיל ({items.length})</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין ציוד פעיל לזיכוי</Text>
            <Text style={styles.emptySubtext}>
              החייל לא קיבל ציוד או כל הציוד כבר זוכה
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map(item => (
              <View
                key={item.equipmentId}
                style={[
                  styles.itemCard,
                  item.selected && styles.itemCardSelected,
                ]}
              >
                <TouchableOpacity
                  style={styles.itemHeader}
                  onPress={() => toggleItem(item.equipmentId)}
                  disabled={processing}
                >
                  <View style={styles.checkbox}>
                    {item.selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemNameContainer}>
                      <Text style={styles.itemName}>{item.equipmentName}</Text>
                      {item.status === 'stored' && (
                        <View style={styles.storedBadge}>
                          <Text style={styles.storedBadgeText}>באפסון</Text>
                        </View>
                      )}
                    </View>

                    {/* Display serials prominently */}
                    {item.availableSerials && item.availableSerials.length > 0 && (
                      <View style={styles.serialDisplayContainer}>
                        <Text style={styles.serialDisplayLabel}>מסטבים:</Text>
                        <Text style={styles.serialDisplayValue}>
                          {item.availableSerials.join(', ')}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.itemQuantity}>
                      כמות זמינה: {item.quantity}
                    </Text>
                  </View>
                </TouchableOpacity>

                {item.selected && (
                  <View style={styles.itemDetails}>
                    {/* Quantity selector */}
                    <View style={styles.quantitySection}>
                      <Text style={styles.detailLabel}>כמות להחזרה:</Text>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateReturnQuantity(item.equipmentId, -1)
                          }
                          disabled={processing}
                        >
                          <Text style={styles.quantityButtonText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>
                          {item.returnQuantity}
                        </Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateReturnQuantity(item.equipmentId, 1)
                          }
                          disabled={processing}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Serials selector */}
                    {item.availableSerials.length > 0 && (
                      <View style={styles.serialsSection}>
                        <Text style={styles.detailLabel}>בחר מסטבים:</Text>
                        <View style={styles.serialsList}>
                          {item.availableSerials.map((serial, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.serialChip,
                                item.selectedSerials.includes(serial) &&
                                styles.serialChipSelected,
                              ]}
                              onPress={() =>
                                toggleSerial(item.equipmentId, serial)
                              }
                              disabled={processing}
                            >
                              <Text
                                style={[
                                  styles.serialChipText,
                                  item.selectedSerials.includes(serial) &&
                                  styles.serialChipTextSelected,
                                ]}
                              >
                                {serial}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Signature Section */}
        {items.some(i => i.selected) && (
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>חתימה</Text>
            {signature ? (
              <View style={styles.signaturePreview}>
                <Text style={styles.signatureStatus}>✓ החתימה נשמרה</Text>
                <TouchableOpacity
                  style={styles.changeSignatureButton}
                  onPress={() => setShowSignature(true)}
                  disabled={processing}
                >
                  <Text style={styles.changeSignatureText}>
                    שנה חתימה
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signButton}
                onPress={() => setShowSignature(true)}
                disabled={processing}
              >
                <Text style={styles.signButtonText}>✍️ לחץ לחתימה</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Button */}
        {/* If Clearance Mode and NO items, show Confirm Clearance Button */}
        {isClearance && items.length === 0 && (
          <TouchableOpacity
            style={[styles.returnButton, { backgroundColor: Colors.success }]}
            onPress={async () => {
              try {
                setProcessing(true);
                await soldierService.updateClearance(soldierId, 'armory', true);
                setModalType('success');
                setModalTitle('זיכוי הושלם');
                setModalMessage('החייל זוכה בהצלחה בנשקייה.');
                setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => { setModalVisible(false); navigation.goBack(); } }]);
                setModalVisible(true);
              } catch (err) {
                console.error(err);
                setModalType('error');
                setModalMessage('שגיאה בביצוע זיכוי');
                setModalVisible(true);
              } finally {
                setProcessing(false);
              }
            }}
            disabled={processing}
          >
            <Text style={styles.returnButtonText}>✓ אשר זיכוי סופי (Armory Clearance)</Text>
          </TouchableOpacity>
        )}

        {/* Regular Return Button (or Return & Clear if isClearance) */}
        {items.some(i => i.selected && i.returnQuantity > 0) && (
          <TouchableOpacity
            style={[
              styles.returnButton,
              processing && styles.buttonDisabled,
            ]}
            onPress={handleReturnEquipment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.returnButtonText}>
                {isClearance ? `↩️ החזר פריטים (לפני זיכוי)` : `↩️ זכה (${items.filter(i => i.selected).length})`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* App Modal */}
      <AppModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
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
  header: {
    backgroundColor: Colors.backgroundHeader,
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
    color: Colors.textWhite,
  },
  headerContent: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textWhite,
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
  scrollContent: {
    paddingBottom: 200,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldierCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  soldierInfo: {
    alignItems: 'flex-end',
  },
  soldierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  soldierMeta: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  instructionsCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b3d9f2',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
    textAlign: 'right',
  },
  itemsList: {
    gap: 12,
    marginBottom: 20,
  },
  itemCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  itemCardSelected: {
    borderColor: Colors.success,
    backgroundColor: '#f0fdf4',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 18,
    color: Colors.success,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storedBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  storedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  serialDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.armeLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-end',
  },
  serialDisplayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.arme,
    marginLeft: 6,
  },
  serialDisplayValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.armeDark,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  itemQuantity: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  itemDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quantitySection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  quantityButton: {
    backgroundColor: Colors.arme,
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  quantityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  serialsSection: {
    marginTop: 12,
  },
  serialsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  serialChip: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.borderDark,
  },
  serialChipSelected: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  serialChipText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  serialChipTextSelected: {
    color: Colors.textWhite,
  },
  signatureSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  signaturePreview: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  signatureStatus: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  changeSignatureButton: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  changeSignatureText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  signButton: {
    backgroundColor: Colors.arme,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    ...Shadows.medium,
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  signatureContainer: {
    flex: 1,
    padding: 20,
  },
  signatureButtons: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  endSignatureButton: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.medium,
  },
  endSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  clearSignatureButton: {
    flex: 1,
    backgroundColor: Colors.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.medium,
  },
  clearSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  emptyCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  returnButton: {
    backgroundColor: Colors.warning,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
    ...Shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  returnButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
});

export default CombatReturnScreen;
