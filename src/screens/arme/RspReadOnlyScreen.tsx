/**
 * RspReadOnlyScreen.tsx
 * Vue en lecture seule de la situation des RSP (pour partage)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import RspTableScreen from './RspTableScreen';

const RspReadOnlyScreen: React.FC = () => {
    // On réutilise simplement RspTableScreen qui est déjà en lecture seule
    // Dans le futur, on pourrait ajouter des restrictions ou une mise en page spécifique web
    return (
        <View style={styles.container}>
            <RspTableScreen />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default RspReadOnlyScreen;
