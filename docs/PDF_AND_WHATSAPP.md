# 📄 Génération PDF et Partage WhatsApp - Guide Complet

Ce document explique l'implémentation de la génération automatique de PDF pour les attributions d'équipement et le partage via WhatsApp.

---

## 🎯 Objectif

Après qu'un soldat ait signé pour recevoir du matériel (ציוד), le système doit:
1. **Générer automatiquement un PDF officiel** (1 page A4)
2. **Uploader le PDF** vers Firebase Storage
3. **Permettre le partage** du PDF via WhatsApp

---

## 🏗️ Architecture Technique

### Stack Utilisée

- **Plateforme**: Expo SDK 54
- **Génération PDF**: `pdf-lib` (JS pur, fonctionne sur Expo)
- **Stockage**: Firebase Storage
- **Partage**: `expo-sharing` (déjà installé)
- **Téléchargement**: `expo-file-system` (déjà installé)

### Choix de `pdf-lib`

**Pourquoi pdf-lib?**
- ✅ Pure JavaScript (pas de dépendances natives)
- ✅ Compatible Expo
- ✅ Support TypeScript
- ✅ Permet d'insérer des images (signature)
- ✅ Contrôle total sur le layout

**Alternatives écartées:**
- ❌ `react-native-pdf-lib`: Nécessite bare React Native
- ❌ `expo-print`: Conversion HTML→PDF, moins de contrôle layout

---

## 📦 Services Créés

### 1. `src/services/pdfService.ts`

**Fonctions principales:**

```typescript
// Génère un PDF 1 page A4 pour une attribution
async function generateAssignmentPDF(assignment: Assignment): Promise<Uint8Array>

// Convertit PDF en base64
function pdfToBase64(pdfBytes: Uint8Array): string

// Convertit base64 en PDF
function base64ToPdf(base64: string): Uint8Array
```

**Format du PDF généré:**
- **En-tête**: Titre "טופס מסירת ציוד" + "גדוד 982"
- **Détails soldat**: Nom, מספר אישי, פלוגה, טלפון
- **Tableau équipement**: שם ציוד, כמות, מסטב
- **Date/heure**: Format hébreu (IL)
- **Opérateur**: בוצע על ידי...
- **Signature**: Image du soldat
- **Pied de page**: Note automatique

**Limitations:**
- Maximum 15 items par page (pour tenir sur 1 page A4)
- Si plus d'items: message "(+ X items supplémentaires)"

---

### 2. `src/services/whatsappService.ts`

**Fonctions principales:**

```typescript
// Télécharge un PDF depuis Storage → local
async function downloadPdf(pdfUrl: string, fileName?: string): Promise<string>

// Partage un PDF via la feuille native
async function sharePdf(fileUri: string, dialogTitle?: string): Promise<void>

// Workflow complet: télécharger + partager
async function downloadAndSharePdf(pdfUrl: string, fileName?: string): Promise<boolean>

// Ouvre WhatsApp avec message pré-rempli (SANS PDF)
async function openWhatsAppChat(phoneNumber: string, message: string): Promise<void>

// Nettoie les PDFs locaux > X jours
async function cleanupOldPdfs(daysOld?: number): Promise<void>
```

**Workaround iOS:**
WhatsApp iOS ne supporte pas bien le partage base64. Solution:
1. Télécharger le PDF depuis Storage → stockage local
2. Partager le fichier local (pas base64)

---

### 3. `src/services/firebaseService.ts` (ajout)

**Nouveau service: `pdfStorageService`**

```typescript
export const pdfStorageService = {
  // Upload PDF vers Storage
  async uploadPdf(pdfBytes: Uint8Array, assignmentId: string): Promise<string>

  // Supprime un PDF de Storage
  async deletePdf(pdfUrl: string): Promise<void>
}
```

**Chemin Storage:**
```
pdf/assignments/assignment_{id}_{timestamp}.pdf
```

---

## 🔄 Workflow Complet

### Flux d'attribution avec PDF + WhatsApp

```
1. Soldat sélectionne ציוד
   ↓
2. Soldat signe (SignatureCanvas)
   ↓
3. Création Assignment dans Firestore
   ↓
4. Génération PDF (pdfService.generateAssignmentPDF)
   ↓
5. Upload PDF vers Storage (pdfStorageService.uploadPdf)
   ↓
6. Mise à jour Assignment.pdfUrl
   ↓
7. Afficher bouton "שלח ב-WhatsApp"
   ↓
8. Au clic: downloadAndSharePdf(pdfUrl)
   ↓
9. Feuille de partage s'ouvre
   ↓
10. Utilisateur choisit WhatsApp
```

---

## 💻 Intégration dans ClothingSignatureScreen

### Étape 1: Imports

```typescript
import { generateAssignmentPDF } from '../../services/pdfService';
import { pdfStorageService } from '../../services/firebaseService';
import { downloadAndSharePdf } from '../../services/whatsappService';
```

### Étape 2: État

