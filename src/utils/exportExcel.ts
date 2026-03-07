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

  // 3. Regrouper les armes par פלוגה
  // Structure: Map<Company, Array<{SoldierName, PersonalNumber, WeaponCat, SerialNumber}>>
  const companyMap = new Map<string, any[]>();

  for (const weapon of assignedWeapons) {
    if (!weapon.assignedTo) continue;

    const soldierId = weapon.assignedTo.soldierId;
    const soldier = soldiers.find(s => s.id === soldierId);

    // Si on ne trouve pas le soldat ou sa compagnie, on met 'לא ידוע' (Inconnu)
    const companyName = soldier?.company || 'לא ידוע';

    if (!companyMap.has(companyName)) {
      companyMap.set(companyName, []);
    }

    companyMap.get(companyName)!.push({
      'שם החייל': weapon.assignedTo.soldierName || (soldier?.name || ''),
      'מ.א.': weapon.assignedTo.soldierPersonalNumber || (soldier?.personalNumber || ''),
      'שם פריט': weapon.category || '',
      'מסט"ב': weapon.serialNumber || '',
    });
  }

  // 3b. Ajouter les équipements réguliers non-sérialisés
  if (combatHoldings) {
    for (const holding of combatHoldings) {
      const soldier = soldiers.find(s => s.id === holding.soldierId);
      const companyName = soldier?.company || 'לא ידוע';

      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, []);
      }

      for (const item of holding.items) {
        // Optionnel : ne pas exporter les items avec 0 quantité
        if (item.quantity <= 0) continue;

        companyMap.get(companyName)!.push({
          'שם החייל': holding.soldierName || (soldier?.name || ''),
          'מ.א.': holding.soldierPersonalNumber || (soldier?.personalNumber || ''),
          'שם פריט': item.equipmentName || '',
          'מסט"ב': '', // Laisser vide pour les équipements non sérialisés
        });
      }
    }
  }

  // 4. Créer le classeur Excel
  const wb = XLSX.utils.book_new();

  // 5. Remplir le classeur avec une feuille par פלוגה
  if (companyMap.size === 0) {
    // S'il n'y a rien à exporter, on crée une feuille vide pour éviter un fichier corrompu
    const ws = XLSX.utils.json_to_sheet([{ הודעה: 'אין נתונים לייצוא' }]);
    ws['!dir'] = 'rtl'; // Right-to-Left
    XLSX.utils.book_append_sheet(wb, ws, 'ריק');
  } else {
    // Trier les compagnies par ordre alphabétique pour un rendu propre
    const sortedCompanies = Array.from(companyMap.keys()).sort();

    for (const company of sortedCompanies) {
      const data = companyMap.get(company)!;
      // Trier les données de la feuille: par nom de soldat puis par catégorie d'arme
      data.sort((a, b) => {
        const nameCompare = a['שם החייל'].localeCompare(b['שם החייל']);
        if (nameCompare !== 0) return nameCompare;
        return a['שם פריט'].localeCompare(b['שם פריט']);
      });

      const ws = XLSX.utils.json_to_sheet(data);
      // Configurer la direction de la feuille (Right-To-Left)
      ws['!dir'] = 'rtl';

      // Ajuster la largeur des colonnes
      ws['!cols'] = [
        { wch: 20 }, // שם החייל
        { wch: 15 }, // מ.א.
        { wch: 20 }, // שם פריט
        { wch: 15 }, // מסט"ב
      ];

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

