// Utilitaires d'export Excel/CSV
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Assignment, Soldier } from '../types';

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
    type: a.type === 'combat' ? 'ציוד לחימה' : 'ביגוד',
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

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'ייצוא חיילים',
    });
  }
}

