import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    TextInput,
    RefreshControl,
    Platform,
    ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { soldierService } from '../../services/firebaseService';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';
import { Soldier } from '../../types';
import { AppModal, ModalType } from '../../components';
import { useData } from '../../contexts/DataContext';

// Status labels and colors
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pre_recruitment: { label: 'טרום גיוס', color: '#6B7280', bg: '#F3F4F6', icon: 'person-outline' },
    recruited: { label: 'מגויס', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle' },
    gimelim: { label: 'גימלים', color: '#8B5CF6', bg: '#EDE9FE', icon: 'calendar' },
    pitzul: { label: 'פיצול', color: '#F59E0B', bg: '#FEF3C7', icon: 'git-branch' },
    rianun: { label: 'רענון', color: '#EC4899', bg: '#FCE7F3', icon: 'refresh' },
    releasing_today: { label: 'משתחרר היום', color: '#D97706', bg: '#FEF3C7', icon: 'time' },
    released: { label: 'משוחרר', color: '#3B82F6', bg: '#DBEAFE', icon: 'flag' },
};

const ShlishutHomeScreen: React.FC = () => {
    const navigation = useNavigation<any>();

    // OPTIMISÉ: Utiliser le cache centralisé
    const { soldiers: cachedSoldiers, soldiersLoading, refreshSoldiers, isInitialized } = useData();

    const [refreshing, setRefreshing] = useState(false);
    const [filteredSoldiers, setFilteredSoldiers] = useState<Soldier[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // Holdings indicators
    const [holdingsMap, setHoldingsMap] = useState<Map<string, { hasCombat: boolean; hasClothing: boolean }>>(new Map());

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<ModalType>('info');
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalButtons, setModalButtons] = useState<any[]>([]);

    // OPTIMISÉ: Stats calculés à partir du cache (pas de rechargement)
    const stats = useMemo(() => {
        const byCompany: Record<string, { recruited: number; released: number }> = {};
        let recruited = 0;
        let releaseProcess = 0;
        let released = 0;

        cachedSoldiers.forEach(s => {
            const status = s.status || 'pre_recruitment';
            const company = s.company || 'לא משויך';

            if (!byCompany[company]) {
                byCompany[company] = { recruited: 0, released: 0 };
            }

            // Statuses where soldier is "active" with equipment
            if (status === 'recruited' || status === 'gimelim' || status === 'pitzul' || status === 'rianun' || status === 'releasing_today') {
                byCompany[company].recruited++;
                if (status === 'releasing_today') releaseProcess++;
                else recruited++;
            } else if (status === 'released') {
                byCompany[company].released++;
                released++;
            }
        });

        return { recruited, releaseProcess, released, byCompany };
    }, [cachedSoldiers]);

    // Loading state optimisé
    const loading = !isInitialized;

    // OPTIMISÉ: Filtrer quand les données changent (pas de useFocusEffect)
    useEffect(() => {
        if (isInitialized) {
            filterSoldiers(cachedSoldiers, searchQuery, selectedStatus);
        }
    }, [isInitialized, cachedSoldiers, searchQuery, selectedStatus]);

    // Refresh manuel uniquement
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshSoldiers();
        } catch (error) {
            console.error('Error refreshing soldiers:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Batch-load holdings for all soldiers to show indicators on cards
    const loadHoldingsForSoldiers = useCallback(async (soldiers: Soldier[]) => {
        if (soldiers.length === 0) return;
        const ids = soldiers.map(s => s.id);
        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            const out: T[][] = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        };
        try {
            const snapshots = await Promise.all(
                chunkArray(ids, 30).map(chunk =>
                    getDocs(query(collection(db, 'soldier_holdings'), where('soldierId', 'in', chunk)))
                )
            );
            const newMap = new Map<string, { hasCombat: boolean; hasClothing: boolean }>();
            snapshots.flatMap(s => s.docs).forEach(d => {
                const data = d.data();
                const { soldierId, type, items } = data;
                if (!soldierId || !type) return;
                if (!Array.isArray(items) || items.length === 0) return;
                const entry = newMap.get(soldierId) || { hasCombat: false, hasClothing: false };
                if (type === 'combat') entry.hasCombat = true;
                if (type === 'clothing') entry.hasClothing = true;
                newMap.set(soldierId, entry);
            });
            setHoldingsMap(newMap);
        } catch (error) {
            console.error('[ShlishutHome] loadHoldings error:', error);
        }
    }, []);

    useEffect(() => {
        if (isInitialized && cachedSoldiers.length > 0) {
            loadHoldingsForSoldiers(cachedSoldiers);
        }
    }, [isInitialized, cachedSoldiers, loadHoldingsForSoldiers]);

    const filterSoldiers = (list: Soldier[], query: string, status: string) => {
        let result = list;

        // Filter by status
        if (status !== 'all') {
            result = result.filter(s => (s.status || 'not_recruited') === status);
        }

        // Filter by search query
        if (query) {
            const lowerQuery = query.toLowerCase();
            result = result.filter(
                s =>
                    s.name.toLowerCase().includes(lowerQuery) ||
                    s.personalNumber.includes(lowerQuery)
            );
        }

        setFilteredSoldiers(result);
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        filterSoldiers(cachedSoldiers, text, selectedStatus);
    };

    const handleStatusFilter = (status: string) => {
        setSelectedStatus(status);
        filterSoldiers(cachedSoldiers, searchQuery, status);
    };

    const handleChangeStatus = async (soldier: Soldier) => {
        const currentStatus = soldier.status || 'pre_recruitment';

        // All available status options
        const allStatuses: { key: Soldier['status']; label: string; icon: string }[] = [
            { key: 'pre_recruitment', label: 'טרום גיוס', icon: 'person-outline' },
            { key: 'recruited', label: 'מגויס', icon: 'checkmark-circle' },
            { key: 'gimelim', label: 'גימלים', icon: 'calendar' },
            { key: 'pitzul', label: 'פיצול', icon: 'git-branch' },
            { key: 'rianun', label: 'רענון', icon: 'refresh' },
            { key: 'releasing_today', label: 'משתחרר היום', icon: 'time' },
            { key: 'released', label: 'משוחרר', icon: 'flag' },
        ];

        // Build actions - exclude current status
        const actions: any[] = allStatuses
            .filter(s => s.key !== currentStatus)
            .map(s => ({
                text: s.label,
                style: s.key === 'released' ? 'primary' : (s.key === 'releasing_today' ? 'warning' : 'outline'),
                icon: s.icon,
                onPress: () => confirmStatusChange(soldier, s.key, s.label)
            }));

        actions.push({
            text: 'ביטול',
            style: 'cancel',
            onPress: () => setModalVisible(false)
        });

        const statusLabel = STATUS_CONFIG[currentStatus]?.label || currentStatus;
        setModalTitle(`שינוי סטטוס: ${soldier.name}`);
        setModalMessage(`סטטוס נוכחי: ${statusLabel}`);
        setModalType('info');
        setModalButtons(actions);
        setModalVisible(true);
    };

    const confirmStatusChange = async (soldier: Soldier, newStatus: Soldier['status'], actionName: string) => {
        setModalVisible(false);
        try {
            await soldierService.updateStatus(soldier.id, newStatus);

            // If starting release process, check if soldier has no equipment
            if (newStatus === 'releasing_today') {
                const combatHoldings = await transactionalAssignmentService.getCurrentHoldings(soldier.id, 'combat');
                const clothingHoldings = await transactionalAssignmentService.getCurrentHoldings(soldier.id, 'clothing');

                if ((combatHoldings?.length || 0) === 0 && (clothingHoldings?.length || 0) === 0) {
                    // Soldier has no equipment! Auto-clear and release
                    await soldierService.updateClearance(soldier.id, 'armory', true);
                    await soldierService.updateClearance(soldier.id, 'logistics', true);

                    setModalType('success');
                    setModalTitle('חייל שוחרר');
                    setModalMessage(`${soldier.name} שוחרר אוטומטית - אין ציוד לזכות.`);
                    setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
                    setModalVisible(true);
                } else {
                    // TODO: Send notification to RSP
                    // For now just show success
                    setModalType('success');
                    setModalTitle('תהליך שחרור התחיל');
                    setModalMessage(`${soldier.name} נמצא כעת בתהליך שחרור.\nיש לבצע זיכוי בנשקייה ואפסנאות.`);
                    setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
                    setModalVisible(true);
                }
            }

            // OPTIMISÉ: Rafraîchir le cache
            await refreshSoldiers();
        } catch (error) {
            console.error('Error updating status:', error);
            setModalType('error');
            setModalTitle('שגיאה');
            setModalMessage('אירעה שגיאה בעדכון הסטטוס');
            setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
            setModalVisible(true);
        }
    };

    const renderSoldierItem = ({ item }: { item: Soldier }) => {
        // Handle legacy statuses by mapping them to new ones if needed, or just fallback
        const status = item.status || 'pre_recruitment';
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pre_recruitment;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => handleChangeStatus(item)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.soldierInfo}>
                        <Text style={styles.soldierName}>{item.name}</Text>
                        <Text style={styles.soldierId}>מ.א: {item.personalNumber}</Text>
                        {item.company && (
                            <Text style={styles.companyText}>פלוגה: {item.company}</Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                        <Ionicons name={config.icon as any} size={14} color={config.color} />
                        <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                    </View>
                </View>


                {(() => {
                    const h = holdingsMap.get(item.id);
                    if (!h) return null;
                    return (
                        <View style={styles.holdingIndicators}>
                            {h.hasClothing && (
                                <View style={[styles.holdingPill, styles.pillLogistics]}>
                                    <Ionicons name="shirt-outline" size={11} color="#FFF" />
                                    <Text style={styles.holdingPillText}>אפסנאות</Text>
                                </View>
                            )}
                            {h.hasCombat && (
                                <View style={[styles.holdingPill, styles.pillArmory]}>
                                    <Ionicons name="shield-outline" size={11} color="#FFF" />
                                    <Text style={styles.holdingPillText}>נשקייה</Text>
                                </View>
                            )}
                        </View>
                    );
                })()}

                {status === 'releasing_today' && (
                    <View style={styles.clearanceContainer}>
                        <Text style={styles.clearanceTitle}>מצב זיכוי:</Text>
                        <View style={styles.clearanceBadges}>
                            <View style={[
                                styles.clearanceBadge,
                                item.clearanceStatus?.armory ? styles.badgeSuccess : styles.badgePending
                            ]}>
                                <Text style={styles.clearanceText}>נשקייה</Text>
                                <Ionicons
                                    name={item.clearanceStatus?.armory ? "checkmark-circle" : "close-circle"}
                                    size={14}
                                    color="#FFF"
                                />
                            </View>
                            <View style={[
                                styles.clearanceBadge,
                                item.clearanceStatus?.logistics ? styles.badgeSuccess : styles.badgePending
                            ]}>
                                <Text style={styles.clearanceText}>אפסנאות</Text>
                                <Ionicons
                                    name={item.clearanceStatus?.logistics ? "checkmark-circle" : "close-circle"}
                                    size={14}
                                    color="#FFF"
                                />
                            </View>
                        </View>
                    </View>
                )}


                <View style={styles.cardAction}>
                    <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
                    <Text style={styles.actionHint}>לחץ לשינוי סטטוס</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-forward" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>שלישות</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('AddSoldier', { fromShlishut: true })}
                    >
                        <Ionicons name="person-add" size={22} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.statsContainer}
                    contentContainerStyle={styles.statsContent}
                >
                    <View style={[styles.statCard, { backgroundColor: 'rgba(209, 250, 229, 0.3)' }]}>
                        <Text style={styles.statNumber}>{stats.recruited}</Text>
                        <Text style={styles.statLabel}>מגויסים</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: 'rgba(254, 243, 199, 0.3)' }]}>
                        <Text style={styles.statNumber}>{stats.releaseProcess}</Text>
                        <Text style={styles.statLabel}>בשחרור</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: 'rgba(219, 234, 254, 0.3)' }]}>
                        <Text style={styles.statNumber}>{stats.released}</Text>
                        <Text style={styles.statLabel}>משוחררים</Text>
                    </View>
                </ScrollView>
            </LinearGradient>

            {/* Search & Filters */}
            <View style={styles.searchSection}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={Colors.textLight} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="חיפוש לפי שם או מספר אישי..."
                        placeholderTextColor={Colors.textLight}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        textAlign="right"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={20} color={Colors.textLight} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filtersContainer}
                    contentContainerStyle={{ paddingHorizontal: Spacing.md }}
                >
                    <TouchableOpacity
                        style={[styles.filterChip, selectedStatus === 'all' && styles.filterChipActive]}
                        onPress={() => handleStatusFilter('all')}
                    >
                        <Text style={[styles.filterText, selectedStatus === 'all' && styles.filterTextActive]}>הכל</Text>
                    </TouchableOpacity>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <TouchableOpacity
                            key={key}
                            style={[
                                styles.filterChip,
                                selectedStatus === key && styles.filterChipActive,
                                selectedStatus === key && { backgroundColor: config.bg, borderColor: config.color }
                            ]}
                            onPress={() => handleStatusFilter(key)}
                        >
                            <Text style={[
                                styles.filterText,
                                selectedStatus === key && { color: config.color, fontWeight: '600' }
                            ]}>
                                {config.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Soldier List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                    <Text style={styles.loadingText}>טוען חיילים...</Text>
                </View>
            ) : filteredSoldiers.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={64} color={Colors.textLight} />
                    <Text style={styles.emptyTitle}>לא נמצאו חיילים</Text>
                    <Text style={styles.emptySubtitle}>
                        {searchQuery ? 'נסה לחפש משהו אחר' : 'הוסף חייל חדש בלחיצה על +'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredSoldiers}
                    renderItem={renderSoldierItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#8B5CF6']}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

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
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: Spacing.lg,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsContainer: {
        marginTop: Spacing.sm,
    },
    statsContent: {
        paddingHorizontal: Spacing.lg,
        gap: 10,
    },
    statCard: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 70,
        marginRight: 10,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    searchSection: {
        backgroundColor: '#FFF',
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
        ...Shadows.small,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: Spacing.md,
    },
    searchInput: {
        flex: 1,
        marginHorizontal: 8,
        fontSize: 15,
        color: Colors.text,
    },
    filtersContainer: {
        marginTop: Spacing.md,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    filterChipActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    filterText: {
        fontSize: 13,
        color: Colors.textLight,
    },
    filterTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.sm,
        color: Colors.textLight,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginTop: Spacing.md,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textLight,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    listContent: {
        padding: Spacing.md,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        ...Shadows.small,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    soldierInfo: {
        flex: 1,
    },
    soldierName: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.text,
        textAlign: 'right',
    },
    soldierId: {
        fontSize: 13,
        color: Colors.textLight,
        marginTop: 2,
        textAlign: 'right',
    },
    companyText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 4,
        textAlign: 'right',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    holdingIndicators: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    holdingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 3,
    },
    pillLogistics: {
        backgroundColor: '#F59E0B',
    },
    pillArmory: {
        backgroundColor: '#EF4444',
    },
    holdingPillText: {
        fontSize: 10,
        color: '#FFF',
        fontWeight: '600',
    },
    clearanceContainer: {
        marginTop: Spacing.md,
        backgroundColor: '#F9FAFB',
        padding: Spacing.sm,
        borderRadius: 12,
    },
    clearanceTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 6,
        textAlign: 'right',
    },
    clearanceBadges: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'flex-end',
    },
    clearanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    badgeSuccess: {
        backgroundColor: '#10B981',
    },
    badgePending: {
        backgroundColor: '#EF4444',
    },
    clearanceText: {
        fontSize: 11,
        color: '#FFF',
        fontWeight: '500',
    },
    cardAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    actionHint: {
        fontSize: 12,
        color: Colors.textLight,
        marginLeft: 4,
    },
});

export default ShlishutHomeScreen;