```typescript
const [pdfUrl, setPdfUrl] = useState<string | null>(null);
const [generatingPdf, setGeneratingPdf] = useState(false);
```

### Étape 3: Fonction de génération PDF

```typescript
const generateAndUploadPdf = async (assignmentId: string, assignmentData: Assignment) => {
  try {
    setGeneratingPdf(true);

    // 1. Générer le PDF
    console.log('Generating PDF...');
    const pdfBytes = await generateAssignmentPDF(assignmentData);

    // 2. Upload vers Storage
    console.log('Uploading PDF to Storage...');
    const url = await pdfStorageService.uploadPdf(pdfBytes, assignmentId);

    // 3. Mettre à jour l'assignment
    await assignmentService.update(assignmentId, { pdfUrl: url });

    setPdfUrl(url);
    Alert.alert('הצלחה', 'המסמך נוצר בהצלחה');

    return url;
  } catch (error) {
    console.error('Error generating PDF:', error);
    Alert.alert('שגיאה', 'נכשל ביצירת המסמך');
    return null;
  } finally {
    setGeneratingPdf(false);
  }
};
```

### Étape 4: Modifier `handleSaveAndSign`

```typescript
const handleSaveAndSign = async () => {
  // ... validation existante ...

  setSaving(true);
  try {
    // Préparer les données complètes pour le PDF
    const assignmentData = {
      soldierId,
      soldierName: soldier.name,
      soldierPersonalNumber: soldier.personalNumber,
      soldierPhone: soldier.phone,
      soldierCompany: soldier.company,
      type: 'clothing' as const,
      action: 'issue' as const,
      items: assignmentItems,
      signature,
      status: 'נופק לחייל' as const,
      assignedBy: user?.id || '',
      assignedByName: user?.name,
      assignedByEmail: user?.email,
      timestamp: new Date(),
    };

    // Créer l'attribution
    const assignmentId = await assignmentService.create(assignmentData);

    // Générer et uploader le PDF
    const pdfUrl = await generateAndUploadPdf(assignmentId, {
      ...assignmentData,
      id: assignmentId,
    });

    // Succès - afficher bouton WhatsApp
    Alert.alert(
      'הצלחה',
      'החתימה נשמרה והמסמך נוצר',
      [
        {
          text: 'שלח ב-WhatsApp',
          onPress: () => pdfUrl && handleShareWhatsApp(pdfUrl)
        },
        {
          text: 'סגור',
          style: 'cancel',
          onPress: () => (navigation as any).reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        }
      ]
    );
  } catch (error) {
    Alert.alert('שגיאה', 'נכשל בשמירת החתימה');
    console.error('Error saving signature:', error);
  } finally {
    setSaving(false);
  }
};
```

### Étape 5: Fonction de partage WhatsApp

```typescript
const handleShareWhatsApp = async (pdfUrl: string) => {
  try {
    const success = await downloadAndSharePdf(
      pdfUrl,
      `assignment_${soldier.personalNumber}_${Date.now()}.pdf`
    );

    if (success) {
      console.log('PDF shared successfully');
    }
  } catch (error) {
    console.error('Error sharing PDF:', error);
    Alert.alert('שגיאה', 'נכשל בשיתוף הקובץ');
  }
};
```

### Étape 6: Bouton WhatsApp (UI)

```typescript
{pdfUrl && (
  <TouchableOpacity
    style={styles.whatsappButton}
    onPress={() => handleShareWhatsApp(pdfUrl)}
  >
    <Text style={styles.whatsappButtonText}>📱 שלח ב-WhatsApp</Text>
  </TouchableOpacity>
)}
```

---

## ⚠️ Limitations Connues

### WhatsApp iOS

**Problème:**
- WhatsApp iOS ne supporte pas bien l'envoi automatique de fichiers
- Le bouton "direct send to contact" (`shareSingle`) est limité

**Solutions appliquées:**
- ✅ Utiliser la feuille de partage native (`expo-sharing`)
- ✅ Télécharger le PDF localement avant partage (workaround base64)
- ✅ L'utilisateur choisit manuellement le contact dans WhatsApp

