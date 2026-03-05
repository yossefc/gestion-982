/**
 * TicketFormScreen.tsx
 * Formulaire de signalement pour le רס"פ
 * Crée un ticket dans Firestore et upload la photo dans Firebase Storage
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
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { ticketService } from '../../services/ticketService';
import { Mozav, IssueType } from '../../types';
import { AppModal } from '../../components';

// ─── Composant Dropdown réutilisable ────────────────────────────────────────

interface DropdownItem { id: string; name: string; }
interface DropdownProps {
  label: string;
  placeholder: string;
  items: DropdownItem[];
  selected: DropdownItem | null;
  onSelect: (item: DropdownItem) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ label, placeholder, items, selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={ddStyles.container}>
      <Text style={ddStyles.label}>{label}</Text>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[ddStyles.triggerText, !selected && ddStyles.placeholder]}>
          {selected ? selected.name : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={ddStyles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={ddStyles.sheet}>
            <View style={ddStyles.sheetHeader}>
              <Text style={ddStyles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {items.length === 0 ? (
              <View style={ddStyles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={36} color={Colors.textLight} />
                <Text style={ddStyles.emptyText}>אין פריטים זמינים</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[ddStyles.item, selected?.id === item.id && ddStyles.itemSelected]}
                    onPress={() => { onSelect(item); setOpen(false); }}
                  >
                    <Text style={[ddStyles.itemText, selected?.id === item.id && ddStyles.itemTextSelected]}>
                      {item.name}
                    </Text>
                    {selected?.id === item.id && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const ddStyles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, textAlign: 'right' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.backgroundInput, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  triggerText: { fontSize: FontSize.base, color: Colors.text, flex: 1, textAlign: 'right', marginLeft: Spacing.sm },
  placeholder: { color: Colors.placeholder },
  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.backgroundCard, borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl, maxHeight: '60%', paddingBottom: Spacing.xxl,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  itemSelected: { backgroundColor: Colors.accentLight },
  itemText: { fontSize: FontSize.base, color: Colors.text, textAlign: 'right', flex: 1 },
  itemTextSelected: { color: Colors.primary, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: Spacing.xxxl },
  emptyText: { color: Colors.textLight, fontSize: FontSize.md, marginTop: Spacing.sm },
});

// ─── Écran Principal ─────────────────────────────────────────────────────────

const TicketFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  // Données Firestore
  const [mozavim, setMozavim] = useState<Mozav[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Champs du formulaire
  const [selectedMozav, setSelectedMozav] = useState<Mozav | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<IssueType | null>(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // État de soumission
  const [submitting, setSubmitting] = useState(false);

  // Modal feedback
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalMsg, setModalMsg] = useState('');

  // ─── Chargement des données ───────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [m, it] = await Promise.all([
          ticketService.getMozavim(),
          ticketService.getIssueTypes(),
        ]);
        setMozavim(m);
        setIssueTypes(it);
      } catch (e) {
        console.error('[TicketForm] load error:', e);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  // ─── Sélection photo ─────────────────────────────────────────────────────

  const handlePickPhoto = useCallback(() => {
    Alert.alert('צירוף תמונה', 'בחר מקור לתמונה', [
      {
        text: 'מצלמה',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('אין הרשאה', 'יש לאפשר גישה למצלמה בהגדרות.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            setPhotoUri(result.assets[0].uri);
          }
        },
      },
      {
        text: 'גלריה',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('אין הרשאה', 'יש לאפשר גישה לגלריה בהגדרות.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            setPhotoUri(result.assets[0].uri);
          }
        },
      },
      { text: 'ביטול', style: 'cancel' },
    ]);
  }, []);

  // ─── Soumission ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedMozav) {
      Alert.alert('שגיאה', 'יש לבחור מוצב');
      return;
    }
    if (!selectedIssueType) {
      Alert.alert('שגיאה', 'יש לבחור סוג פער/תקלה');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      await ticketService.createTicket(
        {
          reporterName: user.name || user.email,
          reporterUserId: user.id,
          pluga: user.company || '',
          mozavId: selectedMozav.id,
          mozavName: selectedMozav.name,
          issueTypeId: selectedIssueType.id,
          issueTypeName: selectedIssueType.name,
          assignedUserId: selectedIssueType.assignedUserId,
          description: description.trim(),
        },
        photoUri
      );
      setModalType('success');
      setModalMsg('הדיווח נשלח בהצלחה!');
      setModalVisible(true);
    } catch (e) {
      console.error('[TicketForm] submit error:', e);
      setModalType('error');
      setModalMsg('אירעה שגיאה בשליחת הדיווח. אנא נסה שנית.');
      setModalVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setModalVisible(false);
    if (modalType === 'success') navigation.goBack();
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>טוען נתונים...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>דיווח תקלה / בקשה</Text>
          <Text style={styles.headerSubtitle}>מלא את הפרטים ושלח</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Champs auto-remplis */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>פרטי המדווח</Text>

          <View style={styles.readonlyField}>
            <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.readonlyContent}>
              <Text style={styles.readonlyLabel}>שם הרושם</Text>
              <Text style={styles.readonlyValue}>{user?.name || user?.email || '—'}</Text>
            </View>
          </View>

          <View style={styles.readonlyField}>
            <Ionicons name="shield-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.readonlyContent}>
              <Text style={styles.readonlyLabel}>פלוגה</Text>
              <Text style={styles.readonlyValue}>{user?.company || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Dropdowns */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>פרטי התקלה</Text>

          <Dropdown
            label="מוצב"
            placeholder="בחר מוצב..."
            items={mozavim}
            selected={selectedMozav}
            onSelect={item => setSelectedMozav(mozavim.find(m => m.id === item.id) ?? null)}
          />

          <Dropdown
            label="סוג הפער / תקלה"
            placeholder="בחר סוג תקלה..."
            items={issueTypes}
            selected={selectedIssueType}
            onSelect={item => setSelectedIssueType(issueTypes.find(it => it.id === item.id) ?? null)}
          />

          {/* Description optionnelle */}
          <Text style={ddStyles.label}>תיאור נוסף (אופציונלי)</Text>
          <TextInput
            style={styles.textarea}
            placeholder="פרט את הבעיה במידת הצורך..."
            placeholderTextColor={Colors.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlign="right"
            textAlignVertical="top"
          />
        </View>

        {/* Photo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>צילום (אופציונלי)</Text>

          {photoUri ? (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setPhotoUri(null)}>
                <Ionicons name="close-circle" size={28} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={28} color={Colors.primary} />
              <Text style={styles.photoBtnText}>הוסף תמונה</Text>
              <Text style={styles.photoBtnSub}>מצלמה או גלריה</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={Colors.textWhite} />
              <Text style={styles.submitBtnText}>שלח דיווח</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <AppModal
        visible={modalVisible}
        type={modalType}
        message={modalMsg}
        buttons={[{ text: 'אישור', style: 'primary', onPress: handleSuccessClose }]}
        onClose={handleSuccessClose}
      />
    </KeyboardAvoidingView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  loadingContainer: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textWhite },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },

  // Cards
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  cardTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text,
    marginBottom: Spacing.lg, textAlign: 'right',
    borderBottomWidth: 2, borderBottomColor: Colors.primary + '30',
    paddingBottom: Spacing.sm,
  },

  // Champs auto
  readonlyField: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  readonlyContent: { flex: 1, alignItems: 'flex-end' },
  readonlyLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  readonlyValue: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text, marginTop: 2 },

  // Textarea
  textarea: {
    backgroundColor: Colors.backgroundInput, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.base, color: Colors.text, minHeight: 100,
  },

  // Photo
  photoBtn: {
    borderWidth: 2, borderColor: Colors.primary + '50', borderStyle: 'dashed',
    borderRadius: BorderRadius.lg, padding: Spacing.xxl,
    alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.accentLight + '40',
  },
  photoBtnText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary },
  photoBtnSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  photoPreviewContainer: { position: 'relative' },
  photoPreview: { width: '100%', height: 200, borderRadius: BorderRadius.md },
  photoRemoveBtn: {
    position: 'absolute', top: -10, right: -10,
    backgroundColor: Colors.backgroundCard, borderRadius: 20,
  },

  // Submit
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    ...Shadows.medium,
  },
  submitBtnDisabled: { backgroundColor: Colors.disabled },
  submitBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textWhite },
});

export default TicketFormScreen;
