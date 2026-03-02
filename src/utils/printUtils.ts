import * as Print from 'expo-print';
import { Platform } from 'react-native';

export interface PrintAssignmentData {
    soldierName: string;
    soldierPersonalNumber: string;
    soldierPhone?: string;
    soldierCompany?: string;
    items: any[];
    signature: string;
    operatorSignature?: string;
    operatorName?: string;
    operatorRank?: string;
    timestamp: Date;
    assignmentId?: string;
}

// ─────────────────────────────────────────────────────────────
// Logo base64 défini UNE SEULE FOIS — évite de le dupliquer N fois
// dans le HTML lors d'une impression par lots
// ─────────────────────────────────────────────────────────────
const LOGO_BASE64 = 'data:image/png;base64,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';

// ─────────────────────────────────────────────────────────────
// CSS partagé (utilisé par generatePDFHTML et generateMultiPDFHTML)
// ─────────────────────────────────────────────────────────────
const PRINT_STYLES = `
    @page {
      size: A4;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, 'David', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 11px;
      line-height: 1.3;
      padding: 5mm;
    }

    /* Page break entre les formulaires (impression multiple) */
    .page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border: 2px solid #000;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    .header-right {
      text-align: right;
    }
    .header-center {
      text-align: center;
      flex: 1;
    }
    .header-left {
      text-align: left;
      min-width: 80px;
    }
    .logo-img {
      width: 60px;
      height: 60px;
      object-fit: contain;
    }
    /* Logo via CSS background-image: défini UNE SEULE FOIS dans le <style>
       même pour N formulaires — évite de dupliquer les ~5KB du base64 */
    .logo-container {
      width: 60px;
      height: 60px;
      background-image: url('${LOGO_BASE64}');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      flex-shrink: 0;
    }
    .doc-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .doc-subtitle {
      font-size: 12px;
      color: #333;
    }
    .voucher-number {
      font-size: 10px;
      margin-top: 8px;
    }
    .msegeret {
      font-size: 14px;
      font-weight: bold;
      margin-top: 10px;
      margin-bottom: 4px;
      color: #000;
      border: 2px solid #000;
      padding: 4px 12px;
      display: inline-block;
      border-radius: 4px;
    }
    .msegeret strong {
      font-size: 16px;
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .items-table th {
      background-color: #e8e8e8;
      border: 1px solid #000;
      padding: 6px 4px;
      font-weight: bold;
      font-size: 11px;
      text-align: center;
    }
    .cell {
      border: 1px solid #000;
      padding: 5px 4px;
      min-height: 22px;
      font-size: 10px;
    }
    .cell-center {
      text-align: center;
    }
    .cell-right {
      text-align: right;
    }
    .col-num { width: 6%; }
    .col-name { width: 30%; }
    .col-qty { width: 10%; }
    .col-id { width: 22%; }
    .col-notes { width: 32%; }

    /* Signature Section */
    .signatures-container {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .signature-box {
      flex: 1;
      border: 2px solid #000;
      padding: 10px;
    }
    .signature-box-title {
      font-weight: bold;
      font-size: 12px;
      text-align: center;
      margin-bottom: 8px;
      background-color: #e8e8e8;
      padding: 4px;
      margin: -10px -10px 8px -10px;
    }
    .signature-row {
      display: flex;
      margin-bottom: 6px;
      align-items: center;
    }
    .signature-label {
      font-weight: bold;
      min-width: 60px;
      font-size: 10px;
    }
    .signature-value {
      flex: 1;
      border-bottom: 1px solid #000;
      min-height: 16px;
      padding: 2px 4px;
      font-size: 10px;
    }
    .signature-area {
      height: 50px;
      border: 1px dashed #999;
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .signature-img {
      max-width: 150px;
      max-height: 45px;
    }
    .signature-placeholder {
      color: #999;
      font-size: 10px;
    }

    /* Safety Instructions */
    .safety-section {
      margin-top: 15px;
      border: 2px solid #000;
      padding: 8px;
    }
    .safety-title {
      font-weight: bold;
      font-size: 11px;
      text-align: center;
      margin-bottom: 6px;
      text-decoration: underline;
    }
    .safety-rules {
      list-style: none;
      padding: 0;
    }
    .safety-rules li {
      font-size: 9px;
      margin-bottom: 4px;
      padding-right: 15px;
      position: relative;
    }
    .safety-rules li::before {
      content: "⚠";
      position: absolute;
      right: 0;
      color: #c00;
    }

    /* Safety signature */
    .safety-confirm-row {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #999;
    }
    .safety-confirm-text {
      font-size: 9px;
      font-style: italic;
      color: #333;
      margin-bottom: 6px;
    }
    .safety-sig-line {
      display: flex;
      gap: 20px;
      align-items: center;
      margin-top: 4px;
    }
    .safety-sig-box {
      flex: 1;
      display: flex;
      align-items: center;
      height: 45px;
    }
    .safety-sig-label {
      font-size: 9px;
      font-weight: bold;
      white-space: nowrap;
    }

    /* Footer */
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 8px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 5px;
    }
`;

