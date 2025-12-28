// Gestion centralisée des erreurs Firebase et application
import { FirebaseError } from 'firebase/app';

export interface AppError {
  code: string;
  message: string;
  technicalDetails?: string;
}

// Codes d'erreur personnalisés
export const ErrorCodes = {
  // Soldats
  SOLDIER_DUPLICATE: 'soldier/duplicate',
  SOLDIER_NOT_FOUND: 'soldier/not-found',
  SOLDIER_INVALID_DATA: 'soldier/invalid-data',
  
  // Équipement
  EQUIPMENT_NOT_FOUND: 'equipment/not-found',
  EQUIPMENT_INSUFFICIENT_STOCK: 'equipment/insufficient-stock',
  
  // Attributions
  ASSIGNMENT_NOT_FOUND: 'assignment/not-found',
  ASSIGNMENT_ALREADY_SIGNED: 'assignment/already-signed',
  
  // Firestore
  FIRESTORE_PERMISSION_DENIED: 'firestore/permission-denied',
  FIRESTORE_NOT_FOUND: 'firestore/not-found',
  FIRESTORE_UNAVAILABLE: 'firestore/unavailable',
  
  // Réseau
  NETWORK_ERROR: 'network/error',
  NETWORK_TIMEOUT: 'network/timeout',
  
  // Général
  UNKNOWN_ERROR: 'unknown/error',
};

// Messages d'erreur en hébreu
const errorMessages: { [key: string]: string } = {
  // Firebase Auth
  'auth/user-not-found': 'משתמש לא נמצא במערכת',
  'auth/wrong-password': 'סיסמה שגויה',
  'auth/email-already-in-use': 'כתובת אימייל כבר קיימת במערכת',
  'auth/weak-password': 'הסיסמה חלשה מדי',
  'auth/invalid-email': 'כתובת אימייל לא תקינה',
  'auth/network-request-failed': 'שגיאת רשת - בדוק את החיבור לאינטרנט',
  
  // Firebase Firestore
  'firestore/permission-denied': 'אין הרשאה לביצוע פעולה זו',
  'firestore/not-found': 'המסמך המבוקש לא נמצא',
  'firestore/unavailable': 'שירות Firestore אינו זמין כרגע',
  'firestore/deadline-exceeded': 'הפעולה ארכה זמן רב מדי - נסה שוב',
  'firestore/already-exists': 'המסמך כבר קיים במערכת',
  
  // Soldats
  'soldier/duplicate': 'מספר אישי כבר קיים במערכת',
  'soldier/not-found': 'החייל לא נמצא במערכת',
  'soldier/invalid-data': 'נתוני החייל אינם תקינים',
  
  // Équipement
  'equipment/not-found': 'הציוד לא נמצא במערכת',
  'equipment/insufficient-stock': 'אין מספיק ציוד במלאי',
  
  // Attributions
  'assignment/not-found': 'ההקצאה לא נמצאה במערכת',
  'assignment/already-signed': 'ההקצאה כבר נחתמה',
  
  // Réseau
  'network/error': 'שגיאת רשת - בדוק את החיבור לאינטרנט',
  'network/timeout': 'הפעולה ארכה זמן רב מדי - נסה שוב',
  
  // Général
  'unknown/error': 'אירעה שגיאה לא צפויה',
};

/**
 * Convertit une erreur Firebase en AppError avec message en hébreu
 */
export function mapFirebaseError(error: unknown): AppError {
  // Si c'est déjà une AppError, la retourner telle quelle
  if (isAppError(error)) {
    return error as AppError;
  }

  // Erreur Firebase
  if (error instanceof FirebaseError) {
    const code = error.code;
    const message = errorMessages[code] || errorMessages['unknown/error'];
    
    return {
      code,
      message,
      technicalDetails: error.message,
    };
  }

  // Erreur standard avec message
  if (error instanceof Error) {
    // Vérifier si c'est une erreur custom avec code
    if ('code' in error && typeof (error as any).code === 'string') {
      const code = (error as any).code;
      return {
        code,
        message: errorMessages[code] || error.message,
        technicalDetails: error.message,
      };
    }
    
    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: error.message || errorMessages['unknown/error'],
      technicalDetails: error.stack,
    };
  }

  // Erreur inconnue
  return {
    code: ErrorCodes.UNKNOWN_ERROR,
    message: errorMessages['unknown/error'],
    technicalDetails: String(error),
  };
}

/**
 * Crée une AppError personnalisée
 */
export function createAppError(code: string, customMessage?: string): AppError {
  return {
    code,
    message: customMessage || errorMessages[code] || errorMessages['unknown/error'],
  };
}

/**
 * Vérifie si une erreur est une AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Log une erreur de manière standardisée
 */
export function logError(context: string, error: unknown): void {
  const appError = mapFirebaseError(error);
  console.error(`[${context}]`, {
    code: appError.code,
    message: appError.message,
    technical: appError.technicalDetails,
  });
}

