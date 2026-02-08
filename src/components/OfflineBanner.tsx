/**
 * OfflineBanner - Indicateur de statut offline/sync
 *
 * Affiche une bannière quand l'app est offline ou
 * quand des opérations sont en attente de synchronisation.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../contexts/OfflineContext';
import { Colors } from '../theme/Colors';

interface OfflineBannerProps {
  showPendingCount?: boolean;
  onPress?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  showPendingCount = true,
  onPress,
}) => {
  const {
    isOnline,
    pendingCount,
    syncStatus,
    syncNow,
  } = useOffline();

  const [fadeAnim] = useState(new Animated.Value(0));

  // Animation d'apparition/disparition
  useEffect(() => {
    const shouldShow = !isOnline || pendingCount > 0;

    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, pendingCount, fadeAnim]);

  // Ne rien afficher si online et pas d'opérations en attente
  if (isOnline && pendingCount === 0) {
    return null;
  }

  const handlePress = async () => {
    if (onPress) {
      onPress();
    } else if (isOnline && pendingCount > 0) {
      // Tenter de sync manuellement
      await syncNow();
    }
  };

  // Déterminer le style selon l'état
  const getBannerStyle = () => {
    if (!isOnline) {
      return {
        backgroundColor: Colors.warning,
        icon: 'cloud-offline' as const,
        text: 'אין חיבור לאינטרנט',
      };
    }
    if (syncStatus === 'syncing') {
      return {
        backgroundColor: Colors.info,
        icon: 'sync' as const,
        text: 'מסנכרן נתונים...',
      };
    }
    if (syncStatus === 'error') {
      return {
        backgroundColor: Colors.danger,
        icon: 'alert-circle' as const,
        text: `${pendingCount} פעולות ממתינות - לחץ לסנכרון`,
      };
    }
    if (pendingCount > 0) {
      return {
        backgroundColor: Colors.info,
        icon: 'time' as const,
        text: `${pendingCount} פעולות ממתינות לסנכרון`,
      };
    }
    return null;
  };

  const bannerStyle = getBannerStyle();
  if (!bannerStyle) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: bannerStyle.backgroundColor }]}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={syncStatus === 'syncing'}
      >
        <View style={styles.content}>
          {syncStatus === 'syncing' ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <Ionicons
              name={bannerStyle.icon}
              size={18}
              color={Colors.textWhite}
            />
          )}
          <Text style={styles.text}>{bannerStyle.text}</Text>
        </View>

        {showPendingCount && pendingCount > 0 && isOnline && (
          <View style={styles.syncButton}>
            <Ionicons name="refresh" size={16} color={Colors.textWhite} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Version minimaliste - juste un point de statut
 */
export const OfflineStatusDot: React.FC = () => {
  const { isOnline, pendingCount, syncStatus } = useOffline();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  const getColor = () => {
    if (!isOnline) return Colors.warning;
    if (syncStatus === 'syncing') return Colors.info;
    if (syncStatus === 'error') return Colors.danger;
    return Colors.info;
  };

  return (
    <View style={[styles.dot, { backgroundColor: getColor() }]}>
      {pendingCount > 0 && (
        <Text style={styles.dotText}>{pendingCount}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  syncButton: {
    padding: 4,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default OfflineBanner;
