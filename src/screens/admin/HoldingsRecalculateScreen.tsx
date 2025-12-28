// Écran admin pour recalculer les holdings depuis assignments
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { soldierService, holdingsService } from '../../services/firebaseService';
import { Colors, Shadows } from '../../theme/colors';

interface RecalculateProgress {
  total: number;
  current: number;
  soldierName: string;
  type: 'combat' | 'clothing';
}

const HoldingsRecalculateScreen: React.FC = () => {
  const navigation = useNavigation();

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<RecalculateProgress | null>(null);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);

  const recalculateAllHoldings = async () => {
    Alert.alert(
      'אישור',
      'האם אתה בטוח שברצונך לחשב מחדש את כל ה-holdings? פעולה זו עלולה לקחת זמן.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'המשך',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            setResults(null);

            let successCount = 0;
            let failedCount = 0;

            try {
              // Récupérer tous les soldats
              const soldiers = await soldierService.getAll();
              const total = soldiers.length * 2; // 2 types par soldat

              let current = 0;

              for (const soldier of soldiers) {
                for (const type of ['combat', 'clothing'] as const) {
                  current++;

                  setProgress({
                    total,
                    current,
                    soldierName: soldier.name,
                    type,
                  });

                  try {
                    // Calculer holdings depuis assignments
                    const holdings = await holdingsService.calculateHoldingsFromAssignments(
                      soldier.id,
                      type
                    );

                    // Sauvegarder seulement si des items existent
                    if (holdings.items.length > 0) {
                      await holdingsService.updateHoldings(holdings);
                      console.log(
                        `Holdings updated for ${soldier.name} (${type}): ${holdings.items.length} items`
                      );
                    }

                    successCount++;
                  } catch (error) {
                    console.error(
                      `Error recalculating holdings for ${soldier.name} (${type}):`,
                      error
                    );
                    failedCount++;
                  }

                  // Petit délai pour ne pas surcharger Firestore
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }

              setResults({
                success: successCount,
                failed: failedCount,
                total,
              });

              Alert.alert(
                'הושלם',
                `הושלם בהצלחה!\n\nהצלחות: ${successCount}\nכשלונות: ${failedCount}\nסה"כ: ${total}`
              );
            } catch (error) {
              console.error('Error in recalculate all holdings:', error);
              Alert.alert('שגיאה', 'נכשל בחישוב מחדש של holdings');
            } finally {
              setProcessing(false);
              setProgress(null);
            }
          },
        },
      ]
    );
  };

  const recalculateSoldierHoldings = async (type: 'combat' | 'clothing') => {
    Alert.alert(
      'בחר חייל',
      'פונקציונליות זו תתווסף בגרסה הבאה.\n\nכרגע אפשר רק לחשב מחדש עבור כל החיילים.',
      [{ text: 'אישור' }]
    );
  };

  const clearAllHoldings = async () => {
    Alert.alert(
      'אזהרה!',
      'האם אתה בטוח שברצונך למחוק את כל ה-holdings? פעולה זו לא ניתנת לביטול!',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'שגיאה',
              'פונקציונליות זו מושבתת למניעת מחיקה בטעות.\n\nאם נדרש, השתמש ב-Firestore Console.'
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={processing}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>חישוב מחדש Holdings</Text>
          <Text style={styles.subtitle}>🔧 כלי ניהול</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ מידע</Text>
          <Text style={styles.infoText}>
            כלי זה מחשב מחדש את ה-holdings (ציוד פעיל) של כל החיילים על ידי ניתוח
            כל ה-assignments.{'\n\n'}
            השתמש בכלי זה אם:{'\n'}
            • Holdings לא מדויקים{'\n'}
            • אחרי מיגרציה או שינוי במבנה{'\n'}
            • Holdings חסרים לחיילים ישנים
          </Text>
        </View>

        {/* Progress Card */}
        {progress && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>מעבד...</Text>
            <Text style={styles.progressText}>
              {progress.current} / {progress.total}
            </Text>
            <Text style={styles.progressSoldier}>
              {progress.soldierName} ({progress.type})
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(progress.current / progress.total) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Results Card */}
        {results && !processing && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>✓ הסתיים</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>הצלחות:</Text>
              <Text style={[styles.resultValue, styles.resultSuccess]}>
                {results.success}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>כשלונות:</Text>
              <Text style={[styles.resultValue, styles.resultFailed]}>
                {results.failed}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>סה"כ:</Text>
              <Text style={styles.resultValue}>{results.total}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>פעולות</Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.primaryAction,
              processing && styles.actionButtonDisabled,
            ]}
            onPress={recalculateAllHoldings}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.actionButtonIcon}>🔄</Text>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>
                    חשב מחדש עבור כל החיילים
                  </Text>
                  <Text style={styles.actionButtonSubtitle}>
                    ניתוח כל ה-assignments ועדכון holdings
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryAction,
              processing && styles.actionButtonDisabled,
            ]}
            onPress={() => recalculateSoldierHoldings('clothing')}
            disabled={processing}
          >
            <Text style={styles.actionButtonIcon}>👕</Text>
            <View style={styles.actionButtonContent}>
              <Text style={[styles.actionButtonTitle, styles.secondaryText]}>
                חשב מחדש ביגוד לחייל ספציפי
              </Text>
              <Text style={[styles.actionButtonSubtitle, styles.secondaryText]}>
                (בקרוב)
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryAction,
              processing && styles.actionButtonDisabled,
            ]}
            onPress={() => recalculateSoldierHoldings('combat')}
            disabled={processing}
          >
            <Text style={styles.actionButtonIcon}>🔫</Text>
            <View style={styles.actionButtonContent}>
              <Text style={[styles.actionButtonTitle, styles.secondaryText]}>
                חשב מחדש ציוד לחימה לחייל ספציפי
              </Text>
              <Text style={[styles.actionButtonSubtitle, styles.secondaryText]}>
                (בקרוב)
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>⚠️ אזור מסוכן</Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.dangerAction,
              processing && styles.actionButtonDisabled,
            ]}
            onPress={clearAllHoldings}
            disabled={processing}
          >
            <Text style={styles.actionButtonIcon}>🗑️</Text>
            <View style={styles.actionButtonContent}>
              <Text style={[styles.actionButtonTitle, styles.dangerText]}>
                מחק את כל ה-Holdings
              </Text>
              <Text style={[styles.actionButtonSubtitle, styles.dangerText]}>
                (מושבת למניעת מחיקה בטעות)
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 סטטיסטיקות</Text>
          <Text style={styles.statsText}>
            Holdings מחושבים מ-Assignments עם action:{'\n'}
            • issue / add → הוספה לציוד פעיל{'\n'}
            • credit / return → הסרה מציוד פעיל{'\n\n'}
            Assignments עם status "לא חתום" מתעלמים.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    backgroundColor: Colors.background.header,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...Shadows.medium,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    color: Colors.text.white,
  },
  headerContent: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b3d9f2',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  infoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: 'right',
  },
  progressCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.status.info,
    ...Shadows.small,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.status.info,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressSoldier: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.status.info,
    borderRadius: 4,
  },
  resultsCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.status.success,
    ...Shadows.small,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.status.success,
    marginBottom: 16,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  resultLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  resultSuccess: {
    color: Colors.status.success,
  },
  resultFailed: {
    color: Colors.status.danger,
  },
  actionsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Shadows.small,
  },
  primaryAction: {
    backgroundColor: Colors.status.info,
  },
  secondaryAction: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.dark,
  },
  dangerAction: {
    backgroundColor: Colors.background.card,
    borderWidth: 2,
    borderColor: Colors.status.danger,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonIcon: {
    fontSize: 32,
    marginLeft: 12,
  },
  actionButtonContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 4,
    textAlign: 'right',
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  secondaryText: {
    color: Colors.text.primary,
  },
  dangerText: {
    color: Colors.status.danger,
  },
  dangerSection: {
    marginBottom: 30,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.status.danger,
    marginBottom: 15,
    textAlign: 'right',
  },
  statsCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'right',
  },
  statsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: 'right',
  },
});

export default HoldingsRecalculateScreen;
