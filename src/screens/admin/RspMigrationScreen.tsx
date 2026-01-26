/**
 * RspMigrationScreen.tsx
 * Écran admin pour initialiser le champ isRsp sur les soldats existants
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import {
    getFirestore,
    collection,
    getDocsFromServer,
    doc,
    updateDoc,
} from 'firebase/firestore';
import { app } from '../../config/firebase';

const db = getFirestore(app);

const RspMigrationScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, message]);
    };

    const runMigration = async () => {
        setLoading(true);
        setLogs([]);
        addLog('🚀 Démarrage de la migration isRsp...');

        try {
            const soldiersRef = collection(db, 'soldiers');
            const snapshot = await getDocsFromServer(soldiersRef);

            addLog(`📊 ${snapshot.docs.length} soldats trouvés.`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const docSnapshot of snapshot.docs) {
                const data = docSnapshot.data();

                // Si le champ n'existe pas, on le met à false
                if (data.isRsp === undefined) {
                    await updateDoc(doc(db, 'soldiers', docSnapshot.id), {
                        isRsp: false
                    });
                    updatedCount++;
                } else {
                    skippedCount++;
                }

                if ((updatedCount + skippedCount) % 50 === 0) {
                    addLog(`⏳ Traitement: ${updatedCount + skippedCount}/${snapshot.docs.length}...`);
                }
            }

            addLog('✅ Migration terminée !');
            addLog(`✨ Mis à jour : ${updatedCount}`);
            addLog(`⏭️ Ignorés (déjà définis) : ${skippedCount}`);

        } catch (error: any) {
            addLog(`❌ Erreur: ${error.message}`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>→</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Migration RSP</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.title}>Initialisation isRsp</Text>
                    <Text style={styles.description}>
                        Cette action va parcourir tous les soldats et définir "isRsp: false" s'il n'est pas défini.
                        À exécuter une seule fois lors de la mise à jour.
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={runMigration}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.buttonText}>Lancer la migration</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {logs.length > 0 && (
                    <View style={styles.logsContainer}>
                        <Text style={styles.logsTitle}>Logs</Text>
                        {logs.map((log, index) => (
                            <Text key={index} style={styles.logText}>{log}</Text>
                        ))}
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
    backButtonText: {
        fontSize: 20,
        color: '#FFF',
        fontWeight: 'bold',
    },
    headerTitle: {
        flex: 1,
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
        marginRight: 40,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        ...Shadows.small,
    },
    title: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        marginBottom: Spacing.sm,
        color: Colors.text,
    },
    description: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginBottom: Spacing.xl,
        lineHeight: 20,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.md,
        width: '100%',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: FontSize.base,
    },
    logsContainer: {
        marginTop: Spacing.xl,
        backgroundColor: '#1E1E1E',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    logsTitle: {
        color: '#FFF',
        fontWeight: 'bold',
        marginBottom: Spacing.sm,
    },
    logText: {
        color: '#CCC',
        fontFamily: 'monospace',
        fontSize: 12,
        marginBottom: 4,
    },
});

export default RspMigrationScreen;
