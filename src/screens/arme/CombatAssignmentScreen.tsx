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

  // Mode de sélection: 'mana' ou 'manual'
  const [selectionMode, setSelectionMode] = useState<'mana' | 'manual'>('mana');

  // ID de la מנה sélectionnée
  const [selectedManaId, setSelectedManaId] = useState<string>('');

  // Items finaux (merge de mana + manual)
  const [finalItems, setFinalItems] = useState<EquipmentItem[]>([]);

  // États pour signature
  const [showSignature, setShowSignature] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    loadSoldierData();
  }, []);

  const loadSoldierData = async () => {
    try {
      const [soldierData, combatEquipment, manotData, currentAssignment] = await Promise.all([
        soldierService.getById(soldierId),
        combatEquipmentService.getAll(),
        manaService.getAll(),
        assignmentService.getCurrentAssignment(soldierId, 'combat', 'issue'),
      ]);

      setSoldier(soldierData);

      // Transformer les équipements Firebase en EquipmentItem
      const equipmentItems: EquipmentItem[] = combatEquipment.map((eq: CombatEquipment) => {
        const currentItem = currentAssignment?.items?.find(
          item => item.equipmentId === eq.id
        );

        return {
          id: eq.id,
          name: eq.name,
          category: eq.category,
          quantity: currentItem?.quantity || 1,
          serial: currentItem?.serial || undefined,
          needsSerial: eq.serial !== undefined || ['נשק', 'אופטיקה'].includes(eq.category),
          subEquipments: eq.hasSubEquipment && eq.subEquipments
            ? eq.subEquipments.map(sub => {
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

      // Si un assignment existe, pré-remplir finalItems
      if (currentAssignment?.items && currentAssignment.items.length > 0) {
        const existingItems: EquipmentItem[] = currentAssignment.items.map(item => {
          const eq = equipmentItems.find(e => e.id === item.equipmentId);
          if (!eq) return null;

          return {
            ...eq,
            quantity: item.quantity,
            serial: item.serial,
            subEquipments: eq.subEquipments?.map(sub => ({
              ...sub,
              selected: item.subEquipments?.some(s => s.name === sub.name) || false,
            })),
          };
        }).filter(item => item !== null) as EquipmentItem[];

        setFinalItems(existingItems);
        console.log(`Loaded ${existingItems.length} items from existing assignment`);
      }

      // Extraire les catégories
      const uniqueCategories = Array.from(
        new Set(combatEquipment.map((e: CombatEquipment) => e.category))
      );

      const categoryColors: { [key: string]: string } = {
        'נשק': '#e74c3c',
        'אופטיקה': '#9b59b6',
        'ציוד מגן': '#27ae60',
        'ציוד נוסף': '#3498db',
        'אביזרים': '#e67e22',
        'ציוד לוחם': '#27ae60',
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
    await handleSaveAndSign(sig);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setSignature(null);
  };

  // Sélectionner une מנה et ajouter ses items à finalItems
  const handleSelectMana = (manaId: string) => {
    const mana = manot.find(m => m.id === manaId);
    if (!mana) return;

    console.log('[MANA] Selecting mana:', mana.name);
    console.log('[MANA] Mana equipments:', mana.equipments);
    setSelectedManaId(manaId);

    // Convertir les équipements de la מנה en EquipmentItem[] et les ajouter à finalItems
    const manaEquipmentItems: EquipmentItem[] = mana.equipments.map(manaEq => {
      // IMPORTANT: Utiliser equipmentId pour le matching, pas le nom
      const fullEquipment = equipment.find(eq => eq.id === manaEq.equipmentId);

      if (!fullEquipment) {
        console.warn(`[MANA] Equipment not found with ID: ${manaEq.equipmentId} (name: ${manaEq.equipmentName})`);
        return null;
      }

      console.log(`[MANA] Found equipment: ${fullEquipment.name} (ID: ${fullEquipment.id})`);

      return {
        ...fullEquipment,
        quantity: manaEq.quantity,
        subEquipments: fullEquipment.subEquipments?.map(sub => ({
          ...sub,
          selected: true, // Sélectionner tous les sous-équipements par défaut
        })),
      };
    }).filter(item => item !== null) as EquipmentItem[];

    console.log(`[MANA] Created ${manaEquipmentItems.length} equipment items from mana`);

    // Merger avec finalItems existants
    const mergedMap = new Map<string, EquipmentItem>();

    // Ajouter les items existants
    finalItems.forEach(item => {
      mergedMap.set(item.id, { ...item });
    });

    // Ajouter/merger les items de la מנה
    manaEquipmentItems.forEach(item => {
      if (mergedMap.has(item.id)) {
        const existing = mergedMap.get(item.id)!;
        mergedMap.set(item.id, {
          ...existing,
          quantity: existing.quantity + item.quantity,
        });
      } else {
        mergedMap.set(item.id, { ...item });
      }
    });

    const newFinalItems = Array.from(mergedMap.values());
    setFinalItems(newFinalItems);

    Alert.alert('הצלחה', `${mana.name} נוספה - סה"כ ${newFinalItems.length} פריטים`);
  };

  // Ajouter un item manuel à finalItems
  const addItemToFinalList = (itemId: string) => {
    const item = equipment.find(eq => eq.id === itemId);
    if (!item) return;

    const existing = finalItems.find(fi => fi.id === itemId);

    if (existing) {
      // Augmenter la quantité
      updateFinalItemQuantity(itemId, existing.quantity + 1);
    } else {
      // Ajouter nouveau
      setFinalItems(prev => [...prev, { ...item, quantity: 1 }]);
    }
  };

  // Retirer un item de finalItems
  const removeItemFromFinalList = (itemId: string) => {
    setFinalItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Mettre à jour la quantité d'un item dans finalItems
  const updateFinalItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromFinalList(itemId);
      return;
    }

    setFinalItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  // Mettre à jour le serial d'un item dans finalItems
  const updateFinalItemSerial = (itemId: string, serial: string) => {
    setFinalItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, serial } : item
      )
    );
  };

  // Toggle sous-équipement dans finalItems
  const toggleFinalItemSubEquipment = (itemId: string, subId: string) => {
    setFinalItems(prev =>
      prev.map(item => {
        if (item.id === itemId && item.subEquipments) {
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

  const proceedToSignature = () => {
    if (finalItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד');
      return;
    }

    // Validation: Vérifier que tous les items qui needsSerial ont un serial
    const missingSerials = finalItems.filter(item => item.needsSerial && !item.serial);
    if (missingSerials.length > 0) {
      Alert.alert(
        'שגיאה',
        `יש להזין מסטב עבור: ${missingSerials.map(i => i.name).join(', ')}`,
        [{ text: 'אישור' }]
      );
      return;
    }

    console.log('[SIGNATURE] Proceeding with', finalItems.length, 'items');
    setShowSignature(true);
  };

  const generateAndUploadPdf = async (assignmentId: string, assignmentData: any) => {
    try {
      console.log('Generating PDF for assignment:', assignmentId);

      const pdfBytes = await generateAssignmentPDF({
        ...assignmentData,
        id: assignmentId,
        timestamp: new Date(),
      });

      console.log('PDF generated successfully, size:', pdfBytes.length, 'bytes');

      const url = await pdfStorageService.uploadPdf(
        pdfBytes,
        assignmentData.soldierId,
        assignmentData.type,
        'issue'
      );
      console.log('PDF uploaded to:', url);

      await assignmentService.update(assignmentId, { pdfUrl: url });

      return url;
    } catch (error) {
      console.error('Error generating/uploading PDF:', error);
      Alert.alert('שגיאה', 'נכשל ביצירת המסמך PDF');
      return null;
    }
  };

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
    const sig = signatureData || signature;

    if (!sig) {
      Alert.alert('שגיאה', 'אנא חתום לפני שמירה');
      return;
    }

    if (finalItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד');
      return;
    }

    setSaving(true);
    try {
      const assignmentItems = finalItems.map(item => {
        const itemData: any = {
          equipmentId: item.id,
          equipmentName: item.name,
          quantity: item.quantity,
        };

        if (item.serial) {
          itemData.serial = item.serial;
        }

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
        signature: sig,
        status: 'נופק לחייל',
        assignedBy: user?.id || '',
      };

      if (soldier.phone) assignmentData.soldierPhone = soldier.phone;
      if (soldier.company) assignmentData.soldierCompany = soldier.company;
      if (user?.name) assignmentData.assignedByName = user.name;
      if (user?.email) assignmentData.assignedByEmail = user.email;

      const assignmentId = await assignmentService.create(assignmentData);
      console.log('Combat assignment created/updated:', assignmentId);

      const pdfUrl = await generateAndUploadPdf(assignmentId, assignmentData);

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

  return (
    <View style={styles.container}>
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
        {/* פרטי החייל */}
        <View style={styles.soldierCard}>
          <Text style={styles.soldierName}>{soldier.name}</Text>
          <Text style={styles.soldierMeta}>
            {soldier.personalNumber} • {soldier.company}
          </Text>
        </View>

        {/* סלקטור - בחר מנה או ציוד ידני */}
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

        {/* MODE MANA */}
        {selectionMode === 'mana' && (
          <View style={styles.manaSection}>
            <Text style={styles.sectionTitle}>בחירת מנה</Text>
            <View style={styles.manaPickerContainer}>
              {manot.map(mana => (
                <TouchableOpacity
                  key={mana.id}
                  style={styles.manaOption}
                  onPress={() => handleSelectMana(mana.id)}
                >
                  <Text style={styles.manaOptionText}>{mana.name}</Text>
                  <Text style={styles.manaAddIcon}>+</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* MODE MANUAL */}
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
                        const isInFinalList = finalItems.some(fi => fi.id === item.id);

                        return (
                          <View key={item.id} style={styles.manualEquipmentItem}>
                            <Text style={styles.equipmentName}>{item.name}</Text>
                            {!isInFinalList ? (
                              <TouchableOpacity
                                style={styles.addManualButton}
                                onPress={() => addItemToFinalList(item.id)}
                              >
                                <Text style={styles.addManualButtonText}>+ הוסף</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={styles.alreadyAddedText}>✓ נוסף</Text>
                            )}
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

        {/* ÉDITION FINALE - Liste de tous les items avec serial, quantité, etc. */}
        {finalItems.length > 0 && (
          <View style={styles.finalEditSection}>
            <Text style={styles.finalEditTitle}>
              ✏️ עריכת ציוד להחתמה ({finalItems.length} פריטים)
            </Text>
            <Text style={styles.finalEditSubtitle}>
              ניתן לערוך כמות, מסטב, ורכיבים נוספים
            </Text>

            {finalItems.map(item => (
              <View key={item.id} style={styles.finalEditItem}>
                {/* Header: Nom + Supprimer */}
                <View style={styles.finalEditItemHeader}>
                  <TouchableOpacity
                    style={styles.removeItemButton}
                    onPress={() => removeItemFromFinalList(item.id)}
                  >
                    <Text style={styles.removeItemButtonText}>🗑</Text>
                  </TouchableOpacity>
                  <Text style={styles.finalEditItemName}>{item.name}</Text>
                </View>

                {/* Quantité */}
                <View style={styles.finalEditRow}>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateFinalItemQuantity(item.id, item.quantity - 1)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateFinalItemQuantity(item.id, item.quantity + 1)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.finalEditLabel}>:כמות</Text>
                </View>

                {/* Serial (si nécessaire) */}
                {item.needsSerial && (
                  <View style={styles.finalEditRow}>
                    <TextInput
                      style={styles.serialInput}
                      value={item.serial || ''}
                      onChangeText={(text) => updateFinalItemSerial(item.id, text)}
                      placeholder="הזן מסטב..."
                      placeholderTextColor={Colors.text.light}
                    />
                    <Text style={[styles.finalEditLabel, styles.requiredLabel]}>:מסטב *</Text>
                  </View>
                )}

                {/* Sous-équipements */}
                {item.subEquipments && item.subEquipments.length > 0 && (
                  <View style={styles.subEquipmentContainer}>
                    <Text style={styles.subEquipmentTitle}>רכיבים נוספים:</Text>
                    {item.subEquipments.map(sub => (
                      <TouchableOpacity
                        key={sub.id}
                        style={styles.subEquipmentRow}
                        onPress={() => toggleFinalItemSubEquipment(item.id, sub.id)}
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

        {/* כפתור חתימה */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.signatureButton, (saving || finalItems.length === 0) && styles.buttonDisabled]}
            onPress={proceedToSignature}
            disabled={saving || finalItems.length === 0}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.signatureButtonText}>
                ✍️ חתימה ({finalItems.length} פריטים)
              </Text>
            )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  manaSection: {
    marginBottom: 20,
  },
  manaPickerContainer: {
    gap: 10,
  },
  manaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  manaOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'right',
  },
  manaAddIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.status.success,
    marginLeft: 10,
  },
  manualSection: {
    marginBottom: 20,
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
  manualEquipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
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
  alreadyAddedText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.status.success,
  },
  finalEditSection: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: Colors.modules.arme,
    ...Shadows.medium,
  },
  finalEditTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
    textAlign: 'right',
  },
  finalEditSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
    textAlign: 'right',
  },
  finalEditItem: {
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  finalEditItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  finalEditItemName: {
    flex: 1,
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'right',
  },
  removeItemButton: {
    backgroundColor: Colors.status.danger,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 10,
  },
  removeItemButtonText: {
    fontSize: 16,
    color: Colors.text.white,
  },
  finalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  finalEditLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginLeft: 10,
  },
  requiredLabel: {
    color: Colors.status.danger,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 36,
    height: 36,
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
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    textAlign: 'right',
  },
  subEquipmentContainer: {
    marginTop: 10,
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
  actionButtons: {
    gap: 12,
    marginBottom: 30,
  },
  signatureButton: {
    backgroundColor: Colors.military.navyBlue,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
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
});

export default CombatAssignmentScreen;
