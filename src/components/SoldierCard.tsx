// Composant Card de soldat réutilisable
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows } from '../theme/Colors';
import { Soldier } from '../types';

interface SoldierCardProps {
  soldier: Soldier;
  onPress: () => void;
  showChevron?: boolean;
  style?: ViewStyle;
}

export const SoldierCard: React.FC<SoldierCardProps> = ({
  soldier,
  onPress,
  showChevron = true,
  style,
}) => {
  const initials = soldier.name.charAt(0);

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{soldier.name}</Text>
        <Text style={styles.details}>
          מ.א: {soldier.personalNumber} | {soldier.company}
        </Text>
        {soldier.phone && (
          <Text style={styles.phone}>{soldier.phone}</Text>
        )}
      </View>

      {showChevron && (
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.medium,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textWhite,
  },
  info: {
    flex: 1,
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  details: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  phone: {
    fontSize: 12,
    color: Colors.textLight,
  },
  chevron: {
    marginRight: 10,
  },
  chevronText: {
    fontSize: 24,
    color: Colors.navyBlue,
  },
});





