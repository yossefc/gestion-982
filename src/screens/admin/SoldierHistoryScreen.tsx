/**
 * SoldierHistoryScreen.tsx
 * Écran d'historique complet d'un soldat (toutes les assignations)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { soldierService } from '../../services/soldierService';
import { assignmentService } from '../../services/assignmentService';
import { rspAssignmentService } from '../../services/firebaseService';
import { Soldier } from '../../types';

interface HistoryItem {
  id: string;
  type: 'clothing' | 'combat' | 'rsp';
  action: 'issue' | 'return' | 'add' | 'remove';
  equipmentName: string;
  quantity: number;
  date: Date;
  serial?: string;
  notes?: string;
}

const SoldierHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState<Soldier | null>(null);
  const [searchResults, setSearchResults] = useState<Soldier[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('שים לב', 'יש להזין שם או מספר אישי');
      return;
    }

    try {
      setSearching(true);
      const soldiers = await soldierService.getAll();

      const results = soldiers.filter((s: Soldier) =>
        s.name.includes(searchQuery) ||
        s.personalNumber.includes(searchQuery)
      );

      if (results.length === 0) {
        Alert.alert('לא נמצא', 'לא נמצאו חיילים התואמים את החיפוש');
        setSearchResults([]);
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('שגיאה', 'לא ניתן לבצע חיפוש');
    } finally {
      setSearching(false);
    }
  };

  const loadSoldierHistory = async (soldier: Soldier) => {
    try {
      setLoading(true);
      setSelectedSoldier(soldier);
      setSearchResults([]);

      // Charger toutes les assignations du soldat
      const [allAssignments, rspAssignments] = await Promise.all([
        assignmentService.getAssignmentsBySoldier(soldier.id),
        rspAssignmentService.getHoldingsBySoldierId(soldier.id),
      ]);

      // Convertir en format unifié d'historique
      const historyItems: HistoryItem[] = [];

      // Assignations générales (vêtements et combat)
      allAssignments.forEach((assignment: any) => {
        assignment.items?.forEach((item: any) => {
          historyItems.push({
            id: `${assignment.id}_${item.equipmentId}`,
            type: assignment.type || 'combat',
            action: 'issue',
            equipmentName: item.equipmentName || item.name || 'Unknown',
            quantity: item.quantity || 1,
            date: assignment.timestamp || new Date(),
            serial: item.serial,
            notes: assignment.notes,
          });
        });
      });

      // Assignations RSP
      rspAssignments.forEach((rsp: any) => {
        historyItems.push({
          id: rsp.id,
          type: 'rsp',
          action: rsp.action || 'issue',
          equipmentName: rsp.equipmentName,
          quantity: rsp.quantity,
          date: rsp.lastSignatureDate || rsp.createdAt || new Date(),
          notes: rsp.notes,
        });
      });

      // Trier par date décroissante (plus récent en premier)
      historyItems.sort((a, b) => b.date.getTime() - a.date.getTime());

      setHistory(historyItems);
    } catch (error) {
      console.error('Load history error:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את ההיסטוריה');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'clothing': return Colors.vetement;
      case 'combat': return Colors.arme;
      case 'rsp': return Colors.primary;
      default: return Colors.textSecondary;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'clothing': return 'shirt';
      case 'combat': return 'shield';
      case 'rsp': return 'construct';
      default: return 'cube';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'clothing': return 'אפנאות';
      case 'combat': return 'קרב';
      case 'rsp': return 'רס"פ';
      default: return type;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'issue': return 'הוחתם';
      case 'return': return 'הוחזר';
      case 'add': return 'הוספה';
      case 'remove': return 'הסרה';
      default: return action;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleReset = () => {
    setSelectedSoldier(null);
    setSearchQuery('');
    setSearchResults([]);
    setHistory([]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={Colors.textWhite} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>היסטוריית חייל</Text>
          <Text style={styles.headerSubtitle}>צפייה בכל ההחתמות</Text>
        </View>

        {selectedSoldier && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleReset}
          >
            <Ionicons name="close" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        )}
        {!selectedSoldier && <View style={styles.headerSpacer} />}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!selectedSoldier ? (
          <>
            {/* Search Section */}
            <View style={styles.searchCard}>
              <Text style={styles.searchTitle}>חיפוש חייל</Text>
              <Text style={styles.searchSubtitle}>
                הזן שם או מספר אישי של החייל
              </Text>

              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="לדוגמה: יוסי כהן או 1234567"
                  placeholderTextColor={Colors.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  disabled={searching}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color={Colors.textWhite} />
                  ) : (
                    <Ionicons name="search" size={20} color={Colors.textWhite} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={styles.resultsSection}>
                <Text style={styles.sectionTitle}>תוצאות חיפוש</Text>
                {searchResults.map((soldier) => (
                  <TouchableOpacity
                    key={soldier.id}
                    style={styles.soldierCard}
                    onPress={() => loadSoldierHistory(soldier)}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={Colors.textLight}
                    />
                    <View style={styles.soldierInfo}>
                      <Text style={styles.soldierName}>{soldier.name}</Text>
                      <Text style={styles.soldierDetails}>
                        מ.א: {soldier.personalNumber} • {soldier.company}
                      </Text>
                    </View>
                    <View style={styles.soldierAvatar}>
                      <Ionicons name="person" size={24} color={Colors.primary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Selected Soldier Info */}
            <View style={styles.selectedSoldierCard}>
              <View style={styles.selectedSoldierAvatar}>
                <Ionicons name="person" size={32} color={Colors.primary} />
              </View>
              <View style={styles.selectedSoldierInfo}>
                <Text style={styles.selectedSoldierName}>{selectedSoldier.name}</Text>
                <Text style={styles.selectedSoldierDetails}>
                  מ.א: {selectedSoldier.personalNumber}
                </Text>
                <Text style={styles.selectedSoldierDetails}>
                  פלוגה: {selectedSoldier.company}
                </Text>
              </View>
            </View>

            {/* History Section */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>טוען היסטוריה...</Text>
              </View>
            ) : (
              <>
                <View style={styles.historyHeader}>
                  <Text style={styles.sectionTitle}>היסטוריית החתמות</Text>
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{history.length} רשומות</Text>
                  </View>
                </View>

                {history.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
                    <Text style={styles.emptyText}>אין רשומות היסטוריה</Text>
                    <Text style={styles.emptySubtext}>
                      לא נמצאו החתמות עבור חייל זה
                    </Text>
                  </View>
                ) : (
                  <View style={styles.historyList}>
                    {history.map((item) => (
                      <View key={item.id} style={styles.historyItem}>
                        <View style={styles.historyTimeline}>
                          <View
                            style={[
                              styles.historyDot,
                              { backgroundColor: getTypeColor(item.type) },
                            ]}
                          />
                          <View style={styles.historyLine} />
                        </View>

                        <View style={styles.historyContent}>
                          <View style={styles.historyCardHeader}>
                            <View style={styles.historyCardHeaderRight}>
                              <View
                                style={[
                                  styles.historyTypeIcon,
                                  { backgroundColor: getTypeColor(item.type) + '15' },
                                ]}
                              >
                                <Ionicons
                                  name={getTypeIcon(item.type) as any}
                                  size={20}
                                  color={getTypeColor(item.type)}
                                />
                              </View>
                              <View>
                                <Text style={styles.historyEquipmentName}>
                                  {item.equipmentName}
                                </Text>
                                <View style={styles.historyMeta}>
                                  <Text
                                    style={[
                                      styles.historyTypeLabel,
                                      { color: getTypeColor(item.type) },
                                    ]}
                                  >
                                    {getTypeLabel(item.type)}
                                  </Text>
                                  <Text style={styles.historyMetaSeparator}>•</Text>
                                  <Text style={styles.historyActionLabel}>
                                    {getActionLabel(item.action)}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <Text style={styles.historyQuantity}>×{item.quantity}</Text>
                          </View>

                          <View style={styles.historyCardFooter}>
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color={Colors.textSecondary}
                            />
                            <Text style={styles.historyDate}>
                              {formatDate(item.date)}
                            </Text>
                          </View>

                          {item.serial && (
                            <View style={styles.historySerialContainer}>
                              <Ionicons
                                name="barcode-outline"
                                size={14}
                                color={Colors.textSecondary}
                              />
                              <Text style={styles.historySerial}>
                                מסטב: {item.serial}
                              </Text>
                            </View>
                          )}

                          {item.notes && (
                            <View style={styles.historyNotesContainer}>
                              <Ionicons
                                name="document-text-outline"
                                size={14}
                                color={Colors.textSecondary}
                              />
                              <Text style={styles.historyNotes}>{item.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
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

  // Header
  header: {
    backgroundColor: Colors.soldats,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
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

  resetButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 44,
  },

  // Content
  content: {
    flex: 1,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  // Search Card
  searchCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },

  searchTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },

  searchSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },

  searchInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  searchInput: {
    flex: 1,
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },

  // Results Section
  resultsSection: {
    marginTop: Spacing.lg,
  },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },

  soldierCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  soldierAvatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  soldierInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  soldierName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  soldierDetails: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Selected Soldier Card
  selectedSoldierCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.soldats,
    ...Shadows.small,
  },

  selectedSoldierAvatar: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.soldatsLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  selectedSoldierInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  selectedSoldierName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },

  selectedSoldierDetails: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // History Section
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },

  historyBadge: {
    backgroundColor: Colors.soldatsLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },

  historyBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.soldatsDark,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },

  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },

  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },

  // History List
  historyList: {
    gap: Spacing.md,
  },

  historyItem: {
    flexDirection: 'row',
  },

  historyTimeline: {
    width: 40,
    alignItems: 'center',
  },

  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: Colors.background,
  },

  historyLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.xs,
  },

  historyContent: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.small,
  },

  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },

  historyCardHeaderRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  historyTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyEquipmentName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },

  historyTypeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  historyMetaSeparator: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },

  historyActionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  historyQuantity: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },

  historyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },

  historyDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  historySerialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  historySerial: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  historyNotesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  historyNotes: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});

export default SoldierHistoryScreen;
