/**
 * RspEquipmentScreen.tsx
 * Gestion des équipements spécifiques pour les RSP
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { rspEquipmentService } from '../../services/firebaseService';
import { RspEquipment } from '../../types';

const RspEquipmentScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [equipments, setEquipments] = useState<RspEquipment[]>([]);
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('ציוד רס"פ');
    const [newQuantity, setNewQuantity] = useState('0');
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        loadEquipment();
    }, []);

    const loadEquipment = async () => {
        setLoading(true);
        try {
            const data = await rspEquipmentService.getAll();
            setEquipments(data);
        } catch (error) {
            console.error(error);
            Alert.alert('שגיאה', 'לא ניתן לטעון את הציוד');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;

        try {
            const quantity = parseInt(newQuantity) || 0;
            await rspEquipmentService.create({
                name: newName.trim(),
                category: newCategory,
                quantity: quantity,
            });
            setNewName('');
            setNewCategory('ציוד רס"פ');
            setNewQuantity('0');
            setAddingNew(false);
            loadEquipment();
        } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן ליצור את הציוד');
        }
    };

    const handleUpdateQuantity = async (id: string, currentQuantity: number, delta: number) => {
        try {
            const newQuantity = Math.max(0, currentQuantity + delta);

            // Mise à jour optimiste locale
            setEquipments(prev =>
                prev.map(item =>
                    item.id === id
                        ? { ...item, quantity: newQuantity }
                        : item
                )
            );

            // Mise à jour Firebase en arrière-plan
            await rspEquipmentService.update(id, { quantity: newQuantity });
        } catch (error) {
            // En cas d'erreur, recharger les vraies données
            Alert.alert('שגיאה', 'לא ניתן לעדכן את הכמות');
            loadEquipment();
        }
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            'מחיקה',
            `למחוק את הציוד "${name}"?`,
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await rspEquipmentService.delete(id);
                            loadEquipment();
                        } catch (error) {
                            Alert.alert('שגיאה', 'לא ניתן למחוק');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ציוד רס"פ</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setAddingNew(!addingNew)}>
                    <Ionicons name={addingNew ? "close" : "add"} size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {addingNew && (
                    <View style={styles.addCard}>
                        <Text style={styles.cardTitle}>ציוד חדש</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="שם הציוד"
                            value={newName}
                            onChangeText={setNewName}
                            textAlign="right"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="קטגוריה (לדוגמה: מתכלה)"
                            value={newCategory}
                            onChangeText={setNewCategory}
                            textAlign="right"
                        />
                        <View style={styles.quantityInputContainer}>
                            <Text style={styles.quantityLabel}>כמות במלאי:</Text>
                            <TextInput
                                style={styles.quantityInput}
                                placeholder="0"
                                value={newQuantity}
                                onChangeText={setNewQuantity}
                                keyboardType="numeric"
                                textAlign="center"
                            />
                        </View>
                        <TouchableOpacity style={styles.submitButton} onPress={handleAdd}>
                            <Text style={styles.submitText}>הוסף</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 20 }} />
                ) : (
                    <View style={styles.list}>
                        {equipments.map((item) => (
                            <View key={item.id} style={styles.itemCard}>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDelete(item.id, item.name)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                </TouchableOpacity>
                                <View style={styles.itemContent}>
                                    <View style={styles.itemHeader}>
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            <Text style={styles.itemCategory}>{item.category}</Text>
                                        </View>
                                        <View style={styles.iconBox}>
                                            <Ionicons name="cube-outline" size={24} color={Colors.primary} />
                                        </View>
                                    </View>

                                    {/* Stock Section */}
                                    <View style={styles.stockSection}>
                                        <Text style={styles.stockLabel}>מלאי:</Text>
                                        <View style={styles.stockControls}>
                                            <TouchableOpacity
                                                style={styles.stockButton}
                                                onPress={() => handleUpdateQuantity(item.id, item.quantity || 0, -1)}
                                            >
                                                <Ionicons name="remove" size={20} color={Colors.danger} />
                                            </TouchableOpacity>
                                            <View style={styles.stockValueContainer}>
                                                <Text style={styles.stockValue}>{item.quantity || 0}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.stockButton}
                                                onPress={() => handleUpdateQuantity(item.id, item.quantity || 0, 1)}
                                            >
                                                <Ionicons name="add" size={20} color={Colors.success} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}
                        {equipments.length === 0 && !loading && (
                            <Text style={styles.emptyText}>אין ציוד מוגדר</Text>
                        )}
                    </View>
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
    header: {
        backgroundColor: Colors.primary,
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: Spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadows.medium,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: '#FFF',
    },
    addButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: BorderRadius.full,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    addCard: {
        backgroundColor: '#FFF',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        ...Shadows.small,
    },
    cardTitle: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        marginBottom: Spacing.md,
        textAlign: 'right',
    },
    input: {
        backgroundColor: '#F5F5F5',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
        textAlign: 'right',
    },
    quantityInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
        backgroundColor: '#F5F5F5',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    quantityLabel: {
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.text,
    },
    quantityInput: {
        backgroundColor: '#FFF',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.text,
        minWidth: 80,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    submitButton: {
        backgroundColor: Colors.primary,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    submitText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    list: {
        gap: Spacing.md,
    },
    itemCard: {
        backgroundColor: '#FFF',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.small,
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    itemInfo: {
        flex: 1,
        alignItems: 'flex-end',
        marginRight: Spacing.md,
    },
    itemName: {
        fontSize: FontSize.base,
        fontWeight: 'bold',
        color: Colors.text,
    },
    itemCategory: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    iconBox: {
        width: 40,
        height: 40,
        backgroundColor: '#E3F2FD',
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButton: {
        padding: Spacing.sm,
        position: 'absolute',
        top: Spacing.sm,
        left: Spacing.sm,
        zIndex: 1,
    },
    stockSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.backgroundInput,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xs,
    },
    stockLabel: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
    },
    stockControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    stockButton: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.full,
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.xs,
    },
    stockValueContainer: {
        minWidth: 50,
        alignItems: 'center',
    },
    stockValue: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginTop: Spacing.xl,
    },
});

export default RspEquipmentScreen;
