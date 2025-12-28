// Service de partage WhatsApp pour les PDFs d'attribution
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * Télécharge un PDF depuis une URL Firebase Storage
 * et le sauvegarde localement
 *
 * @param pdfUrl - URL du PDF sur Firebase Storage
 * @param fileName - Nom du fichier (ex: "assignment_123.pdf")
 * @returns URI locale du fichier téléchargé
 */
export async function downloadPdf(
  pdfUrl: string,
  fileName: string = 'assignment.pdf'
): Promise<string> {
  try {
    // Créer le chemin local pour sauvegarder le PDF
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    console.log('Downloading PDF from:', pdfUrl);
    console.log('Saving to:', fileUri);

    // Télécharger le fichier
    const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Failed to download PDF: ${downloadResult.status}`);
    }

    console.log('PDF downloaded successfully:', downloadResult.uri);
    return downloadResult.uri;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}

/**
 * Partage un PDF via la feuille de partage native
 * (inclut WhatsApp si installé)
 *
 * NOTES IMPORTANTES:
 * - iOS: WhatsApp n'accepte pas toujours base64, nécessite fichier local
 * - Android: Fonctionne généralement mieux avec fichiers locaux aussi
 * - Le partage ouvre la feuille native, l'utilisateur choisit l'app (WhatsApp, Email, etc.)
 *
 * @param fileUri - URI locale du fichier PDF
 * @param dialogTitle - Titre de la feuille de partage (optionnel)
 */
export async function sharePdf(
  fileUri: string,
  dialogTitle: string = 'שתף דרך WhatsApp'
): Promise<void> {
  try {
    // Vérifier que le partage est disponible
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        'שגיאה',
        'שיתוף קבצים אינו זמין במכשיר זה'
      );
      return;
    }

    console.log('Sharing PDF from:', fileUri);

    // Partager le fichier
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf', // iOS Universal Type Identifier
    });

    console.log('PDF shared successfully');
  } catch (error) {
    console.error('Error sharing PDF:', error);
    Alert.alert(
      'שגיאה',
      'נכשל בשיתוף הקובץ. אנא נסה שנית.'
    );
    throw error;
  }
}

/**
 * Workflow complet: télécharger + partager un PDF
 *
 * @param pdfUrl - URL du PDF sur Firebase Storage
 * @param fileName - Nom du fichier (optionnel)
 * @returns true si succès, false si erreur
 */
export async function downloadAndSharePdf(
  pdfUrl: string,
  fileName?: string
): Promise<boolean> {
  try {
    // Générer un nom de fichier unique si non fourni
    const finalFileName = fileName || `assignment_${Date.now()}.pdf`;

    // Étape 1: Télécharger le PDF
    const localUri = await downloadPdf(pdfUrl, finalFileName);

    // Étape 2: Partager via la feuille native
    await sharePdf(localUri, 'שלח ב-WhatsApp');

    return true;
  } catch (error) {
    console.error('Error in downloadAndSharePdf:', error);
    return false;
  }
}

/**
 * Ouvre WhatsApp directement avec un message pré-rempli
 * (sans le PDF - seulement le texte)
 *
 * Note: Cette fonction ouvre WhatsApp mais ne peut PAS attacher de fichier
 * automatiquement. C'est une limitation de WhatsApp.
 * Pour envoyer le PDF, utilisez downloadAndSharePdf() à la place.
 *
 * @param phoneNumber - Numéro de téléphone (format international: +972...)
 * @param message - Message pré-rempli
 */
export async function openWhatsAppChat(
  phoneNumber: string,
  message: string
): Promise<void> {
  try {
    // Nettoyer le numéro de téléphone (enlever espaces, tirets, etc.)
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

    // Encoder le message pour URL
    const encodedMessage = encodeURIComponent(message);

    // URL WhatsApp (fonctionne sur iOS et Android)
    const whatsappUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedMessage}`;

    console.log('Opening WhatsApp URL:', whatsappUrl);

    // Ouvrir WhatsApp
    const { Linking } = require('react-native');
    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (!canOpen) {
      Alert.alert(
        'שגיאה',
        'WhatsApp אינו מותקן במכשיר זה'
      );
      return;
    }

    await Linking.openURL(whatsappUrl);
  } catch (error) {
    console.error('Error opening WhatsApp:', error);
    Alert.alert(
      'שגיאה',
      'נכשל בפתיחת WhatsApp. אנא ודא שהאפליקציה מותקנת.'
    );
  }
}

/**
 * Nettoie les fichiers PDF temporaires plus anciens que X jours
 *
 * @param daysOld - Nombre de jours (par défaut: 7)
 */
export async function cleanupOldPdfs(daysOld: number = 7): Promise<void> {
  try {
    const directory = FileSystem.documentDirectory;
    if (!directory) return;

    const files = await FileSystem.readDirectoryAsync(directory);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000; // Convertir en ms

    for (const file of files) {
      // Ne supprimer que les PDFs
      if (!file.endsWith('.pdf')) continue;

      const fileUri = `${directory}${file}`;
      const info = await FileSystem.getInfoAsync(fileUri);

      if (info.exists && info.modificationTime) {
        const fileAge = now - info.modificationTime;
        if (fileAge > maxAge) {
          await FileSystem.deleteAsync(fileUri);
          console.log(`Deleted old PDF: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old PDFs:', error);
  }
}
