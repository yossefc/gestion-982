// Écran de liste des Manot (מנות) pour le module Arme
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
import { useNavigation } from '@react-navigation/native';
import { Mana } from '../../types';
import { Colors, Shadows } from '../../theme/colors';
import { getAllManot, addMana, deleteMana, DEFAULT_MANOT } from '../../services/equipmentService';

const ManotListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [manot, setManot] = useState<Mana[]>([]);

  useEffect(() => {
    loadManot();
  }, []);

  const loadManot = async () => {
    try {
      const data = await getAllManot();

      // Si aucune מנה n'existe, proposer d'initialiser les données par défaut
      if (data.length === 0) {
        Alert.alert(
          'אין מנות במערכת',
          'האם ברצונך להוסיף מנות ברירת מחדל?',
          [
            { text: 'לא', style: 'cancel' },
            {
              text: 'כן',
              onPress: async () => {
                try {
                  for (const mana of DEFAULT_MANOT) {
                    await addMana(mana);
                  }
                  loadManot(); // Recharger après ajout
                } catch (error) {
                  console.error('Error adding default manot:', error);
                  Alert.alert('שגיאה', 'נכשל בהוספת מנות ברירת מחדל');
                }
              },
            },
          ]
        );
      }

      setManot(data);
    } catch (error) {
      console.error('Error loading manot:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת המנות');
    } finally {
      setLoading(false);
    }
  };

  const handleManaPress = (manaId: string) => {
    navigation.navigate('ManotDetails', { manaId });
  };

  const handleAddMana = () => {
    Alert.alert('בקרוב', 'תכונה זו תהיה זמינה בקרוב');
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
            <Text style={styles.title}>ניהול מנות</Text>
            <Text style={styles.subtitle}>מנת מפקד, מנת לוחם</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.arme} />
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
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>ניהול מנות</Text>
          <Text style={styles.subtitle}>📦 {manot.length} מנות פעילות</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#e74c3c' }]}>
            <Text style={styles.statNumber}>{manot.length}</Text>
            <Text style={styles.statLabel}>מנות</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#27ae60' }]}>
            <Text style={styles.statNumber}>
              {manot.reduce((sum, m) => sum + m.equipments.length, 0)}
            </Text>
            <Text style={styles.statLabel}>פריטי ציוד</Text>
          </View>
        </View>

        {/* Add Mana Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddMana}>
          <Text style={styles.addButtonText}>+ הוסף מנה חדשה</Text>
        </TouchableOpacity>

        {/* Manot List */}
        <Text style={styles.sectionTitle}>רשימת מנות</Text>
        <View style={styles.manotList}>
          {manot.map((mana) => (
            <TouchableOpacity
              key={mana.id}
              style={styles.manaCard}
              onPress={() => handleManaPress(mana.id)}
            >
              <View style={styles.manaIcon}>
                <Text style={styles.manaIconText}>📦</Text>
              </View>
              <View style={styles.manaInfo}>
                <Text style={styles.manaName}>{mana.name}</Text>
                <Text style={styles.manaDetails}>
                  {mana.equipments.length} פריטי ציוד
                </Text>
                <View style={styles.equipmentPreview}>
                  {mana.equipments.slice(0, 2).map((eq, idx) => (
                    <Text key={idx} style={styles.equipmentPreviewText}>
                      • {eq.equipmentName} ({eq.quantity})
                    </Text>
                  ))}
                  {mana.equipments.length > 2 && (
                    <Text style={styles.equipmentPreviewText}>
                      ועוד {mana.equipments.length - 2}...
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {manot.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין מנות במערכת</Text>
            <Text style={styles.emptySubtext}>לחץ על "הוסף מנה חדשה" להתחיל</Text>
          </View>
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
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.small,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.small,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  manotList: {
    gap: 12,
  },
  manaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  manaIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.modules.arme,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  manaIconText: {
    fontSize: 24,
  },
  manaInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  manaName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  manaDetails: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  equipmentPreview: {
    alignItems: 'flex-end',
  },
  equipmentPreviewText: {
    fontSize: 12,
    color: Colors.status.info,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: Colors.military.navyBlue,
    marginRight: 5,
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
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
});

export default ManotListScreen;
