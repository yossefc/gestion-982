// Types pour l'application Gestion 982

// Rôles utilisateur
export type UserRole = 'admin' | 'both' | 'arme' | 'vetement';

// Utilisateur
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
}

// Soldat
export interface Soldier {
  id: string;
  personalNumber: string;  // מספר אישי
  name: string;            // שם
  phone?: string;          // טלפון
  company: string;         // פלוגה
  department?: string;     // מחלקה
  createdAt: Date;
  updatedAt?: Date;
  // Champs de recherche normalisés (générés automatiquement)
  searchKey?: string;      // Clé de recherche (name + personalNumber + phone + company)
  nameLower?: string;      // Nom en lowercase pour tri
}

// Statut équipement
export type EquipmentStatus = 'נופק לחייל' | 'לא חתום' | 'זוכה' | '';

// Équipement combat (מנות וציוד)
export interface CombatEquipment {
  id: string;
  name: string;           // שם הציוד
  category: string;       // קטגוריה
  serial?: string;        // מסטב
  hasSubEquipment: boolean;
  subEquipments?: SubEquipment[];
}

// Sous-équipement
export interface SubEquipment {
  id: string;
  name: string;
  serial?: string;
}

// Équipement vêtement (ביגוד)
export interface ClothingEquipment {
  id: string;
  name: string;
  yamach?: number;        // ימח - quantité totale
}

// Action d'attribution
export type AssignmentAction = 'issue' | 'add' | 'return' | 'credit';

// Attribution d'équipement
export interface Assignment {
  id: string;
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  soldierPhone?: string;  // Téléphone du soldat (pour WhatsApp)
  soldierCompany?: string; // Compagnie du soldat
  type: 'combat' | 'clothing';
  action?: AssignmentAction;  // Type d'opération
  items: AssignmentItem[];
  signature?: string;     // Base64 de la signature
  pdfUrl?: string;        // URL du PDF généré
  status: EquipmentStatus;
  timestamp: Date;
  assignedBy: string;     // User ID qui a fait l'attribution
  assignedByName?: string; // Nom de l'opérateur
  assignedByEmail?: string; // Email de l'opérateur
}

// Item dans une attribution
export interface AssignmentItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  serial?: string;
  subEquipments?: {
    name: string;
    serial?: string;
  }[];
}

// Mana (מנה)
export interface Mana {
  id: string;
  name: string;           // Ex: מנת מפקד, מנת לוחם
  equipments: {
    equipmentId: string;
    equipmentName: string;
    quantity: number;
  }[];
}

// Compagnie (פלוגה)
export type Company = 'פלוגה א' | 'פלוגה ב' | 'פלוגה ג' | 'פלוגה ד' | 'מפקדה' | 'ניוד';

// Props de navigation
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  // Module commun
  SoldierSearch: { mode: 'combat' | 'clothing' };
  SoldierDetails: { soldierId: string };
  AddSoldier: undefined;
  // Module Arme
  ArmeHome: undefined;
  ManotList: undefined;
  ManotDetails: { manaId: string };
  CombatEquipmentList: undefined;
  CombatAssignment: { soldierId: string };
  // Module Vêtement
  VetementHome: undefined;
  ClothingSignature: { soldierId: string };
  ClothingReturn: { soldierId: string };
  ClothingDashboard: undefined;
  ClothingEquipmentManagement: undefined;
  // Admin
  AdminPanel: undefined;
  UserManagement: undefined;
  // Signature
  SignatureScreen: { 
    soldierId: string; 
    soldierName: string;
    type: 'combat' | 'clothing';
    items: AssignmentItem[];
  };
};

// Statistiques Dashboard
export interface DashboardStats {
  totalSoldiers: number;
  signedSoldiers: number;
  pendingSoldiers: number;
  returnedEquipment: number;
  equipmentByType: {
    name: string;
    issued: number;
    returned: number;
    pending: number;
  }[];
}
