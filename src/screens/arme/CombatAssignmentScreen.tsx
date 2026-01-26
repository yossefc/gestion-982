/**
 * CombatAssignmentScreen.tsx - Signature d'équipement de combat
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
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import * as Print from 'expo-print';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { combatEquipmentService, manaService } from '../../services/firebaseService';
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { printQueueService } from '../../services/printQueueService';
import { useAuth } from '../../contexts/AuthContext';
import { Mana, WeaponInventoryItem, Assignment } from '../../types';
import { openWhatsAppChat } from '../../services/whatsappService';

interface Equipment {
  id: string;
  name: string;
  category?: string;
  requiresSerial?: boolean;
  hasSubEquipment?: boolean;
  subEquipment?: { id: string; name: string }[];
}

interface SelectedItem {
  equipment: Equipment;
  quantity: number;
  serials?: string[]; // Array of serials when quantity > 1
  subItems?: string[];
}

type SelectionMode = 'mana' | 'manual';

const CombatAssignmentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { soldier } = route.params as { soldier: any };
  const { user } = useAuth();
  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('mana');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [manot, setManot] = useState<Mana[]>([]);
  const [selectedMana, setSelectedMana] = useState<Mana | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showSignature, setShowSignature] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);

  // Weapon inventory for autocomplete
  const [availableWeapons, setAvailableWeapons] = useState<WeaponInventoryItem[]>([]);
  const [serialPickerVisible, setSerialPickerVisible] = useState(false);
  const [currentSerialField, setCurrentSerialField] = useState<{ equipmentId: string; index: number; equipmentName: string } | null>(null);
  const [serialSearchText, setSerialSearchText] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState<Print.Printer | null>(null);

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      setLoading(true);
      const [equipmentData, manotData, currentItems] = await Promise.all([
        combatEquipmentService.getAll(),
        manaService.getAll(),
        transactionalAssignmentService.getCurrentHoldings(soldier.id, 'combat'),
      ]);
      console.log('Loaded equipment:', equipmentData.length, 'items');
      console.log('Loaded manot:', manotData.length, 'items');
      // The original code had weaponsData and existingData here.
      // The instruction snippet removed weaponsData from the destructuring,
      // but kept a console.log for it. To maintain functionality and avoid errors,
      // I'm keeping the weaponInventoryService call and its corresponding variable.
      // The instruction specifically asked to replace assignmentService.calculateCurrentHoldings.
      const weaponsData = await weaponInventoryService.getAvailableWeapons(); // Re-adding this to keep functionality
      console.log('Loaded available weapons:', weaponsData.length, 'items');
      console.log('Current items:', currentItems.length, 'items'); // Changed from 'Existing assignments' to 'Current items'
      setEquipment(equipmentData);
      setManot(manotData);
      setAvailableWeapons(weaponsData);
      setExistingAssignments(currentItems);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const selectMana = (mana: Mana) => {
    console.log('Selecting mana:', mana.name, 'with', mana.equipments.length, 'items');
    setSelectedMana(mana);
    // Auto-populate equipment from mana
    const newMap = new Map<string, SelectedItem>();
    mana.equipments.forEach(manaEq => {
      // Try to find by ID first, then by name
      let eq = equipment.find(e => e.id === manaEq.equipmentId);
      if (!eq) {
        eq = equipment.find(e => e.name === manaEq.equipmentName);
      }

      if (eq) {
        console.log('Adding equipment to selection:', eq.name, 'qty:', manaEq.quantity, 'requiresSerial:', eq.requiresSerial);
        newMap.set(eq.id, {
          equipment: eq,
          quantity: manaEq.quantity,
          serials: eq.requiresSerial ? Array(manaEq.quantity).fill('') : undefined,
          subItems: [],
        });
      } else {
        console.warn('Equipment not found:', manaEq.equipmentName, 'id:', manaEq.equipmentId);
      }
    });
    console.log('Selected items after mana selection:', newMap.size);
    setSelectedItems(newMap);
  };

  const toggleItem = (eq: Equipment) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(eq.id)) {
        newMap.delete(eq.id);
      } else {
        newMap.set(eq.id, {
          equipment: eq,
          quantity: 1,
          serials: eq.requiresSerial ? [''] : undefined,
          subItems: [],
        });
      }
      return newMap;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(id);
      if (item) {
        const newQty = Math.max(1, item.quantity + delta);
        // Adjust serials array if equipment requires serial
        let newSerials = item.serials;
        if (item.equipment.requiresSerial) {
          if (newQty > item.quantity) {
            // Add more empty slots
            newSerials = [...(item.serials || []), ...Array(newQty - item.quantity).fill('')];
          } else if (newQty < item.quantity) {
            // Remove extra serials
            newSerials = (item.serials || []).slice(0, newQty);
          }
        }
        newMap.set(id, { ...item, quantity: newQty, serials: newSerials });
      }
      return newMap;
    });
  };

  const updateSerial = (id: string, index: number, serial: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(id);
      if (item && item.serials) {
        const newSerials = [...item.serials];
        newSerials[index] = serial;
        newMap.set(id, { ...item, serials: newSerials });
      }
      return newMap;
    });
  };

  const openSerialPicker = (equipmentId: string, index: number, equipmentName: string, currentValue: string) => {
    setCurrentSerialField({ equipmentId, index, equipmentName });
    setSerialSearchText(currentValue || '');
    setSerialPickerVisible(true);
  };

  const selectSerial = (serial: string) => {
    if (currentSerialField) {
      updateSerial(currentSerialField.equipmentId, currentSerialField.index, serial);
      setSerialPickerVisible(false);
      setCurrentSerialField(null);
      setSerialSearchText('');
    }
  };

  const closeSerialPicker = () => {
    setSerialPickerVisible(false);
    setCurrentSerialField(null);
    setSerialSearchText('');
  };

  const toggleSubItem = (parentId: string, subItemId: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(parentId);
      if (item) {
        const subItems = item.subItems || [];
        const newSubItems = subItems.includes(subItemId)
          ? subItems.filter(id => id !== subItemId)
          : [...subItems, subItemId];
        newMap.set(parentId, { ...item, subItems: newSubItems });
      }
      return newMap;
    });
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

  const selectPrinter = async () => {
    try {
      const printer = await Print.selectPrinterAsync();
      setSelectedPrinter(printer);
      return printer;
    } catch (error) {
      console.error('[CombatAssignment] Error selecting printer:', error);
      return null;
    }
  };

  const sendToPrintQueue = async (assignmentData: {
    soldierName: string;
    soldierPersonalNumber: string;
    soldierPhone?: string;
    soldierCompany?: string;
    items: any[];
    signature: string;
    timestamp: Date;
  }) => {
    try {
      console.log('[CombatAssignment] Sending document to print queue...');

      // Générer le HTML (réutilise la fonction existante)
      const html = generatePDFHTML(assignmentData);

      // Créer le PDF en base64
      const { uri, base64 } = await Print.printToFileAsync({
        html,
        base64: true,
      });

      if (!base64) {
        throw new Error('Failed to generate PDF base64');
      }

      // Ajouter à la file d'attente Firebase
      const jobId = await printQueueService.addPrintJob(base64, {
        soldierName: assignmentData.soldierName,
        soldierPersonalNumber: assignmentData.soldierPersonalNumber,
        documentType: 'combat',
        createdBy: user?.id || 'unknown',
        createdByName: user?.displayName || user?.email || 'Unknown',
        metadata: {
          itemsCount: assignmentData.items.length,
          company: assignmentData.soldierCompany,
        },
      });

      console.log('[CombatAssignment] Document added to print queue:', jobId);
      return jobId;
    } catch (error) {
      console.error('[CombatAssignment] Error sending to print queue:', error);
      throw error;
    }
  };

  // Fonction helper pour générer le HTML
  const generatePDFHTML = (assignmentData: {
    soldierName: string;
    soldierPersonalNumber: string;
    soldierPhone?: string;
    soldierCompany?: string;
    items: any[];
    signature: string;
    timestamp: Date;
  }) => {
    const dateStr = assignmentData.timestamp.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const dateOnly = assignmentData.timestamp.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const timeOnly = assignmentData.timestamp.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const operatorText = user?.displayName || user?.email || '';

    const itemsRows = assignmentData.items
      .map(
        item => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.equipmentName}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.serial || ''}</td>
      </tr>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: Arial, sans-serif;
      direction: rtl;
      text-align: right;
      margin: 0;
      padding: 20px;
      font-size: 14px;
    }
    h1 {
      text-align: center;
      font-size: 24px;
      margin-bottom: 5px;
      color: #2c3e50;
    }
    h2 {
      text-align: center;
      font-size: 16px;
      margin-top: 0;
      margin-bottom: 10px;
      color: #7f8c8d;
    }
    .date-box {
      background-color: #3498db;
      color: white;
      padding: 12px;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 16px;
      font-weight: bold;
    }
    .date-box .date {
      font-size: 18px;
      margin-bottom: 5px;
    }
    .date-box .time {
      font-size: 14px;
      opacity: 0.9;
    }
    .soldier-info {
      border: 2px solid #2c3e50;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .soldier-info p {
      margin: 8px 0;
      font-size: 14px;
    }
    .soldier-info strong {
      font-weight: bold;
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #ecf0f1;
      padding: 10px;
      border: 1px solid #bdc3c7;
      font-weight: bold;
      text-align: right;
    }
    td {
      padding: 8px;
      border: 1px solid #ccc;
    }
    .signature-section {
      margin-top: 30px;
      text-align: right;
    }
    .signature-section strong {
      display: block;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
      color: #7f8c8d;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .meta-info {
      margin-top: 20px;
      font-size: 13px;
      color: #555;
    }
  </style>
</head>
<body>
  <h1>טופס מסירת ציוד לחימה</h1>
  <h2>גדוד 982</h2>

  <div class="date-box">
    <div class="date">📅 ${dateOnly}</div>
    <div class="time">🕐 שעה: ${timeOnly}</div>
  </div>

  <div class="soldier-info">
    <p><strong>שם חייל:</strong> ${assignmentData.soldierName}</p>
    <p><strong>מספר אישי:</strong> ${assignmentData.soldierPersonalNumber}</p>
    ${assignmentData.soldierCompany ? `<p><strong>פלוגה:</strong> ${assignmentData.soldierCompany}</p>` : ''}
    ${assignmentData.soldierPhone ? `<p><strong>טלפון:</strong> ${assignmentData.soldierPhone}</p>` : ''}
  </div>

  <h3 style="text-align: right; margin-top: 20px; margin-bottom: 10px;">פירוט ציוד:</h3>

  <table>
    <thead>
      <tr>
        <th>שם ציוד</th>
        <th style="width: 80px;">כמות</th>
        <th style="width: 120px;">מסטב</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="meta-info">
    <p><strong>תאריך ושעה:</strong> ${dateStr}</p>
    ${operatorText ? `<p><strong>בוצע על ידי:</strong> ${operatorText}</p>` : ''}
  </div>

  <div class="signature-section">
    <strong>חתימת מקבל:</strong>
    <img src="${assignmentData.signature}" style="max-width: 200px; max-height: 80px; border: 1px solid #ccc;" />
  </div>

  <div class="footer">
    <p>מסמך זה נוצר אוטומטית באמצעות מערכת ניהול ציוד גדוד 982</p>
  </div>
</body>
</html>
    `;
  };

  const generateAndPrintPDF = async (assignmentData: {
    soldierName: string;
    soldierPersonalNumber: string;
    soldierPhone?: string;
    soldierCompany?: string;
    items: any[];
    signature: string;
    timestamp: Date;
  }, askForPrinter: boolean = false) => {
    try {
      // Si demandé, permettre la sélection d'une imprimante
      let printerToUse = selectedPrinter;
      if (askForPrinter && Platform.OS === 'ios') {
        const newPrinter = await selectPrinter();
        if (newPrinter) {
          printerToUse = newPrinter;
        }
      }

      const html = generatePDFHTML(assignmentData);

      // Préparer les options d'impression
      const printOptions: any = {
        html,
        orientation: Print.Orientation.portrait,
      };

      // Si une imprimante est sélectionnée (iOS uniquement), l'utiliser
      if (printerToUse && Platform.OS === 'ios') {
        printOptions.printerUrl = printerToUse.url;
        console.log('[CombatAssignment] Using selected printer:', printerToUse.name);
      }

      // Imprimer le PDF
      // Sur iOS: Si printerUrl est fourni, imprime directement. Sinon, ouvre le sélecteur.
      // Sur Android: Ouvre toujours le dialogue d'impression système
      // Sur Web: Ouvre window.print()
      await Print.printAsync(printOptions);

      console.log('[CombatAssignment] Document sent to printer successfully');
    } catch (error) {
      console.error('[CombatAssignment] Error printing PDF:', error);
      // Ne pas bloquer si l'impression échoue
      Alert.alert('שים לב', 'לא ניתן להדפיס את המסמך, אך ההחתמה נשמרה בהצלחה');
    }
  };

  const validateAndContinue = () => {
    if (selectedItems.size === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות פריט אחד');
      return;
    }

    // Check for required serials
    for (const [id, item] of Array.from(selectedItems.entries())) {
      if (item.equipment.requiresSerial) {
        if (!item.serials || item.serials.length !== item.quantity) {
          Alert.alert('שגיאה', `יש להזין מספרים סידוריים עבור ${item.equipment.name}`);
          return;
        }
        // Check each serial is not empty
        for (let i = 0; i < item.serials.length; i++) {
          if (!item.serials[i]?.trim()) {
            Alert.alert('שגיאה', `יש להזין מספר סידורי ${i + 1} עבור ${item.equipment.name}`);
            return;
          }
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

    try {
      setSaving(true);
      console.log('[CombatAssignment] Starting save process...');

      const items = Array.from(selectedItems.values()).map(item => {
        const serialString = item.serials?.join(', ') || '';
        console.log(`[CombatAssignment] Preparing item ${item.equipment.name}:`, {
          quantity: item.quantity,
          serials: item.serials,
          serialString: serialString,
          requiresSerial: item.equipment.requiresSerial,
        });

        return {
          equipmentId: item.equipment.id,
          equipmentName: item.equipment.name,
          quantity: item.quantity,
          serial: serialString,
          subItems: item.subItems || [],
          issuedAt: new Date(),
          issuedBy: user?.id,
          type: 'combat',
        };
      });

      console.log('[CombatAssignment] Items prepared:', items.length);
      console.log('[CombatAssignment] Items with serials:', items.filter(i => i.serial).map(i => `${i.equipmentName}: ${i.serial}`));

      // Create assignment using transactional service with requestId
      console.log('[CombatAssignment] Creating transactional assignment...');

      const requestId = `combat_issue_${soldier.id}_${Date.now()}`;

      const assignmentId = await transactionalAssignmentService.issueEquipment({
        soldierId: soldier.id,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        type: 'combat',
        items,
        signature: signatureData,
        assignedBy: user?.id || '',
        requestId,
      });
      console.log('[CombatAssignment] Transactional assignment created:', assignmentId);

      // Update weapon inventory status for each weapon with serial number
      const weaponUpdatePromises: Promise<void>[] = [];

      console.log('[CombatAssignment] Processing weapon status updates...');
      for (const item of Array.from(selectedItems.values())) {
        if (item.equipment.requiresSerial && item.serials) {
          for (const serial of item.serials) {
            if (serial.trim()) {
              // Find the weapon by serial number
              const weapon = availableWeapons.find(
                w => w.serialNumber === serial && w.category.toLowerCase() === item.equipment.name.toLowerCase()
              );

              if (weapon) {
                console.log(`[CombatAssignment] Queuing weapon update: ${weapon.serialNumber} (${weapon.id})`);
                weaponUpdatePromises.push(
                  weaponInventoryService.assignWeaponToSoldier(weapon.id, {
                    soldierId: soldier.id,
                    soldierName: soldier.name,
                    soldierPersonalNumber: soldier.personalNumber,
                  })
                );
              } else {
                console.warn(`[CombatAssignment] Weapon not found for serial: ${serial}, category: ${item.equipment.name}`);
              }
            }
          }
        }
      }

      // Wait for all weapon updates
      if (weaponUpdatePromises.length > 0) {
        console.log(`[CombatAssignment] Updating ${weaponUpdatePromises.length} weapons...`);
        await Promise.all(weaponUpdatePromises);
        console.log(`[CombatAssignment] Updated ${weaponUpdatePromises.length} weapons to assigned status`);
      }

      console.log('[CombatAssignment] Save completed successfully');

      // Générer et imprimer le PDF automatiquement (Local) - STAND BY
      /*
      const printPromise = generateAndPrintPDF({
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        items,
        signature: signatureData,
        timestamp: new Date(),
      }, false);
      */

      // Envoyer à la file d'attente (Web)
      const queuePromise = sendToPrintQueue({
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        items,
        signature: signatureData,
        timestamp: new Date(),
      });

      // await Promise.all([printPromise, queuePromise]);
      await queuePromise;

      // Generate WhatsApp message
      let whatsappMessage = `שלום ${soldier.name},\n\nההחתמה בוצעה בהצלחה.\n\n`;
      whatsappMessage += 'ציוד שהוחתם:\n';
      for (const item of Array.from(selectedItems.values())) {
        whatsappMessage += `• ${item.equipment.name} - כמות: ${item.quantity}`;
        if (item.serials && item.serials.length > 0 && item.serials.some(s => s.trim())) {
          whatsappMessage += ` (מסטב: ${item.serials.filter(s => s.trim()).join(', ')})`;
        }
        whatsappMessage += '\n';
      }
      whatsappMessage += `\nהציוד רשום על שמך ובאחריותך.\nתודה,\nגדוד 982`;

      // Store assignment data for potential reprint
      const assignmentForPrint = {
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        items,
        signature: signatureData,
        timestamp: new Date(),
      };

      // Show success with WhatsApp and Print options
      const successButtons: any[] = [
        { text: 'סגור', onPress: () => navigation.goBack(), style: 'cancel' },
        {
          text: 'הדפס שוב',
          onPress: async () => {
            await generateAndPrintPDF(assignmentForPrint, false);
          },
        },
      ];

      // Ajouter option pour changer d'imprimante (iOS uniquement)
      if (Platform.OS === 'ios') {
        successButtons.push({
          text: 'שנה מדפסת',
          onPress: async () => {
            await generateAndPrintPDF(assignmentForPrint, true);
          },
        });
      }

      // Ajouter option WhatsApp si numéro disponible
      if (soldier.phone) {
        successButtons.push({
          text: 'שלח WhatsApp',
          onPress: async () => {
            try {
              await openWhatsAppChat(soldier.phone, whatsappMessage);
            } catch (e) {
              console.error('WhatsApp error:', e);
            }
            navigation.goBack();
          },
        });
      }

      Alert.alert(
        'הצלחה',
        'ההחתמה בוצעה בהצלחה והמסמך נשלח למדפסת',
        successButtons
      );
    } catch (error: any) {
      console.error('[CombatAssignment] Error saving:', error);
      console.error('[CombatAssignment] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      Alert.alert('שגיאה', `לא ניתן לשמור את ההחתמה\n\nפרטי שגיאה: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Group equipment by category
  const groupedEquipment = equipment.reduce((acc, eq) => {
    const category = eq.category || 'כללי';
    if (!acc[category]) acc[category] = [];
    acc[category].push(eq);
    return acc;
  }, {} as Record<string, Equipment[]>);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
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
          <Text style={styles.headerTitle}>החתמת ציוד קרבי</Text>
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
        {/* Soldier Info */}
        <View style={styles.soldierCard}>
          <View style={styles.soldierAvatar}>
            <Ionicons name="shield" size={32} color={Colors.arme} />
          </View>
          <View style={styles.soldierInfo}>
            <Text style={styles.soldierName}>{soldier.name}</Text>
            <Text style={styles.soldierNumber}>מ.א: {soldier.personalNumber}</Text>
          </View>
        </View>

        {/* Existing Equipment */}
        {existingAssignments.length > 0 && (
          <View style={styles.existingEquipmentCard}>
            <View style={styles.existingEquipmentHeader}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.existingEquipmentTitle}>
                ציוד קיים ({existingAssignments.length} פריטים)
              </Text>
            </View>
            <View style={styles.existingEquipmentList}>
              {existingAssignments.map((item, idx) => (
                <View key={idx} style={styles.existingEquipmentItem}>
                  <View style={styles.existingEquipmentHeader2}>
                    <Text style={styles.existingEquipmentQuantity}>x{item.quantity}</Text>
                    <Text style={styles.existingEquipmentName}>{item.equipmentName}</Text>
                    {item.status === 'stored' && (
                      <View style={styles.storedBadge}>
                        <Text style={styles.storedBadgeText}>באפסון</Text>
                      </View>
                    )}
                  </View>
                  {item.serial && (
                    <View style={styles.existingEquipmentSerialContainer}>
                      <Ionicons name="barcode-outline" size={18} color={Colors.arme} />
                      <Text style={styles.existingEquipmentSerialLabel}>מסטב:</Text>
                      <Text style={styles.existingEquipmentSerial}>{item.serial}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {!showSignature ? (
          <>
            {/* Selection Mode Tabs */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  selectionMode === 'mana' && styles.modeButtonActive,
                ]}
                onPress={() => setSelectionMode('mana')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    selectionMode === 'mana' && styles.modeButtonTextActive,
                  ]}
                >
                  מנות
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  selectionMode === 'manual' && styles.modeButtonActive,
                ]}
                onPress={() => setSelectionMode('manual')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    selectionMode === 'manual' && styles.modeButtonTextActive,
                  ]}
                >
                  ציוד ידני
                </Text>
              </TouchableOpacity>
            </View>

            {/* Manot List */}
            {selectionMode === 'mana' && !selectedMana && (
              <View>
                <Text style={styles.sectionTitle}>בחר מנה</Text>
                <View style={styles.manotList}>
                  {manot.map(mana => (
                    <TouchableOpacity
                      key={mana.id}
                      style={styles.manaCard}
                      onPress={() => selectMana(mana)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.manaIcon}>
                        <Text style={styles.manaIconText}>📦</Text>
                      </View>
                      <View style={styles.manaInfo}>
                        <Text style={styles.manaName}>{mana.name}</Text>
                        <Text style={styles.manaSubtitle}>
                          {mana.equipments.length} פריטים
                        </Text>
                      </View>
                      <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Selected Mana Header */}
            {selectionMode === 'mana' && selectedMana && (
              <View style={styles.selectedManaHeader}>
                <TouchableOpacity
                  style={styles.changeManaButton}
                  onPress={() => {
                    setSelectedMana(null);
                    setSelectedItems(new Map());
                  }}
                >
                  <Ionicons name="swap-horizontal" size={20} color={Colors.arme} />
                  <Text style={styles.changeManaText}>שנה מנה</Text>
                </TouchableOpacity>
                <View style={styles.selectedManaInfo}>
                  <Text style={styles.selectedManaName}>{selectedMana.name}</Text>
                  <Text style={styles.selectedManaHint}>ניתן לערוך את הפריטים</Text>
                </View>
              </View>
            )}

            {/* Equipment by Category */}
            {((selectionMode === 'manual') || (selectionMode === 'mana' && selectedMana)) && (
              <>
                {/* Show info based on mode */}
                {selectionMode === 'manual' && selectedMana && (
                  <View style={styles.manualModeInfo}>
                    <Ionicons name="information-circle" size={20} color={Colors.info} />
                    <Text style={styles.manualModeInfoText}>
                      מצב ידני: בחר ציוד נוסף או ערוך את הבחירה
                    </Text>
                  </View>
                )}
                {selectedItems.size > 0 && (
                  <View style={styles.selectedSummary}>
                    <Text style={styles.selectedSummaryText}>
                      {selectedItems.size} פריטים נבחרו
                      {selectedMana && selectionMode === 'mana' ? ' מהמנה' : ''}
                    </Text>
                    {selectionMode === 'mana' && selectedMana && (
                      <TouchableOpacity
                        style={styles.addMoreButton}
                        onPress={() => {
                          setSelectionMode('manual');
                          // Keep the current selection but switch to manual mode
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={20} color={Colors.arme} />
                        <Text style={styles.addMoreButtonText}>הוסף ציוד נוסף</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {Object.entries(groupedEquipment).map(([category, items]) => {
                  // In manual mode, show all items
                  // In mana mode with selection, show only selected items
                  const displayItems = (selectionMode === 'mana' && selectedMana)
                    ? items.filter(eq => selectedItems.has(eq.id))
                    : items;

                  // Skip empty categories
                  if (displayItems.length === 0) return null;

                  return (
                    <View key={category}>
                      <Text style={styles.categoryTitle}>{category}</Text>
                      <View style={styles.equipmentList}>
                        {displayItems.map((eq) => {
                          const isSelected = selectedItems.has(eq.id);
                          const item = selectedItems.get(eq.id);
                          const isExpanded = expandedItems.has(eq.id);

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
                                  {eq.hasSubEquipment && (
                                    <Text style={styles.subEquipmentHint}>
                                      {eq.subEquipment?.length || 0} רכיבים נלווים
                                    </Text>
                                  )}
                                </View>
                                {eq.hasSubEquipment && isSelected && (
                                  <TouchableOpacity
                                    style={styles.expandButton}
                                    onPress={() => toggleExpanded(eq.id)}
                                  >
                                    <Ionicons
                                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                      size={20}
                                      color={Colors.textSecondary}
                                    />
                                  </TouchableOpacity>
                                )}
                              </TouchableOpacity>

                              {isSelected && (
                                <View style={styles.itemDetails}>
                                  {/* Quantity */}
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

                                  {/* Serial Numbers */}
                                  {eq.requiresSerial && item?.serials && (
                                    <View style={styles.serialsContainer}>
                                      <Text style={styles.serialsTitle}>
                                        מספרים סידוריים (מסטב): *
                                      </Text>
                                      {item.serials.map((serial, idx) => {
                                        // Get available serials for this equipment category
                                        const equipmentName = item.equipment.name;

                                        // Get already selected serials for this equipment (to prevent duplicates in same form)
                                        const alreadySelectedSerials = (item.serials || []).filter((s, i) => i !== idx && s.trim() !== '');

                                        // Filter available weapons (only status='available' weapons from inventory)
                                        // availableWeapons already filters out assigned weapons to ANY soldier
                                        const allAvailableSerials = availableWeapons
                                          .filter(weapon => {
                                            // Match category
                                            const categoryMatch = weapon.category.toLowerCase() === equipmentName.toLowerCase();
                                            // Not already selected in this form
                                            const notSelected = !alreadySelectedSerials.includes(weapon.serialNumber);
                                            return categoryMatch && notSelected;
                                          })
                                          .map(w => w.serialNumber);

                                        return (
                                          <View key={idx} style={styles.serialRow}>
                                            <Text style={styles.serialLabel}>
                                              {item.quantity > 1 ? `יחידה ${idx + 1}:` : 'מסטב:'}
                                            </Text>

                                            {/* Serial Selector Button */}
                                            <TouchableOpacity
                                              style={styles.serialPickerButton}
                                              onPress={() => {
                                                if (allAvailableSerials.length === 0) {
                                                  Alert.alert('שגיאה', `אין ${equipmentName} זמינים במלאי`);
                                                  return;
                                                }
                                                openSerialPicker(eq.id, idx, equipmentName, serial);
                                              }}
                                            >
                                              <Ionicons name="barcode-outline" size={20} color={Colors.textSecondary} />
                                              <Text style={[styles.serialPickerText, !serial && styles.serialPickerPlaceholder]}>
                                                {serial || `בחר מסטב (${allAvailableSerials.length} זמינים)`}
                                              </Text>
                                              <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                                            </TouchableOpacity>

                                            {/* Info: Available count */}
                                            {allAvailableSerials.length === 0 && (
                                              <Text style={styles.serialWarning}>
                                                ⚠️ אין {equipmentName} זמינים במלאי
                                              </Text>
                                            )}
                                          </View>
                                        );
                                      })}
                                    </View>
                                  )}

                                  {/* Sub Equipment */}
                                  {eq.hasSubEquipment && isExpanded && eq.subEquipment && (
                                    <View style={styles.subEquipmentList}>
                                      <Text style={styles.subEquipmentTitle}>רכיבים נלווים:</Text>
                                      {eq.subEquipment.map((sub) => (
                                        <TouchableOpacity
                                          key={sub.id}
                                          style={styles.subEquipmentItem}
                                          onPress={() => toggleSubItem(eq.id, sub.id)}
                                        >
                                          <View style={[
                                            styles.subCheckbox,
                                            item?.subItems?.includes(sub.id) && styles.subCheckboxSelected,
                                          ]}>
                                            {item?.subItems?.includes(sub.id) && (
                                              <Ionicons name="checkmark" size={12} color={Colors.textWhite} />
                                            )}
                                          </View>
                                          <Text style={styles.subEquipmentName}>{sub.name}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Summary */}
            {selectedItems.size > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>סיכום פריטים:</Text>
                {Array.from(selectedItems.values()).map((item, idx) => (
                  <View key={idx} style={styles.summaryItem}>
                    <Text style={styles.summaryItemText}>
                      • {item.equipment.name} x {item.quantity}
                    </Text>
                    {item.serials && item.serials.some(s => s.trim()) && (
                      <Text style={styles.summaryItemSerial}>
                        מסטב: {item.serials.filter(s => s.trim()).join(', ')}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                selectedItems.size === 0 && styles.buttonDisabled,
              ]}
              onPress={validateAndContinue}
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
                <View key={idx} style={styles.summaryItem}>
                  <Text style={styles.summaryItemText}>
                    • {item.equipment.name} x {item.quantity}
                  </Text>
                  {item.serials && item.serials.some(s => s.trim()) && (
                    <Text style={styles.summaryItemSerial}>
                      מסטב: {item.serials.filter(s => s.trim()).join(', ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Signature */}
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
                style={styles.backButton2}
                onPress={() => setShowSignature(false)}
              >
                <Text style={styles.backButton2Text}>חזור לבחירת ציוד</Text>
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

      {/* Serial Picker Modal */}
      <Modal
        visible={serialPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeSerialPicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeSerialPicker} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={Colors.textWhite} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                בחר מסטב - {currentSerialField?.equipmentName || ''}
              </Text>
            </View>

            {/* Search Input */}
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="חפש מסטב..."
                placeholderTextColor={Colors.textLight}
                value={serialSearchText}
                onChangeText={setSerialSearchText}
                textAlign="right"
                autoCapitalize="characters"
                autoFocus={true}
              />
              {serialSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setSerialSearchText('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Serials List */}
            {currentSerialField && (() => {
              // Get the current item to check already selected serials
              const currentItem = selectedItems.get(currentSerialField.equipmentId);
              const alreadySelectedSerials = currentItem?.serials?.filter((s, i) => i !== currentSerialField.index && s.trim() !== '') || [];

              // Filter available weapons (only status='available' from inventory)
              // availableWeapons already filters out weapons assigned to ANY soldier
              const allSerials = availableWeapons
                .filter(weapon => {
                  const categoryMatch = weapon.category.toLowerCase() === currentSerialField.equipmentName.toLowerCase();
                  const notSelected = !alreadySelectedSerials.includes(weapon.serialNumber);
                  return categoryMatch && notSelected;
                })
                .map(w => w.serialNumber);

              const filteredSerials = serialSearchText
                ? allSerials.filter(s => s.toLowerCase().includes(serialSearchText.toLowerCase()))
                : allSerials;

              return (
                <>
                  <View style={styles.modalResultsHeader}>
                    <Text style={styles.modalResultsCount}>
                      {filteredSerials.length} מתוך {allSerials.length} תוצאות
                    </Text>
                  </View>

                  <FlatList
                    data={filteredSerials}
                    keyExtractor={(item, index) => `${item}-${index}`}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalSerialItem}
                        onPress={() => selectSerial(item)}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        <Text style={styles.modalSerialText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={() => (
                      <View style={styles.modalEmptyState}>
                        <Ionicons name="search-outline" size={48} color={Colors.textLight} />
                        <Text style={styles.modalEmptyText}>לא נמצאו תוצאות</Text>
                      </View>
                    )}
                  />
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
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
    backgroundColor: Colors.arme,
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

  categoryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.arme,
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
    backgroundColor: Colors.armeLight,
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

  // Existing Equipment
  existingEquipmentCard: {
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },

  existingEquipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  existingEquipmentTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.successDark,
  },

  existingEquipmentList: {
    gap: Spacing.sm,
  },

  existingEquipmentItem: {
    flexDirection: 'column',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },

  existingEquipmentHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },

  existingEquipmentName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },

  existingEquipmentQuantity: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  existingEquipmentSerialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: Colors.armeLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },

  existingEquipmentSerialLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.arme,
  },

  existingEquipmentSerial: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.armeDark,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Mode Selector
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
    ...Shadows.small,
  },

  modeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },

  modeButtonActive: {
    backgroundColor: Colors.arme,
  },

  modeButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  modeButtonTextActive: {
    color: Colors.textWhite,
  },

  // Manot List
  manotList: {
    gap: Spacing.md,
  },

  manaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },

  manaIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.armeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  manaIconText: {
    fontSize: 28,
  },

  manaInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  manaName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },

  manaSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Selected Mana Header
  selectedManaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.armeLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.arme + '30',
  },

  changeManaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.md,
  },

  changeManaText: {
    fontSize: FontSize.sm,
    color: Colors.arme,
    fontWeight: '600',
  },

  selectedManaInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  selectedManaName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.armeDark,
  },

  selectedManaHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Manual Mode Info
  manualModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },

  manualModeInfoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.info,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Selected Summary
  storedBadge: {
    backgroundColor: Colors.info + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  storedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.info,
  },
  selectedSummary: {
    backgroundColor: Colors.armeLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.arme + '30',
  },

  selectedSummaryText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.armeDark,
    textAlign: 'center',
  },

  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.arme,
  },

  addMoreButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.arme,
  },

  // Serial Numbers
  serialsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    zIndex: 100,
  },

  serialsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  // Equipment List
  equipmentList: {
    gap: Spacing.md,
  },

  equipmentCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
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
    backgroundColor: Colors.arme,
    borderColor: Colors.arme,
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

  subEquipmentHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  expandButton: {
    padding: Spacing.sm,
  },

  itemDetails: {
    backgroundColor: Colors.backgroundInput,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    zIndex: 50,
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

  // Serial Picker Button
  serialPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },

  serialPickerText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  serialPickerPlaceholder: {
    color: Colors.textLight,
    fontWeight: '400',
  },

  serialWarning: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContainer: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    ...Shadows.large,
  },

  modalHeader: {
    backgroundColor: Colors.arme,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  modalTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },

  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },

  modalSearchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },

  modalResultsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.armeLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  modalResultsCount: {
    fontSize: FontSize.sm,
    color: Colors.armeDark,
    fontWeight: '600',
    textAlign: 'center',
  },

  modalSerialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },

  modalSerialText: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  modalEmptyState: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },

  modalEmptyText: {
    fontSize: FontSize.base,
    color: Colors.textLight,
    marginTop: Spacing.md,
  },

  // Sub Equipment
  subEquipmentList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  subEquipmentTitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  subEquipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },

  subCheckbox: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },

  subCheckboxSelected: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },

  subEquipmentName: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlign: 'right',
  },

  // Summary
  summaryCard: {
    backgroundColor: Colors.armeLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.arme + '30',
  },

  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.armeDark,
    textAlign: 'right',
  },

  summaryText: {
    fontSize: FontSize.base,
    color: Colors.armeDark,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  summaryItem: {
    marginTop: Spacing.sm,
  },

  summaryItemText: {
    fontSize: FontSize.base,
    color: Colors.armeDark,
    textAlign: 'right',
  },

  summaryItemSerial: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },

  // Buttons
  continueButton: {
    backgroundColor: Colors.arme,
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

  backButton2: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  backButton2Text: {
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

export default CombatAssignmentScreen;