// Composant Card de statistique réutilisable
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows } from '../theme/Colors';

interface StatCardProps {
  label: string;
  value: string | number;
  backgroundColor?: string;
  textColor?: string;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  backgroundColor = Colors.backgroundCard,
  textColor = Colors.text,
  style,
}) => {
  return (
    <View style={[styles.card, { backgroundColor }, style]}>
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    ...Shadows.medium,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
});





