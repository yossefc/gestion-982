// Thème de couleurs pour l'application militaire
// Design professionnel et clair adapté pour l'armée

export const Colors = {
  // Couleurs de base
  background: {
    primary: '#f5f5f0',      // Beige très clair (fond principal)
    secondary: '#e8e8e0',    // Beige clair (fond secondaire)
    card: '#ffffff',         // Blanc (cartes)
    header: '#2c3e50',       // Bleu-gris foncé (headers)
  },

  // Couleurs de texte
  text: {
    primary: '#2c3e50',      // Texte principal foncé
    secondary: '#5a6c7d',    // Texte secondaire
    light: '#7f8c8d',        // Texte clair
    white: '#ffffff',        // Texte blanc
    link: '#34495e',         // Liens
  },

  // Couleurs militaires/fonctionnelles
  military: {
    olive: '#6b7c3a',        // Vert olive
    khaki: '#8b8970',        // Kaki
    navyBlue: '#2c5f7c',     // Bleu marine
    darkGreen: '#3d5a4a',    // Vert foncé
    tan: '#d4c4a8',          // Beige/tan
  },

  // Couleurs de statut
  status: {
    success: '#27ae60',      // Vert - חתום
    pending: '#e67e22',      // Orange - ממתין
    warning: '#f39c12',      // Jaune - אזהרה
    danger: '#c0392b',       // Rouge - זוכה/problème
    info: '#2980b9',         // Bleu - information
  },

  // Couleurs par module
  modules: {
    arme: '#c0392b',         // Rouge pour module Arme
    vetement: '#2980b9',     // Bleu pour module Vêtement
    common: '#6b7c3a',       // Vert olive pour commun
  },

  // Bordures et séparateurs
  border: {
    light: '#d4d4ce',
    medium: '#bfbfb5',
    dark: '#95958a',
  },

  // Overlay et ombres
  overlay: 'rgba(44, 62, 80, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

// Styles d'ombre pour les cartes
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};
