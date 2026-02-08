/**
 * AppModal.tsx - Modal universel de l'application
 * Un seul composant pour tous les types de modaux (success, error, confirm, info)
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

// Types de modal disponibles
export type ModalType = 'success' | 'error' | 'confirm' | 'info' | 'warning';

// Configuration visuelle par type
const MODAL_CONFIG: Record<ModalType, {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    defaultTitle: string;
}> = {
    success: {
        icon: 'checkmark',
        color: Colors.success,
        defaultTitle: 'הצלחה!',
    },
    error: {
        icon: 'close',
        color: Colors.danger,
        defaultTitle: 'שגיאה',
    },
    confirm: {
        icon: 'help',
        color: Colors.warning,
        defaultTitle: 'אישור',
    },
    info: {
        icon: 'information',
        color: Colors.info,
        defaultTitle: 'מידע',
    },
    warning: {
        icon: 'warning',
        color: Colors.warning,
        defaultTitle: 'אזהרה',
    },
};

export interface AppModalButton {
    text: string;
    onPress: () => void;
    style?: 'primary' | 'secondary' | 'outline' | 'danger';
    icon?: keyof typeof Ionicons.glyphMap;
}

export interface AppModalProps {
    visible: boolean;
    type: ModalType;
    title?: string;
    message: string;
    buttons?: AppModalButton[];
    onClose?: () => void;
}

const AppModal: React.FC<AppModalProps> = ({
    visible,
    type,
    title,
    message,
    buttons,
    onClose,
}) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const iconAnim = useRef(new Animated.Value(0)).current;

    const config = MODAL_CONFIG[type];
    const displayTitle = title || config.defaultTitle;

    // Boutons par défaut si non fournis
    const displayButtons = buttons || [
        {
            text: type === 'confirm' ? 'אישור' : 'סגור',
            style: 'primary' as const,
            onPress: onClose || (() => { }),
        },
    ];

    useEffect(() => {
        if (visible) {
            // Reset animations
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
            iconAnim.setValue(0);

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
                Animated.spring(iconAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 5,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const getButtonStyle = (style?: 'primary' | 'secondary' | 'outline' | 'danger') => {
        switch (style) {
            case 'primary':
                return [styles.button, { backgroundColor: config.color }];
            case 'danger':
                return [styles.button, { backgroundColor: Colors.danger }];
            case 'outline':
                return [styles.button, styles.outlineButton, { borderColor: config.color }];
            case 'secondary':
            default:
                return [styles.button, styles.secondaryButton];
        }
    };

    const getButtonTextStyle = (style?: 'primary' | 'secondary' | 'outline' | 'danger') => {
        switch (style) {
            case 'primary':
            case 'danger':
                return styles.primaryButtonText;
            case 'outline':
                return [styles.buttonText, { color: config.color }];
            case 'secondary':
            default:
                return styles.secondaryButtonText;
        }
    };

    const getButtonIconColor = (style?: 'primary' | 'secondary' | 'outline' | 'danger') => {
        switch (style) {
            case 'primary':
            case 'danger':
                return Colors.textWhite;
            case 'outline':
                return config.color;
            case 'secondary':
            default:
                return Colors.text;
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
                    {/* Icon Circle */}
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: config.color }]}>
                            <Animated.View
                                style={{
                                    transform: [
                                        {
                                            scale: iconAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, 1],
                                            }),
                                        },
                                    ],
                                }}
                            >
                                <Ionicons name={config.icon} size={70} color={Colors.textWhite} />
                            </Animated.View>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={[styles.title, { color: config.color }]}>{displayTitle}</Text>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Buttons */}
                    <View style={styles.buttonsContainer}>
                        {displayButtons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={getButtonStyle(button.style)}
                                onPress={button.onPress}
                                activeOpacity={0.8}
                            >
                                {button.icon && (
                                    <Ionicons
                                        name={button.icon}
                                        size={20}
                                        color={getButtonIconColor(button.style)}
                                        style={styles.buttonIcon}
                                    />
                                )}
                                <Text style={getButtonTextStyle(button.style)}>
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
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.medium,
    },

    title: {
        fontSize: FontSize.xxl,
        fontWeight: '700',
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

    secondaryButton: {
        backgroundColor: Colors.backgroundSecondary,
    },

    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
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
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.textWhite,
    },

    secondaryButtonText: {
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.text,
    },
});

export default AppModal;
