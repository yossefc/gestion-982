// Écran de retour d'équipement (זיכוי חייל) avec signature et WhatsApp
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { RootStackParamList, Soldier, AssignmentItem } from '../../types';
import {
  assignmentService,
  soldierService,
  pdfStorageService,
} from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/colors';
import { generateAssignmentPDF } from '../../services/pdfService';
import { downloadAndSharePdf, openWhatsAppChat } from '../../services/whatsappService';

type ClothingReturnRouteProp = RouteProp<RootStackParamList, 'ClothingReturn'>;

interface ReturnItem extends AssignmentItem {
  selected: boolean;
  returnQuantity: number;
  availableSerials: string[]; // Serials disponibles (depuis serial string)
  selectedSerials: string[]; // Serials sélectionnés pour le retour
}

const ClothingReturnScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ClothingReturnRouteProp>();
  const { soldierId } = route.params;
  const { user } = useAuth();

  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [soldierData, currentItems] = await Promise.all([
        soldierService.getById(soldierId),
        assignmentService.calculateCurrentHoldings(soldierId, 'clothing'),
      ]);

      setSoldier(soldierData);

      // Convertir les items en ReturnItems
      // Convertir serial (string) en tableau de serials
      const returnItems: ReturnItem[] = currentItems.map(item => {
        const serialsArray = item.serial
          ? item.serial.split(',').map(s => s.trim())
          : [];

        return {
          ...item,
          selected: false,
          returnQuantity: 0,
          availableSerials: serialsArray,
          selectedSerials: [], // Initialement vide
        };
      });

      setItems(returnItems);
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
  };

  const handleReturnEquipment = async () => {
    const selectedItems = items.filter(
      item => item.selected && item.returnQuantity > 0
    );

    if (selectedItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד לזיכוי');
      return;
    }

    if (!signature) {
      Alert.alert('שגיאה', 'אנא חתום לפני ביצוע הזיכוי');
      return;
    }

    Alert.alert(
      'זיכוי ציוד',
      `האם אתה בטוח שברצונך לזכות ${selectedItems.length} פריטים?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: async () => {
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

                return itemData;
              });

              // Créer le credit assignment (sans timestamp - ajouté automatiquement)
              const assignmentData: any = {
                soldierId,
                soldierName: soldier?.name || '',
                soldierPersonalNumber: soldier?.personalNumber || '',
                type: 'clothing' as const,
                action: 'credit' as const,
                items: creditItems,
                signature,
                status: 'זוכה' as const,
                assignedBy: user?.id || '',
              };

              // Ajouter les champs optionnels seulement s'ils existent
              if (soldier?.phone) assignmentData.soldierPhone = soldier.phone;
              if (soldier?.company) assignmentData.soldierCompany = soldier.company;
              if (user?.name) assignmentData.assignedByName = user.name;
              if (user?.email) assignmentData.assignedByEmail = user.email;

              const assignmentId = await assignmentService.create(assignmentData);
              console.log('Credit assignment created:', assignmentId);

              // Générer PDF
              const pdfBytes = await generateAssignmentPDF({
                ...assignmentData,
                id: assignmentId,
              });

              const pdfUrl = await pdfStorageService.uploadPdf(
                pdfBytes,
                assignmentId
              );

              await assignmentService.update(assignmentId, { pdfUrl });
              console.log('PDF generated and uploaded:', pdfUrl);

              // Calculer les items restants (recalculer depuis assignments)
              const remainingItems = await assignmentService.calculateCurrentHoldings(
                soldierId,
                'clothing'
              );

              const hasRemainingItems = remainingItems.length > 0;

              // Générer message WhatsApp
              let whatsappMessage = `שלום ${soldier?.name},\n\nהזיכוי בוצע בהצלחה.\n\n`;

              if (hasRemainingItems) {
                whatsappMessage += 'ציוד פתוח:\n';
                remainingItems.forEach(item => {
                  whatsappMessage += `• ${item.equipmentName} - כמות: ${item.quantity}\n`;
                });
              } else {
                whatsappMessage += 'אין ציוד פתוח.\n';
              }

              whatsappMessage += `\nתודה,\nגדוד 982`;

              // Afficher succès avec options WhatsApp
              Alert.alert(
                'הצלחה',
                hasRemainingItems
                  ? `הזיכוי בוצע בהצלחה. לחייל נותר ציוד פתוח (${remainingItems.length} פריטים).`
                  : 'הזיכוי בוצע בהצלחה. החייל אין לו ציוד פתוח.',
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
                    text: 'שלח PDF',
                    onPress: async () => {
                      const fileName = `credit_${soldier?.personalNumber}_${Date.now()}.pdf`;
                      await downloadAndSharePdf(pdfUrl, fileName);
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
              Alert.alert('שגיאה', 'נכשל בזיכוי הציוד');
              console.error('Error returning equipment:', error);
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
            <Text style={styles.title}>זיכוי חייל</Text>
            <Text style={styles.subtitle}>החזרת ציוד</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.vetement} />
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
                    <Text style={styles.itemName}>{item.equipmentName}</Text>
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
                ↩️ זכה ({items.filter(i => i.selected).length})
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
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldierCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  soldierInfo: {
    alignItems: 'flex-end',
  },
  soldierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  soldierMeta: {
    fontSize: 14,
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  itemsList: {
    gap: 12,
    marginBottom: 20,
  },
  itemCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  itemCardSelected: {
    borderColor: Colors.status.success,
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
    borderColor: Colors.border.dark,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 18,
    color: Colors.status.success,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  itemDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  quantitySection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
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
    backgroundColor: Colors.modules.vetement,
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  quantityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
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
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border.dark,
  },
  serialChipSelected: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  serialChipText: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  serialChipTextSelected: {
    color: Colors.text.white,
  },
  signatureSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  signaturePreview: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.status.success,
  },
  signatureStatus: {
    fontSize: 16,
    color: Colors.status.success,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  changeSignatureButton: {
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  changeSignatureText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  signButton: {
    backgroundColor: Colors.modules.vetement,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    ...Shadows.medium,
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
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
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.medium,
  },
  endSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  clearSignatureButton: {
    flex: 1,
    backgroundColor: Colors.status.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.medium,
  },
  clearSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
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
  returnButton: {
    backgroundColor: Colors.status.warning,
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
    color: Colors.text.white,
  },
});

export default ClothingReturnScreen;
