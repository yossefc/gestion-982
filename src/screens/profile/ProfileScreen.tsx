/**
 * ProfileScreen.tsx - Profil du מנפק (opérateur)
 * Permet de sauvegarder sa signature et son grade une fois pour toutes
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { AppModal } from '../../components';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const signatureRef = useRef<any>(null);

  const [rank, setRank] = useState(user?.rank || '');
  const [newSignatureData, setNewSignatureData] = useState<string | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // AppModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<any>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  const handleSignatureEnd = () => {
    signatureRef.current?.readSignature();
    setScrollEnabled(true);
  };

  const handleSignatureChange = (sig: string) => {
    setNewSignatureData(sig);
    setScrollEnabled(true);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clearSignature();
    setNewSignatureData(null);
    setScrollEnabled(true);
  };

  const handleConfirmSignature = () => {
    signatureRef.current?.readSignature();
    setScrollEnabled(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const signatureToSave = newSignatureData || user.signature || null;

    if (!signatureToSave) {
      setModalType('warning');
      setModalTitle('שים לב');
      setModalMessage('יש לצייר חתימה לפני השמירה');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    try {
      setSaving(true);
      await userService.updateSignature(user.id, signatureToSave);
      await userService.updateRank(user.id, rank.trim());
      await refreshUser();
      setModalType('success');
      setModalTitle('הצלחה');
      setModalMessage('הפרופיל עודכן בהצלחה');
      setModalButtons([{
        text: 'אישור',
        style: 'primary',
        onPress: () => {
          setModalVisible(false);
          navigation.goBack();
        },
      }]);
      setModalVisible(true);
    } catch (error) {
      setModalType('error');
      setModalMessage('שגיאה בשמירת הפרופיל');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const currentSignature = newSignatureData || user?.signature || null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>פרופיל מנפק</Text>
          <Text style={styles.headerSubtitle}>חתימה ודרגה</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
      >
        {/* User info */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={36} color={Colors.arme} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || user?.email}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Rank field */}
        <Text style={styles.sectionTitle}>דרגה</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.rankInput}
            value={rank}
            onChangeText={setRank}
            placeholder="הזן דרגה (לדוגמה: סמל, רב-סמל, סגן...)"
            placeholderTextColor={Colors.textLight}
            textAlign="right"
          />
        </View>

        {/* Signature section */}
        <Text style={styles.sectionTitle}>חתימת מנפק</Text>
        <Text style={styles.sectionSubtitle}>
          החתימה תשמש בכל טפסי ההחתמה שתפיק
        </Text>

        {/* Current signature preview */}
        {currentSignature && !showCanvas && (
          <View style={styles.signaturePreviewCard}>
            <Text style={styles.previewLabel}>חתימה שמורה:</Text>
            <Image
              source={{ uri: currentSignature }}
              style={styles.signaturePreview}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.changeSignatureButton}
              onPress={() => {
                setShowCanvas(true);
                setNewSignatureData(null);
              }}
            >
              <Ionicons name="create-outline" size={18} color={Colors.arme} />
              <Text style={styles.changeSignatureText}>שנה חתימה</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No signature yet */}
        {!currentSignature && !showCanvas && (
          <TouchableOpacity
            style={styles.addSignatureButton}
            onPress={() => setShowCanvas(true)}
          >
            <Ionicons name="create-outline" size={24} color={Colors.arme} />
            <Text style={styles.addSignatureText}>לחץ להוספת חתימה</Text>
          </TouchableOpacity>
        )}

        {/* Signature canvas */}
        {showCanvas && (
          <View style={styles.signatureContainer}>
            <View style={styles.signatureWrapper}>
              <SignatureCanvas
                ref={signatureRef}
                onEnd={handleSignatureEnd}
                onOK={handleSignatureChange}
                onBegin={() => setScrollEnabled(false)}
                onEmpty={() => setNewSignatureData(null)}
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
            <View style={styles.signatureActions}>
              <TouchableOpacity style={styles.clearButton} onPress={handleClearSignature}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                <Text style={styles.clearButtonText}>נקה</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSignature}>
                <Ionicons name="checkmark-outline" size={20} color={Colors.textWhite} />
                <Text style={styles.confirmButtonText}>קלוט חתימה</Text>
              </TouchableOpacity>
            </View>
            {newSignatureData && (
              <TouchableOpacity
                style={styles.cancelCanvasButton}
                onPress={() => {
                  setShowCanvas(false);
                }}
              >
                <Text style={styles.cancelCanvasText}>ביטול</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <>
              <Ionicons name="save-outline" size={22} color={Colors.textWhite} />
              <Text style={styles.saveButtonText}>שמור פרופיל</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

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

  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  // User card
  userCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.small,
  },

  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.armeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  userName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },

  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Section titles
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },

  // Rank input
  inputContainer: {
    marginBottom: Spacing.xl,
  },

  rankInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.xs,
  },

  // Signature preview
  signaturePreviewCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    ...Shadows.small,
  },

  previewLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },

  signaturePreview: {
    width: '100%',
    height: 100,
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.sm,
  },

  changeSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.arme,
  },

  changeSignatureText: {
    fontSize: FontSize.sm,
    color: Colors.arme,
    fontWeight: '600',
  },

  addSignatureButton: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.arme,
    borderStyle: 'dashed',
    gap: Spacing.sm,
  },

  addSignatureText: {
    fontSize: FontSize.base,
    color: Colors.arme,
    fontWeight: '600',
  },

  // Canvas
  signatureContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },

  signatureWrapper: {
    height: 220,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  signatureCanvas: {
    flex: 1,
  },

  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },

  clearButtonText: {
    fontSize: FontSize.md,
    color: Colors.danger,
  },

  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.info,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  confirmButtonText: {
    fontSize: FontSize.md,
    color: Colors.textWhite,
    fontWeight: '600',
  },

  cancelCanvasButton: {
    padding: Spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  cancelCanvasText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Save button
  saveButton: {
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    ...Shadows.small,
  },

  saveButtonDisabled: {
    backgroundColor: Colors.disabled,
  },

  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textWhite,
  },
});

export default ProfileScreen;
