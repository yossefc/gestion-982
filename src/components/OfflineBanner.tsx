// Composant bannière offline
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../theme/colors';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠️ אין חיבור לאינטרנט - עובד במצב לא מקוון</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.status.warning,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  text: {
    color: Colors.text.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

