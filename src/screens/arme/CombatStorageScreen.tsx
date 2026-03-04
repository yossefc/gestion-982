// Écran d'אפסון ציוד לחימה - Mise en dépôt avec signature
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, Soldier, AssignmentItem } from '../../types';
import { soldierService } from '../../services/firebaseService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { generateStorageHTML, generateStoragePDF, StoragePDFData } from '../../services/pdfService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/Colors';
import { AppModal, ModalType } from '../../components';
import { useSoldierSearch } from '../../hooks/useSoldierSearch';
import StorageDocumentViewerModal from './StorageDocumentViewerModal';

type CombatStorageRouteProp = RouteProp<RootStackParamList, 'CombatStorage'>;

interface StorageItem extends AssignmentItem {
  itemKey: string;
  selected: boolean;
  storageQuantity: number;
  availableSerials: string[];
  selectedSerials: string[];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
const pad2 = (n: number) => String(n).padStart(2, '0');
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmtDate = (d: number, m: number, y: number) => `${pad2(d)}/${pad2(m)}/${y}`;

interface DateSpinnerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

const DateSpinner: React.FC<DateSpinnerProps> = ({ label, value, min, max, onChange }) => (
  <View style={spin.col}>
    <Text style={spin.label}>{label}</Text>
    <TouchableOpacity style={spin.btn} onPress={() => onChange(value >= max ? min : value + 1)}>
      <Ionicons name="chevron-up" size={16} color={Colors.arme} />
    </TouchableOpacity>
    <Text style={spin.val}>{pad2(value)}</Text>
    <TouchableOpacity style={spin.btn} onPress={() => onChange(value <= min ? max : value - 1)}>
      <Ionicons name="chevron-down" size={16} color={Colors.arme} />
    </TouchableOpacity>
  </View>
);

const spin = StyleSheet.create({
  col: { alignItems: 'center', flex: 1 },
  label: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  btn: {
    width: 30, height: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 6, marginVertical: 2,
  },
  val: { fontSize: 18, fontWeight: '700', color: '#1E293B', minWidth: 32, textAlign: 'center' },
});

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_DAYS = 30;

const initDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_DAYS);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
};

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

  // ── Date state ──────────────────────────────────────────────────────────────
  const [dateState, setDateState] = useState(initDate);

  const setDay = (v: number) =>
    setDateState(p => ({ ...p, day: clamp(v, 1, daysInMonth(p.month, p.year)) }));
  const setMonth = (v: number) =>
    setDateState(p => ({ day: clamp(p.day, 1, daysInMonth(v, p.year)), month: v, year: p.year }));
  const setYear = (v: number) =>
    setDateState(p => ({ day: clamp(p.day, 1, daysInMonth(p.month, v)), month: p.month, year: v }));

  const currentYear = new Date().getFullYear();

  // ── Depositor state ─────────────────────────────────────────────────────────
  const [depositor, setDepositor] = useState<Soldier | null>(null);
  const [depositorQuery, setDepositorQuery] = useState('');
  const { soldiers, loading: searchLoading, search, reset } = useSoldierSearch();

  const handleDepositorQueryChange = useCallback((q: string) => {
    setDepositorQuery(q);
    if (q.length >= 2) search(q);
    else reset();
  }, [search, reset]);

  const handleSelectDepositor = (s: Soldier) => {
    setDepositor(s);
    setDepositorQuery('');
    reset();
  };

  // ── Document viewer state ───────────────────────────────────────────────────
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerHTML, setViewerHTML] = useState('');
  const [viewerPdfData, setViewerPdfData] = useState<StoragePDFData | null>(null);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  const showModal = (type: ModalType, message: string, title?: string, buttons?: any[]) => {
    setModalType(type);
    setModalMessage(message);
    setModalTitle(title);
    setModalButtons(buttons || [{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
    setModalVisible(true);
  };

  useEffect(() => {
    if (!soldierId) {
      showModal('error', 'לא נמצא מזהה חייל', undefined, [{
        text: 'סגור', style: 'primary',
        onPress: () => { setModalVisible(false); navigation.goBack(); },
      }]);
      return;
    }
    loadData();
  }, [soldierId]);

  const loadData = async () => {
    try {
      const [soldierData, currentItems] = await Promise.all([
        soldierService.getById(soldierId),
        transactionalAssignmentService.getCurrentHoldings(soldierId, 'combat'),
      ]);

      setSoldier(soldierData);

      const storageItems: StorageItem[] = currentItems
        .filter((item: any) => item.status !== 'stored')
        .map((item: any) => ({
          itemKey: `${item.equipmentId}_${item.status || 'assigned'}`,
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: item.quantity,
          serial: (item.serials || []).join(','),
          selected: false,
          storageQuantity: 0,
          availableSerials: item.serials || [],
          selectedSerials: [],
        }));

      setItems(storageItems);
    } catch (error) {
      console.error('Error loading data:', error);
      showModal('error', 'נכשל בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  // ── Item selection ──────────────────────────────────────────────────────────

  const toggleItem = (itemKey: string) => {
    setItems(prev =>
      prev.map(item =>
        item.itemKey === itemKey
          ? { ...item, selected: !item.selected, storageQuantity: !item.selected ? item.quantity : 0, selectedSerials: [] }
          : item
      )
    );
  };

  const updateStorageQuantity = (itemKey: string, delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.itemKey !== itemKey) return item;
        return { ...item, storageQuantity: Math.max(0, Math.min(item.quantity, item.storageQuantity + delta)) };
      })
    );
  };

  // ── Signature ───────────────────────────────────────────────────────────────

  const webStyle = `
    .m-signature-pad { position:fixed; margin:auto; top:0; left:0; right:0; width:100%; height:100%;
      box-shadow:none; border:2px solid #2c5f7c; border-radius:8px; background-color:#ffffff; }
    .m-signature-pad--body { border:none; }
    .m-signature-pad--footer { display:none; }
    body,html { margin:0; padding:0; }
  `;

  const handleEnd = () => { setScrollEnabled(true); signatureRef.current?.readSignature(); };
  const handleOK = (sig: string) => { setSignature(sig); setShowSignature(false); setScrollEnabled(true); };
  const handleClear = () => { signatureRef.current?.clearSignature(); setSignature(null); };

  // ── Storage action ──────────────────────────────────────────────────────────

  const handleStorageEquipment = async () => {
    const selectedItems = items.filter(item => item.selected && item.storageQuantity > 0);

    if (selectedItems.length === 0) {
      showModal('error', 'אנא בחר לפחות פריט אחד לאפסון'); return;
    }
    if (!signature) {
      showModal('error', 'אנא חתום לפני ביצוע האפסון'); return;
    }

    showModal('confirm', `האם אתה בטוח שברצונך לאפסן ${selectedItems.length} פריטים?`, 'אפסון ציוד', [
      { text: 'ביטול', style: 'outline', onPress: () => setModalVisible(false) },
      {
        text: 'אשר', style: 'primary', icon: 'archive' as const,
        onPress: async () => {
          setModalVisible(false);
          setProcessing(true);
          try {
            const storageItems = selectedItems.map(item => {
              const serialsToUse = item.selectedSerials.length > 0
                ? item.selectedSerials
                : item.availableSerials.slice(0, item.storageQuantity);
              const d: any = {
                equipmentId: item.equipmentId,
                equipmentName: item.equipmentName,
                quantity: item.storageQuantity,
              };
              if (serialsToUse.length > 0) d.serial = serialsToUse.join(', ');
              return d;
            });

            const requestId = `combat_storage_${soldierId}_${Date.now()}`;

            await transactionalAssignmentService.storageEquipment(
              soldierId,
              soldier?.name || '',
              soldier?.personalNumber || '',
              'combat',
              storageItems,
              user?.id || '',
              requestId
            );

            // Mettre à jour weapons_inventory
            const updatePromises: Promise<void>[] = [];
            for (const item of selectedItems) {
              const serialsToUse = item.selectedSerials.length > 0
                ? item.selectedSerials
                : item.availableSerials.slice(0, item.storageQuantity);
              for (const serial of serialsToUse) {
                const s = serial.trim();
                if (!s) continue;
                updatePromises.push((async () => {
                  try {
                    const weapon = await weaponInventoryService.getWeaponBySerialNumber(s);
                    if (weapon) {
                      await weaponInventoryService.moveWeaponToStorageWithSoldier(weapon.id, {
                        soldierId: soldier!.id,
                        soldierName: soldier!.name,
                        soldierPersonalNumber: soldier!.personalNumber,
                      });
                    }
                  } catch (err) {
                    console.error(`Failed to update weapon ${s}:`, err);
                  }
                })());
              }
            }
            if (updatePromises.length > 0) await Promise.all(updatePromises);

            // ── Build PDF data ────────────────────────────────────────────────
            const { day, month, year } = dateState;

            // Build weapon rows: one row per serial if available, else one row per item
            const weaponRows: { category: string; serialNumber: string }[] = [];
            for (const item of selectedItems) {
              if (item.selectedSerials.length > 0) {
                for (const serial of item.selectedSerials) {
                  weaponRows.push({ category: item.equipmentName, serialNumber: serial });
                }
              } else {
                weaponRows.push({
                  category: item.equipmentName,
                  serialNumber: `כמות: ${item.storageQuantity}`,
                });
              }
            }

            const pdfData: StoragePDFData = {
              ownerName: soldier?.name || '',
              ownerPersonalNumber: soldier?.personalNumber || '',
              ownerCompany: soldier?.company,
              ownerPhone: soldier?.phone,
              depositorName: depositor?.name,
              depositorPersonalNumber: depositor?.personalNumber,
              depositorPhone: depositor?.phone,
              storageDate: new Date(),
              plannedReturnDate: new Date(year, month - 1, day),
              weapons: weaponRows,
            };

            const html = generateStorageHTML(pdfData);
            setViewerPdfData(pdfData);
            setViewerHTML(html);
            setViewerVisible(true);

          } catch (error) {
            console.error('Error storing equipment:', error);
            showModal('error', 'נכשל באפסון הציוד');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  // ── Signature screen ────────────────────────────────────────────────────────

  if (showSignature) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setShowSignature(false)}>
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
            onBegin={() => setScrollEnabled(false)}
            onEnd={handleEnd}
            descriptionText=""
            clearText="נקה"
            confirmText="שמור"
            webStyle={webStyle}
            backgroundColor="#ffffff"
          />
          <View style={styles.signatureButtons}>
            <TouchableOpacity style={styles.endSignatureButton} onPress={handleEnd}>
              <Text style={styles.endSignatureText}>✓ סיים חתימה</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearSignatureButton} onPress={handleClear}>
              <Text style={styles.clearSignatureText}>🗑️ נקה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Loading screen ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} disabled={processing}>
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Soldier Info */}
        {soldier && (
          <View style={styles.soldierCard}>
            <View style={styles.soldierInfo}>
              <Text style={styles.soldierName}>{soldier.name}</Text>
              <Text style={styles.soldierMeta}>{soldier.personalNumber} • {soldier.company}</Text>
            </View>
          </View>
        )}

        {/* ── Return date ─────────────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>תאריך מתוכנן לחזרת החייל</Text>
          <Text style={styles.dateSummary}>{fmtDate(dateState.day, dateState.month, dateState.year)}</Text>
          <View style={styles.spinnersRow}>
            <DateSpinner label="יום" value={dateState.day} min={1}
              max={daysInMonth(dateState.month, dateState.year)} onChange={setDay} />
            <View style={styles.spinnerDivider} />
            <DateSpinner label="חודש" value={dateState.month} min={1} max={12} onChange={setMonth} />
            <View style={styles.spinnerDivider} />
            <DateSpinner label="שנה" value={dateState.year} min={currentYear} max={currentYear + 5} onChange={setYear} />
          </View>
        </View>

        {/* ── Depositor (optional) ─────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>גורם מאפסן <Text style={styles.optional}>(רשות)</Text></Text>
          <Text style={styles.sectionHint}>החייל המאפסן את הציוד — חפש לפי שם או מספר אישי</Text>

          {depositor ? (
            <View style={styles.selectedDepositor}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.depositorName}>{depositor.name}</Text>
                <Text style={styles.depositorDetail}>מ.א: {depositor.personalNumber}{depositor.company ? `  ·  ${depositor.company}` : ''}</Text>
                {depositor.phone ? <Text style={styles.depositorDetail}>טל': {depositor.phone}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => setDepositor(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.searchInput}
                value={depositorQuery}
                onChangeText={handleDepositorQueryChange}
                placeholder="חפש לפי שם או מספר אישי..."
                placeholderTextColor="#94A3B8"
                textAlign="right"
                autoCorrect={false}
              />
              {searchLoading && <ActivityIndicator size="small" color={Colors.arme} style={{ marginVertical: 6 }} />}
              {soldiers.slice(0, 6).map(s => (
                <TouchableOpacity key={s.id} style={styles.searchResult} onPress={() => handleSelectDepositor(s)} activeOpacity={0.7}>
                  <Text style={styles.resultName}>{s.name}</Text>
                  <Text style={styles.resultDetail}>{s.personalNumber}{s.company ? `  ·  ${s.company}` : ''}</Text>
                </TouchableOpacity>
              ))}
              {!searchLoading && depositorQuery.length >= 2 && soldiers.length === 0 && (
                <Text style={styles.noResults}>לא נמצאו חיילים</Text>
              )}
            </>
          )}
        </View>

        {/* ── Items list ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>ציוד פעיל ({items.length})</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין ציוד פעיל לאפסון</Text>
            <Text style={styles.emptySubtext}>החייל לא קיבל ציוד או כל הציוד כבר אופסן</Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map(item => (
              <View key={item.itemKey} style={[styles.itemCard, item.selected && styles.itemCardSelected]}>
                {/* ── Row: checkbox + info + quantity inline ── */}
                <View style={styles.itemRow}>
                  <TouchableOpacity
                    style={styles.itemHeaderTouch}
                    onPress={() => toggleItem(item.itemKey)}
                    disabled={processing}
                  >
                    <View style={styles.checkbox}>
                      {item.selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.itemInfoItems}>
                      <View style={styles.itemNameContainer}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.equipmentName}</Text>
                      </View>
                      {item.availableSerials.length > 0 && (
                        <View style={styles.serialDisplayContainer}>
                          <Text style={styles.serialDisplayValue} numberOfLines={1}>
                            {item.availableSerials.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Quantity controls inline */}
                  <View style={styles.quantityContainerInline}>
                    {item.selected ? (
                      <View style={styles.inlineQuantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButtonSmall}
                          onPress={() => updateStorageQuantity(item.itemKey, -1)}
                          disabled={processing}
                        >
                          <Text style={styles.quantityButtonText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>{item.storageQuantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButtonSmall}
                          onPress={() => updateStorageQuantity(item.itemKey, 1)}
                          disabled={processing}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.itemQuantity}>כמות: {item.quantity}</Text>
                    )}
                  </View>
                </View>

              </View>
            ))}
          </View>
        )}

        {/* ── Signature section ────────────────────────────────────────────── */}
        {items.some(i => i.selected) && (
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>חתימה</Text>
            {signature ? (
              <View style={styles.signaturePreview}>
                <Text style={styles.signatureStatus}>✓ החתימה נשמרה</Text>
                <TouchableOpacity style={styles.changeSignatureButton} onPress={() => setShowSignature(true)} disabled={processing}>
                  <Text style={styles.changeSignatureText}>שנה חתימה</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.signButton} onPress={() => setShowSignature(true)} disabled={processing}>
                <Text style={styles.signButtonText}>✍️ לחץ לחתימה</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Storage button ───────────────────────────────────────────────── */}
        {items.some(i => i.selected && i.storageQuantity > 0) && (
          <TouchableOpacity
            style={[styles.storageButton, processing && styles.buttonDisabled]}
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

      {/* Document viewer — shown after successful storage */}
      {viewerPdfData && (
        <StorageDocumentViewerModal
          visible={viewerVisible}
          html={viewerHTML}
          pdfData={viewerPdfData}
          onClose={() => {
            setViewerVisible(false);
            navigation.goBack();
          }}
        />
      )}

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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#FF6F00',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    ...Shadows.medium,
  },
  backButton: { position: 'absolute', left: 20, bottom: 20, padding: 5 },
  backButtonText: { fontSize: 28, color: Colors.textWhite },
  headerContent: { alignItems: 'flex-end' },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.textWhite, marginBottom: 5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  content: { flex: 1, padding: 20 },
  scrollContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Soldier card
  soldierCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 20,
    marginBottom: 15, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.small,
  },
  soldierInfo: { alignItems: 'flex-end' },
  soldierName: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 5 },
  soldierMeta: { color: Colors.textSecondary },

  // Section card (date + depositor)
  sectionCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 16,
    marginBottom: 15, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.small,
  },
  sectionLabel: {
    fontSize: 14, fontWeight: '700', color: '#1E293B',
    textAlign: 'right', marginBottom: 4,
  },
  optional: { fontSize: 12, fontWeight: '400', color: '#94A3B8' },
  sectionHint: { fontSize: 12, color: '#64748B', textAlign: 'right', marginBottom: 10 },

  // Date spinner
  dateSummary: {
    fontSize: 18, fontWeight: '700', color: '#FF6F00',
    textAlign: 'center', marginBottom: 10, letterSpacing: 1,
  },
  spinnersRow: { flexDirection: 'row', alignItems: 'center' },
  spinnerDivider: { width: 1, height: 55, backgroundColor: '#E2E8F0', marginHorizontal: 4 },

  // Depositor
  selectedDepositor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  depositorName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  depositorDetail: { fontSize: 13, color: '#64748B', marginTop: 2 },
  searchInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: '#1E293B', marginBottom: 4,
  },
  searchResult: {
    paddingVertical: 9, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', alignItems: 'flex-end',
  },
  resultName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  resultDetail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  noResults: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },

  // Items
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: Colors.text,
    marginBottom: 15, textAlign: 'right',
  },
  itemsList: { gap: 12, marginBottom: 20 },
  itemCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: Colors.borderLight, ...Shadows.small,
  },
  itemCardSelected: { borderColor: '#FF6F00', backgroundColor: '#FFF3E0' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, // Added for inline layout
  itemHeaderTouch: { flexDirection: 'row', alignItems: 'center', flex: 1 }, // Adjusted for touchable area
  checkbox: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 2,
    borderColor: Colors.borderDark, marginLeft: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  checkmark: { fontSize: 18, color: '#FF6F00', fontWeight: 'bold' },
  itemInfoItems: { flex: 1, alignItems: 'flex-end' }, // Renamed from itemInfo to avoid conflict
  itemNameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: Colors.text, flexShrink: 1 },
  serialDisplayContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.armeLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    marginBottom: 6, alignSelf: 'flex-end',
  },
  serialDisplayLabel: { fontSize: 13, fontWeight: '600', color: Colors.arme, marginLeft: 6 },
  serialDisplayValue: {
    fontSize: 14, fontWeight: '700', color: Colors.armeDark,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  itemQuantity: { fontSize: 13, color: Colors.textSecondary },
  quantityContainerInline: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 }, // New style for inline quantity
  inlineQuantityControls: { flexDirection: 'row', alignItems: 'center', gap: 8 }, // New style for inline quantity controls
  quantityButtonSmall: {
    backgroundColor: '#FF6F00', width: 32, height: 32,
    borderRadius: 6, justifyContent: 'center', alignItems: 'center',
  },
  quantityButtonText: { fontSize: 18, fontWeight: 'bold', color: Colors.textWhite },
  quantityValue: { fontSize: 16, fontWeight: 'bold', color: Colors.text, minWidth: 25, textAlign: 'center' },
  serialsSection: { marginTop: 12 },
  serialsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  serialChip: {
    backgroundColor: Colors.backgroundSecondary, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 2, borderColor: Colors.borderDark,
  },
  serialChipSelected: { backgroundColor: '#FF6F00', borderColor: '#FF6F00' },
  serialChipText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  serialChipTextSelected: { color: Colors.textWhite },

  // Signature
  signatureSection: { marginTop: 20, marginBottom: 20 },
  signaturePreview: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#FF6F00',
  },
  signatureStatus: { fontSize: 16, color: '#FF6F00', fontWeight: 'bold', marginBottom: 12 },
  changeSignatureButton: { backgroundColor: Colors.backgroundSecondary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  changeSignatureText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  signButton: { backgroundColor: '#FF6F00', borderRadius: 12, padding: 18, alignItems: 'center', ...Shadows.medium },
  signButtonText: { fontSize: 16, fontWeight: 'bold', color: Colors.textWhite },
  signatureContainer: { flex: 1, padding: 20 },
  signatureButtons: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    flexDirection: 'row', gap: 12, zIndex: 10,
  },
  endSignatureButton: {
    flex: 1, backgroundColor: Colors.success, borderRadius: 12,
    padding: 16, alignItems: 'center', ...Shadows.medium,
  },
  endSignatureText: { fontSize: 16, fontWeight: 'bold', color: Colors.textWhite },
  clearSignatureButton: {
    flex: 1, backgroundColor: Colors.danger, borderRadius: 12,
    padding: 16, alignItems: 'center', ...Shadows.medium,
  },
  clearSignatureText: { fontSize: 16, fontWeight: 'bold', color: Colors.textWhite },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.small,
  },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Action button
  storageButton: {
    backgroundColor: '#FF6F00', borderRadius: 12, padding: 18,
    alignItems: 'center', marginBottom: 30, ...Shadows.medium,
  },
  buttonDisabled: { opacity: 0.5 },
  storageButtonText: { fontSize: 18, fontWeight: 'bold', color: Colors.textWhite },
});

export default CombatStorageScreen;
