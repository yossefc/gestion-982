/**
 * TicketAdminScreen.tsx
 * Écran de configuration pour le מנהל :
 *  - Gérer les מוצבים (lieux)
 *  - Gérer les types de problèmes et assigner un responsable (האחראי) à chacun
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../theme/Colors';
import { ticketService } from '../../services/ticketService';
import { getAllUsers } from '../../services/userService';
import { Mozav, IssueType, User } from '../../types';
import { AppModal } from '../../components';

// ─── Constantes ──────────────────────────────────────────────────────────────

const TICKET_COLOR = Colors.warning; // Orange pour le module tickets

// ─── Composant Section ───────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: string;
  title: string;
  count: number;
  onAdd: () => void;
}
const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, count, onAdd }) => (
  <View style={sec.header}>
    <TouchableOpacity style={sec.addBtn} onPress={onAdd}>
      <Ionicons name="add" size={20} color={Colors.textWhite} />
    </TouchableOpacity>
    <View style={sec.titleRow}>
      <Ionicons name={icon as any} size={20} color={TICKET_COLOR} />
      <Text style={sec.title}>{title}</Text>
      <View style={sec.badge}><Text style={sec.badgeText}>{count}</Text></View>
    </View>
  </View>
);
const sec = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, justifyContent: 'flex-end' },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  badge: {
    backgroundColor: TICKET_COLOR + '20', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  badgeText: { fontSize: FontSize.sm, fontWeight: '700', color: TICKET_COLOR },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: TICKET_COLOR, alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Écran Principal ─────────────────────────────────────────────────────────

const TicketAdminScreen: React.FC = () => {
  const navigation = useNavigation();

  const [mozavim, setMozavim]       = useState<Mozav[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);

  // Modal "Ajouter מוצב"
  const [showAddMozav, setShowAddMozav]   = useState(false);
  const [newMozavName, setNewMozavName]   = useState('');
  const [newMozavPluga, setNewMozavPluga] = useState('');
  const [savingMozav, setSavingMozav]     = useState(false);

  // Modal "Ajouter Type"
  const [showAddType, setShowAddType]           = useState(false);
  const [newTypeName, setNewTypeName]           = useState('');
  const [selectedUser, setSelectedUser]         = useState<User | null>(null);
  const [showUserPicker, setShowUserPicker]     = useState(false);
  const [savingType, setSavingType]             = useState(false);

  // Feedback modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType]       = useState<'success' | 'error'>('success');
  const [modalMsg, setModalMsg]         = useState('');

  // ─── Chargement ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, it, u] = await Promise.all([
        ticketService.getMozavim(),
        ticketService.getIssueTypes(),
        getAllUsers(),
      ]);
      setMozavim(m);
      setIssueTypes(it);
      setUsers(u);
    } catch (e) {
      console.error('[TicketAdmin] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Actions Mozav ───────────────────────────────────────────────────────

  const handleAddMozav = async () => {
    if (!newMozavName.trim()) { Alert.alert('שגיאה', 'הכנס שם למוצב'); return; }
    if (!newMozavPluga.trim()) { Alert.alert('שגיאה', 'הכנס פלוגה למוצב'); return; }
    setSavingMozav(true);
    try {
      await ticketService.addMozav(newMozavName.trim(), newMozavPluga.trim());
      setNewMozavName('');
      setNewMozavPluga('');
      setShowAddMozav(false);
      await load();
      setModalType('success'); setModalMsg('המוצב נוסף בהצלחה'); setModalVisible(true);
    } catch {
      setModalType('error'); setModalMsg('שגיאה בהוספת המוצב'); setModalVisible(true);
    } finally { setSavingMozav(false); }
  };

  const handleDeleteMozav = (mozav: Mozav) => {
    Alert.alert('מחיקת מוצב', `האם למחוק את "${mozav.name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          try {
            await ticketService.deleteMozav(mozav.id);
            setMozavim(prev => prev.filter(m => m.id !== mozav.id));
          } catch {
            setModalType('error'); setModalMsg('שגיאה במחיקה'); setModalVisible(true);
          }
        },
      },
    ]);
  };

  // ─── Actions IssueType ───────────────────────────────────────────────────

  const handleAddIssueType = async () => {
    if (!newTypeName.trim()) { Alert.alert('שגיאה', 'הכנס שם לסוג התקלה'); return; }
    if (!selectedUser) { Alert.alert('שגיאה', 'יש לבחור אחראי'); return; }
    setSavingType(true);
    try {
      await ticketService.addIssueType(
        newTypeName.trim(),
        selectedUser.id,
        selectedUser.name || selectedUser.email
      );
      setNewTypeName(''); setSelectedUser(null);
      setShowAddType(false);
      await load();
      setModalType('success'); setModalMsg('סוג התקלה נוסף בהצלחה'); setModalVisible(true);
    } catch {
      setModalType('error'); setModalMsg('שגיאה בהוספת סוג התקלה'); setModalVisible(true);
    } finally { setSavingType(false); }
  };

  const handleDeleteIssueType = (it: IssueType) => {
    Alert.alert('מחיקת סוג תקלה', `האם למחוק את "${it.name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          try {
            await ticketService.deleteIssueType(it.id);
            setIssueTypes(prev => prev.filter(i => i.id !== it.id));
          } catch {
            setModalType('error'); setModalMsg('שגיאה במחיקה'); setModalVisible(true);
          }
        },
      },
    ]);
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TICKET_COLOR} />
        <Text style={styles.loadingText}>טוען הגדרות...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>הגדרות מערכת דיווח</Text>
          <Text style={styles.headerSubtitle}>ניהול מוצבים וסוגי תקלות</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Section: Mozavim ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            icon="location-outline"
            title="מוצבים"
            count={mozavim.length}
            onAdd={() => setShowAddMozav(true)}
          />
          {mozavim.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="location-outline" size={32} color={Colors.textLight} />
              <Text style={styles.emptyText}>אין מוצבים. הוסף את הראשון.</Text>
            </View>
          ) : (
            mozavim.map(m => (
              <View key={m.id} style={styles.listItem}>
                <TouchableOpacity
                  style={styles.deleteItemBtn}
                  onPress={() => handleDeleteMozav(m)}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
                <View style={styles.listItemContent}>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.listItemText}>{m.name}</Text>
                    {m.pluga ? (
                      <View style={styles.assignedRow}>
                        <Text style={styles.assignedText}>{m.pluga}</Text>
                        <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="location" size={16} color={TICKET_COLOR} style={{ marginRight: Spacing.xs }} />
                </View>
              </View>
            ))
          )}
        </View>

        {/* ─── Section: Issue Types ──────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            icon="construct-outline"
            title="סוגי פער / תקלה"
            count={issueTypes.length}
            onAdd={() => setShowAddType(true)}
          />
          {issueTypes.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="construct-outline" size={32} color={Colors.textLight} />
              <Text style={styles.emptyText}>אין סוגי תקלות. הוסף את הראשון.</Text>
            </View>
          ) : (
            issueTypes.map(it => (
              <View key={it.id} style={styles.listItem}>
                <TouchableOpacity
                  style={styles.deleteItemBtn}
                  onPress={() => handleDeleteIssueType(it)}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
                <View style={styles.listItemContent}>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.listItemText}>{it.name}</Text>
                    <View style={styles.assignedRow}>
                      <Text style={styles.assignedText}>{it.assignedUserName || 'לא ידוע'}</Text>
                      <Ionicons name="person-circle-outline" size={14} color={Colors.textSecondary} />
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* ─── Modal: Ajouter מוצב ──────────────────────────────────────────── */}
      <Modal
        visible={showAddMozav}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMozav(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddMozav(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>הוספת מוצב</Text>
            </View>

            <Text style={styles.modalLabel}>שם המוצב</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="לדוגמה: מוצב צפון..."
              placeholderTextColor={Colors.placeholder}
              value={newMozavName}
              onChangeText={setNewMozavName}
              textAlign="right"
              autoFocus
            />

            <Text style={styles.modalLabel}>פלוגה</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="לדוגמה: פלוגה א..."
              placeholderTextColor={Colors.placeholder}
              value={newMozavPluga}
              onChangeText={setNewMozavPluga}
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.modalSaveBtn, savingMozav && styles.btnDisabled]}
              onPress={handleAddMozav}
              disabled={savingMozav}
            >
              {savingMozav ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <Text style={styles.modalSaveBtnText}>הוסף מוצב</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Ajouter Type Taqala ──────────────────────────────────── */}
      <Modal
        visible={showAddType}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddType(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddType(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>הוספת סוג תקלה</Text>
            </View>

            <Text style={styles.modalLabel}>שם סוג התקלה</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="לדוגמה: תקלת ציוד..."
              placeholderTextColor={Colors.placeholder}
              value={newTypeName}
              onChangeText={setNewTypeName}
              textAlign="right"
            />

            <Text style={styles.modalLabel}>האחראי לטיפול</Text>
            <TouchableOpacity
              style={styles.userPickerTrigger}
              onPress={() => setShowUserPicker(true)}
            >
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
              <Text style={[styles.userPickerText, !selectedUser && { color: Colors.placeholder }]}>
                {selectedUser ? (selectedUser.name || selectedUser.email) : 'בחר אחראי...'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalSaveBtn, savingType && styles.btnDisabled]}
              onPress={handleAddIssueType}
              disabled={savingType}
            >
              {savingType ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <Text style={styles.modalSaveBtnText}>הוסף סוג תקלה</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Picker utilisateurs (pour IssueType) ─────────────────────────── */}
      <Modal
        visible={showUserPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserPicker(false)}
      >
        <TouchableOpacity
          style={styles.userPickerBackdrop}
          activeOpacity={1}
          onPress={() => setShowUserPicker(false)}
        >
          <View style={styles.userPickerSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowUserPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>בחר אחראי</Text>
            </View>
            <FlatList
              data={users}
              keyExtractor={u => u.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.userItem,
                    selectedUser?.id === item.id && styles.userItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedUser(item);
                    setShowUserPicker(false);
                  }}
                >
                  <View style={styles.userItemInfo}>
                    <Text style={styles.userItemName}>{item.name || '—'}</Text>
                    <Text style={styles.userItemEmail}>{item.email}</Text>
                  </View>
                  {selectedUser?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <AppModal
        visible={modalVisible}
        type={modalType}
        message={modalMsg}
        buttons={[{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },

  header: {
    backgroundColor: TICKET_COLOR,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textWhite },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },

  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },

  emptySection: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { color: Colors.textLight, fontSize: FontSize.md, textAlign: 'center' },

  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  deleteItemBtn: { padding: Spacing.sm },
  listItemContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  listItemText: { fontSize: FontSize.base, color: Colors.text, fontWeight: '500', textAlign: 'right' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  assignedText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Modals communs
  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xxxl + Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  modalLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, textAlign: 'right', marginBottom: Spacing.sm },
  modalInput: {
    backgroundColor: Colors.backgroundInput, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.base, color: Colors.text, marginBottom: Spacing.lg,
  },
  modalSaveBtn: {
    backgroundColor: TICKET_COLOR, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  modalSaveBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textWhite },
  btnDisabled: { backgroundColor: Colors.disabled },

  // User picker
  userPickerTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.backgroundInput, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  userPickerText: { flex: 1, textAlign: 'right', fontSize: FontSize.base, color: Colors.text, marginRight: Spacing.sm },
  userPickerBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  userPickerSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%', paddingBottom: Spacing.xxl,
  },
  userItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  userItemSelected: { backgroundColor: Colors.accentLight },
  userItemInfo: { flex: 1, alignItems: 'flex-end' },
  userItemName: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  userItemEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});

export default TicketAdminScreen;
