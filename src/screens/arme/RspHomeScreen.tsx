/**
 * RspHomeScreen.tsx
 * Menu principal — deux vues selon le rôle :
 *   • RSP  → 4 raccourcis personnels (tickets + dashboard + tableau)
 *   • Admin → menu complet de gestion רס"פים
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';

const TICKET_COLOR = Colors.warning;

const RspHomeScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user, signOut } = useAuth();

    const isAdmin = user?.role === 'admin';
    const isRsp   = user?.role === 'rsp';

    const handleLogout = () => {
        Alert.alert('יציאה', 'האם אתה בטוח שברצונך להתנתק?', [
            { text: 'ביטול', style: 'cancel' },
            { text: 'התנתק', style: 'destructive', onPress: () => signOut() },
        ]);
    };

    // ─── תפריט לרס"פ (4 פריטים בלבד) ────────────────────────────────────
    const rspMenuItems = [
        {
            id: 'ticket_inbox',
            title: 'תיבת בקשות / תקלות',
            subtitle: 'צפייה וטיפול בדיווחים שנשלחו אליך',
            icon: 'mail',
            color: TICKET_COLOR,
            action: () => navigation.navigate('TicketInbox'),
        },
        {
            id: 'ticket_form',
            title: 'דיווח תקלה / בקשה',
            subtitle: 'הגש דיווח חדש למחסן / לאחראי',
            icon: 'alert-circle',
            color: Colors.danger,
            action: () => navigation.navigate('TicketForm'),
        },
        {
            id: 'dashboard',
            title: 'דשבורד הפלוגה',
            subtitle: 'צפייה בציוד חיילי הפלוגה שלך',
            icon: 'eye',
            color: Colors.primary,
            action: () => navigation.navigate('RspDashboard', {}),
        },
        {
            id: 'table',
            title: 'טבלת רס"פים לפי פלוגה',
            subtitle: 'סקירת כל רס"פי הפלוגה וציודם',
            icon: 'grid',
            color: Colors.info,
            action: () => navigation.navigate('RspTable'),
        },
    ];

    // ─── Menu complet Admin ───────────────────────────────────────────────
    const adminMenuItems = [
        {
            id: 'dashboard',
            title: 'דאשבורד רס"פ',
            subtitle: 'צפייה בציוד חיילי פלוגה',
            icon: 'eye',
            color: Colors.warning,
            action: () => navigation.navigate('RspDashboard', {}),
        },
        {
            id: 'equipment',
            title: 'ציוד רס"פ',
            subtitle: 'ניהול פריטי ציוד רס"פ',
            icon: 'cube',
            color: Colors.primary,
            action: () => navigation.navigate('RspEquipment'),
        },
        {
            id: 'assignment',
            title: 'החתמת רס"פ',
            subtitle: 'הוצאת ציוד לרס"פ',
            icon: 'pencil',
            color: Colors.success,
            action: () => navigation.navigate('SoldierSearch', { mode: 'rsp_issue' }),
        },
        {
            id: 'return',
            title: 'זיכוי רס"פ',
            subtitle: 'החזרת ציוד מהרס"פ',
            icon: 'return-down-back',
            color: Colors.warning,
            action: () => navigation.navigate('SoldierSearch', { mode: 'rsp_credit' }),
        },
        {
            id: 'table',
            title: 'טבלת רס"פים',
            subtitle: 'צפייה בחתכים ודוחות',
            icon: 'grid',
            color: Colors.info,
            action: () => navigation.navigate('RspTable'),
        },
        {
            id: 'link',
            title: 'קישור צפייה',
            subtitle: 'שיתוף קישור לרס"פים',
            icon: 'link',
            color: '#9C27B0',
            action: () => navigation.navigate('RspReadOnly'),
        },
    ];

    const adminTicketItems = [
        {
            id: 'ticket_inbox',
            title: 'תיבת בקשות / תקלות',
            subtitle: 'צפייה וטיפול בדיווחים שנשלחו אליך',
            icon: 'mail',
            color: TICKET_COLOR,
            action: () => navigation.navigate('TicketInbox'),
        },
        {
            id: 'ticket_form',
            title: 'דיווח תקלה / בקשה',
            subtitle: 'הגש דיווח חדש למחסן / לאחראי',
            icon: 'alert-circle',
            color: Colors.danger,
            action: () => navigation.navigate('TicketForm'),
        },
        {
            id: 'ticket_admin',
            title: 'הגדרות מערכת דיווח',
            subtitle: 'ניהול מוצבים וסוגי תקלות',
            icon: 'settings',
            color: Colors.accent,
            action: () => navigation.navigate('TicketAdmin'),
        },
    ];

    // ─── RSP VIEW ─────────────────────────────────────────────────────────
    if (isRsp) {
        return (
            <View style={styles.container}>
                {/* Header RSP — bouton logout à gauche */}
                <View style={[styles.header, styles.headerRsp]}>
                    <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>שלום, {user?.name || 'רס"פ'}</Text>
                        <Text style={styles.headerSubtitle}>מה תרצה לעשות היום?</Text>
                    </View>
                    <View style={styles.headerIcon}>
                        <Ionicons name="person-circle" size={28} color="#FFF" />
                    </View>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.menuContainer}>
                        {rspMenuItems.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.menuCard, { borderRightWidth: 4, borderRightColor: item.color }]}
                                onPress={item.action}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                                    <Ionicons name={item.icon as any} size={28} color={item.color} />
                                </View>
                                <View style={styles.menuInfo}>
                                    <Text style={styles.menuTitle}>{item.title}</Text>
                                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                </View>
                                <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    }

    // ─── ADMIN VIEW ───────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header Admin — bouton retour */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>ניהול רס"פים</Text>
                    <Text style={styles.headerSubtitle}>מערכת ניהול לוגיסטיקה פלוגתית</Text>
                </View>
                <View style={styles.headerIcon}>
                    <Ionicons name="construct" size={24} color="#FFF" />
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>

                {/* Section principale */}
                <View style={styles.menuContainer}>
                    {adminMenuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.menuCard}
                            onPress={item.action}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                                <Ionicons name={item.icon as any} size={28} color={item.color} />
                            </View>
                            <View style={styles.menuInfo}>
                                <Text style={styles.menuTitle}>{item.title}</Text>
                                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                            </View>
                            <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Section Ticketing */}
                <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <View style={styles.sectionDividerLabel}>
                        <Ionicons name="construct-outline" size={14} color={TICKET_COLOR} />
                        <Text style={styles.sectionDividerText}>בקשות ותקלות</Text>
                    </View>
                    <View style={styles.sectionDividerLine} />
                </View>

                <View style={[styles.menuContainer, styles.ticketSection]}>
                    {adminTicketItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.menuCard, styles.ticketCard]}
                            onPress={item.action}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                                <Ionicons name={item.icon as any} size={26} color={item.color} />
                            </View>
                            <View style={styles.menuInfo}>
                                <Text style={styles.menuTitle}>{item.title}</Text>
                                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                            </View>
                            <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={24} color="#F57F17" />
                    <Text style={styles.infoText}>
                        שים לב: ציוד רס"פים מנוהל בנפרד מהמלאי הכללי של הגדוד.
                    </Text>
                </View>
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
        paddingBottom: 24,
        paddingHorizontal: Spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        ...Shadows.medium,
    },
    headerRsp: {
        backgroundColor: '#F59E0B', // Orange for RSP identity
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.full,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: '#FFF',
    },
    headerSubtitle: {
        fontSize: FontSize.xs,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    headerIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: Spacing.lg,
    },
    menuContainer: {
        gap: Spacing.md,
    },
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.small,
    },
    menuIcon: {
        width: 50,
        height: 50,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.md,
    },
    menuInfo: {
        flex: 1,
        alignItems: 'flex-end',
    },
    menuTitle: {
        fontSize: FontSize.base,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
    },
    menuSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    infoCard: {
        marginTop: Spacing.xl,
        backgroundColor: '#FFF8E1',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: '#FFE082',
    },
    infoText: {
        flex: 1,
        color: '#F57F17',
        fontSize: FontSize.sm,
        textAlign: 'right',
    },
    sectionDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    sectionDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    sectionDividerLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.warningLight,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderWidth: 1,
        borderColor: Colors.warning + '40',
    },
    sectionDividerText: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: Colors.warningDark,
    },
    ticketSection: {
        marginTop: 0,
    },
    ticketCard: {
        borderLeftWidth: 3,
        borderLeftColor: TICKET_COLOR,
    },
});

export default RspHomeScreen;
