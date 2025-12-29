# Configuration des Notifications FCM

## Vue d'ensemble

Ce document décrit comment configurer Firebase Cloud Messaging (FCM) pour l'application gestion-982.

## 1. Installation des dépendances

```bash
npm install expo-notifications
```

## 2. Configuration Firebase

### 2.1 Dans Firebase Console

1. Aller dans **Project Settings** → **Cloud Messaging**
2. Copier le **Server Key** et **Sender ID**
3. Pour iOS : Télécharger le fichier `GoogleService-Info.plist`
4. Pour Android : Le fichier `google-services.json` est déjà configuré

### 2.2 Dans app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#3498db",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

## 3. Implémentation côté client

### 3.1 Demander les permissions

Dans `App.tsx` ou au login :

```typescript
import * as Notifications from 'expo-notifications';
import { notificationService } from './src/services/notificationService';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  
  if (status !== 'granted') {
    console.log('Permission notifications refusée');
    return;
  }

  // Obtenir le token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Enregistrer dans Firestore
  const userId = auth.currentUser?.uid;
  if (userId) {
    await notificationService.registerDeviceToken(
      userId,
      token,
      Platform.OS as 'ios' | 'android'
    );
  }
}
```

### 3.2 Écouter les notifications

```typescript
import { useEffect, useRef } from 'react';

function App() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Notification reçue en foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification reçue:', notification);
    });

    // Utilisateur a tapé sur la notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Navigation selon le type
      if (data.type === 'assignment') {
        navigation.navigate('CombatAssignment', { soldierId: data.soldierId });
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
```

## 4. Backend - Cloud Functions

### 4.1 Installation

```bash
cd functions
npm install firebase-admin firebase-functions
```

### 4.2 Fonction d'envoi

**functions/src/index.ts** :

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Envoi de notification lors de création d'attribution
export const onAssignmentCreated = functions.firestore
  .document('assignments/{assignmentId}')
  .onCreate(async (snap, context) => {
    const assignment = snap.data();
    
    // Récupérer les tokens du soldat
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(assignment.soldierId)
      .get();
    
    const fcmTokens = userDoc.data()?.fcmTokens || [];
    
    if (fcmTokens.length === 0) return;

    // Construire le message
    const message = {
      notification: {
        title: 'ציוד חדש הוקצה לך',
        body: `נא לחתום על טופס ההחתמה - ${assignment.items.length} פריטים`,
      },
      data: {
        type: 'assignment',
        assignmentId: snap.id,
        soldierId: assignment.soldierId,
      },
      tokens: fcmTokens.map((t: any) => t.token),
    };

    // Envoyer
    try {
      const response = await admin.messaging().sendMulticast(message);
      console.log('Notifications envoyées:', response.successCount);
    } catch (error) {
      console.error('Erreur envoi notification:', error);
    }
  });

// Rappels de retour (cron quotidien)
export const dailyReturnReminders = functions.pubsub
  .schedule('0 9 * * *') // Tous les jours à 9h
  .timeZone('Asia/Jerusalem')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    // Trouver les assignments avec date de retour proche
    const assignments = await admin.firestore()
      .collection('assignments')
      .where('returnDate', '<=', in7Days)
      .where('status', '==', 'נופק לחייל')
      .get();

    const notifications: Promise<any>[] = [];

    assignments.forEach(async (doc) => {
      const assignment = doc.data();
      const daysLeft = Math.ceil(
        (assignment.returnDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Récupérer tokens
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(assignment.soldierId)
        .get();
      
      const fcmTokens = userDoc.data()?.fcmTokens || [];

      if (fcmTokens.length > 0) {
        notifications.push(
          admin.messaging().sendMulticast({
            notification: {
              title: 'תזכורת החזרת ציוד',
              body: `נותרו ${daysLeft} ימים להחזרת ציוד`,
            },
            data: {
              type: 'return_reminder',
              assignmentId: doc.id,
            },
            tokens: fcmTokens.map((t: any) => t.token),
          })
        );
      }
    });

    await Promise.all(notifications);
    console.log(`${notifications.length} rappels envoyés`);
  });
```

### 4.3 Déploiement

```bash
firebase deploy --only functions
```

## 5. Test

### 5.1 Test local (Expo)

Utiliser l'outil Expo Push Notification Tool :
https://expo.dev/notifications

Entrer le token Expo et envoyer une notification de test.

### 5.2 Test avec l'émulateur Firebase

```bash
firebase emulators:start --only functions,firestore
```

## 6. Bonnes pratiques

- ✅ Toujours vérifier les permissions avant d'enregistrer le token
- ✅ Gérer la désinscription lors du logout
- ✅ Nettoyer les tokens invalides (failureCount > 3)
- ✅ Utiliser des topics pour les notifications broadcast
- ✅ Limiter la fréquence des notifications (pas de spam)
- ✅ Respecter les quiet hours (pas de notif entre 22h-7h)

## 7. Sécurité

- ❌ Ne jamais exposer la Server Key
- ✅ Utiliser Firebase Admin SDK côté serveur uniquement
- ✅ Valider les données avant d'envoyer des notifications
- ✅ Logs d'audit pour toutes les notifications envoyées

## 8. Monitoring

Dans Firebase Console → Cloud Messaging :
- Nombre de notifications envoyées
- Taux d'ouverture
- Erreurs de livraison

---

**Note** : Cette fonctionnalité est préparée mais nécessite :
1. Configuration FCM dans Firebase
2. Déploiement Cloud Functions
3. Tests sur devices réels (pas simulateur iOS pour push)




