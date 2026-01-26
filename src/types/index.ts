// Types pour l'application Gestion 982

// Rôles utilisateur
export type UserRole = 'admin' | 'both' | 'arme' | 'vetement';

// Utilisateur
export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string; // Display name (alias for name or from Firebase)
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
  isRsp?: boolean;         // Est un רס"פ (Company Sergeant)
}

// ... existing types ...

// ============================================
// GESTION RSP (רס"פים)
// ============================================

// Équipement spécial RSP
export interface RspEquipment {
  id: string;
  name: string;
  category: string;
  quantity?: number; // Stock total (YAMAH)
  createdAt: Date;
}

// Attribution RSP
export interface RspAssignment {
  id: string;
  soldierId: string;        // RSP soldier ID
  soldierName: string;
  company: string;          // פלוגה
  equipmentId: string;
  equipmentName: string;
  quantity: number;         // Quantité totale agrégée
  status: 'signed' | 'credited' | 'gap'; // הוחתם/זוכה/פער
  lastSignatureDate: Date;
  notes?: string;
  history: {                // Log des changements
    date: Date;
    quantityChange: number;
    action: 'add' | 'remove';
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// ... existing code ...

// Statut équipement
export type EquipmentStatus = 'נופק לחייל' | 'לא חתום' | 'זוכה' | 'הופקד' | 'אופסן' | 'תקול' | '';

// Équipement combat (מנות וציוד)
export interface CombatEquipment {
  id: string;
  name: string;           // שם הציוד
  nameKey?: string;       // Nom normalisé pour unicité
  category: string;       // קטגוריה
  categoryKey?: string;   // Catégorie normalisée
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

// Équipement vêtement (אפנאות)
export interface ClothingEquipment {
  id: string;
  name: string;
  nameKey?: string;       // Nom normalisé pour unicité
  yamach?: number;        // ימח - quantité totale
}

// Action d'attribution
export type AssignmentAction = 'issue' | 'add' | 'return' | 'credit' | 'storage' | 'retrieve';

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

// Type de package
export type PackageType = 'מנה' | 'ערכה';

// Mana (מנה) ou Arakha (ערכה)
export interface Mana {
  id: string;
  name: string;           // Ex: מנת מפקד, מנת לוחם, ערכת מג"ד
  type?: PackageType;     // סוג: מנה או ערכה (optionnel pour compatibilité)
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
  SoldierSearch: {
    mode: 'signature' | 'return' | 'storage' | 'retrieve' | 'rsp_issue' | 'rsp_credit';
    type?: 'combat' | 'clothing'
  };
  SoldierDetails: { soldierId: string };
  AddSoldier: undefined;
  EditSoldier: { soldier: Soldier };
  // Module Arme
  ArmeHome: undefined;
  ManotList: undefined;
  ManotDetails: { manaId: string };
  AddMana: { manaId?: string };  // manaId optionnel pour mode édition
  CombatEquipmentList: undefined;
  AddCombatEquipment: { equipmentId?: string };  // equipmentId optionnel pour mode édition
  CombatAssignment: { soldierId: string };
  CombatReturn: { soldierId: string };
  CombatStorage: { soldierId: string };
  CombatRetrieve: { soldierId: string };
  CombatStock: undefined;
  // Inventaire d'armes
  WeaponInventoryList: undefined;
  AddWeaponToInventory: { weaponId?: string };
  BulkImportWeapons: undefined;
  AssignWeapon: { weaponId: string };
  WeaponStorage: undefined;
  // Module Vêtement
  VetementHome: undefined;
  ClothingSignature: { soldierId: string };
  ClothingReturn: { soldierId: string };
  ClothingStock: undefined;
  ClothingDashboard: undefined;
  ClothingEquipmentManagement: undefined;
  // Admin
  AdminPanel: undefined;
  UserManagement: undefined;
  HoldingsRecalculate: undefined;
  DatabaseDebug: undefined;
  Migration: undefined;
  // Signature
  SignatureScreen: {
    soldierId: string;
    soldierName: string;
    type: 'combat' | 'clothing';
    items: AssignmentItem[];
  };
  RspMigration: undefined;
  SoldierHistory: undefined;
  // Module RSP
  RspHome: undefined;
  RspEquipment: undefined;
  RspAssignment: undefined;
  RspTable: undefined;
  RspReadOnly: undefined;
};

export interface HoldingItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  serials: string[];  // Liste des numéros de série possédés
  status?: 'assigned' | 'stored'; // 'assigned' = en main, 'stored' = en אפסון
}

export interface SoldierHoldings {
  soldierId: string;
  soldierName: string;
  soldierPersonalNumber: string;
  type: 'combat' | 'clothing';
  items: HoldingItem[];
  lastUpdated: Date;
  // Champs agrégés pour requêtes efficaces
  outstandingCount: number;  // Nombre total d'items à rendre
  hasSignedEquipment: boolean;  // A déjà signé pour des équipements
  status: 'OPEN' | 'CLOSED';  // OPEN = reste à rendre, CLOSED = tout rendu
  currentPdf?: {
    type: 'SIGNATURE' | 'ZIKUY';  // Type du PDF actuel
    storagePath: string;  // Chemin dans Storage
    url?: string;  // URL de téléchargement
    updatedAt: Date;
  };
}

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

// ============================================
// INVENTAIRE D'ARMES (ניהול מלאי נשק)
// ============================================

// Statut d'une arme dans l'inventaire
export type WeaponStatus = 'available' | 'assigned' | 'stored' | 'defective';

// Item d'inventaire d'arme
export interface WeaponInventoryItem {
  id: string;
  category: string;           // M16, M203, מאג, etc.
  serialNumber: string;        // מסטב
  status: WeaponStatus;        // disponible, assigné, ou en אפסון
  assignedTo?: {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    assignedDate: Date;
  };
  storageDate?: Date;          // Date de mise en אפסון
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}
