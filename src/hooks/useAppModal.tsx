/**
 * useAppModal.tsx - Hook pour faciliter l'utilisation du modal universel
 * Remplace Alert.alert partout dans l'app
 */

import { useState, useCallback } from 'react';
import { ModalType, AppModalButton } from '../components/AppModal';

export interface ModalState {
    visible: boolean;
    type: ModalType;
    title?: string;
    message: string;
    buttons?: AppModalButton[];
}

const initialState: ModalState = {
    visible: false,
    type: 'info',
    message: '',
};

export const useAppModal = () => {
    const [modalState, setModalState] = useState<ModalState>(initialState);

    const showModal = useCallback((
        type: ModalType,
        message: string,
        options?: {
            title?: string;
            buttons?: AppModalButton[];
        }
    ) => {
        setModalState({
            visible: true,
            type,
            message,
            title: options?.title,
            buttons: options?.buttons,
        });
    }, []);

    const hideModal = useCallback(() => {
        setModalState(prev => ({ ...prev, visible: false }));
    }, []);

    // Raccourcis pour chaque type
    const showSuccess = useCallback((message: string, buttons?: AppModalButton[]) => {
        showModal('success', message, { buttons });
    }, [showModal]);

    const showError = useCallback((message: string, buttons?: AppModalButton[]) => {
        showModal('error', message, { buttons });
    }, [showModal]);

    const showConfirm = useCallback((
        message: string,
        onConfirm: () => void,
        onCancel?: () => void
    ) => {
        showModal('confirm', message, {
            buttons: [
                {
                    text: 'ביטול',
                    style: 'secondary',
                    onPress: () => {
                        hideModal();
                        onCancel?.();
                    },
                },
                {
                    text: 'אישור',
                    style: 'primary',
                    onPress: () => {
                        hideModal();
                        onConfirm();
                    },
                },
            ],
        });
    }, [showModal, hideModal]);

    const showInfo = useCallback((message: string, buttons?: AppModalButton[]) => {
        showModal('info', message, { buttons });
    }, [showModal]);

    const showWarning = useCallback((message: string, buttons?: AppModalButton[]) => {
        showModal('warning', message, { buttons });
    }, [showModal]);

    return {
        modalState,
        showModal,
        hideModal,
        showSuccess,
        showError,
        showConfirm,
        showInfo,
        showWarning,
    };
};

export default useAppModal;
