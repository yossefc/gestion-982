// Écran de détails d'une Mana
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
import { RootStackParamList, Mana } from '../../types';
import { manaService } from '../../services/firebaseService';
import { Colors, Shadows } from '../../theme/colors';

type ManotDetailsRouteProp = RouteProp<RootStackParamList, 'ManotDetails'>;

const ManotDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ManotDetailsRouteProp>();
  const { manaId } = route.params;

  const [loading, setLoading] = useState(true);
  const [mana, setMana] = useState<Mana | null>(null);

  useEffect(() => {
    loadMana();
  }, []);

  const loadMana = async () => {
    try {
      const manaData = await manaService.getById(manaId);
      setMana(manaData);
    } catch (error) {
      console.error('Error loading mana:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת המנה');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('AddMana', { manaId });
  };

  const handleDelete = () => {
    Alert.alert(
      'מחיקת מנה',
      'האם אתה בטוח שברצונך למחוק מנה זו?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await manaService.delete(manaId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('שגיאה', 'נכשל במחיקת המנה');
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
            <Text style={styles.title}>פרטי מנה</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.arme} />
        </View>
      </View>
    );
  }

  if (!mana) {
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
            <Text style={styles.title}>מנה לא נמצאה</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>המנה לא נמצאה</Text>
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
          <Text style={styles.title}>{mana.name}</Text>
          <Text style={styles.subtitle}>📦 פרטי מנה</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Mana Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{mana.name}</Text>
            <Text style={styles.infoLabel}>שם המנה</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{mana.equipments.length}</Text>
            <Text style={styles.infoLabel}>פריטי ציוד</Text>
          </View>
        </View>

        {/* Equipment List */}
        <Text style={styles.sectionTitle}>רשימת ציוד במנה</Text>
        <View style={styles.equipmentList}>
          {mana.equipments.map((eq, index) => (
            <View key={index} style={styles.equipmentCard}>
              <View style={styles.equipmentIcon}>
                <Text style={styles.equipmentIconText}>🔫</Text>
              </View>
              <View style={styles.equipmentInfo}>
                <Text style={styles.equipmentName}>{eq.equipmentName}</Text>
                <Text style={styles.equipmentId}>מזהה: {eq.equipmentId}</Text>
              </View>
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>{eq.quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
          >
            <Text style={styles.actionButtonText}>✏️ ערוך מנה</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>🗑️ מחק מנה</Text>
          </TouchableOpacity>
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
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  infoCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    textAlign: 'right',
  },
  equipmentList: {
    gap: 12,
    marginBottom: 20,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  equipmentIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.modules.arme,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  equipmentIconText: {
    fontSize: 24,
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  equipmentId: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  quantityBadge: {
    backgroundColor: Colors.modules.arme,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.small,
  },
  editButton: {
    backgroundColor: Colors.status.info,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  deleteButton: {
    backgroundColor: Colors.background.card,
    borderWidth: 2,
    borderColor: Colors.status.danger,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.status.danger,
  },
});

export default ManotDetailsScreen;