**Référence:**
- [GitHub Issue: react-native-share iOS limitations](https://github.com/react-native-share/react-native-share/issues/1300)

### Envoi Automatique Sans Interaction

**Limitation:**
Il est **impossible** d'envoyer un PDF WhatsApp sans interaction utilisateur sur mobile.

**Raisons:**
1. Limitation de sécurité WhatsApp
2. Limitation de l'OS (iOS/Android)
3. Nécessite Business API pour envoi automatique

---

## 🚀 Option Avancée: WhatsApp Cloud API (Business)

### Quand utiliser?

Si le client exige "envoi automatique sans action utilisateur", il faut implémenter un backend avec WhatsApp Business Cloud API.

### Architecture

```
App Mobile                 Cloud Functions          WhatsApp API
    |                            |                        |
    |-- Create Assignment ------>|                        |
    |                            |                        |
    |<-- Assignment ID ----------|                        |
    |                            |                        |
    |-- Generate PDF locally --->|                        |
    |                            |                        |
    |-- Upload to Storage ------->|                        |
    |                            |                        |
    |-- Call sendWhatsApp ------->|                        |
                                 |                        |
                                 |-- Send Document ------>|
                                 |   (pdfUrl, phone)      |
                                 |                        |
                                 |<----- Success ---------|
                                 |                        |
                                 |-- Update Assignment -->|
                                     (whatsappSent: true)
```

### Implémentation

**1. Backend (Firebase Cloud Functions):**

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import axios from 'axios';

export const sendWhatsAppDocument = functions.https.onCall(async (data, context) => {
  // Vérifier auth
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { phoneNumber, pdfUrl, caption } = data;

  // Appeler WhatsApp Cloud API
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'document',
      document: {
        link: pdfUrl,
        caption: caption || 'טופס מסירת ציוד',
        filename: `assignment_${Date.now()}.pdf`,
      },
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return { success: true, messageId: response.data.messages[0].id };
});
```

**2. App Mobile:**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const sendWhatsAppDocument = async (phoneNumber: string, pdfUrl: string) => {
  const functions = getFunctions();
  const sendDoc = httpsCallable(functions, 'sendWhatsAppDocument');

  try {
    const result = await sendDoc({
      phoneNumber,
      pdfUrl,
      caption: 'טופס מסירת ציוד - גדוד 982',
    });
    console.log('WhatsApp sent:', result.data);
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
  }
};
```

**3. Configuration requise:**

- Compte WhatsApp Business
- WhatsApp Cloud API access token
- Phone Number ID (WhatsApp Business)
- Firebase Functions déployées

**Références:**
- [WhatsApp Cloud API - Send Document](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#document-messages)
- [WhatsApp Business API Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

## 📊 Type Assignment (Modifié)

Nouveaux champs ajoutés pour support PDF + WhatsApp:

```typescript
export interface Assignment {
  // ... champs existants ...

  // Nouveaux champs
  soldierPhone?: string;       // Pour WhatsApp
  soldierCompany?: string;     // Pour PDF
  action?: AssignmentAction;   // 'issue' | 'add' | 'return' | 'credit'
  pdfUrl?: string;             // URL du PDF généré
  assignedByName?: string;     // Nom opérateur (pour PDF)
  assignedByEmail?: string;    // Email opérateur (pour PDF)
}
```

---

## 🧪 Testing

### Test Génération PDF

```typescript
import { generateAssignmentPDF } from './services/pdfService';

const testAssignment: Assignment = {
  id: 'test-123',
  soldierId: 'soldier-1',
  soldierName: 'יוסי כהן',
  soldierPersonalNumber: '1234567',
  soldierPhone: '+972501234567',
  soldierCompany: 'פלוגה א',
  type: 'combat',
  action: 'issue',
  items: [
    { equipmentId: '1', equipmentName: 'M16', quantity: 1, serial: 'W123456' },
    { equipmentId: '2', equipmentName: 'קסדה', quantity: 1, serial: 'H789012' },
  ],
  signature: 'data:image/png;base64,iVBORw0KG...',
  status: 'נופק לחייל',
  timestamp: new Date(),
  assignedBy: 'admin-1',
  assignedByName: 'Admin User',
};

const pdfBytes = await generateAssignmentPDF(testAssignment);
console.log('PDF size:', pdfBytes.length, 'bytes');
```

### Test Upload Storage

```typescript
import { pdfStorageService } from './services/firebaseService';

const pdfUrl = await pdfStorageService.uploadPdf(pdfBytes, 'test-123');
console.log('PDF uploaded:', pdfUrl);
```

### Test Partage WhatsApp

```typescript
import { downloadAndSharePdf } from './services/whatsappService';

const success = await downloadAndSharePdf(pdfUrl, 'test.pdf');
console.log('Share success:', success);
```

---

## 📝 Checklist Implémentation

- [x] Installer `pdf-lib`
- [x] Créer `src/services/pdfService.ts`
- [x] Créer `src/services/whatsappService.ts`
- [x] Ajouter `pdfStorageService` dans `firebaseService.ts`
- [x] Modifier type `Assignment` (nouveaux champs)
- [ ] Intégrer dans `ClothingSignatureScreen.tsx`
- [ ] Ajouter bouton "שלח ב-WhatsApp"
- [ ] Tester sur iOS + Android
- [ ] (Optionnel) Implémenter WhatsApp Cloud API backend

---

## 🔗 Références

### PDF
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [pdf-lib GitHub](https://github.com/Hopding/pdf-lib)

### WhatsApp
- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- [Expo File System](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)

### Firebase
- [Firebase Storage - Upload Files](https://firebase.google.com/docs/storage/web/upload-files)
- [Firebase Functions](https://firebase.google.com/docs/functions)

---

*Dernière mise à jour: 2025-12-28*
