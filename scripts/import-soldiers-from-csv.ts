import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// Configuration des fichiers CSV
const CSV_FILES = [
  { path: 'c:\\Users\\USER\\Downloads\\חיילים - ניוד.csv', company: 'ניוד' },
  { path: 'c:\\Users\\USER\\Downloads\\חיילים - פלוגה א.csv', company: 'פלוגה א' },
  { path: 'c:\\Users\\USER\\Downloads\\חיילים - פלוגה ב.csv', company: 'פלוגה ב' },
  { path: 'c:\\Users\\USER\\Downloads\\חיילים - פלוגה ג.csv', company: 'פלוגה ג' },
  { path: 'c:\\Users\\USER\\Downloads\\חיילים - פלוגה ד.csv', company: 'פלוגה ד' },
  { path: 'c:\\Users\\USER\\Downloads\\חיילים - מפקדה_אגמ.csv', company: 'מפקדה/אגמ' }
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
 * Parse une ligne CSV en tenant compte des guillemets
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Lit les données d'un fichier CSV
 */
function readCSVFile(filePath: string, company: string): SoldierData[] {
  try {
    console.log(`\nLecture du fichier: ${path.basename(filePath)}`);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier introuvable: ${filePath}`);
      return [];
    }

    // Lire le fichier avec l'encodage UTF-8 avec BOM
    const content = fs.readFileSync(filePath, 'utf-8');

    // Supprimer le BOM si présent
    const cleanContent = content.replace(/^\uFEFF/, '');

    const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      console.log(`Fichier vide: ${filePath}`);
      return [];
    }

    const soldiers: SoldierData[] = [];

    // Sauter la première ligne (en-têtes)
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);

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
        company
      });
    }

    console.log(`✓ ${soldiers.length} soldats trouvés`);
    return soldiers;

  } catch (error) {
    console.error(`Erreur lors de la lecture de ${filePath}:`, error);
    return [];
  }
}

/**
 * Importe un soldat dans Firestore
 */
async function importSoldier(soldier: SoldierData): Promise<'created' | 'updated'> {
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
      return 'updated';
    } else {
      // Créer un nouveau soldat
      await db.collection('soldiers').add({
        ...soldierDoc,
        createdAt: now
      });
      return 'created';
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
    console.log('=== Import des soldats depuis les fichiers CSV ===\n');

    let totalSoldiers = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Traiter chaque fichier CSV
    for (const file of CSV_FILES) {
      console.log(`\n--- Traitement de ${file.company} ---`);

      const soldiers = readCSVFile(file.path, file.company);
      totalSoldiers += soldiers.length;

      for (const soldier of soldiers) {
        try {
          const result = await importSoldier(soldier);

          if (result === 'created') {
            createdCount++;
            console.log(`✓ Créé: ${soldier.name} (${soldier.personalNumber})`);
          } else {
            updatedCount++;
            console.log(`✓ Mis à jour: ${soldier.name} (${soldier.personalNumber})`);
          }

        } catch (error) {
          errorCount++;
          console.error(`❌ Erreur pour ${soldier.name}:`, error);
        }
      }
    }

    console.log('\n=== Résumé de l\'import ===');
    console.log(`Total soldats trouvés: ${totalSoldiers}`);
    console.log(`Nouveaux soldats créés: ${createdCount}`);
    console.log(`Soldats mis à jour: ${updatedCount}`);
    console.log(`Erreurs: ${errorCount}`);
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
