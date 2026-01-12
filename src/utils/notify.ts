// Utilitaires de notification/toast pour feedback utilisateur
import { Alert } from 'react-native';
import { AppError, mapFirebaseError } from '../services/errors';

/**
 * Affiche une notification d'erreur
 */
export function notifyError(error: unknown, context?: string): void {
  const appError = mapFirebaseError(error);
  
  const title = context ? `שגיאה - ${context}` : 'שגיאה';
  
  Alert.alert(
    title,
    appError.message,
    [{ text: 'אישור', style: 'default' }]
  );
  
  // Log technique en console
  if (__DEV__ && appError.technicalDetails) {
    console.error('[notifyError]', appError.technicalDetails);
  }
}

/**
 * Affiche une notification de succès
 */
export function notifySuccess(message: string): void {
  Alert.alert(
    'הצלחה',
    message,
    [{ text: 'אישור', style: 'default' }]
  );
}

/**
 * Affiche une confirmation avant action critique
 */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'ביטול',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'אישור',
        style: 'destructive',
        onPress: onConfirm,
      },
    ]
  );
}





