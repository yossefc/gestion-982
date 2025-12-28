// Utilitaires d'export PDF avec expo-print
// @ts-ignore - expo-print peut ne pas avoir de types
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Assignment } from '../types';

/**
 * Génère un PDF pour une attribution
 */
export async function generateAssignmentPDF(assignment: Assignment): Promise<string> {
  const html = `
    <!DOCTYPE html>
    <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            text-align: right;
            padding: 20px;
          }
          h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: right;
          }
          th {
            background-color: #3498db;
            color: white;
          }
          .signature {
            margin-top: 40px;
            text-align: center;
          }
          .signature img {
            max-width: 300px;
            border: 2px solid #3498db;
            padding: 10px;
          }
          .info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
          }
          .status-נופק { background-color: #27ae60; }
          .status-לא-חתום { background-color: #f39c12; }
          .status-זוכה { background-color: #3498db; }
        </style>
      </head>
      <body>
        <h1>טופס החתמת ציוד - גדוד 982</h1>
        
        <div class="info">
          <p><strong>שם החייל:</strong> ${assignment.soldierName}</p>
          <p><strong>מספר אישי:</strong> ${assignment.soldierPersonalNumber}</p>
          <p><strong>סטטוס:</strong> <span class="status status-${assignment.status.replace(' ', '-')}">${assignment.status}</span></p>
          <p><strong>תאריך:</strong> ${new Date(assignment.timestamp).toLocaleDateString('he-IL')}</p>
        </div>

        <h2>פריטים:</h2>
        <table>
          <thead>
            <tr>
              <th>שם הפריט</th>
              <th>כמות</th>
              <th>מספר סידורי</th>
            </tr>
          </thead>
          <tbody>
            ${assignment.items.map(item => `
              <tr>
                <td>${item.equipmentName}</td>
                <td>${item.quantity}</td>
                <td>${item.serial || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${assignment.signature ? `
          <div class="signature">
            <h3>חתימת החייל:</h3>
            <img src="${assignment.signature}" alt="חתימה" />
          </div>
        ` : ''}

        <div style="margin-top: 40px; text-align: center; color: #7f8c8d; font-size: 12px;">
          <p>מערכת ניהול גדוד 982</p>
          <p>מסמך זה הופק אוטומטית ב-${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}</p>
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Partage un PDF
 */
export async function sharePDF(uri: string, filename: string = 'assignment.pdf'): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'שתף PDF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Sharing not available');
  }
}

/**
 * Génère et partage un PDF d'attribution
 */
export async function exportAssignmentPDF(assignment: Assignment): Promise<void> {
  const uri = await generateAssignmentPDF(assignment);
  await sharePDF(uri, `assignment_${assignment.soldierPersonalNumber}_${Date.now()}.pdf`);
}

