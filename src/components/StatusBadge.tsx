// Composant Badge de statut réutilisable
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../theme/Colors';
import { EquipmentStatus } from '../types';

interface StatusBadgeProps {
  status: EquipmentStatus;
  style?: ViewStyle;
}

const statusConfig: Record<EquipmentStatus, { label: string; color: string; bgColor: string }> = {
  'נופק לחייל': {
    label: 'נופק לחייל',
    color: Colors.textWhite,
    bgColor: Colors.success,
  },
  'לא חתום': {
    label: 'לא חתום',
    color: Colors.textWhite,
    bgColor: Colors.warning,
  },
  'זוכה': {
    label: 'זוכה',
    color: Colors.textWhite,
    bgColor: Colors.info,
  },
  'הופקד': {
    label: 'הופקד',
    color: Colors.textWhite,
    bgColor: Colors.infoDark,
  },
  'אופסן': {
    label: 'אופסן',
    color: Colors.textWhite,
    bgColor: Colors.warningDark,
  },
  'תקול': {
    label: 'תקול',
    color: Colors.textWhite,
    bgColor: Colors.danger,
  },
  '': {
    label: 'ללא סטטוס',
    color: Colors.textSecondary,
    bgColor: Colors.borderMedium,
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





