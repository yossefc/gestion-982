// Service de notifications (structure pour future intégration FCM)
import { db } from '../config/firebase';
import { collection, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { mapFirebaseError, logError } from './errors';

/**
 * Structure pour intégration future Expo Notifications + FCM
 * 
 * Setup requis :
 * 1. npm install expo-notifications
 * 2. Configurer FCM dans app.json/app.config.js
 * 3. Configurer les permissions iOS/Android
 */

interface NotificationToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  lastUpdated: Date;
}

export const notificationService = {
  /**
   * Enregistre le token FCM de l'appareil pour un utilisateur
   */
  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        fcmTokens: arrayUnion({
          token,
          platform,
          lastUpdated: new Date(),
        }),
      }, { merge: true });
    } catch (error) {
      logError('notificationService.registerDeviceToken', error);
      throw mapFirebaseError(error);
    }
  },

  /**
   * Supprime un token FCM (lors de la déconnexion)
   */
  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    try {
      // TODO: Implémenter avec arrayRemove ou update manual
      console.log('Token unregistration:', userId, token);
    } catch (error) {
      logError('notificationService.unregisterDeviceToken', error);
    }
  },

  /**
   * Demander la permission de notifications
   * À appeler au démarrage ou lors du premier besoin
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // TODO: Implémenter avec expo-notifications
      // const { status } = await Notifications.requestPermissionsAsync();
      // return status === 'granted';
      return false;
    } catch (error) {
      logError('notificationService.requestPermissions', error);
      return false;
    }
  },
};

/**
 * Structure des notifications à implémenter côté Cloud Functions :
 * 
 * 1. Nouvelle attribution créée :
 *    - Envoyer notification au soldat (si a un compte)
 *    - Titre: "ציוד חדש הוקצה לך"
 *    - Body: "נא לחתום על טופס ההחתמה"
 * 
 * 2. Rappel retour proche :
 *    - Cron job quotidien
 *    - Vérifier les dates de retour approchantes (7 jours, 3 jours, 1 jour)
 *    - Envoyer notification aux soldats concernés
 * 
 * 3. Signature complétée :
 *    - Notification au responsable (admin/arme/vetement)
 *    - Titre: "חתימה חדשה התקבלה"
 *    - Body: nom soldat + type équipement
 */

// TODO: Ajouter dans Cloud Functions ou backend
export const NOTIFICATION_TEMPLATES = {
  newAssignment: {
    title: 'ציוד חדש הוקצה לך',
    body: (soldierName: string, equipmentType: string) => 
      `${soldierName}, הוקצה לך ${equipmentType}. נא לחתום על טופס ההחתמה.`,
  },
  returnReminder: {
    title: 'תזכורת החזרת ציוד',
    body: (daysLeft: number, equipmentName: string) => 
      `נותרו ${daysLeft} ימים להחזרת ${equipmentName}`,
  },
  signatureCompleted: {
    title: 'חתימה חדשה התקבלה',
    body: (soldierName: string, equipmentType: string) => 
      `${soldierName} חתם על ${equipmentType}`,
  },
};




