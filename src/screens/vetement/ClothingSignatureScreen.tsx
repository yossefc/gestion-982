// Écran de signature pour le module Vêtement - Système החתמה
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { RootStackParamList } from '../../types';
import { assignmentService, soldierService, clothingEquipmentService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/colors';

type ClothingSignatureRouteProp = RouteProp<RootStackParamList, 'ClothingSignature'>;

interface EquipmentItem {
  id: string;
  name: string;
  quantity: number;
  selected: boolean;
  serial?: string;
  needsSerial?: boolean;
}

const ClothingSignatureScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ClothingSignatureRouteProp>();
  const { soldierId } = route.params;
  const { user, loading: authLoading } = useAuth();

  const signatureRef = useRef<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [soldier, setSoldier] = useState<any>(null);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    // Attendre que l'authentification soit prête avant de charger les données
    if (!authLoading && user) {
      loadData();
    } else if (!authLoading && !user) {
      // Utilisateur non connecté
      setLoading(false);
      Alert.alert('שגיאה', 'יש להתחבר כדי להמשיך');
      navigation.goBack();
    }
  }, [authLoading, user]);

  const loadData = async () => {
    try {
      // Charger soldat et équipements en parallèle
      const [soldierData, equipmentData] = await Promise.all([
        soldierService.getById(soldierId),
        clothingEquipmentService.getAll(),
      ]);

      setSoldier(soldierData);

      // Convertir les équipements Firebase en EquipmentItem
      const equipmentItems: EquipmentItem[] = equipmentData.map(eq => ({
        id: eq.id,
        name: eq.name,
        quantity: 1,
        selected: false,
        needsSerial: ['קסדה', 'וסט לוחם', 'וסט קרמי'].includes(eq.name),
      }));

      setEquipment(equipmentItems);
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בטעינת הנתונים');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Style amélioré du canvas de signature
  const webStyle = `
    .m-signature-pad {
      position: fixed;
      margin: auto;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 100%;
      box-shadow: none;
      border: 2px solid #2c5f7c;
      border-radius: 8px;
      background-color: #ffffff;
    }
    .m-signature-pad--body {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      border: none;
    }
    .m-signature-pad--body canvas {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      position: relative;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `;

  const handleBegin = () => {
    // Désactiver le scroll pendant le dessin
    setScrollEnabled(false);
  };

  const handleEnd = () => {
    // Déclencher la capture de la signature
    signatureRef.current?.readSignature();
    // Réactiver le scroll
    setScrollEnabled(true);
  };

  const handleOK = (sig: string) => {
    console.log('Signature captured:', sig ? 'Yes' : 'No');
    setSignature(sig);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setSignature(null);
  };

  const handleEmpty = () => {
    console.log('Signature pad is empty');
  };

  const toggleEquipment = (id: string) => {
    setEquipment(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateQuantity = (id: string, delta: number) => {
    setEquipment(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const updateSerial = (id: string, serial: string) => {
    setEquipment(prev =>
      prev.map(item =>
        item.id === id ? { ...item, serial } : item
      )
    );
  };

  const handleSaveAndSign = async () => {
    // Validation
    const selectedItems = equipment.filter(item => item.selected);
    if (selectedItems.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות פריט אחד');
      return;
    }

    // Vérifier que les items qui nécessitent un serial l'ont
    const missingSerials = selectedItems.filter(
      item => item.needsSerial && !item.serial
    );
    if (missingSerials.length > 0) {
      Alert.alert(
        'שגיאה',
        `אנא הזן מסטב עבור: ${missingSerials.map(i => i.name).join(', ')}`
      );
      return;
    }

    if (!signature) {
      Alert.alert('שגיאה', 'אנא חתום לפני שמירה. לחץ על "סיים חתימה" לשמור את החתימה.');
      return;
    }

    setSaving(true);
    try {
      // Préparer les items pour l'attribution
      const assignmentItems = selectedItems.map(item => ({
        equipmentId: item.id,
        equipmentName: item.name,
        quantity: item.quantity,
        serial: item.serial || undefined,
      }));

      // Créer l'attribution avec signature
      await assignmentService.create({
        soldierId,
        soldierName: soldier.name,
        soldierPersonalNumber: soldier.personalNumber,
        type: 'clothing',
        items: assignmentItems,
        signature,
        status: 'נופק לחייל',
        assignedBy: user?.id || '',
      });

      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בשמירת החתימה');
      console.error('Error saving signature:', error);
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.title}>החתמת חייל</Text>
            <Text style={styles.subtitle}>ביגוד וציוד אישי</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.modules.vetement} />
        </View>
      </View>
    );
  }

  if (!soldier) {
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
            <Text style={styles.title}>שגיאה</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>החייל לא נמצא</Text>
        </View>
      </View>
    );
  }

  if (equipment.length === 0) {
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
            <Text style={styles.title}>החתמת חייל</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>אין ציוד במערכת</Text>
          <Text style={styles.emptySubtext}>אנא הוסף ציוד דרך ניהול ציוד</Text>
          <TouchableOpacity
            style={styles.manageEquipmentButton}
            onPress={() => navigation.navigate('ClothingEquipmentManagement' as never)}
          >
            <Text style={styles.manageEquipmentText}>⚙️ ניהול ציוד</Text>
          </TouchableOpacity>
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
          disabled={saving}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>החתמת חייל</Text>
          <Text style={styles.subtitle}>ביגוד וציוד אישי</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
      >
        {/* 1. Infos Soldat */}
        <View style={styles.soldierCard}>
          <View style={styles.soldierRow}>
            <Text style={styles.soldierValue}>{soldier.name}</Text>
            <Text style={styles.soldierLabel}>שם:</Text>
          </View>
          <View style={styles.soldierRow}>
            <Text style={styles.soldierValue}>{soldier.personalNumber}</Text>
            <Text style={styles.soldierLabel}>מספר אישי:</Text>
          </View>
          <View style={styles.soldierRow}>
            <Text style={styles.soldierValue}>{soldier.company}</Text>
            <Text style={styles.soldierLabel}>פלוגה:</Text>
          </View>
          {soldier.phone && (
            <View style={styles.soldierRow}>
              <Text style={styles.soldierValue}>{soldier.phone}</Text>
              <Text style={styles.soldierLabel}>טלפון:</Text>
            </View>
          )}
        </View>

        {/* 2. Liste des équipements */}
        <Text style={styles.sectionTitle}>בחירת ציוד</Text>

        {equipment.map((item) => (
          <View key={item.id} style={styles.equipmentItem}>
            {/* Checkbox */}
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => toggleEquipment(item.id)}
            >
              {item.selected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            {/* Info + Quantité */}
            <View style={styles.equipmentMain}>
              <View style={styles.equipmentInfo}>
                <Text style={styles.equipmentName}>{item.name}</Text>
              </View>

              {/* Contrôles de quantité */}
              {item.selected && (
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, 1)}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, -1)}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Champ מסטב si nécessaire */}
            {item.selected && item.needsSerial && (
              <TextInput
                style={styles.serialInput}
                placeholder="מסטב"
                placeholderTextColor={Colors.text.light}
                value={item.serial || ''}
                onChangeText={(text) => updateSerial(item.id, text)}
                textAlign="right"
              />
            )}
          </View>
        ))}

        {/* 3. Section Signature */}
        <Text style={styles.sectionTitle}>חתימה</Text>

        {signature && (
          <View style={styles.signatureStatus}>
            <Text style={styles.signatureStatusText}>✓ החתימה נקלטה</Text>
          </View>
        )}

        <View style={styles.signatureContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleOK}
            onEmpty={handleEmpty}
            onBegin={handleBegin}
            onEnd={handleEnd}
            descriptionText="חתום כאן"
            clearText="נקה"
            confirmText="אשר"
            webStyle={webStyle}
            backgroundColor="#ffffff"
            penColor="#000000"
          />
        </View>

        <View style={styles.signatureButtons}>
          <TouchableOpacity
            style={styles.endSignatureButton}
            onPress={handleEnd}
            disabled={saving}
          >
            <Text style={styles.endSignatureText}>✓ סיים חתימה</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearSignatureButton}
            onPress={handleClear}
            disabled={saving}
          >
            <Text style={styles.clearSignatureText}>🗑️ נקה</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Bouton Sauvegarder */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveAndSign}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>💾 שמור והחתם</Text>
          )}
        </TouchableOpacity>
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
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  manageEquipmentButton: {
    backgroundColor: Colors.status.info,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    ...Shadows.small,
  },
  manageEquipmentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  soldierCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  soldierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  soldierLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  soldierValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'right',
  },
  equipmentItem: {
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.small,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.status.success,
    fontWeight: 'bold',
  },
  equipmentMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  equipmentInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.modules.vetement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    minWidth: 30,
    textAlign: 'center',
  },
  serialInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    minWidth: 100,
    marginRight: 10,
  },
  signatureStatus: {
    backgroundColor: '#d4edda',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  signatureStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#155724',
    textAlign: 'center',
  },
  signatureContainer: {
    height: 300,
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.military.navyBlue,
    marginBottom: 15,
    ...Shadows.medium,
  },
  signatureButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15,
  },
  endSignatureButton: {
    flex: 1,
    backgroundColor: Colors.status.info,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  endSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  clearSignatureButton: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.status.danger,
  },
  clearSignatureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.status.danger,
  },
  saveButton: {
    backgroundColor: Colors.status.success,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
    ...Shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
});

export default ClothingSignatureScreen;
