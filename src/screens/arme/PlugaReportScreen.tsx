/**
 * PlugaReportScreen.tsx
 * Shows a scrollable preview of signed equipment grouped by equipment type,
 * filtered by company (פלוגה). Prints via the system print dialog on button press.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, BorderRadius, Spacing, FontSize } from '../../theme/Colors';
import { Company } from '../../types';
import { assignmentService } from '../../services/assignmentService';
import {
    buildCompanyReport,
    CompanyReportData,
    EquipmentGroup,
    printCompanyReport,
    SoldierHolding,
} from '../../services/companyReportService';

// ─── Constants ─────────────────────────────────────────────────────────────────

const COMPANIES: string[] = [
    'הכל',
    'פלוגה א',
    'פלוגה ב',
    'פלוגה ג',
    'פלוגה ד',
    'מפקדה',
    'ניוד',
];

// ─── Component ─────────────────────────────────────────────────────────────────

const PlugaReportScreen: React.FC = () => {
    const navigation = useNavigation<any>();

    const [selectedCompany, setSelectedCompany] = useState<string>('פלוגה א');
    const [allHoldings, setAllHoldings] = useState<SoldierHolding[]>([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load all combat holdings — ONE Firestore query, computed in-memory
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                // Single Firestore read — all combat assignments
                const allAssignments = await assignmentService.getAssignmentsByType('combat');

                // Sort oldest→newest so we can replay history in order
                const byAge = [...allAssignments].sort(
                    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                );

                // Maps: soldierId → data
                const nameMap = new Map<string, string>();
                const pnMap = new Map<string, string>();
                const companyMap = new Map<string, string>();

                // holdings: soldierId → equipmentId → { name, qty, serial }
                const holdingsMap = new Map<string, Map<string, { name: string; qty: number; serial?: string }>>();

                for (const a of byAge) {
                    nameMap.set(a.soldierId, a.soldierName);
                    pnMap.set(a.soldierId, a.soldierPersonalNumber);
                    if (a.soldierCompany) companyMap.set(a.soldierId, a.soldierCompany);

                    if (!holdingsMap.has(a.soldierId)) {
                        holdingsMap.set(a.soldierId, new Map());
                    }
                    const soldier = holdingsMap.get(a.soldierId)!;
                    const action = a.action || 'issue';

                    for (const item of a.items) {
                        const key = item.equipmentId;
                        if (action === 'issue' || action === 'add') {
                            if (soldier.has(key)) {
                                const ex = soldier.get(key)!;
                                ex.qty += item.quantity;
                                if (item.serial && !ex.serial?.includes(item.serial)) {
                                    ex.serial = ex.serial ? `${ex.serial}, ${item.serial}` : item.serial;
                                }
                            } else {
                                soldier.set(key, { name: item.equipmentName, qty: item.quantity, serial: item.serial });
                            }
                        } else if (action === 'credit' || action === 'return') {
                            if (soldier.has(key)) {
                                const ex = soldier.get(key)!;
                                ex.qty -= item.quantity;
                                if (ex.qty <= 0) soldier.delete(key);
                            }
                        }
                        // storage / retrieve — no quantity change
                    }
                }

                // Build final SoldierHolding array
                const holdings: SoldierHolding[] = [];
                for (const [soldierId, itemsMap] of holdingsMap.entries()) {
                    const positiveItems = Array.from(itemsMap.entries())
                        .filter(([, v]) => v.qty > 0)
                        .map(([equipmentId, v]) => ({
                            equipmentId,
                            equipmentName: v.name,
                            quantity: v.qty,
                            serial: v.serial,
                        }));
                    if (positiveItems.length > 0) {
                        holdings.push({
                            soldierId,
                            soldierName: nameMap.get(soldierId) || '',
                            soldierPersonalNumber: pnMap.get(soldierId) || '',
                            soldierCompany: companyMap.get(soldierId) || '',
                            items: positiveItems,
                        });
                    }
                }

                setAllHoldings(holdings);
            } catch (e: any) {
                console.error('[PlugaReport] load error', e);
                setError('שגיאה בטעינת הנתונים. אנא נסה שוב.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const report: CompanyReportData = useMemo(
        () => buildCompanyReport(allHoldings, selectedCompany),
        [allHoldings, selectedCompany]
    );

    const handlePrint = useCallback(async () => {
        try {
            setPrinting(true);
            await printCompanyReport(report);
        } catch (e: any) {
            console.error('[PlugaReport] print error', e);
            Alert.alert('שגיאה', 'אירעה שגיאה בהדפסה. אנא נסה שוב.');
        } finally {
            setPrinting(false);
        }
    }, [report]);

    // ── Render helpers ──────────────────────────────────────────────────────────

    const renderGroup = useCallback(
        ({ item: group }: { item: EquipmentGroup }) => (
            <View style={styles.groupBlock}>
                {/* Group header */}
                <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{group.equipmentName}</Text>
                    <Text style={styles.groupCount}>{group.total} יח'</Text>
                </View>

                {/* Column headers — RTL order: מסט"ב | שם פריט | מ.א. | שם החייל | מס"ד */}
                <View style={[styles.tableRow, styles.columnHeader]}>
                    <Text style={[styles.colSerial, styles.colHeaderText]}>מסט"ב</Text>
                    <Text style={[styles.colPN, styles.colHeaderText]}>מ.א.</Text>
                    <Text style={[styles.colName, styles.colHeaderText]}>שם החייל</Text>
                    <Text style={[styles.colIdx, styles.colHeaderText]}>מס"ד</Text>
                </View>

                {/* Data rows — RTL order */}
                {group.rows.map((row, idx) => (
                    <View
                        key={`${row.soldierPersonalNumber}-${row.serial}`}
                        style={[styles.tableRow, idx % 2 === 0 ? styles.rowEven : styles.rowOdd]}
                    >
                        <Text style={[styles.colSerial, styles.cellText]}>{row.serial}</Text>
                        <Text style={[styles.colPN, styles.cellText]}>{row.soldierPersonalNumber}</Text>
                        <Text style={[styles.colName, styles.cellText]} numberOfLines={1}>
                            {row.soldierName}
                        </Text>
                        <Text style={[styles.colIdx, styles.cellText]}>{idx + 1}</Text>
                    </View>
                ))}

                {/* Total row */}
                <View style={styles.totalRow}>
                    <Text style={styles.totalText}>
                        סה"כ {group.equipmentName}: <Text style={styles.totalCount}>{group.total}</Text>
                    </Text>
                </View>
            </View>
        ),
        []
    );

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>→</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>דוח ציוד חתום</Text>
                    <Text style={styles.headerSub}>מסוננת לפי פלוגה · מסט"ב בלבד</Text>
                </View>
                <Text style={styles.headerIcon}>📊</Text>
            </View>

            {/* ── Company picker ───────────────────────────────────────────────── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.companyBar}
                contentContainerStyle={styles.companyBarContent}
            >
                {COMPANIES.map(c => (
                    <TouchableOpacity
                        key={c}
                        style={[styles.companyChip, selectedCompany === c && styles.companyChipActive]}
                        onPress={() => setSelectedCompany(c)}
                    >
                        <Text
                            style={[styles.companyChipText, selectedCompany === c && styles.companyChipTextActive]}
                        >
                            {c}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* ── Content ─────────────────────────────────────────────────────── */}
            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={Colors.arme} />
                    <Text style={styles.loadingText}>טוען נתונים…</Text>
                </View>
            ) : error ? (
                <View style={styles.centerBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : report.groups.length === 0 ? (
                <View style={styles.centerBox}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={styles.emptyText}>אין ציוד עם מסט"ב עבור {selectedCompany}</Text>
                </View>
            ) : (
                <>
                    {/* Summary bar */}
                    <View style={styles.summaryBar}>
                        <Text style={styles.summaryText}>
                            📋 {report.groups.length} סוגי ציוד · {report.grandTotal} פריטים
                        </Text>
                    </View>

                    <FlatList
                        data={report.groups}
                        keyExtractor={g => g.equipmentName}
                        renderItem={renderGroup}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            )}

            {/* ── Print button ─────────────────────────────────────────────────── */}
            {!loading && !error && report.groups.length > 0 && (
                <TouchableOpacity
                    style={[styles.printBtn, printing && styles.printBtnDisabled]}
                    onPress={handlePrint}
                    disabled={printing}
                    activeOpacity={0.8}
                >
                    {printing ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.printBtnText}>🖨️ הדפס דוח</Text>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // Header
    header: {
        backgroundColor: Colors.arme,
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'right' },
    headerIcon: { fontSize: 28 },

    // Company picker
    companyBar: {
        height: 56,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    companyBarContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    companyChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Colors.arme,
        backgroundColor: '#fff',
        marginRight: 8,
    },
    companyChipActive: {
        backgroundColor: Colors.arme,
    },
    companyChipText: {
        fontSize: 13,
        color: Colors.arme,
        fontWeight: '600',
    },
    companyChipTextActive: {
        color: '#fff',
    },

    // Summary
    summaryBar: {
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    summaryText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'right',
    },

    // List
    listContent: {
        padding: 12,
        paddingBottom: 100,
    },

    // Group block
    groupBlock: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    groupHeader: {
        backgroundColor: Colors.arme,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    groupName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    groupCount: {
        color: '#fff',
        fontSize: 12,
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },

    // Table — RTL layout
    columnHeader: {
        backgroundColor: '#eceff1',
        paddingVertical: 6,
    },
    colHeaderText: { fontWeight: 'bold', fontSize: 11, color: '#333', textAlign: 'center' },
    tableRow: {
        flexDirection: 'row',          // RTL: items placed right→left
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e0e0e0',
        alignItems: 'center',
    },
    rowEven: { backgroundColor: '#fff' },
    rowOdd: { backgroundColor: '#f5f5f5' },

    // Columns (widths unchanged, alignment RTL)
    colIdx: { width: 36, textAlign: 'center' },
    colName: { flex: 1, textAlign: 'right', paddingHorizontal: 4 },
    colPN: { width: 72, textAlign: 'center' },
    colSerial: { width: 90, textAlign: 'center' },
    cellText: { fontSize: 11, color: '#222' },

    // Total row
    totalRow: {
        backgroundColor: '#e8eaf6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    totalText: { fontSize: 12, color: '#333', fontWeight: '600' },
    totalCount: { fontWeight: 'bold', color: Colors.arme },

    // States
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
    },
    loadingText: { color: '#666', fontSize: 14, marginTop: 8 },
    errorText: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
    emptyIcon: { fontSize: 48 },
    emptyText: { color: '#666', fontSize: 15, textAlign: 'center' },

    // Print button
    printBtn: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        backgroundColor: '#2c3e50',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    printBtnDisabled: { opacity: 0.6 },
    printBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default PlugaReportScreen;
