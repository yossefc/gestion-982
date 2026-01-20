// Service de gestion des utilisateurs
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User, UserRole } from '../types';

const USERS_COLLECTION = 'users';

/**
 * Récupère tous les utilisateurs
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as User[];

    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

/**
 * Récupère un utilisateur par son ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const users = await getAllUsers();
    return users.find(u => u.id === userId) || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

/**
 * Récupère un utilisateur par son email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as User;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

/**
 * Ajoute un nouvel utilisateur
 */
export const addUser = async (userData: Omit<User, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, USERS_COLLECTION), {
      ...userData,
      createdAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

/**
 * Met à jour un utilisateur
 */
export const updateUser = async (userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Met à jour le rôle d'un utilisateur
 */
export const updateUserRole = async (userId: string, role: UserRole): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { role });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

/**
 * Supprime un utilisateur
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Récupère les utilisateurs par rôle
 */
export const getUsersByRole = async (role: UserRole): Promise<User[]> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), where('role', '==', role));
    const querySnapshot = await getDocs(q);

    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as User[];

    return users;
  } catch (error) {
    console.error('Error getting users by role:', error);
    throw error;
  }
};

/**
 * Compte le nombre total d'utilisateurs
 */
export const getUserCount = async (): Promise<number> => {
  try {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting user count:', error);
    throw error;
  }
};

/**
 * Vérifie si un utilisateur a le rôle admin
 */
export const isAdmin = (user: User): boolean => {
  return user.role === 'admin';
};

/**
 * Vérifie si un utilisateur a accès au module Arme
 */
export const hasArmeAccess = (user: User): boolean => {
  return user.role === 'admin' || user.role === 'both' || user.role === 'arme';
};

/**
 * Vérifie si un utilisateur a accès au module Vêtement
 */
export const hasVetementAccess = (user: User): boolean => {
  return user.role === 'admin' || user.role === 'both' || user.role === 'vetement';
};

/**
 * Service object for user management
 */
export const userService = {
  getAll: getAllUsers,
  getById: getUserById,
  getByEmail: getUserByEmail,
  add: addUser,
  update: updateUser,
  updateRole: updateUserRole,
  delete: deleteUser,
  getByRole: getUsersByRole,
  getCount: getUserCount,
  isAdmin,
  hasArmeAccess,
  hasVetementAccess,
};
