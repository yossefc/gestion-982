// Écran de gestion des utilisateurs
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../../theme/colors';
import { User, UserRole } from '../../types';

// Service de gestion des utilisateurs
import { getAllUsers, updateUserRole } from '../../services/userService';

const UserManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('vetement');
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת המשתמשים');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      await updateUserRole(editingUser.id, selectedRole);

      Alert.alert('הצלחה', 'התפקיד עודכן בהצלחה');
      setModalVisible(false);
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('שגיאה', 'נכשל בעדכון התפקיד');
    }
  };

  const handleAddUser = () => {
    Alert.alert(
      'הוספת משתמש',
      'כדי להוסיף משתמש חדש, המשתמש צריך להירשם דרך מסך ההתחברות.\n\nניתן לשנות את תפקידו לאחר מכן.',
      [{ text: 'אישור' }]
    );
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return '#9b59b6';
      case 'both':
        return Colors.status.success;
      case 'arme':
        return Colors.modules.arme;
      case 'vetement':
        return Colors.modules.vetement;
      default:
        return Colors.text.secondary;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'מנהל מערכת';
      case 'both':
        return 'גישה מלאה';
      case 'arme':
        return 'נשק בלבד';
      case 'vetement':
        return 'ביגוד בלבד';
      default:
        return role;
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
            <Text style={styles.title}>ניהול משתמשים</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9b59b6" />
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
          <Text style={styles.title}>ניהול משתמשים</Text>
          <Text style={styles.subtitle}>👥 {users.length} משתמשים</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Users List */}
        {users.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>אין משתמשים במערכת</Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {users.map(user => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: getRoleBadgeColor(user.role) },
                    ]}
                  >
                    <Text style={styles.roleBadgeText}>
                      {getRoleLabel(user.role)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditUser(user)}
                >
                  <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 הסבר תפקידים</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.infoBold}>מנהל מערכת</Text> - גישה מלאה לכל המערכת כולל ניהול משתמשים{'\n'}
            • <Text style={styles.infoBold}>גישה מלאה</Text> - גישה לנשק וביגוד{'\n'}
            • <Text style={styles.infoBold}>נשק בלבד</Text> - גישה רק למודול הנשק{'\n'}
            • <Text style={styles.infoBold}>ביגוד בלבד</Text> - גישה רק למודול הביגוד
          </Text>
        </View>
      </ScrollView>

      {/* FAB - Add User */}
      <TouchableOpacity style={styles.fab} onPress={handleAddUser}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Edit User Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>עריכת תפקיד משתמש</Text>

            {editingUser && (
              <>
                <View style={styles.modalUserInfo}>
                  <Text style={styles.modalUserName}>{editingUser.name}</Text>
                  <Text style={styles.modalUserEmail}>{editingUser.email}</Text>
                </View>

                <Text style={styles.label}>בחר תפקיד:</Text>

                <View style={styles.rolesContainer}>
                  {(['admin', 'both', 'arme', 'vetement'] as UserRole[]).map(
                    role => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          selectedRole === role && styles.roleOptionSelected,
                          {
                            borderColor:
                              selectedRole === role
                                ? getRoleBadgeColor(role)
                                : Colors.border.light,
                          },
                        ]}
                        onPress={() => setSelectedRole(role)}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            selectedRole === role &&
                              styles.roleOptionTextSelected,
                          ]}
                        >
                          {getRoleLabel(role)}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>ביטול</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveUser}
                  >
                    <Text style={styles.saveButtonText}>שמור</Text>
                  </TouchableOpacity>
                </View>
              </>
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
  usersList: {
    gap: 12,
    marginBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#9b59b6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.status.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 20,
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
    color: Colors.text.secondary,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#9b59b6',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
  },
  fabText: {
    fontSize: 32,
    color: Colors.text.white,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#b3d9f2',
    marginBottom: 80,
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
  infoBold: {
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Shadows.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 20,
    textAlign: 'right',
  },
  modalUserInfo: {
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 12,
    textAlign: 'right',
  },
  rolesContainer: {
    gap: 10,
    marginBottom: 20,
  },
  roleOption: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 2,
    borderColor: Colors.border.light,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: Colors.background.card,
  },
  roleOptionText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  roleOptionTextSelected: {
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#9b59b6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
});

export default UserManagementScreen;
