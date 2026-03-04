// Service de génération de PDF pour les attributions d'équipement
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Assignment } from '../types';

// ============================================================
// STORAGE (אפסון) PDF — אישור על אפסון ארמו"י
// ============================================================

export interface StorageWeaponItem {
  category: string;
  serialNumber?: string;
  quantity?: number;
  notes?: string;
}

export interface StoragePDFData {
  // Weapon owner — the soldier the weapon is signed to
  ownerName: string;
  ownerPersonalNumber: string;
  ownerRank?: string;
  ownerCompany?: string;
  ownerPhone?: string;
  // Depositor — may differ from owner (גורם מאפסן)
  depositorName?: string;
  depositorPersonalNumber?: string;
  depositorRank?: string;
  depositorPhone?: string;
  // Dates
  storageDate: Date;
  plannedReturnDate: Date;
  // Original voucher number from the weapon's assignment
  voucherNumber?: string;
  // Signature captured in the storage flow (owner or depositor)
  signerSignature?: string;
  signatureRole?: 'owner' | 'depositor';
  // Receiver in armory (from users collection)
  receiverName?: string;
  receiverPersonalNumber?: string;
  receiverRank?: string;
  receiverPhone?: string;
  receiverSignature?: string;
  // Weapons selected for storage
  weapons: StorageWeaponItem[];
}

/**
 * Generates and prints/shares the אפסון confirmation document.
 * iOS: triggers system print dialog.
 * Android: exports PDF via Share sheet.
 */
export async function generateStoragePDF(data: StoragePDFData): Promise<void> {
  const html = generateStorageHTML(data);
  if (Platform.OS === 'ios') {
    await Print.printAsync({ html });
  } else {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'אישור אפסון',
    });
  }
}

