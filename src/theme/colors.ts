/**
 * Theme Colors - Système de design unifié pour Gestion 982
 * 
 * IMPORTANT: Structure PLATE avec valeurs directes (pas d'objets imbriqués)
 * pour compatibilité avec React Native StyleSheet
 */

// ============================================
// COULEURS PRINCIPALES (valeurs directes)
// ============================================

export const Colors = {
  // === PRIMAIRES ===
  primary: '#1B365D',
  primaryLight: '#2D4A7C',
  primaryDark: '#0F1F3D',

  secondary: '#2D5016',
  secondaryLight: '#3D6B1E',
  secondaryDark: '#1E3810',

  // === BACKGROUNDS ===
  background: '#F5F7FA',
  backgroundSecondary: '#FFFFFF',
  backgroundCard: '#FFFFFF',
  backgroundHeader: '#1B365D',
  backgroundInput: '#F8F9FA',

  // === TEXTE ===
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textWhite: '#FFFFFF',
  textLink: '#3B82F6',
  textMuted: '#9CA3AF',

  // === BORDURES ===
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderMedium: '#D1D5DB',
  borderDark: '#9CA3AF',
  borderFocus: '#3B82F6',

  // === STATUS ===
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#059669',

  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerDark: '#DC2626',

  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',

  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#2563EB',

  // === MODULES ===
  arme: '#2D5016',
  armeLight: '#E8F5E9',
  armeDark: '#1E3810',

  vetement: '#1B365D',
  vetementLight: '#E3F2FD',
  vetementDark: '#0F1F3D',

  soldats: '#7C3AED',
  soldatsLight: '#EDE9FE',
  soldatsDark: '#5B21B6',

  // === MILITAIRE ===
  olive: '#556B2F',
  khaki: '#C3B091',
  navyBlue: '#1B365D',
  darkGreen: '#2D5016',
  tan: '#D2B48C',
  armyGreen: '#4B5320',

  // === UTILITAIRES ===
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  transparent: 'transparent',
  divider: '#E5E7EB',
  disabled: '#D1D5DB',
  placeholder: '#9CA3AF',
  skeleton: '#E5E7EB',

  // === ACCENT ===
  accent: '#6366F1',
  accentLight: '#E0E7FF',
  accentDark: '#4F46E5',
};

// ============================================
// SHADOWS
// ============================================

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

// ============================================
// SPACING
// ============================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ============================================
// BORDER RADIUS
// ============================================

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// ============================================
// FONT SIZES
// ============================================

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export default { Colors, Shadows, Spacing, BorderRadius, FontSize };