/**
 * ClothingReturnScreen.tsx - Retour de vêtements
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { assignmentService } from '../../services/assignmentService';
import { useAuth } from '../../contexts/AuthContext';

interface HoldingItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  serials?: string[];
}

interface SelectedReturn {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  selectedSerials?: string[];
}

const ClothingReturnScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { soldier } = route.params as { soldier: any };
  const { user } = useAuth();
  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [selectedReturns, setSelectedReturns] = useState<Map<string, SelectedReturn>>(new Map());
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      setLoading(true);
      const items = await assignmentService.calculateCurrentHoldings(soldier.id, 'clothing');
      console.log('Holdings loaded for soldier:', soldier.id, items);
      setHoldings(items || []);
    } catch (error) {
      console.error('Error loading holdings:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הציוד');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (item: HoldingItem) => {
    setSelectedReturns(prev => {
      const newMap = new Map(prev);
      if (newMap.has(item.equipmentId)) {
        newMap.delete(item.equipmentId);
      } else {
        // Prendre automatiquement TOUTE la quantité disponible
        newMap.set(item.equipmentId, {
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: item.quantity, // Toute la quantité au lieu de 1
          selectedSerials: item.serials, // Tous les serials au lieu d'un seul
        });
      }
      return newMap;
    });
  };

  const updateReturnQuantity = (id: string, delta: number, maxQty: number) => {
    setSelectedReturns(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(id);
      if (item) {
        const newQty = Math.max(1, Math.min(maxQty, item.quantity + delta));
        newMap.set(id, { ...item, quantity: newQty });
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

  const validateAndContinue = () => {
    if (selectedReturns.size === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות פריט אחד להחזרה');
      return;
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

      const items = Array.from(selectedReturns.values()).map(item => ({
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        quantity: item.quantity,
        serial: item.selectedSerials?.join(',') || '',
      }));

      // Create credit assignment with correct field names
      await assignmentService.create({
        soldierId: soldier.id,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        soldierPhone: soldier.phone,
        soldierCompany: soldier.company,
        type: 'clothing',
        action: 'credit',
        items,
        status: 'זוכה',
        assignedBy: user?.uid || '',
        assignedByName: user?.displayName || user?.email || '',
        assignedByEmail: user?.email || '',
      }, signatureData);

      Alert.alert('הצלחה', 'הזיכוי בוצע בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את הזיכוי');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.vetement} />
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
          <Text style={styles.headerTitle}>זיכוי ביגוד</Text>
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
            <Ionicons name="person" size={32} color={Colors.vetement} />
          </View>
          <View style={styles.soldierInfo}>
            <Text style={styles.soldierName}>{soldier.name}</Text>
            <Text style={styles.soldierNumber}>מ.א: {soldier.personalNumber}</Text>
          </View>
          <View style={styles.holdingsBadge}>
            <Text style={styles.holdingsCount}>{holdings.length}</Text>
            <Text style={styles.holdingsLabel}>פריטים</Text>
          </View>
        </View>

        {!showSignature ? (
          <>
            {/* Holdings List */}
            <Text style={styles.sectionTitle}>ציוד להחזרה</Text>

            {holdings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
                <Text style={styles.emptyTitle}>אין ציוד להחזרה</Text>
                <Text style={styles.emptySubtitle}>החייל החזיר את כל הציוד</Text>
              </View>
            ) : (
              <View style={styles.holdingsList}>
                {holdings.map((item) => {
                  const isSelected = selectedReturns.has(item.equipmentId);
                  const returnItem = selectedReturns.get(item.equipmentId);

                  return (
                    <View key={item.equipmentId} style={styles.holdingCard}>
                      <TouchableOpacity
                        style={styles.holdingRow}
                        onPress={() => toggleItem(item)}
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
                        <View style={styles.holdingInfo}>
                          <Text style={styles.holdingName}>{item.equipmentName}</Text>
                          <Text style={styles.holdingQuantity}>כמות ברשות: {item.quantity}</Text>
                        </View>
                      </TouchableOpacity>

                      {isSelected && (
                        <View style={styles.returnDetails}>
                          <Text style={styles.returnLabel}>כמות להחזרה:</Text>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => updateReturnQuantity(item.equipmentId, -1, item.quantity)}
                            >
                              <Ionicons name="remove" size={20} color={Colors.danger} />
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{returnItem?.quantity}</Text>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => updateReturnQuantity(item.equipmentId, 1, item.quantity)}
                            >
                              <Ionicons name="add" size={20} color={Colors.success} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Summary */}
            {selectedReturns.size > 0 && (
              <View style={styles.summaryCard}>
                <Ionicons name="return-up-back" size={24} color={Colors.warningDark} />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryTitle}>סיכום החזרה</Text>
                  <Text style={styles.summaryText}>
                    {Array.from(selectedReturns.values()).reduce((sum, item) => sum + item.quantity, 0)} פריטים להחזרה
                  </Text>
                </View>
              </View>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                selectedReturns.size === 0 && styles.buttonDisabled,
              ]}
              onPress={validateAndContinue}
              disabled={selectedReturns.size === 0}
            >
              <Text style={styles.continueButtonText}>המשך לחתימה</Text>
              <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
            </TouchableOpacity>
          </>
        ) : (
          <>
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

              <TouchableOpacity
                style={styles.clearSignatureButton}
                onPress={handleClearSignature}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                <Text style={styles.clearSignatureText}>נקה חתימה</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.backButton2}
                onPress={() => setShowSignature(false)}
              >
                <Text style={styles.backButton2Text}>חזור לבחירת פריטים</Text>
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
                    <Text style={styles.submitButtonText}>שמור זיכוי</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
    backgroundColor: Colors.vetement,
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
    backgroundColor: Colors.vetementLight,
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

  holdingsBadge: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },

  holdingsCount: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.warningDark,
  },

  holdingsLabel: {
    fontSize: FontSize.xs,
    color: Colors.warningDark,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },

  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.success,
    marginTop: Spacing.lg,
  },

  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Holdings List
  holdingsList: {
    gap: Spacing.md,
  },

  holdingCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },

  holdingRow: {
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
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },

  holdingInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  holdingName: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: Colors.text,
  },

  holdingQuantity: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  returnDetails: {
    backgroundColor: Colors.backgroundInput,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  returnLabel: {
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

  // Summary
  summaryCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },

  summaryContent: {
    flex: 1,
    marginRight: Spacing.md,
    alignItems: 'flex-end',
  },

  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.warningDark,
  },

  summaryText: {
    fontSize: FontSize.base,
    color: Colors.warningDark,
    marginTop: Spacing.xs,
  },

  // Buttons
  continueButton: {
    backgroundColor: Colors.warning,
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

export default ClothingReturnScreen;