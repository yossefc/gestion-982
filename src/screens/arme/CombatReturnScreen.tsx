// ֳ‰cran de retour d'ֳ©quipement ׳׳—׳™׳׳” (׳–׳™׳›׳•׳™ ׳—׳™׳™׳) avec WhatsApp
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, Soldier, AssignmentItem } from '../../types';
import { soldierService, combatEquipmentService } from '../../services/firebaseService';
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/Colors';
import { openWhatsAppChat } from '../../services/whatsappService';
import { AppModal, ModalType } from '../../components';
import { generateAndPrintPDF, PrintAssignmentData } from '../../utils/printUtils';
import { Ionicons } from '@expo/vector-icons';

type CombatReturnRouteProp = RouteProp<RootStackParamList, 'CombatReturn'> & {
  params: {
    soldierId: string;
    isClearance?: boolean;
  };
};

interface ReturnItem extends AssignmentItem {
  itemKey: string;
  selected: boolean;
  returnQuantity: number;
  availableSerials: string[]; // Serials disponibles (depuis serial string)
  selectedSerials: string[]; // Serials sֳ©lectionnֳ©s pour le retour
  status?: 'assigned' | 'stored';
}

const CombatReturnScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CombatReturnRouteProp>();
  const { soldierId, isClearance } = route.params || {};
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [printing, setPrinting] = useState(false);

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
      setModalMessage('׳׳ ׳ ׳׳¦׳ ׳׳–׳”׳” ׳—׳™׳™׳');
      setModalButtons([{
        text: '׳¡׳’׳•׳¨',
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
          itemKey: `${item.equipmentId}_${item.status || 'assigned'}`,
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: item.quantity,
          serial: (item.serials || []).join(','), // Unified AssignmentItem field
          selected: false,
          returnQuantity: 0,
          availableSerials: serialsArray,
          selectedSerials: [], // Initialement vide
          status: item.status, // Transfֳ©rer le statut
        };
      });

      console.log(`[CombatReturn] Return items prepared: ${returnItems.length}`);
      setItems(returnItems);
    } catch (error) {
      console.error('Error loading data:', error);
      setModalType('error');
      setModalMessage('׳ ׳›׳©׳ ׳‘׳˜׳¢׳™׳ ׳× ׳”׳ ׳×׳•׳ ׳™׳');
      setModalButtons([{ text: '׳¡׳’׳•׳¨', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemKey: string) => {
    setItems(prev =>
      prev.map(item =>
        item.itemKey === itemKey
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

  const updateReturnQuantity = (itemKey: string, delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.itemKey === itemKey) {
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

  const toggleSerial = (itemKey: string, serial: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.itemKey === itemKey) {
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

  const handleReturnEquipment = async () => {
    const selectedItems = items.filter(
      item => item.selected && item.returnQuantity > 0
    );

    if (selectedItems.length === 0) {
      setModalType('error');
      setModalMessage('׳׳ ׳ ׳‘׳—׳¨ ׳׳₪׳—׳•׳× ׳₪׳¨׳™׳˜ ׳׳—׳“ ׳׳–׳™׳›׳•׳™');
      setModalButtons([{ text: '׳¡׳’׳•׳¨', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    setModalType('confirm');
    setModalTitle('׳–׳™׳›׳•׳™ ׳¦׳™׳•׳“');
    setModalMessage(`׳”׳׳ ׳׳×׳” ׳‘׳˜׳•׳— ׳©׳‘׳¨׳¦׳•׳ ׳ ׳׳–׳›׳•׳× ${selectedItems.length} ׳₪׳¨׳™׳˜׳™׳?`);
    setModalButtons([
      { text: '׳‘׳™׳˜׳•׳', style: 'outline', onPress: () => setModalVisible(false) },
      {
        text: '׳׳©׳¨',
        style: 'primary',
        icon: 'checkmark-circle' as const,
        onPress: async () => {
          setModalVisible(false);
          setProcessing(true);
          try {
            // Prֳ©parer les items pour le credit assignment
            const creditItems = selectedItems.map(item => {
              const itemData: any = {
                equipmentId: item.equipmentId,
                equipmentName: item.equipmentName,
                quantity: item.returnQuantity,
                status: item.status,
              };

              // Ajouter serial seulement s'il y a des serials sֳ©lectionnֳ©s
              if (item.selectedSerials.length > 0) {
                itemData.serial = item.selectedSerials.join(', ');
              }

              return itemData;
            });

            const requestId = `combat_return_${soldierId}_${Date.now()}`;

            await transactionalAssignmentService.returnEquipment({
              soldierId,
              soldierName: soldier?.name || '',
              soldierPersonalNumber: soldier?.personalNumber || '',
              type: 'combat',
              items: creditItems,
              returnedBy: user?.id || '',
              requestId,
            });

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

            // Gֳ©nֳ©rer message WhatsApp
            let whatsappMessage = `׳©׳׳•׳ ${soldier?.name},\n\n׳”׳–׳™׳›׳•׳™ ׳‘׳•׳¦׳¢ ׳‘׳”׳¦׳׳—׳”.\n\n`;

            // Montrer ce qui a ֳ©tֳ© retournֳ©
            whatsappMessage += '׳¦׳™׳•׳“ ׳©׳”׳•׳—׳–׳¨:\n';
            selectedItems.forEach(item => {
              whatsappMessage += `ג€¢ ${item.equipmentName} - ׳›׳׳•׳×: ${item.returnQuantity}`;
              if (item.selectedSerials && item.selectedSerials.length > 0) {
                whatsappMessage += ` (׳׳¡׳˜׳‘: ${item.selectedSerials.join(', ')})`;
              }
              whatsappMessage += '\n';
            });

            // Montrer ce qui reste (s'il reste quelque chose)
            if (hasRemainingItems) {
              whatsappMessage += '\n׳¦׳™׳•׳“ ׳©׳ ׳•׳×׳¨ ׳‘׳™׳“׳™׳:\n';
              remainingItems.forEach((item: any) => {
                whatsappMessage += `ג€¢ ${item.equipmentName} - ׳›׳׳•׳×: ${item.quantity}`;
                const serialStr = (item.serials || []).join(',');
                if (serialStr) {
                  whatsappMessage += ` (׳׳¡׳˜׳‘: ${serialStr})`;
                }
                whatsappMessage += '\n';
              });
            } else {
              whatsappMessage += '\n׳›׳ ׳”׳¦׳™׳•׳“ ׳”׳•׳—׳–׳¨. ׳×׳•׳“׳”!\n';
            }

            whatsappMessage += `\n׳×׳•׳“׳”,\n׳’׳“׳•׳“ 982`;

            // Afficher succֳ¨s avec options WhatsApp
            const returnedCount = selectedItems.reduce((sum, item) => sum + item.returnQuantity, 0);

            setModalType('success');
            setModalTitle('׳”׳¦׳׳—׳”');
            setModalMessage(hasRemainingItems
              ? `׳”׳–׳™׳›׳•׳™ ׳‘׳•׳¦׳¢ ׳‘׳”׳¦׳׳—׳”!\n\n${returnedCount} ׳₪׳¨׳™׳˜׳™׳ ׳”׳•׳—׳–׳¨׳•.\n׳ ׳•׳×׳¨׳• ${remainingItems.length} ׳₪׳¨׳™׳˜׳™׳ ׳‘׳™׳“׳™ ׳”׳—׳™׳™׳.`
              : `׳”׳–׳™׳›׳•׳™ ׳‘׳•׳¦׳¢ ׳‘׳”׳¦׳׳—׳”!\n\n${returnedCount} ׳₪׳¨׳™׳˜׳™׳ ׳”׳•׳—׳–׳¨׳•.\n׳”׳—׳™׳™׳ ׳”׳—׳–׳™׳¨ ׳׳× ׳›׳ ׳”׳¦׳™׳•׳“.`);
            setModalButtons([
              {
                text: '׳©׳׳— WhatsApp',
                style: 'primary',
                icon: 'logo-whatsapp' as const,
                onPress: async () => {
                  setModalVisible(false);
                  if (soldier?.phone) {
                    await openWhatsAppChat(soldier.phone, whatsappMessage);
                  } else {
                    setModalType('error');
                    setModalMessage('׳׳™׳ ׳׳¡׳₪׳¨ ׳˜׳׳₪׳•׳ ׳׳—׳™׳™׳');
                    setModalButtons([{ text: '׳¡׳’׳•׳¨', style: 'primary', onPress: () => setModalVisible(false) }]);
                    setModalVisible(true);
                    return;
                  }
                  navigation.goBack();
                },
              },
              {
                text: '׳¡׳’׳•׳¨',
                style: 'outline',
                onPress: () => {
                  setModalVisible(false);
                  navigation.goBack();
                },
              },
            ]);
            setModalVisible(true);
          } catch (error) {
            const message = (error as any)?.message;
            setModalType('error');
            setModalMessage(message || 'Cannot complete zikuy');
            setModalButtons([{ text: '׳¡׳’׳•׳¨', style: 'primary', onPress: () => setModalVisible(false) }]);
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

  const handlePrintCurrentHoldings = async () => {
    if (!soldier || items.length === 0) {
      setModalType('error');
      setModalMessage('׳׳™׳ ׳¦׳™׳•׳“ ׳׳”׳“׳₪׳¡׳”');
      setModalButtons([{ text: '׳¡׳’׳•׳¨', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    setPrinting(true);
    try {
      // Find the last assignment to get a signature if possible
      const assignments = await assignmentService.getAssignmentsBySoldier(soldierId, 'combat');
      const latestAssignmentWithSignature = assignments.find(a => a.signature);

      const printItems = items.map(item => ({
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        quantity: item.quantity,
        serial: item.serial || item.availableSerials.join(', '),
      }));

      const printData: PrintAssignmentData = {
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        items: printItems,
        signature: latestAssignmentWithSignature?.signature || '',
        operatorName: user?.name || user?.email || '',
        timestamp: new Date(),
        assignmentId: `holdings_${soldierId}_${Date.now()}`
      };

      await generateAndPrintPDF(printData);
    } catch (error) {
      console.error('Error printing holdings:', error);
      setModalType('error');
      setModalMessage('׳׳™׳¨׳¢׳” ׳©׳’׳™׳׳” ׳‘׳”׳“׳₪׳¡׳× ׳”׳˜׳•׳₪׳¡');
      setModalButtons([{ text: '׳¡׳’׳•׳¨', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setPrinting(false);
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
            <Text style={styles.backButtonText}>ג†</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>׳–׳™׳›׳•׳™ ׳—׳™׳™׳</Text>
            <Text style={styles.subtitle}>׳”׳—׳–׳¨׳× ׳¦׳™׳•׳“</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.arme} />
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
          <Text style={styles.backButtonText}>ג†</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>׳–׳™׳›׳•׳™ ׳—׳™׳™׳</Text>
          <Text style={styles.subtitle}>ג†©ן¸ ׳”׳—׳–׳¨׳× ׳¦׳™׳•׳“</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Soldier Info */}
        {soldier && (
          <View style={styles.soldierCard}>
            <View style={styles.soldierInfo}>
              <Text style={styles.soldierName}>{soldier.name}</Text>
              <Text style={styles.soldierMeta}>
                {soldier.personalNumber} ג€¢ {soldier.company}
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>נ“‹ ׳”׳ ׳—׳™׳•׳×</Text>
          <Text style={styles.instructionsText}>
            ג€¢ ׳‘׳—׳¨ ׳׳× ׳”׳₪׳¨׳™׳˜׳™׳ ׳©׳”׳—׳™׳™׳ ׳׳—׳–׳™׳¨{'\n'}
            ג€¢ ׳”׳’׳“׳¨ ׳›׳׳•׳× ׳׳›׳ ׳₪׳¨׳™׳˜{'\n'}
            ג€¢ ׳‘׳—׳¨ ׳׳¡׳˜׳‘׳™׳ ׳׳ ׳¨׳׳•׳•׳ ׳˜׳™
          </Text>
        </View>

        <View style={styles.sectionHeaderLine}>
          <Text style={styles.sectionTitle}>׳¦׳™׳•׳“ ׳₪׳¢׳™׳ ({items.length})</Text>

          {items.length > 0 && (
            <TouchableOpacity
              style={[styles.smallPrintBtn, printing && styles.buttonDisabled]}
              onPress={handlePrintCurrentHoldings}
              disabled={printing}
            >
              {printing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="print-outline" size={16} color={Colors.primary} />
                  <Text style={styles.smallPrintText}>׳”׳“׳₪׳¡ ׳˜׳•׳₪׳¡</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>׳׳™׳ ׳¦׳™׳•׳“ ׳₪׳¢׳™׳ ׳׳–׳™׳›׳•׳™</Text>
            <Text style={styles.emptySubtext}>
              ׳”׳—׳™׳™׳ ׳׳ ׳§׳™׳‘׳ ׳¦׳™׳•׳“ ׳׳• ׳›׳ ׳”׳¦׳™׳•׳“ ׳›׳‘׳¨ ׳–׳•׳›׳”
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map(item => (
              <View
                key={item.itemKey}
                style={[
                  styles.itemCard,
                  item.selected && styles.itemCardSelected,
                ]}
              >
                <TouchableOpacity
                  style={styles.itemHeader}
                  onPress={() => toggleItem(item.itemKey)}
                  disabled={processing}
                >
                  <View style={styles.checkbox}>
                    {item.selected && <Text style={styles.checkmark}>ג“</Text>}
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemNameContainer}>
                      <Text style={styles.itemName}>{item.equipmentName}</Text>
                      {item.status === 'stored' && (
                        <View style={styles.storedBadge}>
                          <Text style={styles.storedBadgeText}>׳‘׳׳₪׳¡׳•׳</Text>
                        </View>
                      )}
                    </View>

                    {/* Display serials prominently */}
                    {item.availableSerials && item.availableSerials.length > 0 && (
                      <View style={styles.serialDisplayContainer}>
                        <Text style={styles.serialDisplayLabel}>׳׳¡׳˜׳‘׳™׳:</Text>
                        <Text style={styles.serialDisplayValue}>
                          {item.availableSerials.join(', ')}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.itemQuantity}>
                      ׳›׳׳•׳× ׳–׳׳™׳ ׳”: {item.quantity}
                    </Text>
                  </View>
                </TouchableOpacity>

                {item.selected && (
                  <View style={styles.itemDetails}>
                    {/* Quantity selector */}
                    <View style={styles.quantitySection}>
                      <Text style={styles.detailLabel}>׳›׳׳•׳× ׳׳”׳—׳–׳¨׳”:</Text>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateReturnQuantity(item.itemKey, -1)
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
                            updateReturnQuantity(item.itemKey, 1)
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
                        <Text style={styles.detailLabel}>׳‘׳—׳¨ ׳׳¡׳˜׳‘׳™׳:</Text>
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
                                toggleSerial(item.itemKey, serial)
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
                setModalTitle('׳–׳™׳›׳•׳™ ׳”׳•׳©׳׳');
                setModalMessage('׳”׳—׳™׳™׳ ׳–׳•׳›׳” ׳‘׳”׳¦׳׳—׳” ׳‘׳ ׳©׳§׳™׳™׳”.');
                setModalButtons([{ text: '׳׳™׳©׳•׳¨', style: 'primary', onPress: () => { setModalVisible(false); navigation.goBack(); } }]);
                setModalVisible(true);
              } catch (err) {
                console.error(err);
                const message = (err as any)?.message;
                setModalType('error');
                setModalMessage(message || 'Error while completing zikuy');
                setModalVisible(true);
              } finally {
                setProcessing(false);
              }
            }}
            disabled={processing}
          >
            <Text style={styles.returnButtonText}>ג“ ׳׳©׳¨ ׳–׳™׳›׳•׳™ ׳¡׳•׳₪׳™ (Armory Clearance)</Text>
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
                {isClearance ? `ג†©ן¸ ׳”׳—׳–׳¨ ׳₪׳¨׳™׳˜׳™׳ (׳׳₪׳ ׳™ ׳–׳™׳›׳•׳™)` : `ג†©ן¸ ׳–׳›׳” (${items.filter(i => i.selected).length})`}
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
  sectionHeaderLine: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  smallPrintBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
  },
  smallPrintText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
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
