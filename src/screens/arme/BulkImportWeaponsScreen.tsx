// Écran d'import en masse de numéros de série depuis Excel
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { AppModal, ModalType } from '../../components';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { combatEquipmentService } from '../../services/firebaseService';

interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
}

const BulkImportWeaponsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [category, setCategory] = useState('');
  const [fileName, setFileName] = useState('');
  const [serials, setSerials] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // AppModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  // Charger les catégories depuis l'équipement de combat qui nécessite un מסטב
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const equipmentList = await combatEquipmentService.getAll();
      // Filtrer seulement les équipements qui nécessitent un מסטב
      const serialEquipment = equipmentList.filter((eq: any) => eq.requiresSerial === true);
      const categoryNames = serialEquipment.map((eq: any) => eq.name);
      // Ajouter "אחר" à la fin pour permettre une catégorie personnalisée
      setCategories([...categoryNames, 'אחר']);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback - catégories par défaut si erreur
      setCategories(['M16', 'M4', 'אחר']);
    } finally {
      setLoadingCategories(false);
    }
  };

  const pickExcelFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setFileName(file.name);

      // Read the file
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Parse Excel
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      console.log('[Import] Excel data:', jsonData);

      // Extraire les numéros de série
      // On cherche dans la première colonne, en ignorant les headers
      const extractedSerials: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row && row.length > 0) {
          const value = String(row[0]).trim();

          // Skip headers et lignes vides
          if (value &&
            value !== '' &&
            value.toLowerCase() !== 'מסטב' &&
            value.toLowerCase() !== 'serial' &&
            value.toLowerCase() !== 'serial number' &&
            value.toLowerCase() !== 'מספר סידורי') {
            extractedSerials.push(value);
          }
        }
      }

      console.log('[Import] Extracted serials:', extractedSerials);

      if (extractedSerials.length === 0) {
        setModalType('error');
        setModalMessage('לא נמצאו מסטבים בקובץ.\nוודא שהעמודה הראשונה מכילה מסטבים.');
        setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
        setModalVisible(true);
        return;
      }

      setSerials(extractedSerials);
      setModalType('success');
      setModalTitle('הצלחה');
      setModalMessage(`נמצאו ${extractedSerials.length} מסטבים בקובץ`);
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } catch (error) {
      console.error('Error picking/parsing file:', error);
      console.error('Error picking/parsing file:', error);
      setModalType('error');
      setModalMessage('נכשל בקריאת הקובץ. וודא שהקובץ הוא Excel תקין.');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    }
  };

  const handleImport = async () => {
    if (!category) {
      if (!category) {
        setModalType('error');
        setModalMessage('אנא בחר קטגוריה');
        setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
        setModalVisible(true);
        return;
      }
    }

    if (serials.length === 0) {
      if (serials.length === 0) {
        setModalType('error');
        setModalMessage('אנא בחר קובץ Excel');
        setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]);
        setModalVisible(true);
        return;
      }
    }

    setModalType('info');
    setModalTitle('אישור ייבוא');
    setModalMessage(`האם אתה בטוח שברצונך לייבא ${serials.length} מסטבים עבור ${category}?`);
    setModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setModalVisible(false) },
      {
        text: 'ייבא',
        style: 'primary',
        onPress: async () => {
          setModalVisible(false);
          setProcessing(true);
          setImportResult(null);

          const result: ImportResult = {
            success: 0,
            failed: 0,
            duplicates: 0,
            errors: [],
          };

          for (let i = 0; i < serials.length; i++) {
            const serial = serials[i];

            try {
              // Vérifier si le serial existe déjà
              const existing = await weaponInventoryService.getWeaponBySerialNumber(serial);

              if (existing) {
                console.log(`[Import] Serial ${serial} already exists, skipping`);
                result.duplicates++;
                continue;
              }

              // Créer la nouvelle arme
              await weaponInventoryService.addWeapon({
                category,
                serialNumber: serial,
                status: 'available',
              });

              result.success++;
              console.log(`[Import] Successfully imported ${serial} (${i + 1}/${serials.length})`);
            } catch (error: any) {
              console.error(`[Import] Error importing ${serial}:`, error);
              result.failed++;
              result.errors.push(`${serial}: ${error.message || 'שגיאה לא ידועה'}`);
            }
          }

          setProcessing(false);
          setImportResult(result);

          // Show summary alert
          const message = `ייבוא הושלם!\n\nהוספו בהצלחה: ${result.success}\nכבר קיימים: ${result.duplicates}\nנכשלו: ${result.failed}`;

          setTimeout(() => {
            setModalType('success');
            setModalTitle('סיכום ייבוא');
            setModalMessage(message);
            setModalButtons([
              {
                text: 'סגור',
                style: 'primary',
                onPress: () => {
                  setModalVisible(false);
                  if (result.success > 0) {
                    navigation.goBack();
                  }
                },
              },
            ]);
            setModalVisible(true);
          }, 500);
        },
      },
    ]);
    setModalVisible(true);
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
          <Text style={styles.title}>ייבוא מסטבים</Text>
          <Text style={styles.subtitle}>📊 ייבוא מ-Excel</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 הנחיות</Text>
          <Text style={styles.instructionsText}>
            • בחר קטגוריית ציוד (M16, M203, וכו'){'\n'}
            • הכן קובץ Excel עם מסטבים בעמודה הראשונה{'\n'}
            • העלה את הקובץ{'\n'}
            • אשר את הייבוא{'\n\n'}
            פורמט הקובץ:{'\n'}
            העמודה הראשונה צריכה להכיל את המסטבים.{'\n'}
            השורה הראשונה יכולה להיות כותרת (תדלג אוטומטית).
          </Text>
        </View>

        {/* Category Selection */}
        <Text style={styles.sectionTitle}>קטגוריה</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                category === cat && styles.categoryButtonSelected,
              ]}
              onPress={() => setCategory(cat)}
              disabled={processing}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  category === cat && styles.categoryButtonTextSelected,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Category Input */}
        {category === 'אחר' && (
          <View style={styles.customCategoryContainer}>
            <TextInput
              style={styles.customCategoryInput}
              placeholder="הכנס שם קטגוריה..."
              placeholderTextColor={Colors.placeholder}
              value={category === 'אחר' ? '' : category}
              onChangeText={setCategory}
            />
          </View>
        )}

        {/* File Selection */}
        <Text style={styles.sectionTitle}>קובץ Excel</Text>
        <TouchableOpacity
          style={styles.filePickerButton}
          onPress={pickExcelFile}
          disabled={processing}
        >
          <Text style={styles.filePickerIcon}>📁</Text>
          <View style={styles.filePickerInfo}>
            <Text style={styles.filePickerText}>
              {fileName || 'בחר קובץ Excel...'}
            </Text>
            {serials.length > 0 && (
              <Text style={styles.filePickerSubtext}>
                {serials.length} מסטבים נמצאו
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Preview */}
        {serials.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>תצוגה מקדימה</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>
                {serials.length} מסטבים לייבוא:
              </Text>
              <View style={styles.previewList}>
                {serials.slice(0, 10).map((serial, idx) => (
                  <View key={idx} style={styles.previewItem}>
                    <Text style={styles.previewItemNumber}>{idx + 1}.</Text>
                    <Text style={styles.previewItemSerial}>{serial}</Text>
                  </View>
                ))}
                {serials.length > 10 && (
                  <Text style={styles.previewMore}>
                    ועוד {serials.length - 10} מסטבים...
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* Import Result */}
        {importResult && (
          <>
            <Text style={styles.sectionTitle}>תוצאות ייבוא</Text>
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>הצלחה:</Text>
                <Text style={[styles.resultValue, styles.resultSuccess]}>
                  {importResult.success}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>כפולים (דלגו):</Text>
                <Text style={[styles.resultValue, styles.resultWarning]}>
                  {importResult.duplicates}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>שגיאות:</Text>
                <Text style={[styles.resultValue, styles.resultError]}>
                  {importResult.failed}
                </Text>
              </View>

              {importResult.errors.length > 0 && (
                <View style={styles.errorsContainer}>
                  <Text style={styles.errorsTitle}>שגיאות:</Text>
                  {importResult.errors.slice(0, 5).map((error, idx) => (
                    <Text key={idx} style={styles.errorText}>
                      • {error}
                    </Text>
                  ))}
                  {importResult.errors.length > 5 && (
                    <Text style={styles.errorText}>
                      ועוד {importResult.errors.length - 5} שגיאות...
                    </Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* Import Button */}
        {serials.length > 0 && !importResult && (
          <TouchableOpacity
            style={[
              styles.importButton,
              (processing || !category) && styles.importButtonDisabled,
            ]}
            onPress={handleImport}
            disabled={processing || !category}
          >
            {processing ? (
              <>
                <ActivityIndicator color={Colors.textWhite} />
                <Text style={styles.importButtonText}>מייבא...</Text>
              </>
            ) : (
              <Text style={styles.importButtonText}>
                📥 ייבא {serials.length} מסטבים
              </Text>
            )}
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* App Modal */}
      <AppModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.arme,
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
    color: Colors.textWhite,
  },
  headerContent: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textWhite,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  instructionsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'flex-end',
  },
  categoryButton: {
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  categoryButtonSelected: {
    backgroundColor: Colors.arme,
    borderColor: Colors.arme,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryButtonTextSelected: {
    color: Colors.textWhite,
  },
  customCategoryContainer: {
    marginBottom: 20,
  },
  customCategoryInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filePickerButton: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
    marginBottom: 20,
    ...Shadows.small,
  },
  filePickerIcon: {
    fontSize: 40,
    marginLeft: 16,
  },
  filePickerInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  filePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  filePickerSubtext: {
    fontSize: 14,
    color: Colors.success,
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  previewList: {
    gap: 8,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  previewItemNumber: {
    fontSize: 14,
    color: Colors.textLight,
  },
  previewItemSerial: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  previewMore: {
    fontSize: 14,
    color: Colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  resultCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultSuccess: {
    color: Colors.success,
  },
  resultWarning: {
    color: Colors.warning,
  },
  resultError: {
    color: Colors.danger,
  },
  errorsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  errorsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.danger,
    marginBottom: 8,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    lineHeight: 20,
    textAlign: 'right',
  },
  importButton: {
    backgroundColor: Colors.arme,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    ...Shadows.medium,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
});

export default BulkImportWeaponsScreen;
