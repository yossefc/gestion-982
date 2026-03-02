import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { assignmentService } from '../../services/assignmentService';
import { Assignment } from '../../types';
import { generateAndPrintPDF, PrintAssignmentData } from '../../utils/printUtils';

const UnprintedSignaturesScreen: React.FC = () => {
    const navigation = useNavigation();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        navigation.setOptions({
            title: 'הדפסת טפסים',
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: Colors.backgroundCard,
        });
        loadUnprintedAssignments();
    }, [navigation]);

    const loadUnprintedAssignments = async () => {
        setLoading(true);
        try {
            const data = await assignmentService.getUnprintedAssignments('combat');
            // Filtre uniquement les attributions qui ont des "items" et une "signature"
            const complets = data.filter((a: Assignment) => a.items && a.items.length > 0 && a.signature);
            setAssignments(complets);
        } catch (error) {
            console.error('Error loading unprinted assignments:', error);
            Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת הטפסים');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === assignments.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(assignments.map(a => a.id!)));
        }
    };

    const handlePrintSelected = async () => {
        if (selectedIds.size === 0) return;

        setPrinting(true);
        try {
            const selectedAssignments = assignments.filter(a => selectedIds.has(a.id!));

            // Imprimer chaque formulaire un par un
            // Une meilleure approche pour de grosses quantités serait de générer un seul PDF multipage,
            // mais 'expo-print' gère l'impression séquentielle si on laisse l'utilisateur valider.
            // Ou on ne sélectionne qu'un seul à la fois pour simplifier.
            // Faisons une boucle séquentielle
            for (const assignment of selectedAssignments) {
                const printData: PrintAssignmentData = {
                    soldierName: assignment.soldierName,
                    soldierPersonalNumber: assignment.soldierPersonalNumber,
                    soldierPhone: assignment.soldierPhone,
                    soldierCompany: assignment.soldierCompany,
                    items: assignment.items || [],
                    signature: assignment.signature || '',
                    operatorSignature: undefined,
                    operatorName: assignment.assignedByName || assignment.assignedByEmail || '',
                    timestamp: assignment.timestamp instanceof Date ? assignment.timestamp : new Date(assignment.timestamp),
                    assignmentId: assignment.id,
                };
                // On n'ouvre pas le sélecteur d'imprimante à chaque itération, 
                // ou on utilise l'imprimante par défaut.
                await generateAndPrintPDF(printData);
            }

            // Marquer comme imprimés
            const idsToMark = Array.from(selectedIds);
            await assignmentService.markAssignmentsAsPrinted(idsToMark);

            Alert.alert('הצלחה', 'הטפסים נשלחו להדפסה בהצלחה.', [
                { text: 'אישור', onPress: () => loadUnprintedAssignments() }
            ]);
            setSelectedIds(new Set());

        } catch (error) {
            console.error('Error printing selected forms:', error);
            Alert.alert('שגיאה', 'אירעה שגיאה במהלך ההדפסה.');
        } finally {
            setPrinting(false);
        }
    };

    const renderItem = ({ item }: { item: Assignment }) => {
        const isSelected = selectedIds.has(item.id!);
        const date = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp);

        return (
            <TouchableOpacity
                style={[styles.assignmentCard, isSelected && styles.selectedCard]}
                onPress={() => toggleSelection(item.id!)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.soldierName}>{item.soldierName}</Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color={Colors.backgroundCard} />}
                    </View>
                </View>

                <View style={styles.cardContent}>
                    <Text style={styles.cardText}>מ"א: {item.soldierPersonalNumber}</Text>
                    {item.soldierCompany && <Text style={styles.cardText}>פלוגה: {item.soldierCompany}</Text>}
                    <Text style={styles.cardText}>פריטים: {item.items?.length || 0}</Text>
                    <Text style={styles.cardDate}>
                        {date.toLocaleDateString('he-IL')} {date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>טוען טפסים...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={styles.topBarText}>נמצאו {assignments.length} טפסים שלא הודפסו</Text>
                {assignments.length > 0 && (
                    <TouchableOpacity style={styles.selectAllBtn} onPress={selectAll}>
                        <Text style={styles.selectAllText}>
                            {selectedIds.size === assignments.length ? 'בטל בחירה' : 'בחר הכל'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {assignments.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="documents-outline" size={64} color={Colors.textSecondary} />
                    <Text style={styles.emptyText}>אין טפסים הממתינים להדפסה</Text>
                </View>
            ) : (
                <FlatList
                    data={assignments}
                    keyExtractor={item => item.id!}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {selectedIds.size > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.printBtn, printing && styles.printBtnDisabled]}
                        onPress={handlePrintSelected}
                        disabled={printing}
                    >
                        {printing ? (
                            <ActivityIndicator color={Colors.backgroundCard} />
                        ) : (
                            <>
                                <Ionicons name="print" size={20} color={Colors.backgroundCard} style={styles.printIcon} />
                                <Text style={styles.printBtnText}>הדפס נבחרים ({selectedIds.size})</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: FontSize.md,
        color: Colors.text,
    },
    topBar: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    topBarText: {
        fontSize: FontSize.md,
        fontWeight: 'bold',
        color: Colors.text,
    },
    selectAllBtn: {
        padding: Spacing.sm,
    },
    selectAllText: {
        color: Colors.primary,
        fontSize: FontSize.md,
        fontWeight: 'bold',
    },
    listContent: {
        padding: Spacing.md,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: FontSize.lg,
        color: Colors.textSecondary,
    },
    assignmentCard: {
        backgroundColor: Colors.backgroundCard,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        flexDirection: 'column',
        ...Shadows.small,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: Colors.primary,
        backgroundColor: '#E3F2FD',
    },
    cardHeader: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    soldierName: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.text,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundCard,
    },
    checkboxSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    cardContent: {
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    cardText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    cardDate: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        marginTop: 4,
        fontWeight: 'bold',
    },
    footer: {
        padding: Spacing.md,
        backgroundColor: Colors.backgroundCard,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        ...Shadows.medium,
    },
    printBtn: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    printBtnDisabled: {
        opacity: 0.7,
    },
    printIcon: {
        marginRight: Spacing.sm,
    },
    printBtnText: {
        color: Colors.backgroundCard,
        fontSize: FontSize.lg,
        fontWeight: 'bold',
    },
});

export default UnprintedSignaturesScreen;
