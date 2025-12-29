// Service de génération de PDF pour les attributions d'équipement
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Assignment } from '../types';

/**
 * Génère un PDF 1 page A4 pour une attribution d'équipement
 * en utilisant expo-print (HTML → PDF)
 *
 * Format du document:
 * - Titre: טופס מסירת ציוד
 * - Détails soldat: nom, numéro אישי, פלוגה, téléphone
 * - Tableau items: nom ציוד, כמות, מסטב
 * - Date/heure opération
 * - Opérateur qui a effectué l'attribution
 * - Signature du soldat
 */
export async function generateAssignmentPDF(
  assignment: Assignment
): Promise<Uint8Array> {
  try {
    // Générer le HTML
    const html = generateAssignmentHTML(assignment);

    // Créer le PDF avec expo-print
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Lire le fichier PDF comme base64
    // @ts-ignore - EncodingType existe mais n'est pas dans les types
    const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // Convertir base64 en Uint8Array
    const pdfBytes = base64ToPdf(pdfBase64);

    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Génère le HTML pour le PDF d'attribution
 */
function generateAssignmentHTML(assignment: Assignment): string {
  const titleText = assignment.type === 'combat'
    ? 'טופס מסירת ציוד לחימה'
    : 'טופס מסירת ביגוד וציוד אישי';

  const dateStr = new Date(assignment.timestamp).toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const operatorText = assignment.assignedByName || assignment.assignedByEmail || '';

  // Limiter à 15 items
  const maxItems = 15;
  const itemsToShow = assignment.items.slice(0, maxItems);
  const hasMoreItems = assignment.items.length > maxItems;

  // Générer les lignes du tableau
  const itemsRows = itemsToShow
    .map(
      item => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.equipmentName}</td>
      <td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.serial || ''}</td>
    </tr>
  `
    )
    .join('');

  const moreItemsNote = hasMoreItems
    ? `<p style="text-align: right; color: #666; font-size: 12px; margin-top: 5px;">(+ ${assignment.items.length - maxItems} items supplémentaires)</p>`
    : '';

  // Image signature en base64
  const signatureImg = assignment.signature
    ? `<img src="${assignment.signature}" style="max-width: 200px; max-height: 80px; border: 1px solid #ccc;" />`
    : '<p style="color: #c00;">(Signature non disponible)</p>';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: Arial, sans-serif;
      direction: rtl;
      text-align: right;
      margin: 0;
      padding: 20px;
      font-size: 14px;
    }
    h1 {
      text-align: center;
      font-size: 24px;
      margin-bottom: 5px;
      color: #2c3e50;
    }
    h2 {
      text-align: center;
      font-size: 16px;
      margin-top: 0;
      margin-bottom: 30px;
      color: #7f8c8d;
    }
    .soldier-info {
      border: 2px solid #2c3e50;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .soldier-info p {
      margin: 8px 0;
      font-size: 14px;
    }
    .soldier-info strong {
      font-weight: bold;
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #ecf0f1;
      padding: 10px;
      border: 1px solid #bdc3c7;
      font-weight: bold;
      text-align: right;
    }
    td {
      padding: 8px;
      border: 1px solid #ccc;
    }
    .signature-section {
      margin-top: 30px;
      text-align: right;
    }
    .signature-section strong {
      display: block;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
      color: #7f8c8d;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .meta-info {
      margin-top: 20px;
      font-size: 13px;
      color: #555;
    }
  </style>
</head>
<body>
  <h1>${titleText}</h1>
  <h2>גדוד 982</h2>

  <div class="soldier-info">
    <p><strong>שם חייל:</strong> ${assignment.soldierName}</p>
    <p><strong>מספר אישי:</strong> ${assignment.soldierPersonalNumber}</p>
    ${assignment.soldierCompany ? `<p><strong>פלוגה:</strong> ${assignment.soldierCompany}</p>` : ''}
    ${assignment.soldierPhone ? `<p><strong>טלפון:</strong> ${assignment.soldierPhone}</p>` : ''}
  </div>

  <h3 style="text-align: right; margin-top: 20px; margin-bottom: 10px;">פירוט ציוד:</h3>

  <table>
    <thead>
      <tr>
        <th>שם ציוד</th>
        <th style="width: 80px;">כמות</th>
        <th style="width: 120px;">מסטב</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  ${moreItemsNote}

  <div class="meta-info">
    <p><strong>תאריך ושעה:</strong> ${dateStr}</p>
    ${operatorText ? `<p><strong>בוצע על ידי:</strong> ${operatorText}</p>` : ''}
  </div>

  <div class="signature-section">
    <strong>חתימת מקבל:</strong>
    ${signatureImg}
  </div>

  <div class="footer">
    <p>מסמך זה נוצר אוטומטית באמצעות מערכת ניהול ציוד גדוד 982</p>
  </div>
</body>
</html>
  `;
}

/**
 * Convertit un Uint8Array PDF en base64
 */
export function pdfToBase64(pdfBytes: Uint8Array): string {
  const binary = Array.from(pdfBytes)
    .map(byte => String.fromCharCode(byte))
    .join('');
  return btoa(binary);
}

/**
 * Convertit une base64 en Uint8Array
 */
export function base64ToPdf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
