/**
 * SuccessModal.tsx - Modal de confirmation avec animation
 * Grande icône verte avec animation
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../theme/Colors';

const { width } = Dimensions.get('window');

interface SuccessModalButton {
    text: string;
    onPress: () => void;
    style?: 'primary' | 'secondary' | 'outline';
    icon?: string;
}

interface SuccessModalProps {
    visible: boolean;
    title: string;
    message: string;
    buttons: SuccessModalButton[];
    onClose?: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    visible,
    title,
    message,
    buttons,
    onClose,
}) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const checkmarkAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Reset animations
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
            checkmarkAnim.setValue(0);

            // Start animations
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 50,
                        friction: 7,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.spring(checkmarkAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 5,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const getButtonStyle = (style?: 'primary' | 'secondary' | 'outline') => {
        switch (style) {
            case 'primary':
                return styles.primaryButton;
            case 'outline':
                return styles.outlineButton;
            case 'secondary':
            default:
                return styles.secondaryButton;
        }
    };

    const getButtonTextStyle = (style?: 'primary' | 'secondary' | 'outline') => {
        switch (style) {
            case 'primary':
                return styles.primaryButtonText;
            case 'outline':
                return styles.outlineButtonText;
            case 'secondary':
            default:
                return styles.secondaryButtonText;
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* Success Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Animated.View
                                style={{
                                    transform: [
                                        {
                                            scale: checkmarkAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, 1],
                                            }),
                                        },
                                    ],
                                }}
                            >
                                <Ionicons name="checkmark" size={80} color={Colors.textWhite} />
                            </Animated.View>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Buttons */}
                    <View style={styles.buttonsContainer}>
                        {buttons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.button, getButtonStyle(button.style)]}
                                onPress={button.onPress}
                                activeOpacity={0.8}
                            >
                                {button.icon && (
                                    <Ionicons
                                        name={button.icon as any}
                                        size={20}
                                        color={button.style === 'primary' ? Colors.textWhite : Colors.primary}
                                        style={styles.buttonIcon}
                                    />
                                )}
                                <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                                    {button.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },

    container: {
        backgroundColor: Colors.backgroundCard,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        width: width - 48,
        maxWidth: 400,
        alignItems: 'center',
        ...Shadows.large,
    },

    iconContainer: {
        marginBottom: Spacing.lg,
    },

    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.medium,
    },

    title: {
        fontSize: FontSize.xxl,
        fontWeight: '700',
        color: Colors.success,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },

    message: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: Spacing.xl,
    },

    buttonsContainer: {
        width: '100%',
        gap: Spacing.sm,
    },

    button: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
        width: '100%',
    },

    primaryButton: {
        backgroundColor: Colors.success,
    },

    secondaryButton: {
        backgroundColor: Colors.backgroundSecondary,
    },

    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: Colors.primary,
    },

    buttonIcon: {
        marginLeft: Spacing.sm,
    },

    buttonText: {
        fontSize: FontSize.base,
        fontWeight: '600',
        textAlign: 'center',
    },

    primaryButtonText: {
        color: Colors.textWhite,
    },

    secondaryButtonText: {
        color: Colors.text,
    },

    outlineButtonText: {
        color: Colors.primary,
    },
});

export default SuccessModal;
