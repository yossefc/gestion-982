import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Assignment, AssignmentItem, Soldier, WeaponInventoryItem } from '../types';

// Polyfill pour les types manquants
const FS = FileSystem as any;

/**
 * Convertit un tableau d'objets en CSV
 */
function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      // Échapper les virgules et guillemets
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',')
  );

  return [headerRow, ...rows].join('\n');
}

/**
 * Exporte des attributions en CSV
 */
export async function exportAssignmentsToCSV(assignments: Assignment[]): Promise<void> {
  const headers = [
    'soldierId',
    'soldierName',
    'soldierPersonalNumber',
    'type',
    'status',
    'timestamp',
    'itemsCount',
  ];

  const data = assignments.map(a => ({
    soldierId: a.soldierId,
    soldierName: a.soldierName,
    soldierPersonalNumber: a.soldierPersonalNumber,
    type: a.type === 'combat' ? 'ציוד לחימה' : 'אפסנאות',
    status: a.status,
    timestamp: new Date(a.timestamp).toLocaleDateString('he-IL'),
    itemsCount: a.items.length,
  }));

  const csv = convertToCSV(data, headers);
  const fileUri = FS.documentDirectory + `assignments_${Date.now()}.csv`;

  // Ajouter BOM UTF-8 pour Excel
  const bom = '\uFEFF';
  await FileSystem.writeAsStringAsync(fileUri, bom + csv, {
    encoding: FS.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'ייצוא נתונים',
    });
  }
}

/**
 * Exporte des soldats en CSV
 */
export async function exportSoldiersToCSV(soldiers: Soldier[]): Promise<void> {
  const headers = [
    'id',
    'personalNumber',
    'name',
    'phone',
    'company',
    'department',
    'createdAt',
  ];

  const data = soldiers.map(s => ({
    id: s.id,
    personalNumber: s.personalNumber,
    name: s.name,
    phone: s.phone || '',
    company: s.company,
    department: s.department || '',
    createdAt: new Date(s.createdAt).toLocaleDateString('he-IL'),
  }));

  const csv = convertToCSV(data, headers);
  const fileUri = FS.documentDirectory + `soldiers_${Date.now()}.csv`;

  const bom = '\uFEFF';
  await FileSystem.writeAsStringAsync(fileUri, bom + csv, {
    encoding: FS.EncodingType.UTF8,
  });

}

/**
 * Exporte l'inventaire des armes (נשקייה) en Excel, séparé par פלוגה.
 * On inclut toutes les armes assignées ou en stockage (status 'assigned' ou 'stored').
 * Les armes sans מסט"ב (serialNumber) apparaîtront avec une case vide.
 */
