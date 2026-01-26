/**
 * UserManagementScreen.tsx - Gestion des utilisateurs
 * Design militaire professionnel
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { userService } from '../../services/userService';
import { UserRole } from '../../types';

interface User {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'both' | 'arme' | 'vetement';
}

const ROLES = [
  { value: 'admin', label: 'מנהל', color: Colors.soldatsDark, bg: Colors.soldatsLight },
  { value: 'both', label: 'מלא', color: Colors.successDark, bg: Colors.successLight },
  { value: 'arme', label: 'נשק', color: Colors.armeDark, bg: Colors.armeLight },
  { value: 'vetement', label: 'אפנאות', color: Colors.vetementDark, bg: Colors.vetementLight },
];

const UserManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת המשתמשים');
    } finally {
      setLoading(false);
    }
  };

  const getRoleConfig = (role: string) => {
    return ROLES.find(r => r.value === role) || { label: role, color: Colors.textSecondary, bg: Colors.backgroundSecondary };
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setModalVisible(true);
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      await userService.updateRole(selectedUser.id, newRole as UserRole);
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, role: newRole as any } : u
      ));
      setModalVisible(false);
      Alert.alert('הצלחה', 'התפקיד עודכן בהצלחה');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את התפקיד');
    } finally {
      setSaving(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const roleConfig = getRoleConfig(item.role);

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => handleEditUser(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={24} color={Colors.primary} />
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName || item.email.split('@')[0]}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>

        <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}>
          <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
            {roleConfig.label}
          </Text>
        </View>

        <Ionicons name="chevron-back" size={20} color={Colors.textLight} />
      </TouchableOpacity>
    );
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
          <Text style={styles.headerTitle}>ניהול משתמשים</Text>
          <Text style={styles.headerSubtitle}>{users.length} משתמשים</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadUsers}
        >
          <Ionicons name="refresh" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCardContainer}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.info} />
          <Text style={styles.infoText}>
            לחץ על משתמש כדי לשנות את ההרשאות שלו
          </Text>
        </View>
      </View>

      {/* Users List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>טוען משתמשים...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadUsers}
        />
      )}

      {/* Edit Role Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>שינוי תפקיד</Text>
              <View style={styles.modalCloseButton} />
            </View>

            {selectedUser && (
              <View style={styles.modalContent}>
                <Text style={styles.modalUserName}>
                  {selectedUser.displayName || selectedUser.email}
                </Text>
                <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>

                <Text style={styles.modalSectionTitle}>בחר תפקיד:</Text>

                {ROLES.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleOption,
                      selectedUser.role === role.value && styles.roleOptionSelected,
                    ]}
                    onPress={() => handleUpdateRole(role.value)}
                    disabled={saving}
                  >
                    <View style={[styles.roleOptionDot, { backgroundColor: role.color }]} />
                    <Text style={[
                      styles.roleOptionText,
                      selectedUser.role === role.value && styles.roleOptionTextSelected,
                    ]}>
                      {role.label}
                    </Text>
                    {selectedUser.role === role.value && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}

                {saving && (
                  <View style={styles.savingOverlay}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.savingText}>שומר...</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
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

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info Card
  infoCardContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
  },

  infoCard: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.xs,
  },

  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.infoDark,
    textAlign: 'right',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // List
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  userCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },

  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: Spacing.md,
  },

  userName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  roleBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },

  roleBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  modalContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    ...Shadows.large,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },

  modalContent: {
    padding: Spacing.lg,
  },

  modalUserName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },

  modalUserEmail: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  modalSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },

  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundInput,
    marginBottom: Spacing.sm,
  },

  roleOptionSelected: {
    backgroundColor: Colors.primaryLight + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  roleOptionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },

  roleOptionText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },

  roleOptionTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },

  savingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },

  savingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});

export default UserManagementScreen;