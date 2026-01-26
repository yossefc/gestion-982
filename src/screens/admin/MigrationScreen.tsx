/**
 * MigrationScreen.tsx
 * Écran admin pour exécuter les migrations Firestore de manière sécurisée
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import {
  getFirestore,
  collection,
  getDocs,
  getDocsFromServer,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { app } from '../../config/firebase';
import { transactionalAssignmentService } from '../../services/transactionalAssignmentService';

const db = getFirestore(app);

interface MigrationResult {
  type: 'success' | 'error' | 'info';
  message: string;
}

const MigrationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);

  const normalizeText = (text: string): string => {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const addResult = (type: 'success' | 'error' | 'info', message: string) => {
    setResults(prev => [...prev, { type, message }]);
  };

  // Migration 1: Ajouter nameKey aux équipements existants
  const migrateAddNameKeys = async () => {
    setLoading(true);
    setResults([]);
    addResult('info', '🔄 Démarrage migration nameKey...');

    try {
      // Clothing Equipment
      addResult('info', '📦 Traitement clothingEquipment...');
      const clothingSnapshot = await getDocsFromServer(collection(db, 'clothingEquipment'));
      let updatedClothing = 0;

      for (const docSnapshot of clothingSnapshot.docs) {
        const data = docSnapshot.data();
        if (!data.nameKey) {
          const nameKey = normalizeText(data.name);
          await setDoc(doc(db, 'clothingEquipment', docSnapshot.id), {
            ...data,
            nameKey,
          });
          updatedClothing++;
        }
      }
      addResult('success', `✅ clothingEquipment: ${updatedClothing} items mis à jour`);

      // Combat Equipment
      addResult('info', '📦 Traitement combatEquipment...');
      const combatSnapshot = await getDocsFromServer(collection(db, 'combatEquipment'));
      let updatedCombat = 0;

      for (const docSnapshot of combatSnapshot.docs) {
        const data = docSnapshot.data();
        if (!data.nameKey || !data.categoryKey) {
          const nameKey = normalizeText(data.name);
          const categoryKey = normalizeText(data.category);
          await setDoc(doc(db, 'combatEquipment', docSnapshot.id), {
            ...data,
            nameKey,
            categoryKey,
          });
          updatedCombat++;
        }
      }
      addResult('success', `✅ combatEquipment: ${updatedCombat} items mis à jour`);

      addResult('success', '🎉 Migration nameKey terminée avec succès!');
    } catch (error: any) {
      addResult('error', `❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Migration 2: Détecter les doublons
  const detectDuplicates = async () => {
    setLoading(true);
    setResults([]);
    addResult('info', '🔍 Détection des doublons...');

    try {
      // Clothing Equipment
      const clothingSnapshot = await getDocsFromServer(collection(db, 'clothingEquipment'));
      const clothingMap = new Map<string, any[]>();

      clothingSnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const nameKey = data.nameKey || normalizeText(data.name);
        if (!clothingMap.has(nameKey)) {
          clothingMap.set(nameKey, []);
        }
        clothingMap.get(nameKey)!.push({ id: docSnapshot.id, ...data });
      });

      let clothingDuplicates = 0;
      clothingMap.forEach((items, nameKey) => {
        if (items.length > 1) {
          clothingDuplicates++;
          addResult('error', `⚠️ Doublon clothingEquipment: "${items[0].name}" (${items.length} instances)`);
          items.forEach((item, idx) => {
            addResult('info', `   [${idx}] ID: ${item.id}`);
          });
        }
      });

      if (clothingDuplicates === 0) {
        addResult('success', '✅ Aucun doublon dans clothingEquipment');
      }

      // Combat Equipment
      const combatSnapshot = await getDocsFromServer(collection(db, 'combatEquipment'));
      const combatMap = new Map<string, any[]>();

      combatSnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const nameKey = data.nameKey || normalizeText(data.name);
        const categoryKey = data.categoryKey || normalizeText(data.category);
        const compositeKey = `${nameKey}_${categoryKey}`;

        if (!combatMap.has(compositeKey)) {
          combatMap.set(compositeKey, []);
        }
        combatMap.get(compositeKey)!.push({ id: docSnapshot.id, ...data });
      });

      let combatDuplicates = 0;
      combatMap.forEach((items, compositeKey) => {
        if (items.length > 1) {
          combatDuplicates++;
          addResult('error', `⚠️ Doublon combatEquipment: "${items[0].name}" (${items[0].category}) - ${items.length} instances`);
          items.forEach((item, idx) => {
            addResult('info', `   [${idx}] ID: ${item.id}`);
          });
        }
      });

      if (combatDuplicates === 0) {
        addResult('success', '✅ Aucun doublon dans combatEquipment');
      }

      addResult('success', `🎉 Détection terminée: ${clothingDuplicates + combatDuplicates} doublons trouvés`);
    } catch (error: any) {
      addResult('error', `❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Migration 3: Recalculer les holdings d'un soldat
  const recalculateHoldingsForOne = () => {
    Alert.prompt(
      'Recalculer Holdings',
      'Entrez l\'ID du soldat:',
      async (soldierId: string) => {
        if (!soldierId.trim()) return;

        setLoading(true);
        setResults([]);
        addResult('info', `🔄 Recalcul holdings pour soldat ${soldierId}...`);

        try {
          for (const type of ['combat', 'clothing'] as const) {
            // Récupérer tous les assignments du soldat
            const assignmentsQuery = query(
              collection(db, 'assignments'),
              where('soldierId', '==', soldierId.trim()),
              where('type', '==', type)
            );

            const snapshot = await getDocs(assignmentsQuery);
            const holdings = new Map<string, any>();

            snapshot.docs.forEach(docSnapshot => {
              const assignment = docSnapshot.data();
              const action = assignment.action;

              (assignment.items || []).forEach((item: any) => {
                const key = item.equipmentId;
                const current = holdings.get(key) || {
                  equipmentId: item.equipmentId,
                  equipmentName: item.equipmentName,
                  quantity: 0,
                };

                if (action === 'issue' || action === 'add' || action === 'retrieve') {
                  current.quantity += item.quantity;
                } else if (action === 'return' || action === 'credit' || action === 'storage') {
                  current.quantity -= item.quantity;
                }

                if (current.quantity > 0) {
                  holdings.set(key, current);
                } else {
                  holdings.delete(key);
                }
              });
            });

            const holdingsArray = Array.from(holdings.values());
            const outstandingCount = holdingsArray.reduce((sum, item) => sum + item.quantity, 0);

            // Mettre à jour soldier_holdings
            const holdingId = `${soldierId.trim()}_${type}`;
            if (holdingsArray.length > 0) {
              await setDoc(doc(db, 'soldier_holdings', holdingId), {
                soldierId: soldierId.trim(),
                type,
                items: holdingsArray,
                outstandingCount,
                status: 'OPEN',
                lastUpdated: Timestamp.now(),
              });
              addResult('success', `✅ ${type}: ${outstandingCount} items`);
            } else {
              addResult('info', `ℹ️ ${type}: Aucun item`);
            }
          }

          addResult('success', '🎉 Recalcul terminé!');
        } catch (error: any) {
          addResult('error', `❌ Erreur: ${error.message}`);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Migration 4: Recalculer tous les holdings (Global)
  const runGlobalRecalculate = async () => {
    Alert.alert(
      'Recalcul Global',
      'Ceci va recalculer les holdings de TOUS les soldats depuis leur historique d\'assignments. Continuer?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: async () => {
            setLoading(true);
            setResults([]);
            addResult('info', '🚀 Démarrage du recalcul global...');

            try {
              const { success, errors } = await transactionalAssignmentService.recalculateAllSoldiersHoldings(
                (current, total) => {
                  if (current % 10 === 0 || current === total) {
                    console.log(`Progress: ${current}/${total}`);
                  }
                }
              );

              addResult('success', `✅ Recalcul terminé: ${success} succès, ${errors} erreurs.`);
              Alert.alert('הצלחה', 'Recalcul global terminé!');
            } catch (error: any) {
              addResult('error', `❌ Erreur globale: ${error.message}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Migrations Firestore</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions de Migration</Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={migrateAddNameKeys}
            disabled={loading}
          >
            <Text style={styles.buttonText}>1. Ajouter nameKey aux équipements</Text>
            <Text style={styles.buttonSubtext}>Ajoute nameKey/categoryKey si manquant</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={detectDuplicates}
            disabled={loading}
          >
            <Text style={styles.buttonText}>2. Détecter les doublons</Text>
            <Text style={styles.buttonSubtext}>Trouve les équipements en double</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={recalculateHoldingsForOne}
            disabled={loading}
          >
            <Text style={styles.buttonText}>3. Recalculer holdings (1 soldat)</Text>
            <Text style={styles.buttonSubtext}>Recalcule depuis assignments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger, loading && styles.buttonDisabled]}
            onPress={runGlobalRecalculate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>4. Recalcul Global (TOUS les soldats)</Text>
            <Text style={styles.buttonSubtext}>Synchronise soldier_holdings avec l'historique</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résultats</Text>
            <View style={styles.resultsContainer}>
              {results.map((result, index) => (
                <View
                  key={index}
                  style={[
                    styles.resultItem,
                    result.type === 'error' && styles.resultError,
                    result.type === 'success' && styles.resultSuccess,
                  ]}
                >
                  <Text style={styles.resultText}>{result.message}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Migration en cours...</Text>
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
    color: Colors.textWhite,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonDanger: {
    backgroundColor: Colors.danger,
  },
  buttonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.textWhite,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  buttonSubtext: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  resultsContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultItem: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultError: {
    backgroundColor: Colors.dangerLight,
  },
  resultSuccess: {
    backgroundColor: Colors.successLight,
  },
  resultText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
});

export default MigrationScreen;
