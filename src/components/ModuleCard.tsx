// Composant Card de module avec icône et état
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows } from '../theme/colors';

interface ModuleCardProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: string | number;
  backgroundColor?: string;
  style?: ViewStyle;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  disabled = false,
  badge,
  backgroundColor = Colors.background.card,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
        {badge !== undefined && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {!disabled && (
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>‹</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.medium,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    position: 'relative',
    marginLeft: 15,
  },
  icon: {
    fontSize: 36,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.status.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: Colors.text.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  chevron: {
    marginRight: 5,
  },
  chevronText: {
    fontSize: 28,
    color: Colors.military.navyBlue,
    fontWeight: 'bold',
  },
});

