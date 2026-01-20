// Écran d'אפסון ציוד לחימה - Mise en dépôt avec signature
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { RootStackParamList, Soldier, AssignmentItem } from '../../types';
import { soldierService } from '../../services/firebaseService';
import { assignmentService } from '../../services/assignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/Colors';
import { openWhatsAppChat } from '../../services/whatsappService';

type CombatStorageRouteProp = RouteProp<RootStackParamList, 'CombatStorage'>;

interface StorageItem extends AssignmentItem {
  selected: boolean;
  storageQuantity: number;
  availableSerials: string[];
  selectedSerials: string[];
}

const CombatStorageScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CombatStorageRouteProp>();
  const { soldierId } = route.params || {};
  const { user } = useAuth();

  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    if (!soldierId) {
      console.error('[CombatStorage] No soldierId provided in route params!');
      Alert.alert('שגיאה', 'לא נמצא מזהה חייל');
      navigation.goBack();
      return;
    }
    loadData();
  }, [soldierId]);

  const loadData = async () => {
    try {
      console.log(`[CombatStorage] Loading data for soldier: ${soldierId}`);

      const [soldierData, currentItems] = await Promise.all([
        soldierService.getById(soldierId),
        assignmentService.calculateCurrentHoldings(soldierId, 'combat'),
      ]);

      console.log(`[CombatStorage] Soldier: ${soldierData?.name}`);
      console.log(`[CombatStorage] Current items:`, currentItems.length);

      setSoldier(soldierData);

      // Convertir les items en StorageItems
      const storageItems: StorageItem[] = currentItems.map(item => {
        const serialsArray = item.serial
          ? item.serial.split(',').map(s => s.trim())
          : [];

        return {
          ...item,
          selected: false,
          storageQuantity: 0,
          availableSerials: serialsArray,
          selectedSerials: [],
        };
      });

      setItems(storageItems);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הנתונים');
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
            storageQuantity: !item.selected ? item.quantity : 0,
            selectedSerials: [],
          }
          : item
      )
    );
  };

  const updateStorageQuantity = (equipmentId: string, delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.equipmentId === equipmentId) {
          const newQuantity = Math.max(
            0,
            Math.min(item.quantity, item.storageQuantity + delta)
          );
          return { ...item, storageQuantity: newQuantity };
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
            storageQuantity: selectedSerials.length,
          };
        }
        return item;
      })
    );
  };

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
  };

  const handleStorageEquipment = async () => {
    const selectedItems = items.filter(
      item => item.selected && item.storageQuantity > 0
    );

    if (selectedItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד לאפסון');
      return;
    }

    if (!signature) {
      Alert.alert('שגיאה', 'אנא חתום לפני ביצוע האפסון');
      return;
    }

    Alert.alert(
      'אפסון ציוד',
      `האם אתה בטוח שברצונך לאפסן ${selectedItems.length} פריטים?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: async () => {
            setProcessing(true);
            try {
              // Créer l'assignment de type storage
              const storageItems = selectedItems.map(item => {
                const itemData: any = {
                  equipmentId: item.equipmentId,
                  equipmentName: item.equipmentName,
                  quantity: item.storageQuantity,
                };

                if (item.selectedSerials.length > 0) {
                  itemData.serial = item.selectedSerials.join(', ');
                }

                return itemData;
              });

              const assignmentData: any = {
                soldierId,
                soldierName: soldier?.name || '',
                soldierPersonalNumber: soldier?.personalNumber || '',
                type: 'combat' as const,
                action: 'storage' as const,
                items: storageItems,
                status: 'אופסן' as const,
                assignedBy: user?.id || '',
              };

              if (soldier?.phone) assignmentData.soldierPhone = soldier.phone;
              if (soldier?.company) assignmentData.soldierCompany = soldier.company;
              if (user?.name) assignmentData.assignedByName = user.name;
              if (user?.email) assignmentData.assignedByEmail = user.email;

              const assignmentId = await assignmentService.create(assignmentData, signature || undefined);
              console.log('Combat storage assignment created:', assignmentId);

              // Mettre à jour weapons_inventory - passer en status 'storage' AVEC les infos du soldat
              console.log('[CombatStorage] Updating weapons_inventory to storage status...');

              for (const item of selectedItems) {
                if (item.selectedSerials && item.selectedSerials.length > 0) {
                  for (const serial of item.selectedSerials) {
                    if (serial.trim()) {
                      try {
                        const weapon = await weaponInventoryService.getWeaponBySerialNumber(serial.trim());

                        if (weapon) {
                          console.log(`[CombatStorage] Moving weapon ${weapon.serialNumber} to storage`);

                          // Utiliser la nouvelle fonction pour mettre en storage AVEC infos soldat
                          await weaponInventoryService.moveWeaponToStorageWithSoldier(weapon.id, {
                            soldierId: soldier!.id,
                            soldierName: soldier!.name,
                            soldierPersonalNumber: soldier!.personalNumber,
                          });

                          console.log(`[CombatStorage] ✅ Weapon ${weapon.serialNumber} moved to storage`);
                        } else {
                          console.warn(`[CombatStorage] Weapon not found for serial: ${serial}`);
                        }
                      } catch (error) {
                        console.error(`[CombatStorage] Error updating weapon ${serial}:`, error);
                      }
                    }
                  }
                }
              }

              // Message WhatsApp
              let whatsappMessage = `שלום ${soldier?.name},\n\nהאפסון בוצע בהצלחה.\n\n`;
              whatsappMessage += 'ציוד שאופסן:\n';
              selectedItems.forEach(item => {
                whatsappMessage += `• ${item.equipmentName} - כמות: ${item.storageQuantity}`;
                if (item.selectedSerials && item.selectedSerials.length > 0) {
                  whatsappMessage += ` (מסטב: ${item.selectedSerials.join(', ')})`;
                }
                whatsappMessage += '\n';
              });
              whatsappMessage += `\nהציוד שמור בנשקייה ורשום על שמך.\nתודה,\nגדוד 982`;

              const storedCount = selectedItems.reduce((sum, item) => sum + item.storageQuantity, 0);

              Alert.alert(
                'הצלחה',
                `האפסון בוצע בהצלחה!\n\n${storedCount} פריטים אופסנו בנשקייה.`,
                [
                  {
                    text: 'שלח WhatsApp',
                    onPress: async () => {
                      if (soldier?.phone) {
                        await openWhatsAppChat(soldier.phone, whatsappMessage);
                      } else {
                        Alert.alert('שגיאה', 'אין מספר טלפון לחייל');
                      }
                      navigation.goBack();
                    },
                  },
                  {
                    text: 'סגור',
                    style: 'cancel',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              Alert.alert('שגיאה', 'נכשל באפסון הציוד');
              console.error('Error storing equipment:', error);
            } finally {
              setProcessing(false);
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
            <Text style={styles.title}>אפסון ציוד</Text>
            <Text style={styles.subtitle}>שמירה בנשקייה</Text>
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
            <Text style={styles.title}>חתימת מאפסן</Text>
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
          <Text style={styles.title}>אפסון ציוד</Text>
          <Text style={styles.subtitle}>🏦 שמירה בנשקייה</Text>
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
            • בחר את הפריטים לאפסון{'\n'}
            • הגדר כמות לכל פריט{'\n'}
            • בחר מסטבים אם רלוונטי{'\n'}
            • חתום לאישור האפסון{'\n'}
            • הציוד יישאר רשום על שמך בנשקייה
          </Text>
        </View>

        {/* Items List */}
        <Text style={styles.sectionTitle}>ציוד פעיל ({items.length})</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין ציוד פעיל לאפסון</Text>
            <Text style={styles.emptySubtext}>
              החייל לא קיבל ציוד או כל הציוד כבר אופסן
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
                    <Text style={styles.itemName}>{item.equipmentName}</Text>

                    {/* Display serials */}
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
                      <Text style={styles.detailLabel}>כמות לאפסון:</Text>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateStorageQuantity(item.equipmentId, -1)
                          }
                          disabled={processing}
                        >
                          <Text style={styles.quantityButtonText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>
                          {item.storageQuantity}
                        </Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateStorageQuantity(item.equipmentId, 1)
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
        {items.some(i => i.selected && i.storageQuantity > 0) && (
          <TouchableOpacity
            style={[
              styles.storageButton,
              processing && styles.buttonDisabled,
            ]}
            onPress={handleStorageEquipment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.storageButtonText}>
                🏦 אפסן ({items.filter(i => i.selected).length})
              </Text>
            )}
          </TouchableOpacity>
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
  header: {
    backgroundColor: '#FF6F00',
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
    paddingBottom: 100,
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
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
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
    borderColor: '#FF6F00',
    backgroundColor: '#FFF3E0',
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
    color: '#FF6F00',
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
    alignItems: 'flex-end',
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
    backgroundColor: '#FF6F00',
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
    backgroundColor: '#FF6F00',
    borderColor: '#FF6F00',
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
    borderColor: '#FF6F00',
  },
  signatureStatus: {
    fontSize: 16,
    color: '#FF6F00',
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
    backgroundColor: '#FF6F00',
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
  storageButton: {
    backgroundColor: '#FF6F00',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
    ...Shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  storageButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
});

export default CombatStorageScreen;