export function generateStorageHTML(data: StoragePDFData): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const esc = (value?: string | number | null) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const storageDateStr = fmt(data.storageDate);
  const returnDateStr = fmt(data.plannedReturnDate);
  const rawVoucher = String(data.voucherNumber || '').trim();
  const voucherDigits = rawVoucher.replace(/\D/g, '');
  const voucherLast6 = voucherDigits
    ? voucherDigits.slice(-6).padStart(6, '0')
    : rawVoucher.slice(-6).padStart(6, '0');
  const voucherDisplay = rawVoucher ? voucherLast6 : '______';
  const hasDepositorDetails = Boolean(
    data.depositorName || data.depositorPersonalNumber || data.depositorRank || data.depositorPhone
  );
  const signatureRole = data.signatureRole || (hasDepositorDetails ? 'depositor' : 'owner');
  const signatureImg = data.signerSignature
    ? `<img src="${esc(data.signerSignature)}" class="signature-img" />`
    : '';
  const ownerSignatureHTML = signatureRole === 'owner' ? signatureImg : '';
  const depositorSignatureHTML = signatureRole === 'depositor' ? signatureImg : '';
  const receiverSignatureHTML = data.receiverSignature
    ? `<img src="${esc(data.receiverSignature)}" class="signature-img" />`
    : '';

  const weaponRows = data.weapons
    .map(
      (w, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="r">${esc(w.category)}</td>
      <td class="c">${Math.max(1, Math.floor(Number(w.quantity) || 1))}</td>
      <td class="c">${esc(w.serialNumber || '')}</td>
      <td class="r">${esc(w.notes || '')}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 portrait; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow: visible; }
  body {
    font-family: Arial, 'David', sans-serif;
    direction: rtl;
    text-align: right;
    font-size: 12.5px;
    line-height: 1.28;
    color: #000;
  }
  .page {
    min-height: calc(297mm - 10mm);
    display: flex;
    flex-direction: column;
  }
  h1 {
    text-align: center;
    font-size: 22px;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 6px;
  }
  .voucher-box {
    text-align: right;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .voucher-val {
    font-weight: bold;
    text-decoration: underline;
    letter-spacing: 0.8px;
    font-size: 18px;
  }
  .dates-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: space-between;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .date-pill {
    background: #fff4bf;
    border: 2px solid #f59e0b;
    border-radius: 6px;
    padding: 4px 8px;
    font-weight: 700;
  }
  .sec-label {
    font-weight: bold;
    font-size: 13px;
    text-decoration: underline;
    margin-bottom: 3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 5px;
  }
  th {
    border: 1px solid #000;
    padding: 3px 4px;
    background: #d8d8d8;
    font-size: 11.5px;
    font-weight: bold;
    text-align: center;
    line-height: 1.15;
  }
  td {
    border: 1px solid #000;
    padding: 3px 4px;
    font-size: 11.5px;
    height: 28px;
    line-height: 1.15;
  }
  td.c { text-align: center; }
  td.r { text-align: right; }
  .signature-cell {
    text-align: center;
    vertical-align: middle;
    height: 56px;
    background: #fffef7;
  }
  .signature-frame {
    width: 100%;
    min-height: 44px;
    border: 1px dashed #777;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }
  .depositor-box {
    border: 1px solid #000;
    padding: 5px 6px;
    margin-bottom: 5px;
  }
  .inline-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    margin-bottom: 4px;
  }
  .fg { display: flex; align-items: baseline; gap: 3px; }
  .fl { font-weight: bold; font-size: 11.5px; white-space: nowrap; }
  .fv {
    border-bottom: 1px solid #000;
    min-width: 86px;
    font-size: 11.5px;
    padding: 0 2px;
    display: inline-block;
    min-height: 16px;
  }
  .fv-sig {
    border-bottom: 1px solid #000;
    min-width: 180px;
    min-height: 50px;
    display: inline-block;
    vertical-align: middle;
    padding: 1px 2px;
    background: #fffef7;
  }
  .signature-img {
    max-width: 190px;
    max-height: 46px;
    object-fit: contain;
    display: block;
    margin: 0 auto;
  }
  .footer-note {
    border-top: 1px solid #888;
    padding-top: 4px;
    font-size: 10.5px;
    text-align: center;
    margin-top: auto;
  }
</style>
</head>
<body>
<div class="page">

<div class="voucher-box">מספר שובר: <span class="voucher-val">${esc(voucherDisplay)}</span></div>

<h1>אישור על אפסון ארמו"י (במקום ט' 1082)</h1>

<div class="dates-row">
  <span class="date-pill"><b>תאריך האפסון:</b> ${storageDateStr}</span>
  <span class="date-pill"><b>תאריך מתוכנן של חזרת החייל:</b> ${returnDateStr}</span>
</div>

<!-- Table 1: weapon owner -->
<div class="sec-label">פרטי החייל (שחתום על הארמו"י)</div>
<table>
  <thead><tr>
    <th style="width:12%">מ.א.</th>
    <th style="width:20%">שם ומשפחה</th>
    <th style="width:10%">דרגה</th>
    <th style="width:13%">מסגרת</th>
    <th style="width:14%">מס' טל' נייד</th>
    <th style="width:16%">חתימה</th>
    <th style="width:15%">הערות</th>
  </tr></thead>
  <tbody><tr>
    <td class="c">${esc(data.ownerPersonalNumber)}</td>
    <td class="r">${esc(data.ownerName)}</td>
    <td class="c">${esc(data.ownerRank || '')}</td>
    <td class="c">${esc(data.ownerCompany || '')}</td>
    <td class="c">${esc(data.ownerPhone || '')}</td>
    <td class="c signature-cell"><div class="signature-frame">${ownerSignatureHTML}</div></td>
    <td></td>
  </tr></tbody>
</table>

<!-- Depositor section -->
<div class="depositor-box">
  <div class="sec-label" style="margin-bottom:5px">פרטי גורם מאפסן (במידה והמאפסן אינו חתום על הציוד)</div>
  <div class="inline-fields">
    <div class="fg"><span class="fl">שם המאפסן:</span><span class="fv">${esc(data.depositorName || '')}</span></div>
    <div class="fg"><span class="fl">מ.א:</span><span class="fv">${esc(data.depositorPersonalNumber || '')}</span></div>
    <div class="fg"><span class="fl">דרגה:</span><span class="fv">${esc(data.depositorRank || '')}</span></div>
    <div class="fg"><span class="fl">טלפון:</span><span class="fv">${esc(data.depositorPhone || '')}</span></div>
  </div>
  <div class="fg"><span class="fl">חתימה:</span><span class="fv-sig">${depositorSignatureHTML}</span></div>
</div>

<!-- Table 2: equipment list -->
<div class="sec-label">פריטים לאפסון</div>
<table>
  <thead><tr>
    <th style="width:7%">מס"ד</th>
    <th style="width:30%">שם פריט</th>
    <th style="width:9%">כמות</th>
    <th style="width:32%">מזהה (מסט"ב)</th>
    <th style="width:22%">הערות</th>
  </tr></thead>
  <tbody>${weaponRows}</tbody>
</table>

<!-- Table 3: armoury receiver — left blank -->
<div class="sec-label">פרטי הגורם המקבל במחסן</div>
<table>
  <thead><tr>
    <th style="width:14%">מ.א.</th>
    <th style="width:26%">שם ומשפחה</th>
    <th style="width:14%">דרגה</th>
    <th style="width:22%">חתימה</th>
    <th style="width:24%">הערות</th>
  </tr></thead>
  <tbody><tr>
    <td class="c">${esc(data.receiverPersonalNumber || '')}</td>
    <td class="r">${esc(data.receiverName || '')}</td>
    <td class="c">${esc(data.receiverRank || '')}</td>
    <td class="c signature-cell"><div class="signature-frame">${receiverSignatureHTML}</div></td>
    <td class="r">${data.receiverPhone ? `טלפון: ${esc(data.receiverPhone)}` : ''}</td>
  </tr></tbody>
</table>

<!-- Table 4: retrieval — left blank -->
<div class="sec-label">פרטי החייל שמושך את הארמו"י מהאפסון</div>
<table>
  <thead><tr>
    <th style="width:14%">מ.א.</th>
    <th style="width:26%">שם ומשפחה</th>
    <th style="width:14%">דרגה</th>
    <th style="width:20%">תאריך</th>
    <th style="width:26%">חתימה</th>
  </tr></thead>
  <tbody><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody>
</table>

<div class="footer-note">
  טופס זה יישמר למשך כשלושה חודשים במחסן לאחר הניפוק חזרה לחייל המאפסן.
</div>

</div>
</body>
</html>`;
}

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
    throw error;
  }
}

/**
 * Génère le HTML pour le PDF d'attribution - Format militaire officiel (style Topes 1003)
 */
function generateAssignmentHTML(assignment: Assignment): string {
  const titleText = assignment.type === 'combat'
    ? 'טופס החתמה על ציוד לחימה'
    : 'טופס החתמה על אפסנאות וציוד אישי';

  // S'assurer que timestamp est un Date object
  const timestamp = assignment.timestamp instanceof Date
    ? assignment.timestamp
    : new Date(assignment.timestamp);

  const dateStr = timestamp.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeStr = timestamp.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const operatorText = assignment.assignedByName || assignment.assignedByEmail || '';

  // Only show items that were actually assigned (no empty rows)
  const itemsToShow = assignment.items.slice(0, 20);

  // Générer les lignes du tableau avec numéro de série
  const itemsRows = itemsToShow
    .map((item, index) => `
    <tr>
      <td class="cell cell-center">${index + 1}</td>
      <td class="cell cell-right">${item.equipmentName}</td>
      <td class="cell cell-center">${item.quantity}</td>
      <td class="cell cell-center">${item.serial || '-'}</td>
      <td class="cell cell-right"></td>
    </tr>
  `).join('');

  // Image signature en base64
  const signatureImg = assignment.signature
    ? `<img src="${assignment.signature}" class="signature-img" />`
    : '<div class="signature-placeholder">חתימה</div>';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4;
      margin: 6mm;
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
      font-size: 10px;
      line-height: 1.25;
      padding: 3mm;
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
    .logo-placeholder {
      width: 60px;
      height: 60px;
      border: 1px dashed #999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: #666;
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
      padding: 3px 3px;
      min-height: 18px;
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
    
    /* Footer */
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 8px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 5px;
    }
  </style>
</head>
<body>
  <!-- Header Section -->
  <div class="header">
    <div class="header-right">
      <div class="logo-placeholder">לוגו גדוד</div>
    </div>
    <div class="header-center">
      <div class="doc-title">${titleText}</div>
      <div class="doc-subtitle">גדוד 982</div>
      <div class="voucher-number">מספר שובר: _______________</div>
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
    </tbody>
  </table>

  <!-- Signature Section -->
  <div class="signatures-container">
    <!-- Right Box - Issuer Details -->
    <div class="signature-box">
      <div class="signature-box-title">פרטי המנפק</div>
      <div class="signature-row">
        <span class="signature-label">שם:</span>
        <span class="signature-value">${operatorText}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">מ"א:</span>
        <span class="signature-value">${assignment.assignedByPersonalNumber || ''}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">דרגה:</span>
        <span class="signature-value">${assignment.assignedByRank || ''}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">תאריך:</span>
        <span class="signature-value">${dateStr}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">חתימה:</span>
      </div>
      <div class="signature-area">
        <div class="signature-placeholder">חתימת המנפק</div>
      </div>
    </div>

    <!-- Left Box - Receiver Details -->
    <div class="signature-box">
      <div class="signature-box-title">פרטי המקבל</div>
      <div class="signature-row">
        <span class="signature-label">שם:</span>
        <span class="signature-value">${assignment.soldierName}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">דרגה:</span>
        <span class="signature-value"></span>
      </div>
      <div class="signature-row">
        <span class="signature-label">מ"א:</span>
        <span class="signature-value">${assignment.soldierPersonalNumber}</span>
      </div>
      <div class="signature-row">
        <span class="signature-label">טלפון:</span>
        <span class="signature-value">${assignment.soldierPhone || ''}</span>
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
  </div>

  <!-- Footer -->
  <div class="footer">
    מסמך זה נוצר אוטומטית באמצעות מערכת ניהול ציוד גדוד 982 | ${dateStr} ${timeStr}
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
