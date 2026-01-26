/**
 * RspHomeScreen.tsx
 * Menu principal pour la gestion des רס"פים (RSP)
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';

const RspHomeScreen: React.FC = () => {
    const navigation = useNavigation<any>();

    const handleShareLink = async () => {
        try {
            // Pour l'instant, on partage juste un message placeholder
            // Dans le futur, cela pourrait être un deep link ou un lien web
            await Share.share({
                message: 'Lien de consultation רס"פים: [Lien à implémenter]',
                title: 'Lien רס"פים',
            });
        } catch (error) {
            console.error(error);
        }
    };

    const menuItems = [
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
            action: () => navigation.navigate('RspReadOnly'), // Ou handleShareLink directement
        },
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
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
                <View style={styles.menuContainer}>
                    {menuItems.map((item) => (
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
        backgroundColor: Colors.primary, // Ou une couleur spécifique pour RSP ?
        paddingTop: 50,
        paddingBottom: 24,
        paddingHorizontal: Spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        ...Shadows.medium,
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
        alignItems: 'flex-end', // RTL
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
        textAlign: 'right', // RTL
    },
});

export default RspHomeScreen;
