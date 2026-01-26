import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// Configuration Google Sheets
const SPREADSHEET_ID = '1tU4SAKWL-T7pyASfnU6RiiE0IQQ5TWwCi9iVPb1xIY4';

// Mapping des feuilles (gid) vers les noms de compagnies
const SHEETS_CONFIG = [
  { name: 'ניוד', gid: '0' },
  { name: 'פלוגה א', gid: '1557806629' },
  { name: 'פלוגה ב', gid: '1006699570' },
  { name: 'פלוגה ג', gid: '1920396699' },
  { name: 'פלוגה ד', gid: '1531453780' },
  { name: 'מפקדה/אגמ', gid: '1225558011' }
];

interface SoldierData {
  name: string;
  personalNumber: string;
  phone: string;
  department: string;
  company: string;
}

/**
 * Normalise un numéro de téléphone israélien
 * Ajoute 0 au début si nécessaire
 * Nettoie les espaces et caractères spéciaux
 */
function normalizePhoneNumber(phone: string | undefined): string {
  if (!phone) return '';

  // Nettoyer le numéro (supprimer espaces, tirets, etc.)
  let cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');

  // Si le numéro commence par +972, convertir en format local
  if (cleaned.startsWith('+972')) {
    cleaned = '0' + cleaned.substring(4);
  }

  // Si le numéro ne commence pas par 0 et a 9 chiffres, ajouter 0
  if (!cleaned.startsWith('0') && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Génère une clé de recherche pour un soldat
 */
function generateSearchKey(soldier: SoldierData): string {
  const parts = [
    soldier.name,
    soldier.personalNumber,
    soldier.phone,
    soldier.company,
    soldier.department
  ].filter(Boolean);

  return parts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Lit les données d'une feuille Google Sheets
 */
async function readSheetData(auth: any, sheetName: string): Promise<SoldierData[]> {
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    console.log(`\nLecture de la feuille: ${sheetName}`);

    // Lire toutes les données de la feuille
    // On suppose que la première ligne contient les en-têtes
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:D`, // Colonnes A à D (nom, mispear aishi, téléphone, machlaka)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log(`Aucune donnée trouvée dans ${sheetName}`);
      return [];
    }

    const soldiers: SoldierData[] = [];

    // Sauter la première ligne (en-têtes)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Ignorer les lignes vides ou incomplètes
      if (!row || row.length < 2) continue;

      const name = row[0]?.toString().trim();
      const personalNumber = row[1]?.toString().trim();
      const phone = row[2]?.toString().trim();
      const department = row[3]?.toString().trim();

      // Ignorer si pas de nom ou pas de numéro personnel
      if (!name || !personalNumber) continue;

      soldiers.push({
        name,
        personalNumber,
        phone: normalizePhoneNumber(phone),
        department: department || '',
        company: sheetName
      });
    }

    console.log(`✓ ${soldiers.length} soldats trouvés dans ${sheetName}`);
    return soldiers;

  } catch (error) {
    console.error(`Erreur lors de la lecture de ${sheetName}:`, error);
    throw error;
  }
}

/**
 * Importe un soldat dans Firestore
 */
async function importSoldier(soldier: SoldierData): Promise<void> {
  try {
    // Vérifier si le soldat existe déjà (par numéro personnel)
    const existingQuery = await db
      .collection('soldiers')
      .where('personalNumber', '==', soldier.personalNumber)
      .limit(1)
      .get();

    const now = admin.firestore.Timestamp.now();

    const soldierDoc = {
      personalNumber: soldier.personalNumber,
      name: soldier.name,
      phone: soldier.phone || '',
      company: soldier.company,
      department: soldier.department || '',
      searchKey: generateSearchKey(soldier),
      nameLower: soldier.name.toLowerCase(),
      updatedAt: now
    };

    if (!existingQuery.empty) {
      // Mettre à jour le soldat existant
      const docId = existingQuery.docs[0].id;
      await db.collection('soldiers').doc(docId).update(soldierDoc);
      console.log(`✓ Mis à jour: ${soldier.name} (${soldier.personalNumber})`);
    } else {
      // Créer un nouveau soldat
      await db.collection('soldiers').add({
        ...soldierDoc,
        createdAt: now
      });
      console.log(`✓ Créé: ${soldier.name} (${soldier.personalNumber})`);
    }

  } catch (error) {
    console.error(`Erreur lors de l'import de ${soldier.name}:`, error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('=== Import des soldats depuis Google Sheets ===\n');
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

    // Authentification Google Sheets avec le service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();

    let totalSoldiers = 0;
    let importedCount = 0;
    let updatedCount = 0;

    // Lire et importer les données de chaque feuille
    for (const sheet of SHEETS_CONFIG) {
      console.log(`\n--- Traitement de ${sheet.name} ---`);

      const soldiers = await readSheetData(authClient, sheet.name);
      totalSoldiers += soldiers.length;

      for (const soldier of soldiers) {
        try {
          // Vérifier si existe avant import
          const existingQuery = await db
            .collection('soldiers')
            .where('personalNumber', '==', soldier.personalNumber)
            .limit(1)
            .get();

          await importSoldier(soldier);

          if (existingQuery.empty) {
            importedCount++;
          } else {
            updatedCount++;
          }

        } catch (error) {
          console.error(`Erreur pour ${soldier.name}:`, error);
        }
      }
    }

    console.log('\n=== Résumé de l\'import ===');
    console.log(`Total soldats trouvés: ${totalSoldiers}`);
    console.log(`Nouveaux soldats créés: ${importedCount}`);
    console.log(`Soldats mis à jour: ${updatedCount}`);
    console.log('\n✓ Import terminé avec succès!');

  } catch (error) {
    console.error('Erreur lors de l\'import:', error);
    process.exit(1);
  }
}

// Exécuter le script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
