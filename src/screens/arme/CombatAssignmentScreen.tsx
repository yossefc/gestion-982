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
import { assignmentService, soldierService, combatEquipmentService, manaService, pdfStorageService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/colors';
import { CombatEquipment, Mana } from '../../types';
import { generateAssignmentPDF } from '../../services/pdfService';
import { downloadAndSharePdf, openWhatsAppChat } from '../../services/whatsappService';

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
  const [manot, setManot] = useState<Mana[]>([]);
  const [categories, setCategories] = useState<{name: string; color: string}[]>([]);

  // ==========================================
  // NOUVEAUX ÉTATS POUR FIX DU BUG MANA
  // ==========================================
  // Mode de sélection: 'mana' ou 'manual'
  const [selectionMode, setSelectionMode] = useState<'mana' | 'manual'>('mana');

  // ID de la מנה sélectionnée (stable, ne reset pas)
  const [selectedManaId, setSelectedManaId] = useState<string>('');

  // Items confirmés depuis la מנה (ne change que lors de confirmation)
  const [manaItems, setManaItems] = useState<EquipmentItem[]>([]);

  // Items ajoutés manuellement (indépendants de la מנה)
  const [manualItems, setManualItems] = useState<EquipmentItem[]>([]);

  // États pour signature
  const [showSignature, setShowSignature] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // ANCIEN CODE HARDCODÉ - NE PLUS UTILISER
  /*
  const [equipment, setEquipment] = useState<EquipmentItem[]>([
    // נשק ראשי
    { id: 'w1', name: 'M16', category: 'נשק ראשי', quantity: 1, selected: false, needsSerial: true,
      subEquipments: [
        { id: 'w1s1', name: 'מחסנית', selected: false },
        { id: 'w1s2', name: 'רצועה', selected: false },
        { id: 'w1s3', name: 'כלי טעינה', selected: false },
      ]
    },
    { id: 'w2', name: 'M203', category: 'נשק ראשי', quantity: 1, selected: false, needsSerial: true,
      subEquipments: [
        { id: 'w2s1', name: 'מחסנית', selected: false },
        { id: 'w2s2', name: 'רצועה', selected: false },
        { id: 'w2s3', name: 'כלי טעינה', selected: false },
        { id: 'w2s4', name: 'קנה M203', selected: false },
      ]
    },
    { id: 'w3', name: 'קלע', category: 'נשק ראשי', quantity: 1, selected: false, needsSerial: true },
    { id: 'w4', name: 'נגב', category: 'נשק ראשי', quantity: 1, selected: false, needsSerial: true,
      subEquipments: [
        { id: 'w4s1', name: 'מחסנית', selected: false },
        { id: 'w4s2', name: 'רצועה', selected: false },
        { id: 'w4s3', name: 'חצובה', selected: false },
      ]
    },
    { id: 'w5', name: 'מאג', category: 'נשק ראשי', quantity: 1, selected: false, needsSerial: true,
      subEquipments: [
        { id: 'w5s1', name: 'מחסנית', selected: false },
        { id: 'w5s2', name: 'רצועה', selected: false },
        { id: 'w5s3', name: 'חצובה', selected: false },
      ]
    },
    { id: 'w6', name: 'נגמ"ש', category: 'נשק ראשי', quantity: 1, selected: false, needsSerial: true },

    // אביזרי נשק
    { id: 'a1', name: 'אופטיקה (טריג\'יקון)', category: 'אביזרי נשק', quantity: 1, selected: false, needsSerial: true },
    { id: 'a2', name: 'אופטיקה (מאורס)', category: 'אביזרי נשק', quantity: 1, selected: false, needsSerial: true },
    { id: 'a3', name: 'לייזר', category: 'אביזרי נשק', quantity: 1, selected: false, needsSerial: true },
    { id: 'a4', name: 'פנס נשק', category: 'אביזרי נשק', quantity: 1, selected: false, needsSerial: true },
    { id: 'a5', name: 'ידית אחיזה', category: 'אביזרי נשק', quantity: 1, selected: false, needsSerial: false },
    { id: 'a6', name: 'רתע', category: 'אביזרי נשק', quantity: 1, selected: false, needsSerial: false },

    // ציוד לוחם
    { id: 'c1', name: 'אפוד טקטי', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: false },
    { id: 'c2', name: 'וסט קרמי', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: true },
    { id: 'c3', name: 'קסדה', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: true },
    { id: 'c4', name: 'מוביל מחסניות', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: false },
    { id: 'c5', name: 'פאוץ\' רימונים', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: false },
    { id: 'c6', name: 'תיק גב לחימה', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: false },
    { id: 'c7', name: 'חגורת לחימה', category: 'ציוד לוחם', quantity: 1, selected: false, needsSerial: false },

    // אופטיקה ותצפית
    { id: 'o1', name: 'משקפי לילה', category: 'אופטיקה ותצפית', quantity: 1, selected: false, needsSerial: true },
    { id: 'o2', name: 'דרבן תצפית', category: 'אופטיקה ותצפית', quantity: 1, selected: false, needsSerial: true },
    { id: 'o3', name: 'מצפן', category: 'אופטיקה ותצפית', quantity: 1, selected: false, needsSerial: true },

    // קשר
    { id: 'r1', name: 'מכשיר קשר', category: 'קשר', quantity: 1, selected: false, needsSerial: true },
    { id: 'r2', name: 'אוזניות קשר', category: 'קשר', quantity: 1, selected: false, needsSerial: true },
    { id: 'r3', name: 'סוללות קשר', category: 'קשר', quantity: 2, selected: false, needsSerial: false },
  ]);

  */
  // FIN ANCIEN CODE HARDCODÉ

  useEffect(() => {
    loadSoldierData();
  }, []);

  const loadSoldierData = async () => {
    try {
      // Charger toutes les données + ASSIGNMENT ACTUEL en parallèle depuis Firebase
      const [soldierData, combatEquipment, manotData, currentAssignment] = await Promise.all([
        soldierService.getById(soldierId),
        combatEquipmentService.getAll(),
        manaService.getAll(),
        assignmentService.getCurrentAssignment(soldierId, 'combat', 'issue'),
      ]);

      setSoldier(soldierData);

      // Transformer les équipements Firebase en EquipmentItem pour l'UI
      const equipmentItems: EquipmentItem[] = combatEquipment.map((eq: CombatEquipment) => {
        // Chercher si cet équipement est dans l'assignment actuel
        const currentItem = currentAssignment?.items?.find(
          item => item.equipmentId === eq.id
        );

        return {
          id: eq.id,
          name: eq.name,
          category: eq.category,
          quantity: currentItem?.quantity || 1,
          selected: !!currentItem, // Pré-cocher SEULEMENT si dans l'assignment
          serial: currentItem?.serial || undefined,
          needsSerial: eq.serial !== undefined || ['נשק', 'אופטיקה'].includes(eq.category),
          subEquipments: eq.hasSubEquipment && eq.subEquipments
            ? eq.subEquipments.map(sub => {
                // Chercher si ce sous-équipement est dans l'assignment
                const existingSub = currentItem?.subEquipments?.find(
                  s => s.name === sub.name
                );
                return {
                  id: sub.id,
                  name: sub.name,
                  selected: !!existingSub,
                };
              })
            : undefined,
        };
      });

      setEquipment(equipmentItems);
      setManot(manotData);

      // Afficher un message si des items existent déjà
      if (currentAssignment?.items && currentAssignment.items.length > 0) {
        console.log(`Found ${currentAssignment.items.length} items in current combat assignment for soldier ${soldierId}`);
      }

      // Extraire les catégories uniques depuis les équipements
      const uniqueCategories = Array.from(
        new Set(combatEquipment.map((e: CombatEquipment) => e.category))
      );

      const categoryColors: { [key: string]: string } = {
        'נשק': '#e74c3c',
        'אופטיקה': '#9b59b6',
        'ציוד מגן': '#27ae60',
        'ציוד נוסף': '#3498db',
        'נשק ראשי': '#e74c3c',
        'אביזרי נשק': '#e67e22',
        'ציוד לוחם': '#27ae60',
        'אופטיקה ותצפית': '#9b59b6',
        'קשר': '#3498db',
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
      border: none;
      background-color: #ffffff;
    }
    .m-signature-pad--body {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      border: none;
    }
    .m-signature-pad--body canvas {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      position: relative;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `;

  const handleBegin = () => {
    setScrollEnabled(false);
  };

  const handleEnd = () => {
    setScrollEnabled(true);
    signatureRef.current?.readSignature();
  };

  const handleOK = async (sig: string) => {
    setSignature(sig);
    setShowSignature(false);
    setScrollEnabled(true);

    // Déclencher automatiquement la sauvegarde après capture de signature
    // On passe la signature en paramètre car le state ne sera pas encore à jour
    await handleSaveAndSign(sig);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setSignature(null);
  };

  // ==========================================
  // NOUVELLES FONCTIONS - FIX BUG MANA
  // ==========================================

  // Sélectionner une מנה (ne fait que stocker l'ID, pas de reset)
  const handleSelectMana = (manaId: string) => {
    console.log('[MANA] Selected mana ID:', manaId);
    setSelectedManaId(manaId); // État stable
  };

  // Confirmer la מנה sélectionnée (transforme en items)
  const confirmMana = () => {
    const mana = manot.find(m => m.id === selectedManaId);
    if (!mana) {
      Alert.alert('שגיאה', 'אנא בחר מנה תחילה');
      return;
    }

    console.log('[MANA] Confirming mana:', mana.name);
    console.log('[MANA] Equipment in mana:', mana.equipments);

    // Convertir les équipements de la מנה en EquipmentItem[]
    const manaEquipmentItems: EquipmentItem[] = mana.equipments.map(manaEq => {
      // Trouver l'équipement complet dans la liste equipment
      const fullEquipment = equipment.find(eq => eq.name === manaEq.equipmentName);

      if (!fullEquipment) {
        console.warn(`[MANA] Equipment not found: ${manaEq.equipmentName}`);
        return null;
      }

      return {
        ...fullEquipment,
        quantity: manaEq.quantity,
        selected: true,
        subEquipments: fullEquipment.subEquipments?.map(sub => ({
          ...sub,
          selected: true,
        })),
      };
    }).filter(item => item !== null) as EquipmentItem[];

    console.log('[MANA] Items created from mana:', manaEquipmentItems.length);
    setManaItems(manaEquipmentItems);
    Alert.alert('הצלחה', `${mana.name} נבחרה - ${manaEquipmentItems.length} פריטים`);
  };

  // Ajouter un item manuel
  const addManualItem = (itemId: string, quantity: number = 1) => {
    const item = equipment.find(eq => eq.id === itemId);
    if (!item) return;

    console.log('[MANUAL] Adding item:', item.name, 'quantity:', quantity);

    // Vérifier si déjà dans manualItems
    const existingIndex = manualItems.findIndex(mi => mi.id === itemId);

    if (existingIndex >= 0) {
      // Mettre à jour la quantité
      const updated = [...manualItems];
      updated[existingIndex] = { ...updated[existingIndex], quantity };
      setManualItems(updated);
    } else {
      // Ajouter nouveau
      setManualItems(prev => [...prev, { ...item, selected: true, quantity }]);
    }
  };

  // Supprimer un item manuel
  const removeManualItem = (itemId: string) => {
    console.log('[MANUAL] Removing item:', itemId);
    setManualItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Calculer la liste finale (merge mana + manual)
  const getFinalEquipmentList = (): EquipmentItem[] => {
    const finalMap = new Map<string, EquipmentItem>();

    // 1. Ajouter les items de la מנה
    manaItems.forEach(item => {
      finalMap.set(item.id, { ...item });
    });

    // 2. Ajouter/merger les items manuels
    manualItems.forEach(item => {
      if (finalMap.has(item.id)) {
        // Item existe déjà (depuis מנה), additionner les quantités
        const existing = finalMap.get(item.id)!;
        finalMap.set(item.id, {
          ...existing,
          quantity: existing.quantity + item.quantity,
        });
      } else {
        // Nouvel item
        finalMap.set(item.id, { ...item });
      }
    });

    const finalList = Array.from(finalMap.values());
    console.log('[FINAL] Final equipment list:', finalList.length, 'items');
    return finalList;
  };

  // Passer à la signature (simplifié - pas de confirmation intermédiaire)
  const proceedToSignature = () => {
    const finalItems = getFinalEquipmentList();

    if (finalItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד (מנה או ציוד ידני)');
      return;
    }

    console.log('[SIGNATURE] Proceeding with', finalItems.length, 'items');
    setShowSignature(true);
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

  // Générer et uploader le PDF de signature
  const generateAndUploadPdf = async (assignmentId: string, assignmentData: any) => {
    try {
      console.log('Generating PDF for assignment:', assignmentId);

      // 1. Générer le PDF
      const pdfBytes = await generateAssignmentPDF({
        ...assignmentData,
        id: assignmentId,
        timestamp: new Date(),
      });

      console.log('PDF generated successfully, size:', pdfBytes.length, 'bytes');

      // 2. Upload vers Storage avec chemin structuré
      // Chemin: pdf/{type}/signature/{soldierId}.pdf
      const url = await pdfStorageService.uploadPdf(
        pdfBytes,
        assignmentData.soldierId,
        assignmentData.type,
        'issue' // Action pour signature
      );
      console.log('PDF uploaded to:', url);

      // 3. Mettre à jour l'assignment avec le pdfUrl
      await assignmentService.update(assignmentId, { pdfUrl: url });

      return url;
    } catch (error) {
      console.error('Error generating/uploading PDF:', error);
      Alert.alert('שגיאה', 'נכשל ביצירת המסמך PDF');
      return null;
    }
  };

  // Partager le PDF sur WhatsApp
  const handleShareWhatsApp = async (pdfUrl: string) => {
    try {
      if (!soldier?.phone) {
        Alert.alert('שגיאה', 'אין מספר טלפון לחייל');
        return;
      }

      const message = `שלום ${soldier.name},\n\nצורף מסמך החתמה לציוד לחימה.\n\nתודה,\nגדוד 982`;
      await openWhatsAppChat(soldier.phone, message);
    } catch (error) {
      console.error('Error sharing on WhatsApp:', error);
      Alert.alert('שגיאה', 'לא ניתן לשלוח ב-WhatsApp');
    }
  };

  const handleSaveAndSign = async (signatureData?: string) => {
    // Utiliser le paramètre fourni ou le state signature
    const sig = signatureData || signature;

    if (!sig) {
      Alert.alert('שגיאה', 'אנא חתום לפני שמירה');
      return;
    }

    // Utiliser la liste finale (merge mana + manual)
    const finalItems = getFinalEquipmentList();
    console.log('[SAVE] Final items to save:', finalItems.length);

    if (finalItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד');
      return;
    }

    // Note: Validation des serials sera faite dans l'UI de sélection manuelle
    // Pour simplifier, on retire cette validation ici

    setSaving(true);
    try {
      const assignmentItems = finalItems.map(item => {
        const itemData: any = {
          equipmentId: item.id,
          equipmentName: item.name,
          quantity: item.quantity,
        };

        // Ajouter serial uniquement s'il existe
        if (item.serial) {
          itemData.serial = item.serial;
        }

        // Ajouter subEquipments uniquement s'il y en a
        const selectedSubEquipments = item.subEquipments?.filter(sub => sub.selected);
        if (selectedSubEquipments && selectedSubEquipments.length > 0) {
          itemData.subEquipments = selectedSubEquipments.map(sub => ({ name: sub.name }));
        }

        return itemData;
      });

      const assignmentData: any = {
        soldierId,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        type: 'combat',
        action: 'issue',
        items: assignmentItems,
        signature: sig, // Utiliser sig au lieu de signature
        status: 'נופק לחייל',
        assignedBy: user?.id || '',
      };

      // Ajouter les champs optionnels seulement s'ils existent
      if (soldier.phone) assignmentData.soldierPhone = soldier.phone;
      if (soldier.company) assignmentData.soldierCompany = soldier.company;
      if (user?.name) assignmentData.assignedByName = user.name;
      if (user?.email) assignmentData.assignedByEmail = user.email;

      const assignmentId = await assignmentService.create(assignmentData);
      console.log('Combat assignment created/updated:', assignmentId);

      // Générer et uploader le PDF
      const pdfUrl = await generateAndUploadPdf(assignmentId, assignmentData);

      // Afficher succès avec option WhatsApp
      if (pdfUrl) {
        Alert.alert(
          'הצלחה',
          'החתימה נשמרה והמסמך נוצר בהצלחה',
          [
            {
              text: 'שלח ב-WhatsApp',
              onPress: () => {
                handleShareWhatsApp(pdfUrl);
                (navigation as any).reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              },
            },
            {
              text: 'סגור',
              style: 'cancel',
              onPress: () => {
                (navigation as any).reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              },
            },
          ]
        );
      } else {
        // Si le PDF a échoué, naviguer quand même
        (navigation as any).reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
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
        <Text style={styles.emptyText}>החייל לא נמצא</Text>
      </View>
    );
  }

  // ====================
  // VUE: Écran de signature simple
  // ====================
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

        <View style={styles.signatureFullScreen}>
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
              style={styles.clearSignatureButtonFullscreen}
              onPress={handleClear}
            >
              <Text style={styles.clearSignatureTextFullscreen}>🗑️ נקה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ====================
  // VUE: Écran principal
  // ====================
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
          <Text style={styles.subtitle}>🔫 נשקייה</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
      >
        {/* 1. פרטי החייל */}
        <View style={styles.soldierCard}>
          <Text style={styles.soldierName}>{soldier.name}</Text>
          <Text style={styles.soldierMeta}>
            {soldier.personalNumber} • {soldier.company}
          </Text>
        </View>

        {/* 2. סֶלֶקְטוֹר קטגוריה - בחר מנה או ציוד ידני */}
        <View style={styles.categorySelector}>
          <TouchableOpacity
            style={[
              styles.categorySelectorButton,
              selectionMode === 'mana' && styles.categorySelectorButtonActive
            ]}
            onPress={() => setSelectionMode('mana')}
          >
            <Text style={[
              styles.categorySelectorText,
              selectionMode === 'mana' && styles.categorySelectorTextActive
            ]}>
              📦 בחר מנה
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categorySelectorButton,
              selectionMode === 'manual' && styles.categorySelectorButtonActive
            ]}
            onPress={() => setSelectionMode('manual')}
          >
            <Text style={[
              styles.categorySelectorText,
              selectionMode === 'manual' && styles.categorySelectorTextActive
            ]}>
              🔧 ציוד ידני
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. MODE MANA - Sélection et preview de מנה */}
        {selectionMode === 'mana' && (
          <View style={styles.manaSection}>
            <Text style={styles.sectionTitle}>בחירת מנה</Text>

            {/* Dropdown/Picker de מנה */}
            <View style={styles.manaPickerContainer}>
              <Text style={styles.inputLabel}>בחר מנה:</Text>
              {manot.map(mana => (
                <TouchableOpacity
                  key={mana.id}
                  style={[
                    styles.manaOption,
                    selectedManaId === mana.id && styles.manaOptionSelected
                  ]}
                  onPress={() => handleSelectMana(mana.id)}
                >
                  <View style={styles.radioButton}>
                    {selectedManaId === mana.id && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text style={styles.manaOptionText}>{mana.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview de la מנה sélectionnée */}
            {selectedManaId && (() => {
              const mana = manot.find(m => m.id === selectedManaId);
              return mana ? (
                <View style={styles.manaPreview}>
                  <Text style={styles.previewTitle}>📋 תצוגה מקדימה - {mana.name}</Text>
                  {mana.equipments.map((eq, idx) => (
                    <View key={idx} style={styles.previewItem}>
                      <Text style={styles.previewItemQuantity}>×{eq.quantity}</Text>
                      <Text style={styles.previewItemName}>• {eq.equipmentName}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.confirmManaButton}
                    onPress={confirmMana}
                  >
                    <Text style={styles.confirmManaButtonText}>✓ אשר מנה זו</Text>
                  </TouchableOpacity>
                </View>
              ) : null;
            })()}
          </View>
        )}

        {/* 4. MODE MANUAL - Sélection manuelle d'équipement */}
        {selectionMode === 'manual' && (
          <View style={styles.manualSection}>
            <Text style={styles.sectionTitle}>בחירת ציוד ידני</Text>

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
                      {categoryEquipment.map(item => {
                        const isInManualList = manualItems.some(mi => mi.id === item.id);
                        const manualItem = manualItems.find(mi => mi.id === item.id);

                        return (
                          <View key={item.id} style={styles.manualEquipmentItem}>
                            <View style={styles.equipmentRow}>
                              <Text style={styles.equipmentName}>{item.name}</Text>

                              {!isInManualList ? (
                                <TouchableOpacity
                                  style={styles.addManualButton}
                                  onPress={() => addManualItem(item.id, 1)}
                                >
                                  <Text style={styles.addManualButtonText}>+ הוסף</Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.manualItemControls}>
                                  <TouchableOpacity
                                    style={styles.removeManualButton}
                                    onPress={() => removeManualItem(item.id)}
                                  >
                                    <Text style={styles.removeManualButtonText}>🗑</Text>
                                  </TouchableOpacity>

                                  <View style={styles.quantityControls}>
                                    <TouchableOpacity
                                      style={styles.quantityButton}
                                      onPress={() => addManualItem(item.id, (manualItem?.quantity || 1) + 1)}
                                    >
                                      <Text style={styles.quantityButtonText}>+</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.quantityText}>{manualItem?.quantity || 1}</Text>
                                    <TouchableOpacity
                                      style={styles.quantityButton}
                                      onPress={() => {
                                        const newQty = (manualItem?.quantity || 1) - 1;
                                        if (newQty > 0) {
                                          addManualItem(item.id, newQty);
                                        } else {
                                          removeManualItem(item.id);
                                        }
                                      }}
                                    >
                                      <Text style={styles.quantityButtonText}>-</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 5. LISTE FINALE - Merge מנה + manuel */}
        {(() => {
          const finalList = getFinalEquipmentList();
          if (finalList.length === 0) return null;

          return (
            <View style={styles.finalListSection}>
              <Text style={styles.finalListTitle}>
                ✅ ציוד סופי להחתמה ({finalList.length} פריטים)
              </Text>
              {finalList.map(item => (
                <View key={item.id} style={styles.finalListItem}>
                  <Text style={styles.finalListItemQuantity}>×{item.quantity}</Text>
                  <Text style={styles.finalListItemName}>{item.name}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* 6. כפתור חתימה */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.signatureButton, saving && styles.buttonDisabled]}
            onPress={proceedToSignature}
            disabled={saving || getFinalEquipmentList().length === 0}
          >
            <Text style={styles.signatureButtonText}>
              ✍️ חתימה ({getFinalEquipmentList().length} פריטים)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>ביטול</Text>
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
  scrollContent: {
    paddingBottom: 100,
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
  soldierName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'right',
  },
  soldierMeta: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    textAlign: 'right',
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
    height: 300,
    width: '100%',
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

  // ==================
  // Styles: Modal de preview de מנה
  // ==================
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    ...Shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 24,
    color: Colors.text.secondary,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 15,
    textAlign: 'right',
  },
  manaEquipmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    marginBottom: 8,
  },
  manaEquipmentName: {
    fontSize: 15,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  manaEquipmentQuantity: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.modules.arme,
    marginLeft: 10,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: 10,
  },
  applyManaButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.small,
  },
  applyManaButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  cancelManaButton: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelManaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },

  // ==================
  // Styles: Écran de confirmation
  // ==================
  summaryCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b3d9f2',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  summaryText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  confirmationItem: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  confirmationItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmationItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  confirmationItemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.modules.arme,
    marginLeft: 10,
  },
  confirmationItemSerial: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'right',
  },
  subEquipmentsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  subEquipmentText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 4,
    textAlign: 'right',
  },
  confirmationButtons: {
    gap: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  confirmButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    ...Shadows.medium,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },

  // ==================
  // Styles: Écran de signature fullscreen
  // ==================
  signatureFullScreen: {
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
  clearSignatureButtonFullscreen: {
    flex: 1,
    backgroundColor: Colors.status.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Shadows.medium,
  },
  clearSignatureTextFullscreen: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },

  // ==================
  // Styles: Nouvelle UI simplifiée (single-page)
  // ==================
  categorySelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 4,
    ...Shadows.small,
  },
  categorySelectorButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  categorySelectorButtonActive: {
    backgroundColor: Colors.modules.arme,
    ...Shadows.small,
  },
  categorySelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  categorySelectorTextActive: {
    color: Colors.text.white,
    fontWeight: 'bold',
  },

  // Mana selection mode
  manaSection: {
    marginBottom: 20,
  },
  manaPickerContainer: {
    gap: 10,
  },
  manaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  manaOptionSelected: {
    borderColor: Colors.modules.arme,
    backgroundColor: '#e8f4fd',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.modules.arme,
  },
  manaOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'right',
  },

  // Mana preview
  manaPreview: {
    marginTop: 15,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    paddingBottom: 8,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  previewItemQuantity: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.modules.arme,
    marginRight: 8,
    minWidth: 35,
    textAlign: 'center',
  },
  previewItemName: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    textAlign: 'right',
  },
  confirmManaButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    ...Shadows.small,
  },
  confirmManaButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },

  // Manual selection mode
  manualSection: {
    marginBottom: 20,
  },
  manualEquipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  manualItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addManualButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 80,
    alignItems: 'center',
  },
  addManualButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  removeManualButton: {
    backgroundColor: Colors.status.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  removeManualButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },

  // Final equipment list
  finalListSection: {
    backgroundColor: '#d4edda',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: Colors.status.success,
    ...Shadows.small,
  },
  finalListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.medium,
    paddingBottom: 8,
  },
  finalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 6,
    marginBottom: 6,
  },
  finalListItemQuantity: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.modules.arme,
    marginRight: 8,
    minWidth: 35,
    textAlign: 'center',
  },
  finalListItemName: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    textAlign: 'right',
  },

  // Signature button
  signatureButton: {
    backgroundColor: Colors.military.navyBlue,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
    ...Shadows.medium,
  },
  signatureButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.background.secondary,
  },
});

export default CombatAssignmentScreen;
