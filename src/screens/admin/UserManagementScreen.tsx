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
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { AppModal, ModalType } from '../../components';
import { userService } from '../../services/userService';
import { UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  company?: string;  // פלוגה - requis pour le rôle RSP
  signature?: string;
  rank?: string;
}

const ROLES = [
  { value: 'admin', label: 'מנהל', color: Colors.soldatsDark, bg: Colors.soldatsLight },
  { value: 'both', label: 'מלא', color: Colors.successDark, bg: Colors.successLight },
  { value: 'arme', label: 'נשק', color: Colors.armeDark, bg: Colors.armeLight },
  { value: 'vetement', label: 'אפסנאות', color: Colors.vetementDark, bg: Colors.vetementLight },
  { value: 'rsp', label: 'רס"פ', color: Colors.warningDark, bg: Colors.warningLight },
  { value: 'shlishut', label: 'שלישות', color: Colors.infoDark, bg: Colors.infoLight },
];

const COMPANIES = ['פלוגה א', 'פלוגה ב', 'פלוגה ג', 'פלוגה ד', 'מפקדה', 'ניוד'];

const UserManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  // AppModal state
  const [appModalVisible, setAppModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalButtons, setModalButtons] = useState<any[]>([]);

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
      setModalType('error');
      setModalMessage('לא ניתן לטעון את רשימת המשתמשים');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const getRoleConfig = (role: string) => {
    return ROLES.find(r => r.value === role) || { label: role, color: Colors.textSecondary, bg: Colors.backgroundSecondary };
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setSelectedCompany(user.company || '');
    setModalVisible(true);
  };

  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
    // Si ce n'est pas RSP, effacer la company
    if (role !== 'rsp') {
      setSelectedCompany('');
    }
  };

  const handleSelectCompany = (company: string) => {
    setSelectedCompany(company);
  };

  const handleSaveChanges = async () => {
    if (!selectedUser) return;

    // Validation: RSP doit avoir une company
    if (selectedRole === 'rsp' && !selectedCompany) {
      setModalType('warning');
      setModalTitle('שגיאה');
      setModalMessage('יש לבחור פלוגה עבור רס"פ');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
      return;
    }

    try {
      setSaving(true);
      // Mettre à jour le rôle et la company
      await userService.updateRole(selectedUser.id, selectedRole as UserRole);
      if (selectedRole === 'rsp') {
        await userService.updateCompany(selectedUser.id, selectedCompany);
      } else {
        // Effacer la company si ce n'est plus RSP
        await userService.updateCompany(selectedUser.id, '');
      }
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, role: selectedRole as any, company: selectedRole === 'rsp' ? selectedCompany : undefined } : u
      ));
      setModalVisible(false);
      setModalType('success');
      setModalTitle('הצלחה');
      setModalMessage('התפקיד עודכן בהצלחה');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
    } catch (error) {
      setModalType('error');
      setModalMessage('לא ניתן לעדכן את התפקיד');
      setModalButtons([{ text: 'אישור', style: 'primary', onPress: () => setAppModalVisible(false) }]);
      setAppModalVisible(true);
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

        <TouchableOpacity
          style={styles.sigButton}
          onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={item.signature ? Colors.success : Colors.textLight}
          />
          {item.signature && (
            <View style={styles.sigDot} />
          )}
        </TouchableOpacity>

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

      {/* My Profile Button */}
      <TouchableOpacity
        style={styles.myProfileButton}
        onPress={() => navigation.navigate('UserProfile')}
        activeOpacity={0.8}
      >
        <View style={styles.myProfileLeft}>
          <View style={styles.myProfileAvatar}>
            {currentUser?.signature ? (
              <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            ) : (
              <Ionicons name="person-circle-outline" size={22} color={Colors.arme} />
            )}
          </View>
          <View>
            <Text style={styles.myProfileTitle}>הפרופיל שלי — חתימת מנפק</Text>
            <Text style={styles.myProfileSubtitle}>
              {currentUser?.signature ? 'חתימה שמורה ✓' : 'לחץ להגדרת חתימה'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-back" size={20} color={Colors.arme} />
      </TouchableOpacity>

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
                      selectedRole === role.value && styles.roleOptionSelected,
                    ]}
                    onPress={() => handleSelectRole(role.value)}
                    disabled={saving}
                  >
                    <View style={[styles.roleOptionDot, { backgroundColor: role.color }]} />
                    <Text style={[
                      styles.roleOptionText,
                      selectedRole === role.value && styles.roleOptionTextSelected,
                    ]}>
                      {role.label}
                    </Text>
                    {selectedRole === role.value && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}

                {/* Sélecteur de פלוגה pour RSP */}
                {selectedRole === 'rsp' && (
                  <>
                    <Text style={styles.modalSectionTitle}>בחר פלוגה:</Text>
                    <View style={styles.companyGrid}>
                      {COMPANIES.map((company) => (
                        <TouchableOpacity
                          key={company}
                          style={[
                            styles.companyOption,
                            selectedCompany === company && styles.companyOptionSelected,
                          ]}
                          onPress={() => handleSelectCompany(company)}
                          disabled={saving}
                        >
                          <Text style={[
                            styles.companyOptionText,
                            selectedCompany === company && styles.companyOptionTextSelected,
                          ]}>
                            {company}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Bouton de sauvegarde */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    saving && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveChanges}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={Colors.textWhite} />
                  ) : (
                    <Text style={styles.saveButtonText}>שמור שינויים</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

      </Modal>

      {/* App Modal */}
      <AppModal
        visible={appModalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setAppModalVisible(false)}
      />
    </View >
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

  // Company selector styles
  companyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },

  companyOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  companyOptionSelected: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
  },

  companyOptionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },

  companyOptionTextSelected: {
    fontWeight: '600',
    color: Colors.warningDark,
  },

  // Save button styles
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },

  saveButtonDisabled: {
    backgroundColor: Colors.textLight,
  },

  saveButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Signature button on user card
  sigButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    position: 'relative',
  },

  sigDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.backgroundCard,
  },

  // My Profile button
  myProfileButton: {
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.arme + '50',
    ...Shadows.small,
  },

  myProfileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },

  myProfileAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.armeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  myProfileTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.armeDark,
    textAlign: 'right',
  },

  myProfileSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
});

export default UserManagementScreen;