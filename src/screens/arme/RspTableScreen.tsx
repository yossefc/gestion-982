/**
 * RspTableScreen.tsx
 * Tableau des équipements attribués aux רס"פים
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { rspAssignmentService } from '../../services/firebaseService';
import { RspAssignment } from '../../types';

const RspTableScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState<RspAssignment[]>([]);
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        loadAssignments();
    }, []);

    const loadAssignments = async () => {
        setLoading(true);
        try {
            const data = await rspAssignmentService.getAll();
            setAssignments(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'signed': return '#4CAF50'; // Vert (Signé)
            case 'gap': return '#F44336';    // Rouge (Ecart)
            case 'credited': return '#9E9E9E'; // Gris (Rendu)
            default: return '#000';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'signed': return 'הוחתם';
            case 'gap': return 'פער';
            case 'credited': return 'זוכה';
            default: return status;
        }
    };

    const formatDate = (date?: Date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('he-IL');
    };

    const filteredAssignments = assignments.filter(a =>
        a.soldierName.includes(filterText) ||
        a.equipmentName.includes(filterText) ||
        a.company.includes(filterText)
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>טבלת רס"פים</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={loadAssignments}>
                    <Ionicons name="refresh" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Filter */}
            <View style={styles.filterContainer}>
                <TextInput
                    style={styles.filterInput}
                    placeholder="חיפוש לפי שם, ציוד או פלוגה..."
                    value={filterText}
                    onChangeText={setFilterText}
                    textAlign="right"
                />
                <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.filterIcon} />
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { flex: 2 }]}>שם רס"פ</Text>
                <Text style={[styles.headerCell, { flex: 1.5 }]}>פלוגה</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>ציוד</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>כמות</Text>
                <Text style={[styles.headerCell, { flex: 1.5 }]}>סטטוס</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>תאריך</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <ScrollView style={styles.tableBody}>
                    {filteredAssignments.map((item) => (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={[styles.cell, { flex: 2, fontWeight: 'bold' }]}>{item.soldierName}</Text>
                            <Text style={[styles.cell, { flex: 1.5 }]}>{item.company}</Text>
                            <Text style={[styles.cell, { flex: 2 }]}>{item.equipmentName}</Text>
                            <Text style={[styles.cell, { flex: 1 }]}>{item.quantity}</Text>
                            <View style={[styles.cellContainer, { flex: 1.5 }]}>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                        {getStatusText(item.status)}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.cell, { flex: 2, fontSize: 10 }]}>
                                {formatDate(item.lastSignatureDate)}
                            </Text>
                        </View>
                    ))}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
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
    refreshButton: {
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
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        margin: Spacing.md,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    filterInput: {
        flex: 1,
        paddingVertical: Spacing.md,
        fontSize: FontSize.base,
    },
    filterIcon: {
        marginLeft: Spacing.sm,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerCell: {
        fontSize: 12, // Reduced font size for better fit
        fontWeight: 'bold',
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    tableBody: {
        flex: 1,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#FFF',
        minHeight: 50,
    },
    cell: {
        fontSize: 12,
        color: Colors.text,
        textAlign: 'center',
    },
    cellContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default RspTableScreen;
