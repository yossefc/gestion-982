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
import { assignmentService } from '../../services/assignmentService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { printQueueService } from '../../services/printQueueService';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useIsOnline } from '../../contexts/OfflineContext';
import { Mana, WeaponInventoryItem, Assignment } from '../../types';
import { openWhatsAppChat } from '../../services/whatsappService';
import { AppModal } from '../../components';

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

  // OPTIMISÉ: Utiliser le cache centralisé pour équipements et manot
  const { combatEquipment, manot: cachedManot, isInitialized } = useData();
  const isOnline = useIsOnline();

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
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Weapon inventory for autocomplete
  const [availableWeapons, setAvailableWeapons] = useState<WeaponInventoryItem[]>([]);
  const [serialPickerVisible, setSerialPickerVisible] = useState(false);
  const [currentSerialField, setCurrentSerialField] = useState<{ equipmentId: string; index: number; equipmentName: string } | null>(null);
  const [serialSearchText, setSerialSearchText] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState<Print.Printer | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    assignmentForPrint: any;
    whatsappMessage: string;
    isQueuedOffline?: boolean;
  } | null>(null);

  // AppModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<any>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  // OPTIMISE: Utiliser les donnees du cache des qu'elles sont disponibles
  // Mode offline: continuer meme si pas completement initialise
  useEffect(() => {
    // Ne pas recharger si deja en mode offline ou si donnees deja chargees
    if (isOfflineMode || dataLoaded) return;

    // Si on a des donnees en cache, les utiliser immediatement
    if (combatEquipment.length > 0 || cachedManot.length > 0 || isInitialized) {
      setEquipment(combatEquipment as Equipment[]);
      setManot(cachedManot);
      loadSoldierSpecificData();
      setDataLoaded(true);
    }
  }, [isInitialized, combatEquipment, cachedManot, isOfflineMode, dataLoaded]);

  // Timeout de securite: apres 3 secondes, continuer quand meme (mode offline)
  // Ce timeout gere TOUS les cas de blocage: authLoading, Firebase lent, etc.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('[CombatAssignment] Timeout (3s) - proceeding in offline mode');
        setIsOfflineMode(true);
        setEquipment(combatEquipment as Equipment[]);
        setManot(cachedManot);
        setLoading(false);
      }
    }, 3000); // Reduit a 3 secondes pour une meilleure UX
    return () => clearTimeout(timeout);
  }, [loading, combatEquipment, cachedManot]);

  // Charger uniquement les données spécifiques au soldat (pas en cache global)
  const loadSoldierSpecificData = async () => {
    try {
      setLoading(true);

      const currentHoldingsPromise = transactionalAssignmentService
        .getCurrentHoldings(soldier.id, 'combat')
        .catch((error) => {
          console.warn('Could not load current holdings (offline?):', error);
          return [];
        });

      const availableWeaponsPromise = weaponInventoryService
        .getAvailableWeapons()
        .catch((error) => {
          console.warn('Could not load available weapons (offline?):', error);
          return [];
        });

      const currentItems = await currentHoldingsPromise;
      setExistingAssignments(currentItems);
      console.log('Current items:', currentItems.length, 'items');

      const weaponsData = await availableWeaponsPromise;
      setAvailableWeapons(weaponsData as WeaponInventoryItem[]);
      console.log('Loaded available weapons:', weaponsData.length, 'items');
    } catch (error) {
      console.error('Error loading data:', error);
      // Ne pas afficher d'erreur si on est en mode hors ligne
      // L'utilisateur peut quand m?me continuer avec les donn?es en cache
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
    setScrollEnabled(true);
  };

  const handleSignatureChange = (signature: string) => {
    setSignatureData(signature);
    setScrollEnabled(true);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clearSignature();
    setSignatureData(null);
    setScrollEnabled(true);
  };

  const handleConfirmSignature = () => {
    signatureRef.current?.readSignature();
    setScrollEnabled(true);
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

  // Fonction helper pour générer le HTML - Format militaire officiel (style Topes 1003)
  const generatePDFHTML = (assignmentData: {
    soldierName: string;
    soldierPersonalNumber: string;
    soldierPhone?: string;
    soldierCompany?: string;
    items: any[];
    signature: string;
    timestamp: Date;
  }) => {
    const dateStr = assignmentData.timestamp.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const timeStr = assignmentData.timestamp.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const operatorText = user?.displayName || user?.email || '';

    // Générer les lignes du tableau avec numéro de série
    const itemsRows = assignmentData.items
      .map((item, index) => `
      <tr>
        <td class="cell cell-center">${index + 1}</td>
        <td class="cell cell-right">${item.equipmentName}</td>
        <td class="cell cell-center">${item.quantity}</td>
        <td class="cell cell-center">${item.serial || '-'}</td>
        <td class="cell cell-right"></td>
      </tr>
    `).join('');

    // Lignes vides pour le formulaire (au moins 10 lignes au total)
    const emptyRowsCount = Math.max(0, 10 - assignmentData.items.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map((_, index) => `
      <tr>
        <td class="cell cell-center">${assignmentData.items.length + index + 1}</td>
        <td class="cell cell-right"></td>
        <td class="cell cell-center"></td>
        <td class="cell cell-center"></td>
        <td class="cell cell-right"></td>
      </tr>
    `).join('');

    // Image signature
    const signatureImg = assignmentData.signature
      ? `<img src="${assignmentData.signature}" class="signature-img" />`
      : '<div class="signature-placeholder">חתימה</div>';

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, 'David', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 11px;
      line-height: 1.3;
      padding: 5mm;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border: 2px solid #000;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    .header-right {
      text-align: right;
    }
    .header-center {
      text-align: center;
      flex: 1;
    }
    .header-left {
      text-align: left;
      min-width: 80px;
    }
    .logo-img {
      width: 60px;
      height: 60px;
      object-fit: contain;
    }
    .doc-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .doc-subtitle {
      font-size: 12px;
      color: #333;
    }
    .voucher-number {
      font-size: 10px;
      margin-top: 8px;
    }
    
    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .items-table th {
      background-color: #e8e8e8;
      border: 1px solid #000;
      padding: 6px 4px;
      font-weight: bold;
      font-size: 11px;
      text-align: center;
    }
    .cell {
      border: 1px solid #000;
      padding: 5px 4px;
      min-height: 22px;
      font-size: 10px;
    }
    .cell-center {
      text-align: center;
    }
    .cell-right {
      text-align: right;
    }
    .col-num { width: 6%; }
    .col-name { width: 30%; }
    .col-qty { width: 10%; }
    .col-id { width: 22%; }
    .col-notes { width: 32%; }
    
    /* Signature Section */
    .signatures-container {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .signature-box {
      flex: 1;
      border: 2px solid #000;
      padding: 10px;
    }
    .signature-box-title {
      font-weight: bold;
      font-size: 12px;
      text-align: center;
      margin-bottom: 8px;
      background-color: #e8e8e8;
      padding: 4px;
      margin: -10px -10px 8px -10px;
    }
    .signature-row {
      display: flex;
      margin-bottom: 6px;
      align-items: center;
    }
    .signature-label {
      font-weight: bold;
      min-width: 60px;
      font-size: 10px;
    }
    .signature-value {
      flex: 1;
      border-bottom: 1px solid #000;
      min-height: 16px;
      padding: 2px 4px;
      font-size: 10px;
    }
    .signature-area {
      height: 50px;
      border: 1px dashed #999;
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .signature-img {
      max-width: 150px;
      max-height: 45px;
    }
    .signature-placeholder {
      color: #999;
      font-size: 10px;
    }
    
    /* Safety Instructions */
    .safety-section {
      margin-top: 15px;
      border: 2px solid #000;
      padding: 8px;
    }
    .safety-title {
      font-weight: bold;
      font-size: 11px;
      text-align: center;
      margin-bottom: 6px;
      text-decoration: underline;
    }
    .safety-rules {
      list-style: none;
      padding: 0;
    }
    .safety-rules li {
      font-size: 9px;
      margin-bottom: 4px;
      padding-right: 15px;
      position: relative;
    }
    .safety-rules li::before {
      content: "⚠";
      position: absolute;
      right: 0;
      color: #c00;
    }
    
    /* Footer */
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 8px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 5px;
    }
  </style>
</head>
<body>
  <!-- Header Section -->
  <div class="header">
    <div class="header-right">
      <img src="data:image/png;base64,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" class="logo-img" alt="לוגו גדוד 982" />
    </div>
    <div class="header-center">
      <div class="doc-title">טופס החתמה על ציוד לחימה</div>
      <div class="doc-subtitle">גדוד 982</div>
      <div class="voucher-number">מספר שובר: _______________</div>
    </div>
    <div class="header-left">
      <div style="font-size: 10px;">תאריך: ${dateStr}</div>
      <div style="font-size: 10px; margin-top: 4px;">שעה: ${timeStr}</div>
    </div>
  </div>

  <!-- Inventory Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="col-num">מס"ד</th>
        <th class="col-name">שם פריט</th>
        <th class="col-qty">כמות</th>
        <th class="col-id">מספר מזהה / מסט"ב</th>
        <th class="col-notes">הערות</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
      ${emptyRows}
    </tbody>
  </table>

  <!-- Signature Section -->
  <div class="signatures-container">
    <!-- Right Box - Issuer Details -->
    <div class="signature-box">
      <div class="signature-box-title">פרטי המנפק</div>
      <div class="signature-row">
        <span class="signature-label">שם:</span>
        <span class="signature-value">${operatorText}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">דרגה:</span>
        <span class="signature-value"></span>
      </div>
      <div class="signature-row">
        <span class="signature-label">מ"א:</span>
        <span class="signature-value"></span>
      </div>
      <div class="signature-row">
        <span class="signature-label">תאריך:</span>
        <span class="signature-value">${dateStr}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">חתימה:</span>
      </div>
      <div class="signature-area">
        <div class="signature-placeholder">חתימת המנפק</div>
      </div>
    </div>

    <!-- Left Box - Receiver Details -->
    <div class="signature-box">
      <div class="signature-box-title">פרטי המקבל</div>
      <div class="signature-row">
        <span class="signature-label">שם:</span>
        <span class="signature-value">${assignmentData.soldierName}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">דרגה:</span>
        <span class="signature-value"></span>
      </div>
      <div class="signature-row">
        <span class="signature-label">מ"א:</span>
        <span class="signature-value">${assignmentData.soldierPersonalNumber}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">טלפון:</span>
        <span class="signature-value">${assignmentData.soldierPhone || ''}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">תאריך:</span>
        <span class="signature-value">${dateStr}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">חתימה:</span>
      </div>
      <div class="signature-area">
        ${signatureImg}
      </div>
    </div>
  </div>

  <!-- Safety Instructions -->
  <div class="safety-section">
    <div class="safety-title">הוראות בטיחות לנושא נשק</div>
    <ul class="safety-rules">
      <li>חל איסור לנקות כלי נשק בחדרי שינה ובחללים סגורים (מסדרונות, אולמות, בתוך רק"ם וכו').</li>
      <li>ניקוי נשקים יבוצע במקומות פתוחים תו"כ הקפדה שהנשקים אינם מכוונים לעבר אדם ופרוקים.</li>
      <li>חל איסור מוחלט לשחק בנשק, לבצע שינויים וכן להחליף חלקים בנשק.</li>
    </ul>
  </div>

  <!-- Footer -->
  <div class="footer">
    מסמך זה נוצר אוטומטית באמצעות מערכת ניהול ציוד גדוד 982 | ${dateStr} ${timeStr}
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
      setModalType('warning');
      setModalTitle('שים לב');
      setModalMessage('לא ניתן להדפיס את המסמך, אך ההחתמה נשמרה בהצלחה');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    }
  };

  const validateAndContinue = () => {
    if (selectedItems.size === 0) {
      setModalType('error');
      setModalMessage('יש לבחור לפחות פריט אחד');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    // Check for required serials
    for (const [id, item] of Array.from(selectedItems.entries())) {
      if (item.equipment.requiresSerial) {
        if (!item.serials || item.serials.length !== item.quantity) {
          setModalType('error');
          setModalMessage(`יש להזין מספרים סידוריים עבור ${item.equipment.name}`);
          setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
          setModalVisible(true);
          return;
        }
        // Check each serial is not empty
        for (let i = 0; i < item.serials.length; i++) {
          if (!item.serials[i]?.trim()) {
            setModalType('error');
            setModalMessage(`יש להזין מספר סידורי ${i + 1} עבור ${item.equipment.name}`);
            setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
            setModalVisible(true);
            return;
          }
        }
      }
    }

    setShowSignature(true);
  };

  const handleSubmit = async () => {
    if (!signatureData) {
      setModalType('error');
      setModalMessage('יש לחתום על הטופס');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
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

      const hasExistingHoldings = existingAssignments.some((holding) => (holding?.quantity || 0) > 0);
      const operation = hasExistingHoldings ? 'add' : 'issue';
      const requestId = `combat_${operation}_${soldier.id}_${Date.now()}`;

      const assignmentId = hasExistingHoldings
        ? await transactionalAssignmentService.addEquipment({
          soldierId: soldier.id,
          soldierName: soldier.name,
          soldierPersonalNumber: soldier.personalNumber,
          soldierPhone: soldier.phone,
          soldierCompany: soldier.company,
          type: 'combat',
          items,
          signature: signatureData,
          addedBy: user?.id || '',
          requestId,
        })
        : await transactionalAssignmentService.issueEquipment({
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

      const isQueuedOffline = assignmentId.startsWith('LOCAL_');
      console.log('[CombatAssignment] Transactional assignment created:', assignmentId, isQueuedOffline ? '(QUEUED OFFLINE)' : '');

      // Update weapon inventory status for each weapon with serial number
      const weaponUpdatePromises: Promise<any>[] = [];

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
                  // Offline-aware: queues if offline
                  weaponInventoryService.setWeaponAssignedStatusOnlyOffline(weapon.id, {
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

      // Wait for all weapon updates / queues
      if (weaponUpdatePromises.length > 0) {
        console.log(`[CombatAssignment] Updating ${weaponUpdatePromises.length} weapons...`);
        if (isOnline) {
          await Promise.all(weaponUpdatePromises);
          console.log(`[CombatAssignment] Updated/queued ${weaponUpdatePromises.length} weapons`);
        } else {
          // Offline: fire-and-forget to avoid blocking UI
          Promise.allSettled(weaponUpdatePromises).then(() => {
            console.log(`[CombatAssignment] Queued ${weaponUpdatePromises.length} weapons (offline)`);
          });
        }
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

      // Envoyer à la file d'attente EN ARRIÈRE-PLAN (ne bloque pas l'affichage)
      // Si offline, ne pas lancer la génération PDF (trop lent / timeout)
      if (!isQueuedOffline && isOnline) {
        // On lance la promesse sans await pour ne pas bloquer
        sendToPrintQueue({
          soldierName: soldier.name,
          soldierPersonalNumber: soldier.personalNumber,
          soldierPhone: soldier.phone,
          soldierCompany: soldier.company,
          items,
          signature: signatureData,
          timestamp: new Date(),
        }).then(() => {
          console.log('[CombatAssignment] Print queue sent successfully (background)');
        }).catch((printError) => {
          console.error('[CombatAssignment] Print queue error (background):', printError);
          // On ne bloque pas l'utilisateur, juste un log
        });
      } else {
        console.log('[CombatAssignment] Offline - skipping print queue generation');
      }

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

      // Show success modal with animated green checkmark
      // Note: isQueuedOffline indicates the operation was queued for later sync
      setSuccessModalData({
        assignmentForPrint,
        whatsappMessage,
        isQueuedOffline,
      });
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[CombatAssignment] Error saving:', error);
      console.error('[CombatAssignment] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      setModalType('error');
      setModalMessage(`לא ניתן לשמור את ההחתמה\n\nפרטי שגיאה: ${error?.message || 'Unknown error'}`);
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
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

  // Afficher le loading seulement si on charge ET qu'on n'est pas en mode offline
  // Le timeout de 3s garantit qu'on ne reste jamais bloque indefiniment
  if (loading && !isOfflineMode) {
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
                  {item.serials && item.serials.length > 0 && (
                    <View style={styles.existingEquipmentSerialContainer}>
                      <Ionicons name="barcode-outline" size={18} color={Colors.arme} />
                      <Text style={styles.existingEquipmentSerialLabel}>מסטב:</Text>
                      <Text style={styles.existingEquipmentSerial}>{item.serials.join(', ')}</Text>
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
                {/* Offline banner when no data available */}
                {!isOnline && manot.length === 0 && (
                  <View style={styles.offlineWarning}>
                    <Ionicons name="cloud-offline" size={24} color="#92400E" />
                    <Text style={styles.offlineWarningTitle}>אין חיבור לאינטרנט</Text>
                    <Text style={styles.offlineWarningText}>
                      לא נמצאו מנות בזיכרון המקומי.{'\n'}
                      התחבר לאינטרנט כדי לטעון את המנות, ואז הן יהיו זמינות גם offline.
                    </Text>
                  </View>
                )}
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
                {/* Offline warning when no equipment available */}
                {!isOnline && equipment.length === 0 && (
                  <View style={styles.offlineWarning}>
                    <Ionicons name="cloud-offline" size={24} color="#92400E" />
                    <Text style={styles.offlineWarningTitle}>אין חיבור לאינטרנט</Text>
                    <Text style={styles.offlineWarningText}>
                      לא נמצא ציוד בזיכרון המקומי.{'\n'}
                      התחבר לאינטרנט כדי לטעון את רשימת הציוד.
                    </Text>
                  </View>
                )}
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
                                                  setModalType('error');
                                                  setModalMessage(`אין ${equipmentName} זמינים במלאי`);
                                                  setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
                                                  setModalVisible(true);
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

      {/* Success Modal with animated green checkmark */}
      <AppModal
        visible={showSuccessModal}
        type={successModalData?.isQueuedOffline ? 'warning' : 'success'}
        title={successModalData?.isQueuedOffline ? 'נשמר מקומית' : 'הצלחה!'}
        message={successModalData?.isQueuedOffline
          ? 'ההחתמה נשמרה מקומית ותסונכרן אוטומטית כשתחזור לאינטרנט.\n\nניתן להמשיך לעבוד במצב אופליין.'
          : 'ההחתמה בוצעה בהצלחה והמסמך נשלח למדפסת'}
        buttons={[
          {
            text: 'סגור',
            style: 'primary',
            icon: 'checkmark-circle',
            onPress: () => {
              setShowSuccessModal(false);
              navigation.goBack();
            },
          },
          // Pas de boutons print/WhatsApp en mode offline
          ...(successModalData?.isQueuedOffline ? [] : [
            {
              text: 'הדפס שוב',
              style: 'secondary' as const,
              icon: 'print' as const,
              onPress: async () => {
                if (successModalData) {
                  await generateAndPrintPDF(successModalData.assignmentForPrint, false);
                }
              },
            },
            ...(soldier.phone ? [{
              text: 'שלח WhatsApp',
              style: 'outline' as const,
              icon: 'logo-whatsapp' as const,
              onPress: async () => {
                if (successModalData) {
                  try {
                    await openWhatsAppChat(soldier.phone, successModalData.whatsappMessage);
                  } catch (e) {
                    console.error('WhatsApp error:', e);
                  }
                }
                setShowSuccessModal(false);
                navigation.goBack();
              },
            }] : []),
          ]),
        ]}
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      />
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

  // Offline Warning
  offlineWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },

  offlineWarningTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: '#92400E',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  offlineWarningText: {
    fontSize: FontSize.sm,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
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
