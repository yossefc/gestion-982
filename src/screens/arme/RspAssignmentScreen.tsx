/**
 * RspAssignmentScreen.tsx
 * Écran d'attribution/restitution d'équipement RSP avec signature
 * AMÉLIORÉ: Ajout inline d'équipement, saisie quantité directe, correction signature
 * STOCK & HOLDINGS: Affichage du stock et des possessions actuelles
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
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { rspEquipmentService, rspAssignmentService } from '../../services/firebaseService';
import { RspEquipment, Soldier, RspAssignment } from '../../types';
import { openWhatsAppChat } from '../../services/whatsappService';

interface RouteParams {
    soldier: Soldier;
    action: 'issue' | 'credit';
}

interface SelectedItem {
    equipment: RspEquipment;
    quantity: number;
}

const RspAssignmentScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { soldier, action } = route.params as RouteParams;
    const signatureRef = useRef<any>(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [equipmentList, setEquipmentList] = useState<RspEquipment[]>([]);
    const [soldierHoldings, setSoldierHoldings] = useState<Map<string, number>>(new Map());
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const [step, setStep] = useState<'selection' | 'signature'>('selection');

    // Modal pour ajouter un nouvel équipement
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEquipmentName, setNewEquipmentName] = useState('');
    const [addingEquipment, setAddingEquipment] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [equipments, holdings] = await Promise.all([
                rspEquipmentService.getAll(),
                rspAssignmentService.getHoldingsBySoldierId(soldier.id)
            ]);

            setEquipmentList(equipments);

            // Mapper les possessions actuelles
            const holdingsMap = new Map<string, number>();
            holdings.forEach((h: RspAssignment) => {
                if (h.quantity > 0) {
                    holdingsMap.set(h.equipmentId, h.quantity);
                }
            });
            setSoldierHoldings(holdingsMap);

        } catch (error) {
            console.error(error);
            Alert.alert('שגיאה', 'לא ניתן לטעון את הנתונים');
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (eq: RspEquipment) => {
        setSelectedItems(prev => {
            const newMap = new Map(prev);
            if (newMap.has(eq.id)) {
                newMap.delete(eq.id);
            } else {
                // Par défaut 1, ou tout ce qu'il a si c'est un retour
                const defaultQty = action === 'credit' ? (soldierHoldings.get(eq.id) || 1) : 1;
                newMap.set(eq.id, { equipment: eq, quantity: defaultQty });
            }
            return newMap;
        });
    };

    const updateQuantityDirect = (id: string, value: string) => {
        const qty = parseInt(value) || 0;
        if (qty <= 0) return;

        setSelectedItems(prev => {
            const newMap = new Map(prev);
            const item = newMap.get(id);
            if (item) {
                newMap.set(id, { ...item, quantity: qty });
            }
            return newMap;
        });
    };

    // Signature automatique à la fin du tracé
    const handleSignatureEnd = () => {
        signatureRef.current?.readSignature();
        setScrollEnabled(true);
    };

    // Callback quand la signature est générée (automatiquement ou manuellement)
    const handleSignatureOK = (signature: string) => {
        if (signature && signature !== 'data:image/png;base64,') {
            setSignatureData(signature);
        }
    };

    const handleClearSignature = () => {
        signatureRef.current?.clearSignature();
        setSignatureData(null);
    };

    // Bouton manuel de secours
    const handleConfirmSignature = () => {
        signatureRef.current?.readSignature();
    };


    const proceedToSignature = () => {
        if (selectedItems.size === 0) {
            Alert.alert('שים לב', 'יש לבחור לפחות פריט ציוד אחד');
            return;
        }
        setStep('signature');
    };

    const handleAddEquipment = async () => {
        if (!newEquipmentName.trim()) {
            Alert.alert('שגיאה', 'יש להזין שם לציוד');
            return;
        }

        setAddingEquipment(true);
        try {
            await rspEquipmentService.create({
                name: newEquipmentName.trim(),
                category: 'ציוד רס"פ',
            });
            setNewEquipmentName('');
            setShowAddModal(false);
            // Recharger la liste
            await loadData();
        } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן להוסיף את הציוד');
        } finally {
            setAddingEquipment(false);
        }
    };

    const handleSubmit = async () => {
        if (!signatureData) {
            Alert.alert('שים לב', 'יש לחתום לפני האישור');
            return;
        }

        setSubmitting(true);
        try {
            const items = Array.from(selectedItems.values());

            const promises = items.map(item => {
                const change = action === 'issue' ? item.quantity : -item.quantity;

                return rspAssignmentService.updateQuantity({
                    soldierId: soldier.id,
                    soldierName: soldier.name,
                    company: soldier.company,
                    equipmentId: item.equipment.id,
                    equipmentName: item.equipment.name,
                    quantityChange: change,
                    action: action === 'issue' ? 'add' : 'remove',
                    notes: `חתימה דיגיטלית - ${action === 'issue' ? 'הנפקה' : 'זיכוי'}`,
                });
            });

            await Promise.all(promises);

            // Generate WhatsApp message
            const actionText = action === 'issue' ? 'הוחתם' : 'זוכה';
            let whatsappMessage = `שלום ${soldier.name},\n\n${actionText} ציוד בהצלחה.\n\n`;
            whatsappMessage += `ציוד ${actionText}:\n`;
            for (const item of Array.from(selectedItems.values())) {
                whatsappMessage += `• ${item.equipment.name} - כמות: ${item.quantity}\n`;
            }
            whatsappMessage += `\nתודה,\nגדוד 982`;

            // Show success with WhatsApp option
            if (soldier.phone) {
                Alert.alert(
                    'הצלחה',
                    `הפעולה נרשמה בהצלחה עבור ${soldier.name}`,
                    [
                        { text: 'סגור', onPress: () => navigation.goBack(), style: 'cancel' },
                        {
                            text: 'שלח WhatsApp',
                            onPress: async () => {
                                try {
                                    await openWhatsAppChat(soldier.phone!, whatsappMessage);
                                } catch (e) {
                                    console.error('WhatsApp error:', e);
                                }
                                navigation.goBack();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert(
                    'הצלחה',
                    `הפעולה נרשמה בהצלחה עבור ${soldier.name}`,
                    [{ text: 'אישור', onPress: () => navigation.goBack() }]
                );
            }
        } catch (error) {
            console.error(error);
            Alert.alert('שגיאה', 'אירעה שגיאה בעת השמירה');
        } finally {
            setSubmitting(false);
        }
    };

    const isIssue = action === 'issue';
    const getActionColor = () => isIssue ? Colors.success : Colors.warning;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: getActionColor() }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{isIssue ? 'החתמת רס"פ' : 'זיכוי רס"פ'}</Text>
                    <Text style={styles.headerSubtitle}>{soldier.name} - {soldier.company}</Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                scrollEnabled={scrollEnabled}
            >
                {step === 'selection' ? (
                    <>
                        {isIssue && (
                            <TouchableOpacity
                                style={styles.addEquipmentButton}
                                onPress={() => setShowAddModal(true)}
                            >
                                <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                                <Text style={styles.addEquipmentText}>הוסף ציוד חדש</Text>
                            </TouchableOpacity>
                        )}

                        <Text style={styles.sectionTitle}>בחר ציוד {isIssue ? 'להנפקה' : 'לזיכוי'}</Text>

                        <View style={styles.grid}>
                            {equipmentList.map(eq => {
                                const isSelected = selectedItems.has(eq.id);
                                const item = selectedItems.get(eq.id);
                                const holdingQty = soldierHoldings.get(eq.id) || 0;
                                const stockQty = eq.quantity || 0; // Quantité en YAMAH (si disponible dans l'objet eq)

                                // En mode crédit, on montre seulement ce que le soldat a (ou tout si admin veut forcer)
                                // Pour l'instant on montre tout mais on met en évidence ce qu'il a

                                return (
                                    <View key={eq.id} style={[
                                        styles.card,
                                        isSelected && styles.cardSelected,
                                        !isIssue && holdingQty > 0 && styles.cardHighlight // Highlight owned items in return mode
                                    ]}>
                                        <TouchableOpacity
                                            style={styles.cardHeader}
                                            onPress={() => toggleItem(eq)}
                                        >
                                            <View style={styles.checkbox}>
                                                {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                                            </View>
                                            <Text style={styles.cardTitle}>{eq.name}</Text>
                                        </TouchableOpacity>

                                        {/* Stock Info */}
                                        <View style={styles.stockInfoContainer}>
                                            <Text style={styles.stockText}>במלאי: {stockQty}</Text>
                                            <Text style={[
                                                styles.holdingText,
                                                holdingQty > 0 ? styles.holdingTextActive : null
                                            ]}>
                                                אצלך: {holdingQty}
                                            </Text>
                                            {!isIssue && holdingQty > 0 && (
                                                <Text style={styles.returnHint}>להחזרה</Text>
                                            )}
                                        </View>

                                        {isSelected && (
                                            <View style={styles.quantityContainer}>
                                                <Text style={styles.quantityLabel}>כמות:</Text>
                                                <TextInput
                                                    style={styles.quantityInput}
                                                    value={String(item?.quantity || 1)}
                                                    onChangeText={(val) => updateQuantityDirect(eq.id, val)}
                                                    keyboardType="numeric"
                                                    selectTextOnFocus
                                                />
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={[styles.proceedButton, { backgroundColor: getActionColor() }]}
                            onPress={proceedToSignature}
                        >
                            <Text style={styles.proceedButtonText}>המשך לחתימה</Text>
                            <Ionicons name="create-outline" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        {/* Summary at signature step */}
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>סיכום הציוד:</Text>
                            {Array.from(selectedItems.values()).map((item, idx) => (
                                <View key={idx} style={styles.summaryItem}>
                                    <Text style={styles.summaryText}>
                                        • {item.equipment.name} x {item.quantity}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.sectionTitle}>חתימת החייל</Text>
                        <View style={styles.signatureContainer}>
                            <SignatureCanvas
                                ref={signatureRef}
                                onEnd={handleSignatureEnd}
                                onOK={handleSignatureOK}
                                onBegin={() => setScrollEnabled(false)}
                                descriptionText=""
                                clearText="נקה"
                                confirmText="אישור"
                                webStyle={`.m-signature-pad--footer { display: none; margin: 0px; } 
                                           body, html { height: 100%; }
                                           .m-signature-pad { height: 100%; }`}
                                style={styles.signature}
                            />

                            <View style={styles.signatureActions}>
                                <TouchableOpacity style={styles.clearButton} onPress={handleClearSignature}>
                                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                    <Text style={styles.clearButtonText}>נקה</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.manualConfirmButton} onPress={handleConfirmSignature}>
                                    <Ionicons name="create-outline" size={20} color="#FFF" />
                                    <Text style={styles.manualConfirmText}>קלוט חתימה</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.backButtonSecondary}
                                onPress={() => setStep('selection')}
                            >
                                <Text style={styles.backButtonTextSecondary}>חזור לבחירה</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.submitButton,
                                    { backgroundColor: getActionColor(), opacity: signatureData ? 1 : 0.5 }
                                ]}
                                onPress={handleSubmit}
                                disabled={!signatureData || submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Text style={styles.submitButtonText}>אישור ושמירה</Text>
                                        <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>

            <Modal
                visible={showAddModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalContainer}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>הוספת ציוד רס&quot;פ חדש</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="שם הציוד (לדוגמה: מטאטא, מגב...)"
                            value={newEquipmentName}
                            onChangeText={setNewEquipmentName}
                            autoFocus
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalButtonCancel}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.modalButtonTextCancel}>ביטול</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalButtonAdd}
                                onPress={handleAddEquipment}
                                disabled={addingEquipment}
                            >
                                {addingEquipment ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.modalButtonTextAdd}>הוסף</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadows.medium,
    },
    backButton: {
        padding: 5,
    },
    headerCenter: {
        alignItems: 'flex-end',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 15,
        textAlign: 'right',
    },
    addEquipmentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E3F2FD',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#90CAF9',
        gap: 10,
    },
    addEquipmentText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    grid: {
        gap: 12,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 15,
        ...Shadows.small,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: Colors.success,
        backgroundColor: '#F1F8E9',
    },
    cardHighlight: {
        borderLeftWidth: 4,
        borderLeftColor: Colors.warning,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 10,
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        flex: 1,
        textAlign: 'right',
    },
    stockInfoContainer: {
        flexDirection: 'row-reverse', // RTL
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
        marginBottom: 5,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        paddingTop: 8,
    },
    stockText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    holdingText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    holdingTextActive: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    returnHint: {
        fontSize: 10,
        color: Colors.warning,
        fontWeight: 'bold',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 10,
        gap: 10,
    },
    quantityLabel: {
        fontSize: 14,
        color: Colors.text,
    },
    quantityInput: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        width: 60,
        height: 40,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    proceedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 12,
        marginTop: 30,
        gap: 10,
        ...Shadows.medium,
    },
    proceedButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    summaryCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        ...Shadows.small,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 10,
        textAlign: 'right',
    },
    summaryItem: {
        marginBottom: 5,
    },
    summaryText: {
        fontSize: 16,
        color: Colors.text,
        textAlign: 'right',
    },
    signatureContainer: {
        height: 300,
        backgroundColor: '#FFF',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 20,
    },
    signature: {
        flex: 1,
        height: 240,
    },
    signatureActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        backgroundColor: '#FAFAFA',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        padding: 5,
    },
    clearButtonText: {
        color: Colors.danger,
        fontWeight: '600',
    },
    manualConfirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: Colors.primary,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    manualConfirmText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 12,
    },
    actionButtons: {
        gap: 15,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 12,
        gap: 10,
        ...Shadows.medium,
    },
    submitButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    backButtonSecondary: {
        padding: 15,
        alignItems: 'center',
    },
    backButtonTextSecondary: {
        fontSize: 16,
        color: Colors.textSecondary,
        textDecorationLine: 'underline',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        ...Shadows.large,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        textAlign: 'right',
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        gap: 10,
    },
    modalButtonAdd: {
        flex: 1,
        backgroundColor: Colors.success,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalButtonCancel: {
        flex: 1,
        backgroundColor: Colors.danger,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalButtonTextAdd: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalButtonTextCancel: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default RspAssignmentScreen;

