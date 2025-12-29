// Composant Badge de statut réutilisable
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';
import { EquipmentStatus } from '../types';

interface StatusBadgeProps {
  status: EquipmentStatus;
  style?: ViewStyle;
}

const statusConfig: Record<EquipmentStatus, { label: string; color: string; bgColor: string }> = {
  'נופק לחייל': {
    label: 'נופק לחייל',
    color: Colors.text.white,
    bgColor: Colors.status.success,
  },
  'לא חתום': {
    label: 'לא חתום',
    color: Colors.text.white,
    bgColor: Colors.status.warning,
  },
  'זוכה': {
    label: 'זוכה',
    color: Colors.text.white,
    bgColor: Colors.status.info,
  },
  '': {
    label: 'ללא סטטוס',
    color: Colors.text.secondary,
    bgColor: Colors.border.medium,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style }) => {
  const config = statusConfig[status] || statusConfig[''];

  return (
    <View style={[styles.badge, { backgroundColor: config.bgColor }, style]}>
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});