// ─────────────────────────────────────────────────────────────
// Contenu HTML d'un seul formulaire (sans <html>/<head>/<body>)
// ─────────────────────────────────────────────────────────────
const generatePageBodyHTML = (assignmentData: PrintAssignmentData): string => {
    const dateStr = assignmentData.timestamp.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const timeStr = assignmentData.timestamp.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const operatorText = assignmentData.operatorName || '';

    const itemsRows = assignmentData.items
        .map((item, index) => {
            const serialDisplay = item.serial
                ? item.serial.split(', ').join('<br>')
                : '-';
            return `
    <tr>
      <td class="cell cell-center">${index + 1}</td>
      <td class="cell cell-right">${item.equipmentName || item.name}</td>
      <td class="cell cell-center">${item.quantity}</td>
      <td class="cell cell-center">${serialDisplay}</td>
      <td class="cell cell-right"></td>
    </tr>
  `;
        }).join('');

    const emptyRowsCount = Math.max(0, 10 - assignmentData.items.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map((_, index) => `
    <tr>
      <td class="cell cell-center">${assignmentData.items.length + index + 1}</td>
      <td class="cell cell-right"></td>
      <td class="cell cell-center"></td>
      <td class="cell cell-center"></td>
      <td class="cell cell-right"></td>
    </tr>
  `).join('');

    const signatureImg = assignmentData.signature
        ? `<img src="${assignmentData.signature}" class="signature-img" />`
        : '<div class="signature-placeholder">חתימה</div>';

    return `
  <!-- Header Section -->
  <div class="header">
    <div class="header-right">
      <div class="logo-container" role="img" aria-label="לוגו גדוד 982"></div>
    </div>
    <div class="header-center">
      <div class="doc-title">טופס החתמה על ציוד לחימה</div>
      <div class="doc-subtitle">גדוד 982</div>
      <div class="voucher-number">מספר שובר: ${assignmentData.assignmentId ? String(assignmentData.assignmentId).slice(-6).padStart(6, '0') : '______'}</div>
      <div class="msegeret">מסגרת: <strong>${assignmentData.soldierCompany || ''}</strong></div>
    </div>
    <div class="header-left">
      <div style="font-size: 10px;">תאריך: ${dateStr}</div>
      <div style="font-size: 10px; margin-top: 4px;">שעה: ${timeStr}</div>
    </div>
  </div>

  <!-- Inventory Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="col-num">מס"ד</th>
        <th class="col-name">שם פריט</th>
        <th class="col-qty">כמות</th>
        <th class="col-id">מספר מזהה / מסט"ב</th>
        <th class="col-notes">הערות</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
      ${emptyRows}
    </tbody>
  </table>

  <!-- Signature Section -->
  <div class="signatures-container">
    <div class="signature-box">
      <div class="signature-box-title">פרטי המנפק</div>
      <div class="signature-row">
        <span class="signature-label">שם:</span>
        <span class="signature-value">${operatorText}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">דרגה:</span>
        <span class="signature-value">${assignmentData.operatorRank || ''}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">מ"א:</span>
        <span class="signature-value"></span>
      </div>
      <div class="signature-row">
        <span class="signature-label">תאריך:</span>
        <span class="signature-value">${dateStr}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">חתימה:</span>
      </div>
      <div class="signature-area">
        ${assignmentData.operatorSignature
            ? `<img src="${assignmentData.operatorSignature}" class="signature-img" />`
            : '<div class="signature-placeholder">חתימת המנפק</div>'}
      </div>
    </div>

    <div class="signature-box">
      <div class="signature-box-title">פרטי המקבל</div>
      <div class="signature-row">
        <span class="signature-label">שם:</span>
        <span class="signature-value">${assignmentData.soldierName}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">פלוגה:</span>
        <span class="signature-value">${assignmentData.soldierCompany || ''}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">מ"א:</span>
        <span class="signature-value">${assignmentData.soldierPersonalNumber}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">טלפון:</span>
        <span class="signature-value">${assignmentData.soldierPhone || ''}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">תאריך:</span>
        <span class="signature-value">${dateStr}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">חתימה:</span>
      </div>
      <div class="signature-area">
        ${signatureImg}
      </div>
    </div>
  </div>

  <!-- Safety Instructions -->
  <div class="safety-section">
    <div class="safety-title">הוראות בטיחות לנושא נשק</div>
    <ul class="safety-rules">
      <li>חל איסור לנקות כלי נשק בחדרי שינה ובחללים סגורים (מסדרונות, אולמות, בתוך רק"ם וכו').</li>
      <li>ניקוי נשקים יבוצע במקומות פתוחים תו"כ הקפדה שהנשקים אינם מכוונים לעבר אדם ופרוקים.</li>
      <li>חל איסור מוחלט לשחק בנשק, לבצע שינויים וכן להחליף חלקים בנשק.</li>
    </ul>
    <div class="safety-confirm-row">
      <div class="safety-confirm-text">קראתי והבנתי את הוראות הבטיחות לעיל ואני מתחייב לפעול על פיהן</div>
      <div class="safety-sig-line">
        <span class="safety-sig-label">חתימת החייל:</span>
        <div class="safety-sig-box">
          ${signatureImg}
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    מסמך זה נוצר אוטומטית באמצעות מערכת ניהול ציוד גדוד 982 | ${dateStr} ${timeStr}
  </div>
`;
};

// ─────────────────────────────────────────────────────────────
// HTML complet pour UN seul formulaire
// ─────────────────────────────────────────────────────────────
export const generatePDFHTML = (assignmentData: PrintAssignmentData): string => {
    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${generatePageBodyHTML(assignmentData)}
</body>
</html>`;
};

// ─────────────────────────────────────────────────────────────
// HTML complet pour PLUSIEURS formulaires (un par page)
// Un seul appel à Print.printAsync → évite les dialogues multiples
// et fonctionne correctement sur Android
// ─────────────────────────────────────────────────────────────
export const generateMultiPDFHTML = (assignments: PrintAssignmentData[]): string => {
    if (assignments.length === 0) return generatePDFHTML({ } as any);
    if (assignments.length === 1) return generatePDFHTML(assignments[0]);

    const pages = assignments
        .map((data, i) => {
            const content = generatePageBodyHTML(data);
            // Saut de page après chaque formulaire sauf le dernier
            const pageBreak = i < assignments.length - 1
                ? '<div class="page-break"></div>'
                : '';
            return `${content}${pageBreak}`;
        })
        .join('\n');

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
};

// ─────────────────────────────────────────────────────────────
// Impression d'un seul formulaire
// ─────────────────────────────────────────────────────────────
export const generateAndPrintPDF = async (
    assignmentData: PrintAssignmentData,
    printerToUse?: Print.Printer | null
) => {
    try {
        const html = generatePDFHTML(assignmentData);
        const printOptions: any = {
            html,
            orientation: Print.Orientation.portrait,
        };
        if (printerToUse && Platform.OS === 'ios') {
            printOptions.printerUrl = printerToUse.url;
            console.log('[PrintUtils] Using selected printer:', printerToUse.name);
        }
        await Print.printAsync(printOptions);
        console.log('[PrintUtils] Document sent to printer successfully');
    } catch (error) {
        console.error('[PrintUtils] Error printing PDF:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────
// Impression de PLUSIEURS formulaires en un seul job
// ─────────────────────────────────────────────────────────────
export const generateAndPrintMultiPDF = async (
    assignments: PrintAssignmentData[],
    printerToUse?: Print.Printer | null
) => {
    if (assignments.length === 0) return;
    try {
        const html = generateMultiPDFHTML(assignments);
        const printOptions: any = {
            html,
            orientation: Print.Orientation.portrait,
        };
        if (printerToUse && Platform.OS === 'ios') {
            printOptions.printerUrl = printerToUse.url;
        }
        await Print.printAsync(printOptions);
        console.log(`[PrintUtils] ${assignments.length} documents sent to printer`);
    } catch (error) {
        console.error('[PrintUtils] Error printing multi PDF:', error);
        throw error;
    }
};
