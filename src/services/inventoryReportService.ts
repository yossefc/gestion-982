import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { EquipmentStock } from './combatStockService';

export interface InventoryReportData {
  stocks: EquipmentStock[];
  operatorName: string;
  operatorPersonalNumber?: string; // מ.א.
  operatorRank?: string;
  operatorSignature?: string;
  timestamp: Date;
}

const generateInventoryReportHTML = (data: InventoryReportData): string => {
  const dateStr = data.timestamp.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeStr = data.timestamp.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const tableRows = data.stocks
    .map((stock, index) => {
      const totalInArmory = stock.available + stock.stored;
      return `
      <tr>
        <td class="cell cell-center">${index + 1}</td>
        <td class="cell cell-right"></td>
        <td class="cell cell-right">${stock.equipmentName}</td>
        <td class="cell cell-center">${stock.total > 0 ? stock.total : ''}</td>
        <td class="cell cell-center">${stock.issued > 0 ? stock.issued : ''}</td>
        <td class="cell cell-center">${stock.available > 0 ? stock.available : ''}</td>
        <td class="cell cell-center">${stock.stored > 0 ? stock.stored : ''}</td>
        <td class="cell cell-center grey-cell">${totalInArmory > 0 ? totalInArmory : ''}</td>
        <td class="cell cell-right"></td>
      </tr>`;
    })
    .join('');

  const signatureImg = data.operatorSignature
    ? `<img src="${data.operatorSignature}" style="max-width: 110px; max-height: 38px; object-fit: contain;" />`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      overflow: hidden;
    }
    body {
      font-family: Arial, 'David', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 13px;
      line-height: 1.4;
    }

    /* ── Header ── */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .header-side {
      font-size: 12px;
      min-width: 90px;
    }
    .doc-title {
      font-size: 17px;
      font-weight: bold;
      text-decoration: underline;
      text-align: center;
      flex: 1;
    }

    /* ── Inventory table ── */
    .inventory-table {
      width: 92%;
      margin: 0 auto 14px auto;
      border-collapse: collapse;
    }
    .inventory-table th {
      background-color: #d8d8d8;
      border: 1px solid #000;
      padding: 4px 2px;
      font-weight: bold;
      font-size: 12px;
      text-align: center;
    }
    .cell {
      border: 1px solid #000;
      padding: 3px 2px;
      min-height: 20px;
      font-size: 12px;
    }
    .cell-center { text-align: center; }
    .cell-right  { text-align: right; padding-right: 3px; }
    .grey-cell   { background-color: #b8b8b8; font-weight: bold; }

    /* ── Signature table ── */
    .sig-table {
      width: 92%;
      margin: 0 auto;
      border-collapse: collapse;
    }
    .sig-table td,
    .sig-table th {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 12px;
      vertical-align: middle;
    }
    .sig-header {
      background-color: #d8d8d8;
      font-weight: bold;
      text-align: center;
      font-size: 13px;
    }
    .sig-label {
      background-color: #e8e8e8;
      font-weight: bold;
      text-align: right;
      white-space: nowrap;
      width: 14%;
    }
    .sig-value {
      min-width: 120px;
    }
    .sig-area {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>

  <div class="header-row">
    <div class="header-side" style="text-align:left;">שעה: ${timeStr}</div>
    <div class="doc-title">ספירת מחסן ארמו"ן - פתיחה / סגירה</div>
    <div class="header-side" style="text-align:right;">תאריך: ${dateStr}</div>
  </div>

  <table class="inventory-table">
    <thead>
      <tr>
        <th style="width:4%">מס"ד</th>
        <th style="width:7%">מק"ט</th>
        <th style="width:19%">שם פריט</th>
        <th style="width:12%">מלאי תקני / קיים</th>
        <th style="width:11%">השאלות זמניות</th>
        <th style="width:10%">מצאי</th>
        <th style="width:8%">איפסון</th>
        <th style="width:12%">סה"כ מצאי במחסן</th>
        <th style="width:17%">הערות</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <table class="sig-table">
    <thead>
      <tr>
        <th class="sig-header" style="width:14%">פרטים</th>
        <th class="sig-header">אחראי משק הארמו"ן</th>
        <th class="sig-header">בעל תפקיד סופר</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sig-label">שם ומשפחה</td>
        <td class="sig-value">${data.operatorName}</td>
        <td class="sig-value"></td>
      </tr>
      <tr>
        <td class="sig-label">מ.א.</td>
        <td class="sig-value">${data.operatorPersonalNumber || ''}</td>
        <td class="sig-value"></td>
      </tr>
      <tr>
        <td class="sig-label">דרגה</td>
        <td class="sig-value">${data.operatorRank || ''}</td>
        <td class="sig-value"></td>
      </tr>
      <tr>
        <td class="sig-label">חתימה</td>
        <td class="sig-value">
          <div class="sig-area">${signatureImg}</div>
        </td>
        <td class="sig-value">
          <div class="sig-area"></div>
        </td>
      </tr>
    </tbody>
  </table>

</body>
</html>`;
};

export const printInventoryReport = async (data: InventoryReportData): Promise<void> => {
  const html = generateInventoryReportHTML(data);

  if (Platform.OS === 'android') {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'ספירת מחסן ארמו"ן',
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ html });
    }
  } else {
    await Print.printAsync({ html, orientation: Print.Orientation.portrait });
  }
};
