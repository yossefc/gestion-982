/**
 * SharedStyles.ts - Styles partagés pour tous les écrans
 * Design militaire professionnel et cohérent
 */

import { StyleSheet, Platform, Dimensions } from 'react-native';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from './Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// HEADER STYLES (Utilisé par tous les écrans)
// ============================================

export const HeaderStyles = StyleSheet.create({
  // Header principal avec gradient effect
  header: {
    backgroundColor: Colors.backgroundHeader,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    ...Shadows.medium,
  },

  // Version sans border radius (pour certains écrans)
  headerFlat: {
    backgroundColor: Colors.backgroundHeader,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: Spacing.lg,
    ...Shadows.small,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },

  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerAction: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Spacer pour équilibrer le header
  headerSpacer: {
    width: 44,
  },
});

// ============================================
// CARD STYLES
// ============================================

export const CardStyles = StyleSheet.create({
  // Card standard
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  // Card avec bordure colorée à gauche
  cardAccent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    ...Shadows.small,
  },

  // Card pour les stats
  statsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flex: 1,
    alignItems: 'center',
    ...Shadows.small,
  },

  // Card pressable (avec effet hover)
  cardPressable: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  cardPressed: {
    backgroundColor: Colors.backgroundSecondary,
    transform: [{ scale: 0.98 }],
  },

  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },

  cardSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  cardValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.primary,
  },

  cardLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

// ============================================
// BUTTON STYLES
// ============================================

export const ButtonStyles = StyleSheet.create({
  // Bouton primaire
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Shadows.small,
  },

  primaryPressed: {
    backgroundColor: Colors.primaryDark,
  },

  primaryText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Bouton secondaire
  secondary: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },

  secondaryText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Bouton danger
  danger: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },

  dangerText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Bouton success
  success: {
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },

  successText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Bouton outline
  outline: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  outlineText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Bouton désactivé
  disabled: {
    backgroundColor: Colors.disabled,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textLight,
  },

  // Icon button
  icon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },

  iconSmall: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ============================================
// INPUT STYLES
// ============================================

export const InputStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  input: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },

  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundCard,
  },

  inputError: {
    borderColor: Colors.danger,
  },

  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  // Search input
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },

  searchIcon: {
    marginLeft: Spacing.sm,
  },
});

// ============================================
// LIST STYLES
// ============================================

export const ListStyles = StyleSheet.create({
  container: {
    flex: 1,
  },

  item: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.xs,
  },

  itemPressed: {
    backgroundColor: Colors.backgroundSecondary,
  },

  itemContent: {
    flex: 1,
    marginRight: Spacing.md,
  },

  itemTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },

  itemSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },

  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemChevron: {
    marginLeft: Spacing.sm,
  },

  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },

  emptyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});

// ============================================
// BADGE STYLES
// ============================================

export const BadgeStyles = StyleSheet.create({
  // Badge de base
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },

  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Variantes
  success: {
    backgroundColor: Colors.successLight,
  },
  successText: {
    color: Colors.successDark,
  },

  danger: {
    backgroundColor: Colors.dangerLight,
  },
  dangerText: {
    color: Colors.dangerDark,
  },

  warning: {
    backgroundColor: Colors.warningLight,
  },
  warningText: {
    color: Colors.warningDark,
  },

  info: {
    backgroundColor: Colors.infoLight,
  },
  infoText: {
    color: Colors.infoDark,
  },

  primary: {
    backgroundColor: Colors.primaryLight + '30',
  },
  primaryText: {
    color: Colors.primary,
  },

  // Count badge (pour notifications)
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },

  countText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});

// ============================================
// MODAL STYLES
// ============================================

export const ModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  container: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...Shadows.large,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    padding: Spacing.lg,
  },

  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },

  footerButton: {
    flex: 1,
  },
});

// ============================================
// SCREEN LAYOUT
// ============================================

export const ScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  section: {
    marginBottom: Spacing.xl,
  },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },

  sectionSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'right',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});

// ============================================
// MODULE-SPECIFIC COLORS
// ============================================

export const ModuleColors = {
  arme: {
    primary: Colors.arme,
    light: Colors.armeLight,
    dark: Colors.armeDark,
  },
  vetement: {
    primary: Colors.vetement,
    light: Colors.vetementLight,
    dark: Colors.vetementDark,
  },
  admin: {
    primary: Colors.soldats,
    light: Colors.soldatsLight,
    dark: Colors.soldatsDark,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'success':
    case 'completed':
    case 'active':
      return { bg: Colors.successLight, text: Colors.successDark };
    case 'pending':
    case 'warning':
      return { bg: Colors.warningLight, text: Colors.warningDark };
    case 'error':
    case 'danger':
    case 'failed':
      return { bg: Colors.dangerLight, text: Colors.dangerDark };
    default:
      return { bg: Colors.infoLight, text: Colors.infoDark };
  }
};

export const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'admin':
      return { bg: Colors.soldatsLight, text: Colors.soldatsDark };
    case 'arme':
      return { bg: Colors.armeLight, text: Colors.armeDark };
    case 'vetement':
      return { bg: Colors.vetementLight, text: Colors.vetementDark };
    case 'both':
      return { bg: Colors.successLight, text: Colors.successDark };
    default:
      return { bg: Colors.backgroundSecondary, text: Colors.textSecondary };
  }
};