/**
 * WeaponInventoryListScreen.tsx - Liste de l'inventaire des armes
 * Affiche toutes les armes avec filtres par statut
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { weaponInventoryService } from '../../services/weaponInventoryService';
import { WeaponInventoryItem, WeaponStatus } from '../../types';
import { AppModal, ModalType } from '../../components';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { app } from '../../config/firebase';

const db = getFirestore(app);

type FilterTab = 'all' | 'available' | 'assigned' | 'stored' | 'defective';

const WeaponInventoryListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weapons, setWeapons] = useState<WeaponInventoryItem[]>([]);
  const [filteredWeapons, setFilteredWeapons] = useState<WeaponInventoryItem[]>([]);
  const [groupedWeapons, setGroupedWeapons] = useState<Map<string, WeaponInventoryItem[]>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    stored: 0,
    defective: 0,
  });

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponInventoryItem | null>(null);
  const [editedSerialNumber, setEditedSerialNumber] = useState('');

  // AppModal state
  const [appModalVisible, setAppModalVisible] = useState(false);
  const [appModalType, setAppModalType] = useState<ModalType>('info');
  const [appModalMessage, setAppModalMessage] = useState('');
  const [appModalTitle, setAppModalTitle] = useState<string | undefined>(undefined);
  const [appModalButtons, setAppModalButtons] = useState<any[]>([]);

  // Shelf verification flow (מדף)
  const [verifyCategoryModalVisible, setVerifyCategoryModalVisible] = useState(false);
  const [verifyListModalVisible, setVerifyListModalVisible] = useState(false);
  const [verifyCategoryGroups, setVerifyCategoryGroups] = useState<Array<{
    category: string;
    weapons: WeaponInventoryItem[];
  }>>([]);
  const [verifySelectedCategory, setVerifySelectedCategory] = useState<string | null>(null);
  const [verifySelectedWeapons, setVerifySelectedWeapons] = useState<WeaponInventoryItem[]>([]);
  const [verifiedWeaponIds, setVerifiedWeaponIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadWeapons();
    }, [])
  );

  // Pour chaque arme assignée sans voucherNumber, cherche le שובר dans la collection assignments
  const enrichWeaponsWithVoucherNumbers = async (
    weaponsList: WeaponInventoryItem[]
  ): Promise<WeaponInventoryItem[]> => {
    const weaponsWithoutVoucher = weaponsList.filter(
      w => w.status === 'assigned' && w.assignedTo && !w.assignedTo.voucherNumber
    );
    if (weaponsWithoutVoucher.length === 0) return weaponsList;

    // Grouper par soldierId pour minimiser les requêtes Firestore
    const bySoldier = new Map<string, WeaponInventoryItem[]>();
    for (const weapon of weaponsWithoutVoucher) {
      const sid = weapon.assignedTo!.soldierId;
      if (!bySoldier.has(sid)) bySoldier.set(sid, []);
      bySoldier.get(sid)!.push(weapon);
    }

    const updates: { weaponId: string; voucherNumber: string }[] = [];

    for (const [soldierId, solWeapons] of bySoldier.entries()) {
      const snap = await getDocs(
        query(
          collection(db, 'assignments'),
          where('soldierId', '==', soldierId),
          where('type', '==', 'combat')
        )
      );

      for (const weapon of solWeapons) {
        let bestId: string | null = null;
        let bestTs = 0;

        for (const assignDoc of snap.docs) {
          const data = assignDoc.data();
          if (data.action !== 'issue' && data.action !== 'add') continue;

          const found = (data.items || []).some((item: any) => {
            if (!item.serial) return false;
            return item.serial
              .split(',')
              .map((s: string) => s.trim())
              .includes(weapon.serialNumber);
          });

          if (found) {
            const ts: number = data.timestamp?.seconds ?? 0;
            if (ts > bestTs) {
              bestTs = ts;
              bestId = assignDoc.id;
            }
          }
        }

        if (bestId) {
          updates.push({ weaponId: weapon.id, voucherNumber: bestId });
        }
      }
    }

    if (updates.length === 0) return weaponsList;

    // Persister en Firestore (dot-notation = update partiel, sans écraser assignedTo)
    for (const upd of updates) {
      updateDoc(doc(db, 'weapons_inventory', upd.weaponId), {
        'assignedTo.voucherNumber': upd.voucherNumber,
      }).catch(e => console.warn('[WeaponInventory] voucherNumber persist failed:', e));
    }

    // Mettre à jour l'état local immédiatement
    return weaponsList.map(w => {
      const upd = updates.find(u => u.weaponId === w.id);
      if (upd && w.assignedTo) {
        return { ...w, assignedTo: { ...w.assignedTo, voucherNumber: upd.voucherNumber } };
      }
      return w;
    });
  };

  const loadWeapons = async () => {
    try {
      setLoading(true);

      // Clear states to force refresh
      setWeapons([]);
      setFilteredWeapons([]);
      setGroupedWeapons(new Map());

      const [allWeapons, inventoryStats] = await Promise.all([
        weaponInventoryService.getAllWeapons(),
        weaponInventoryService.getInventoryStats(),
      ]);

      console.log('Weapon Inventory Stats:', inventoryStats);
      console.log('Total weapons loaded:', allWeapons.length);

      // Cherche les שוברים manquants dans la collection assignments
      const enrichedWeapons = await enrichWeaponsWithVoucherNumbers(allWeapons);

      setWeapons(enrichedWeapons);
      setStats({
        total: inventoryStats.total,
        available: inventoryStats.available,
        assigned: inventoryStats.assigned,
        stored: inventoryStats.stored,
        defective: inventoryStats.defective,
      });

      // Appliquer le filtre actuel
      applyFilter(activeFilter, enrichedWeapons);
    } catch (error) {
      console.error('Error loading weapons:', error);
      setAppModalType('error');
      setAppModalMessage('לא ניתן לטעון את המלאי');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (
    filter: FilterTab,
    weaponsList: WeaponInventoryItem[] = weapons,
    search: string = searchQuery
  ) => {
    setActiveFilter(filter);

    let filtered: WeaponInventoryItem[];
    switch (filter) {
      case 'all':
        filtered = weaponsList;
        break;
      case 'available':
        filtered = weaponsList.filter((w) => w.status === 'available');
        break;
      case 'assigned':
        filtered = weaponsList.filter((w) => w.status === 'assigned');
        break;
      case 'stored':
        filtered = weaponsList.filter((w) => w.status === 'stored');
        break;
      case 'defective':
        filtered = weaponsList.filter((w) => w.status === 'defective');
        break;
      default:
        filtered = weaponsList;
    }

    // Apply search query across serial number, category and soldier name
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((w) =>
        w.serialNumber.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        (w.assignedTo?.soldierName || '').toLowerCase().includes(q)
      );
    }

    setFilteredWeapons(filtered);

    // Grouper par catégorie
    const grouped = new Map<string, WeaponInventoryItem[]>();
    filtered.forEach((weapon) => {
      if (!grouped.has(weapon.category)) {
        grouped.set(weapon.category, []);
      }
      grouped.get(weapon.category)!.push(weapon);
    });

    // Trier les armes dans chaque catégorie par serial number
    grouped.forEach((weaponList) => {
      weaponList.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
    });

    setGroupedWeapons(grouped);

    // Auto-expand all matching categories when a search is active
    if (q) {
      setExpandedCategories(new Set(grouped.keys()));
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilter(activeFilter, weapons, query);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWeapons();
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const buildAvailableCategoryGroups = () => {
    const byCategory = new Map<string, WeaponInventoryItem[]>();

    weapons
      .filter((w) => w.status === 'available')
      .forEach((weapon) => {
        if (!byCategory.has(weapon.category)) {
          byCategory.set(weapon.category, []);
        }
        byCategory.get(weapon.category)!.push(weapon);
      });

    return Array.from(byCategory.entries())
      .map(([category, categoryWeapons]) => ({
        category,
        weapons: [...categoryWeapons].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  };

  const handleOpenShelfVerification = () => {
    const groups = buildAvailableCategoryGroups();
    if (groups.length === 0) {
      setAppModalType('info');
      setAppModalTitle('בדיקת מדף');
      setAppModalMessage('אין מסט"בים זמינים לבדיקה כרגע.');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    setVerifyCategoryGroups(groups);
    setVerifyCategoryModalVisible(true);
  };

  const handleSelectVerifyCategory = (category: string) => {
    const group = verifyCategoryGroups.find((g) => g.category === category);
    if (!group) return;

    setVerifySelectedCategory(category);
    setVerifySelectedWeapons(group.weapons);
    setVerifiedWeaponIds(new Set());
    setVerifyCategoryModalVisible(false);
    setVerifyListModalVisible(true);
  };

  const closeVerifyListModal = () => {
    setVerifyListModalVisible(false);
    setVerifySelectedCategory(null);
    setVerifySelectedWeapons([]);
    setVerifiedWeaponIds(new Set());
  };

  const toggleVerifiedWeapon = (weaponId: string) => {
    setVerifiedWeaponIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(weaponId)) {
        updated.delete(weaponId);
      } else {
        updated.add(weaponId);
      }
      return updated;
    });
  };

  const markAllVerifiedWeapons = () => {
    setVerifiedWeaponIds(new Set(verifySelectedWeapons.map((w) => w.id)));
  };

  const clearAllVerifiedWeapons = () => {
    setVerifiedWeaponIds(new Set());
  };

  const finishShelfVerification = () => {
    const category = verifySelectedCategory;
    const checked = verifiedWeaponIds.size;
    const total = verifySelectedWeapons.length;
    closeVerifyListModal();

    setAppModalType('info');
    setAppModalTitle('בדיקת מדף הסתיימה');
    setAppModalMessage(
      category
        ? `בקטגוריה ${category} סומנו ${checked} מתוך ${total} מסט"בים כמאומתים במדף.`
        : `סומנו ${checked} מתוך ${total} מסט"בים כמאומתים במדף.`
    );
    setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
    setAppModalVisible(true);
  };

  const openWeaponModal = (weapon: WeaponInventoryItem) => {
    setSelectedWeapon(weapon);
    setEditedSerialNumber(weapon.serialNumber);
    setModalVisible(true);
  };

  const closeWeaponModal = () => {
    setModalVisible(false);
    setSelectedWeapon(null);
    setEditedSerialNumber('');
  };

  const handleEditSerialNumber = async () => {
    if (!selectedWeapon) return;

    if (!editedSerialNumber.trim()) {
      setAppModalType('error');
      setAppModalMessage('יש להזין מסטב');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    if (editedSerialNumber.trim() === selectedWeapon.serialNumber) {
      setAppModalType('info');
      setAppModalMessage('המסטב זהה לקיים');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    // Check if serial number already exists
    const existingWeapon = await weaponInventoryService.getWeaponBySerialNumber(editedSerialNumber.trim());
    if (existingWeapon) {
      setAppModalType('error');
      setAppModalMessage('מסטב זה כבר קיים במערכת');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    try {
      await weaponInventoryService.updateWeapon(selectedWeapon.id, {
        serialNumber: editedSerialNumber.trim(),
      });
      setAppModalType('success');
      setAppModalMessage('המסטב עודכן בהצלחה');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      closeWeaponModal();
      loadWeapons();
    } catch (error) {
      console.error('Error updating serial number:', error);
      setAppModalType('error');
      setAppModalMessage('לא ניתן לעדכן את המסטב');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    }
  };

  const handleDeleteWeaponFromModal = async () => {
    if (!selectedWeapon) return;

    if (selectedWeapon.status !== 'available') {
      setAppModalType('error');
      setAppModalMessage('לא ניתן למחוק נשק שאינו זמין');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    setAppModalType('warning');
    setAppModalTitle('מחיקת נשק');
    setAppModalMessage(`האם אתה בטוח שברצונך למחוק ${selectedWeapon.category} ${selectedWeapon.serialNumber}?`);
    setAppModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setAppModalVisible(false) },
      {
        text: 'מחק',
        style: 'danger',
        icon: 'trash' as const,
        onPress: async () => {
          setAppModalVisible(false);
          try {
            await weaponInventoryService.deleteWeapon(selectedWeapon.id);
            setAppModalType('success');
            setAppModalTitle(undefined);
            setAppModalMessage('הנשק נמחק בהצלחה');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
            closeWeaponModal();
            loadWeapons();
          } catch (error) {
            console.error('Error deleting weapon:', error);
            setAppModalType('error');
            setAppModalTitle(undefined);
            setAppModalMessage('לא ניתן למחוק את הנשק');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
          }
        },
      },
    ]);
    setAppModalVisible(true);
  };

  const handleDeleteWeapon = (weapon: WeaponInventoryItem) => {
    if (weapon.status !== 'available') {
      setAppModalType('error');
      setAppModalMessage('לא ניתן למחוק נשק שאינו זמין');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    setAppModalType('warning');
    setAppModalTitle('מחיקת נשק');
    setAppModalMessage(`האם אתה בטוח שברצונך למחוק ${weapon.category} ${weapon.serialNumber}?`);
    setAppModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setAppModalVisible(false) },
      {
        text: 'מחק',
        style: 'danger',
        icon: 'trash' as const,
        onPress: async () => {
          setAppModalVisible(false);
          try {
            await weaponInventoryService.deleteWeapon(weapon.id);
            setAppModalType('success');
            setAppModalTitle(undefined);
            setAppModalMessage('הנשק נמחק בהצלחה');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
            loadWeapons();
          } catch (error) {
            console.error('Error deleting weapon:', error);
            setAppModalType('error');
            setAppModalTitle(undefined);
            setAppModalMessage('לא ניתן למחוק את הנשק');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
          }
        },
      },
    ]);
    setAppModalVisible(true);
  };

  const handleAssignWeapon = (weapon: WeaponInventoryItem) => {
    if (weapon.status !== 'available') {
      setAppModalType('error');
      setAppModalMessage('הנשק אינו זמין להקצאה');
      setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }
    navigation.navigate('AssignWeapon', { weaponId: weapon.id });
  };

  const handleReturnWeapon = (weapon: WeaponInventoryItem) => {
    setAppModalType('confirm');
    setAppModalTitle('החזרת נשק');
    setAppModalMessage(`האם להחזיר ${weapon.category} ${weapon.serialNumber} למלאי?`);
    setAppModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setAppModalVisible(false) },
      {
        text: 'החזר',
        style: 'primary',
        icon: 'return-down-back' as const,
        onPress: async () => {
          setAppModalVisible(false);
          try {
            await weaponInventoryService.returnWeapon(weapon.id);
            setAppModalType('success');
            setAppModalTitle(undefined);
            setAppModalMessage('הנשק הוחזר למלאי');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
            loadWeapons();
          } catch (error) {
            console.error('Error returning weapon:', error);
            setAppModalType('error');
            setAppModalTitle(undefined);
            setAppModalMessage('לא ניתן להחזיר את הנשק');
            setAppModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
            setAppModalVisible(true);
          }
        },
      },
    ]);
    setAppModalVisible(true);
  };

  const handleMarkAsDefective = () => {
    setAppModalType('warning');
    setAppModalTitle('דיווח על תקלה');
    setAppModalMessage(`האם לסמן את ${selectedWeapon?.category} ${selectedWeapon?.serialNumber} כתקול?`);
    setAppModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setAppModalVisible(false) },
      {
        text: 'סמן כתקול',
        style: 'danger',
        onPress: async () => {
          setAppModalVisible(false);
          try {
            if (selectedWeapon) {
              await weaponInventoryService.updateWeapon(selectedWeapon.id, { status: 'defective' });
              setAppModalType('success');
              setAppModalTitle(undefined);
              setAppModalMessage('הנשק סומן כתקול');
              setAppModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
              setAppModalVisible(true);
              closeWeaponModal();
              loadWeapons();
            }
          } catch (error) {
            console.error('Error updating weapon:', error);
            setAppModalType('error');
            setAppModalMessage('שגיאה בעדכון הסטטוס');
            setAppModalVisible(true);
          }
        },
      },
    ]);
    setAppModalVisible(true);
  };

  const handleMarkAsFixed = () => {
    setAppModalType('confirm');
    setAppModalTitle('חזרה מתיקון');
    setAppModalMessage(`האם לסמן את ${selectedWeapon?.category} ${selectedWeapon?.serialNumber} כתקין (זמין)?`);
    setAppModalButtons([
      { text: 'ביטול', style: 'outline', onPress: () => setAppModalVisible(false) },
      {
        text: 'סמן כתקין',
        style: 'primary',
        onPress: async () => {
          setAppModalVisible(false);
          try {
            if (selectedWeapon) {
              await weaponInventoryService.updateWeapon(selectedWeapon.id, { status: 'available' });
              setAppModalType('success');
              setAppModalTitle(undefined);
              setAppModalMessage('הנשק חזר למלאי הזמין');
              setAppModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
              setAppModalVisible(true);
              closeWeaponModal();
              loadWeapons();
            }
          } catch (error) {
            console.error('Error updating weapon:', error);
            setAppModalType('error');
            setAppModalMessage('שגיאה בעדכון הסטטוס');
            setAppModalVisible(true);
          }
        },
      },
    ]);
    setAppModalVisible(true);
  };


  const getStatusColor = (status: WeaponStatus) => {
    switch (status) {
      case 'available':
        return Colors.success;
      case 'assigned':
        return Colors.warning;
      case 'stored':
        return Colors.info;
      case 'defective':
        return Colors.danger;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusText = (status: WeaponStatus) => {
    switch (status) {
      case 'available':
        return 'זמין';
      case 'assigned':
        return 'מוקצה';
      case 'stored':
        return 'אפסון';
      case 'defective':
        return 'תקול';
      default:
        return '';
    }
  };

  const renderCategoryGroup = (category: string, weaponsList: WeaponInventoryItem[]) => {
    const isExpanded = expandedCategories.has(category);

    return (
      <View key={category} style={styles.categoryCard}>
        {/* Category Header - Clickable */}
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryHeaderLeft}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={24}
              color={Colors.textWhite}
            />
            <Text style={styles.categoryCount}>{weaponsList.length}</Text>
          </View>
          <Text style={styles.categoryTitle}>{category}</Text>
        </TouchableOpacity>

        {/* Weapons Table - Only show if expanded */}
        {isExpanded && (
          <View style={styles.weaponsTable}>
            {weaponsList.map((weapon) => (
              <TouchableOpacity
                key={weapon.id}
                style={[
                  styles.weaponRow,
                  { borderRightWidth: 3, borderRightColor: getStatusColor(weapon.status) },
                ]}
                onPress={() => openWeaponModal(weapon)}
                activeOpacity={0.7}
              >
                <View style={styles.weaponRowContent}>
                  <View style={styles.weaponInfoMain}>
                    <Text style={styles.serialNumberTable}>{weapon.serialNumber}</Text>
                    <Text style={[
                      styles.statusBadgeSmall,
                      { color: getStatusColor(weapon.status) }
                    ]}>
                      {weapon.status === 'assigned' ? 'אצל החייל' : getStatusText(weapon.status)}
                    </Text>
                  </View>

                  <View style={styles.weaponStatus}>
                    {(weapon.status === 'assigned' || weapon.status === 'stored') && weapon.assignedTo ? (
                      <View style={styles.weaponStatusInfo}>
                        <View style={styles.soldierInfoRow}>
                          <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
                          <Text style={styles.soldierNameTable}>{weapon.assignedTo.soldierName}</Text>
                        </View>
                        {weapon.assignedTo.voucherNumber ? (
                          <View style={styles.soldierInfoRow}>
                            <Ionicons name="receipt-outline" size={11} color={Colors.textLight} />
                            <Text style={styles.voucherNumberTable}>
                              שובר: {String(weapon.assignedTo.voucherNumber).slice(-6).padStart(6, '0')}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : weapon.status === 'available' ? (
                      <Text style={styles.availableTextTable}>מוכן להנפקה</Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.arme} />
        <Text style={styles.loadingText}>טוען מלאי...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>מלאי נשק</Text>
          <Text style={styles.headerSubtitle}>{stats.total} נשקים</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddWeaponToInventory')}
        >
          <Ionicons name="add" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: Colors.success }]}>
          <Text style={styles.statNumber}>{stats.available}</Text>
          <Text style={styles.statLabel}>זמינים</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.warning }]}>
          <Text style={styles.statNumber}>{stats.assigned}</Text>
          <Text style={styles.statLabel}>מוקצים</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.info }]}>
          <Text style={styles.statNumber}>{stats.stored}</Text>
          <Text style={styles.statLabel}>אפסון</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.danger }]}>
          <Text style={styles.statNumber}>{stats.defective}</Text>
          <Text style={styles.statLabel}>תקול</Text>
        </View>
      </View>

      {/* Import Button */}
      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate('BulkImportWeapons')}
        activeOpacity={0.7}
      >
        <Ionicons name="cloud-upload-outline" size={20} color={Colors.arme} />
        <Text style={styles.importButtonText}>ייבוא מסטבים מ-Excel</Text>
      </TouchableOpacity>

      {/* Shelf Verification Button */}
      <TouchableOpacity
        style={styles.verifyShelfButton}
        onPress={handleOpenShelfVerification}
        activeOpacity={0.7}
      >
        <Ionicons name="checkbox-outline" size={20} color={Colors.success} />
        <Text style={styles.verifyShelfButtonText}>בדיקת מדף לפי קטגוריה</Text>
      </TouchableOpacity>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
          onPress={() => applyFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
            הכל
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'available' && styles.filterTabActive]}
          onPress={() => applyFilter('available')}
        >
          <Text
            style={[styles.filterText, activeFilter === 'available' && styles.filterTextActive]}
          >
            זמינים
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'assigned' && styles.filterTabActive]}
          onPress={() => applyFilter('assigned')}
        >
          <Text
            style={[styles.filterText, activeFilter === 'assigned' && styles.filterTextActive]}
          >
            מוקצים
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'stored' && styles.filterTabActive]}
          onPress={() => applyFilter('stored')}
        >
          <Text style={[styles.filterText, activeFilter === 'stored' && styles.filterTextActive]}>
            אפסון
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'defective' && styles.filterTabActive]}
          onPress={() => applyFilter('defective')}
        >
          <Text style={[styles.filterText, activeFilter === 'defective' && styles.filterTextActive]}>
            תקול
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          style={styles.searchClearButton}
          onPress={() => handleSearch('')}
          disabled={!searchQuery}
        >
          <Ionicons
            name={searchQuery ? 'close-circle' : 'search-outline'}
            size={20}
            color={searchQuery ? Colors.textSecondary : Colors.textLight}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="חפש לפי מסטב, קטגוריה או שם חייל..."
          placeholderTextColor={Colors.textLight}
          textAlign="right"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
      </View>

      {/* Weapons List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {groupedWeapons.size === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>אין נשקים להצגה</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? `אין תוצאות עבור "${searchQuery.trim()}"`
                : activeFilter === 'all'
                  ? 'לחץ על + להוספת נשק למלאי'
                  : 'אין נשקים בסטטוס זה'}
            </Text>
          </View>
        ) : (
          Array.from(groupedWeapons.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([category, weaponsList]) => renderCategoryGroup(category, weaponsList))
        )}
      </ScrollView>

      {/* Shelf Verification - Category Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={verifyCategoryModalVisible}
        onRequestClose={() => setVerifyCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVerifyCategoryModalVisible(false)}
        >
          <View style={styles.verifyModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setVerifyCategoryModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.modalHeaderInfo}>
                <Text style={styles.modalTitle}>בדיקת מדף</Text>
                <Text style={styles.modalSubtitle}>בחר קטגוריה לבדיקה</Text>
              </View>
            </View>

            <ScrollView style={styles.verifyListScroll} showsVerticalScrollIndicator={false}>
              {verifyCategoryGroups.map((group) => (
                <TouchableOpacity
                  key={group.category}
                  style={styles.verifyCategoryRow}
                  onPress={() => handleSelectVerifyCategory(group.category)}
                >
                  <View style={styles.verifyCategoryBadge}>
                    <Text style={styles.verifyCategoryBadgeText}>{group.weapons.length}</Text>
                  </View>
                  <View style={styles.verifyCategoryInfo}>
                    <Text style={styles.verifyCategoryName}>{group.category}</Text>
                    <Text style={styles.verifyCategorySubtitle}>מסט"בים זמינים לבדיקה</Text>
                  </View>
                  <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Shelf Verification - Serial Checklist Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={verifyListModalVisible}
        onRequestClose={closeVerifyListModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeVerifyListModal}
        >
          <View style={styles.verifyModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeVerifyListModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.modalHeaderInfo}>
                <Text style={styles.modalTitle}>{verifySelectedCategory || 'בדיקת מדף'}</Text>
                <Text style={styles.modalSubtitle}>
                  {verifiedWeaponIds.size} / {verifySelectedWeapons.length} אומתו במדף
                </Text>
              </View>
            </View>

            <View style={styles.verifyToolbar}>
              <TouchableOpacity style={styles.verifyToolbarButton} onPress={markAllVerifiedWeapons}>
                <Text style={styles.verifyToolbarButtonText}>סמן הכל</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.verifyToolbarButton} onPress={clearAllVerifiedWeapons}>
                <Text style={styles.verifyToolbarButtonText}>נקה הכל</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.verifyListScroll} showsVerticalScrollIndicator={false}>
              {verifySelectedWeapons.map((weapon) => {
                const checked = verifiedWeaponIds.has(weapon.id);
                return (
                  <TouchableOpacity
                    key={weapon.id}
                    style={styles.verifySerialRow}
                    onPress={() => toggleVerifiedWeapon(weapon.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={checked ? Colors.success : Colors.textSecondary}
                    />
                    <View style={styles.verifySerialInfo}>
                      <Text style={styles.verifySerialNumber}>{weapon.serialNumber}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.verifyDoneButton} onPress={finishShelfVerification}>
              <Ionicons name="checkmark-done-outline" size={20} color={Colors.textWhite} />
              <Text style={styles.verifyDoneButtonText}>סיום בדיקה</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Weapon Actions Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeWeaponModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeWeaponModal}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedWeapon && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={closeWeaponModal} style={styles.modalCloseButton}>
                    <Ionicons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.modalHeaderInfo}>
                    <Text style={styles.modalTitle}>{selectedWeapon.category}</Text>
                    <Text style={styles.modalSubtitle}>עריכת מסטב</Text>
                  </View>
                </View>

                {/* Serial Number Input */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>מסטב (מספר סידורי)</Text>
                  <View style={styles.modalInputContainer}>
                    <TextInput
                      style={styles.modalInput}
                      value={editedSerialNumber}
                      onChangeText={setEditedSerialNumber}
                      placeholder="הזן מסטב"
                      placeholderTextColor={Colors.textLight}
                      textAlign="right"
                      autoCapitalize="characters"
                      keyboardType="numeric"
                    />
                    <Ionicons name="barcode-outline" size={20} color={Colors.textSecondary} />
                  </View>
                </View>

                {/* Status Info */}
                <View style={styles.modalInfoCard}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoValue}>
                      {getStatusText(selectedWeapon.status)}
                    </Text>
                    <Text style={styles.modalInfoLabel}>סטטוס:</Text>
                  </View>
                  {selectedWeapon.status === 'assigned' && selectedWeapon.assignedTo && (
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoValue}>
                        {selectedWeapon.assignedTo.soldierName}
                      </Text>
                      <Text style={styles.modalInfoLabel}>מוקצה ל:</Text>
                    </View>
                  )}
                  {selectedWeapon.status === 'assigned' && selectedWeapon.assignedTo?.voucherNumber && (
                    <View style={styles.modalInfoRow}>
                      <Text style={[styles.modalInfoValue, styles.voucherNumberModal]}>
                        {String(selectedWeapon.assignedTo.voucherNumber).slice(-6).padStart(6, '0')}
                      </Text>
                      <Text style={styles.modalInfoLabel}>מספר שובר:</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  {selectedWeapon.status === 'available' && (
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: Colors.danger }]}
                      onPress={handleMarkAsDefective}
                    >
                      <Ionicons name="construct-outline" size={20} color={Colors.textWhite} />
                      <Text style={styles.modalButtonText}>סמן כתקול</Text>
                    </TouchableOpacity>
                  )}

                  {selectedWeapon.status === 'defective' && (
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: Colors.success }]}
                      onPress={handleMarkAsFixed}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textWhite} />
                      <Text style={styles.modalButtonText}>סמן כתקין</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonEdit]}
                    onPress={handleEditSerialNumber}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.textWhite} />
                    <Text style={styles.modalButtonText}>שמור שינויים</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonDelete,
                      selectedWeapon.status !== 'available' && selectedWeapon.status !== 'defective' && styles.modalButtonDisabled,
                    ]}
                    onPress={handleDeleteWeaponFromModal}
                    disabled={selectedWeapon.status !== 'available' && selectedWeapon.status !== 'defective'}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.textWhite} />
                    <Text style={styles.modalButtonText}>מחק נשק</Text>
                  </TouchableOpacity>
                </View>

                {selectedWeapon.status !== 'available' && (
                  <Text style={styles.modalWarning}>
                    ⚠️ ניתן למחוק רק נשק זמין
                  </Text>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* App Modal */}
      <AppModal
        visible={appModalVisible}
        type={appModalType}
        title={appModalTitle}
        message={appModalMessage}
        buttons={appModalButtons}
        onClose={() => setAppModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Header
  header: {
    backgroundColor: Colors.arme,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },

  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.small,
  },

  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  statLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: Spacing.xs,
  },

  // Import Button
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.arme,
    borderStyle: 'dashed',
    ...Shadows.small,
  },

  importButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.arme,
  },

  verifyShelfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.success,
    ...Shadows.small,
  },

  verifyShelfButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.success,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },

  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    textAlign: 'right',
  },

  searchClearButton: {
    padding: Spacing.xs,
  },

  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
  },

  filterTabActive: {
    backgroundColor: Colors.arme,
  },

  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  filterTextActive: {
    color: Colors.textWhite,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },

  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },

  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },

  // Category Card
  categoryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.small,
    overflow: 'hidden',
  },

  categoryHeader: {
    backgroundColor: Colors.arme,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  categoryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textWhite,
    flex: 1,
    textAlign: 'right',
  },

  categoryCount: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minWidth: 32,
    textAlign: 'center',
  },

  // Weapons Table
  weaponsTable: {
    padding: Spacing.sm,
  },

  weaponRow: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },

  weaponRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  weaponInfoMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusBadgeSmall: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soldierInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serialNumberTable: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.arme,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minWidth: 80,
  },
  weaponStatus: {
    alignItems: 'flex-end',
    flex: 1,
  },
  soldierNameTable: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    fontWeight: '600',
  },

  availableTextTable: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },

  weaponStatusInfo: {
    alignItems: 'flex-end',
    gap: 2,
  },

  voucherNumberTable: {
    fontSize: 10,
    color: Colors.textLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  voucherNumberModal: {
    fontSize: FontSize.sm,
    color: Colors.armeDark,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  storageTextTable: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.info,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    ...Shadows.large,
  },

  verifyModalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    padding: Spacing.xl,
    ...Shadows.large,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  modalHeaderInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },

  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  modalSection: {
    marginBottom: Spacing.lg,
  },

  modalLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  modalInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },

  modalInfoCard: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },

  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },

  modalInfoLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  modalInfoValue: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  verifyListScroll: {
    maxHeight: 380,
  },

  verifyCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },

  verifyCategoryInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  verifyCategoryName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },

  verifyCategorySubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  verifyCategoryBadge: {
    minWidth: 34,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.arme + '20',
    alignItems: 'center',
  },

  verifyCategoryBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.arme,
  },

  verifyToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  verifyToolbarButton: {
    flex: 1,
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  verifyToolbarButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  verifySerialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },

  verifySerialInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  verifySerialNumber: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.arme,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  verifyDoneButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },

  verifyDoneButtonText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  modalActions: {
    gap: Spacing.md,
  },

  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.small,
  },

  modalButtonEdit: {
    backgroundColor: Colors.arme,
  },

  modalButtonDelete: {
    backgroundColor: Colors.danger,
  },

  modalButtonDisabled: {
    backgroundColor: Colors.disabled,
    opacity: 0.5,
  },

  modalButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  modalWarning: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});

export default WeaponInventoryListScreen;
