// Écran de retour d'équipement (זיכוי חייל)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, Assignment, Soldier } from '../../types';
import { assignmentService, soldierService } from '../../services/firebaseService';
import { Colors, Shadows } from '../../theme/colors';

type ClothingReturnRouteProp = RouteProp<RootStackParamList, 'ClothingReturn'>;

const ClothingReturnScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ClothingReturnRouteProp>();
  const { soldierId } = route.params;

  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [soldierData, assignmentsData] = await Promise.all([
        soldierService.getById(soldierId),
        assignmentService.getBySoldier(soldierId),
      ]);

      setSoldier(soldierData);
      // Filtrer seulement les attributions actives (non retournées)
      const activeAssignments = assignmentsData.filter(
        a => a.type === 'clothing' && a.status === 'נופק לחייל'
      );
      setAssignments(activeAssignments);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignment = (assignmentId: string) => {
    setSelectedAssignments(prev =>
      prev.includes(assignmentId)
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  const handleReturnEquipment = async () => {
    if (selectedAssignments.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד לזיכוי');
      return;
    }

    Alert.alert(
      'זיכוי ציוד',
      `האם אתה בטוח שברצונך לזכות ${selectedAssignments.length} פריטים?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: async () => {
            setProcessing(true);
            try {
              // Mettre à jour chaque attribution sélectionnée
              await Promise.all(
                selectedAssignments.map(id =>
                  assignmentService.update(id, { status: 'זוכה' })
                )
              );

              Alert.alert('הצלחה', 'הציוד זוכה בהצלחה', [
                {
                  text: 'אישור',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              Alert.alert('שגיאה', 'נכשל בזיכוי הציוד');
              console.error('Error returning equipment:', error);
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>זיכוי חייל</Text>
            <Text style={styles.subtitle}>החזרת ציוד</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.vetement} />
        </View>
      </View>
    );
  }

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
          <Text style={styles.title}>זיכוי חייל</Text>
          <Text style={styles.subtitle}>↩️ החזרת ציוד</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Soldier Info */}
        {soldier && (
          <View style={styles.soldierCard}>
            <View style={styles.soldierInfo}>
              <Text style={styles.soldierName}>{soldier.name}</Text>
              <Text style={styles.soldierMeta}>
                {soldier.personalNumber} • {soldier.company}
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 הנחיות</Text>
          <Text style={styles.instructionsText}>
            • בחר את הפריטים שהחייל מחזיר{'\n'}
            • בדוק את מצב הציוד לפני זיכוי{'\n'}
            • לאחר אישור, הסטטוס ישתנה ל"זוכה"
          </Text>
        </View>

        {/* Assignments List */}
        <Text style={styles.sectionTitle}>
          ציוד פעיל ({assignments.length})
        </Text>

        {assignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין ציוד פעיל לזיכוי</Text>
            <Text style={styles.emptySubtext}>
              החייל לא קיבל ציוד או כל הציוד כבר זוכה
            </Text>
          </View>
        ) : (
          <View style={styles.assignmentsList}>
            {assignments.map(assignment => (
              <TouchableOpacity
                key={assignment.id}
                style={[
                  styles.assignmentCard,
                  selectedAssignments.includes(assignment.id) &&
                    styles.assignmentCardSelected,
                ]}
                onPress={() => toggleAssignment(assignment.id)}
                disabled={processing}
              >
                <View style={styles.checkbox}>
                  {selectedAssignments.includes(assignment.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentDate}>
                    {assignment.timestamp.toLocaleDateString('he-IL')}
                  </Text>
                  <View style={styles.itemsList}>
                    {assignment.items.map((item, idx) => (
                      <Text key={idx} style={styles.itemText}>
                        • {item.equipmentName} ({item.quantity})
                      </Text>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action Button */}
        {assignments.length > 0 && (
          <TouchableOpacity
            style={[
              styles.returnButton,
              (selectedAssignments.length === 0 || processing) &&
                styles.buttonDisabled,
            ]}
            onPress={handleReturnEquipment}
            disabled={selectedAssignments.length === 0 || processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.returnButtonText}>
                  ↩️ זכה {selectedAssignments.length > 0 && `(${selectedAssignments.length})`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldierCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  soldierInfo: {
    alignItems: 'flex-end',
  },
  soldierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  soldierMeta: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  instructionsCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b3d9f2',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  assignmentsList: {
    gap: 12,
    marginBottom: 20,
  },
  assignmentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  assignmentCardSelected: {
    borderColor: Colors.status.success,
    backgroundColor: '#f0fdf4',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border.dark,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 18,
    color: Colors.status.success,
    fontWeight: 'bold',
  },
  assignmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  assignmentDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  itemsList: {
    gap: 4,
  },
  itemText: {
    fontSize: 15,
    color: Colors.text.primary,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  returnButton: {
    backgroundColor: Colors.status.warning,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
    ...Shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  returnButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
});

export default ClothingReturnScreen;