export async function exportWeaponInventoryByCompanyToExcel(
  weapons: WeaponInventoryItem[],
  soldiers: Soldier[],
  combatHoldings?: Array<{ soldierId: string; soldierName: string; soldierPersonalNumber: string; items: AssignmentItem[]; }>
): Promise<void> {
  // 1. Importer XLSX dynamiquement pour éviter d'alourdir le bundle si non utilisé
  const XLSX = await import('xlsx');

  // 2. Filtrer les armes qui appartiennent actuellement à un soldat (assigned ou stored)
  const assignedWeapons = weapons.filter(w => w.status === 'assigned' || w.status === 'stored');

  // 3. Regrouper par פלוגה puis par soldat
  // Structure: Map<CompanyName, Map<SoldierId, { SoldierName: string, PersonalNumber: string, EquipmentParts: string[], SerializedItemsCategoryCounts: Map<string, number> }>>
  const companyMap = new Map<string, Map<string, {
    'שם החייל': string;
    'מ.א.': string;
    EquipmentParts: string[];
    SerializedItemsCategoryCounts: Map<string, number>;
  }>>();

  // Fonction pour initialiser un soldat s'il n'existe pas encore
  const ensureSoldierEntry = (companyName: string, soldierId: string, soldierName: string, personalNumber: string) => {
    if (!companyMap.has(companyName)) {
      companyMap.set(companyName, new Map());
    }
    const soldiersMap = companyMap.get(companyName)!;
    if (!soldiersMap.has(soldierId)) {
      soldiersMap.set(soldierId, {
        'שם החייל': soldierName,
        'מ.א.': personalNumber,
        EquipmentParts: [],
        SerializedItemsCategoryCounts: new Map()
      });
    }
    return soldiersMap.get(soldierId)!;
  };

  // Traitement des armes assignées (sérialisées)
  for (const weapon of assignedWeapons) {
    if (!weapon.assignedTo) continue;

    const soldierId = weapon.assignedTo.soldierId;
    const soldier = soldiers.find(s => s.id === soldierId);

    const companyName = soldier?.company || 'לא ידוע';
    const sName = weapon.assignedTo.soldierName || (soldier?.name || '');
    const pNumber = weapon.assignedTo.soldierPersonalNumber || (soldier?.personalNumber || '');

    const entry = ensureSoldierEntry(companyName, soldierId, sName, pNumber);

    // Format: Nom d'équipement (Serie) ou Nom d'équipement si pas de série
    const equipText = weapon.serialNumber
      ? `${weapon.category || 'נֶשֶׁק'} (${weapon.serialNumber})`
      : (weapon.category || 'נֶשֶׁק');

    entry.EquipmentParts.push(equipText);
  }

  // 3b. Ajouter les équipements réguliers non-sérialisés
  if (combatHoldings) {
    for (const holding of combatHoldings) {
      const soldier = soldiers.find(s => s.id === holding.soldierId);
      const companyName = soldier?.company || 'לא ידוע';

      // On utilise le soldierId comme identifiant, ou un fallback s'il manque
      const soldierId = holding.soldierId || `unknown_${Math.random()}`;
      const sName = holding.soldierName || (soldier?.name || '');
      const pNumber = holding.soldierPersonalNumber || (soldier?.personalNumber || '');

      const entry = ensureSoldierEntry(companyName, soldierId, sName, pNumber);

      for (const item of holding.items) {
        if (item.quantity <= 0) continue;

        // Format: Nom d'équipement xQuantité (si quantité > 1) sinon Nom d'équipement
        const equipText = item.quantity > 1
          ? `${item.equipmentName} x${item.quantity}`
          : item.equipmentName;

        entry.EquipmentParts.push(equipText);
      }
    }
  }

  // Convertir le Map imbriqué en données de tableau pour Excel
  const flattenedCompanyData = new Map<string, { list: any[], maxItems: number }>();

  for (const [company, soldiersMap] of companyMap.entries()) {
    let maxItems = 0;
    const list = Array.from(soldiersMap.values()).map(entry => {
      const row: any = {
        'שם החייל': entry['שם החייל'],
        'מ.א.': entry['מ.א.'],
      };

      if (entry.EquipmentParts.length > maxItems) {
        maxItems = entry.EquipmentParts.length;
      }

      // Distribuer chaque équipement dans sa propre colonne (פריט 1, פריט 2...)
      entry.EquipmentParts.forEach((part, index) => {
        row[`פריט ${index + 1}`] = part;
      });

      return row;
    });
    flattenedCompanyData.set(company, { list, maxItems });
  }

  // 4. Créer le classeur Excel
  const wb = XLSX.utils.book_new();

  // 5. Remplir le classeur avec une feuille par פלוגה
  if (flattenedCompanyData.size === 0) {
    // S'il n'y a rien à exporter, on crée une feuille vide pour éviter un fichier corrompu
    const ws = XLSX.utils.json_to_sheet([{ הודעה: 'אין נתונים לייצוא' }]);
    ws['!dir'] = 'rtl'; // Right-to-Left
    XLSX.utils.book_append_sheet(wb, ws, 'ריק');
  } else {
    // Trier les compagnies par ordre alphabétique pour un rendu propre
    const sortedCompanies = Array.from(flattenedCompanyData.keys()).sort();

    for (const company of sortedCompanies) {
      const { list: data, maxItems } = flattenedCompanyData.get(company)!;
      // Trier les données de la feuille: par nom de soldat
      data.sort((a: any, b: any) => {
        return a['שם החייל'].localeCompare(b['שם החייל']);
      });

      const ws = XLSX.utils.json_to_sheet(data);
      // Configurer la direction de la feuille (Right-To-Left)
      ws['!dir'] = 'rtl';

      // Ajuster la largeur des colonnes
      const cols = [
        { wch: 20 }, // שם החייל
        { wch: 15 }, // מ.א.
      ];
      // Ajouter une colonne de taille 25 pour chaque équipement
      for (let i = 0; i < maxItems; i++) {
        cols.push({ wch: 25 });
      }
      ws['!cols'] = cols;

      // On s'assure que le nom de l'onglet est valide (max 31 chars, pas de caractères interdits)
      const safeSheetName = company.substring(0, 31).replace(/[\\/?*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    }
  }

  // 6. Générer le fichier binaire (base64 pour ReactNative)
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileName = `WeaponInventory_${Date.now()}.xlsx`;
  const fileUri = FS.documentDirectory + fileName;

  // 7. Sauvegarder localement
  await FS.writeAsStringAsync(fileUri, wbout, {
    encoding: FS.EncodingType.Base64
  });

  // 8. Ouvrir le dialogue de partage
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'ייצוא מלאי נשק לאקסל',
    });
  }
}

