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
  reportType: 'פתיחה' | 'סגירה';
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
        <td class="cell cell-center">${(stock.issued + stock.stored) > 0 ? stock.issued + stock.stored : ''}</td>
        <td class="cell cell-center">${stock.available > 0 ? stock.available : ''}</td>
        <td class="cell cell-center">${stock.stored > 0 ? stock.stored : ''}</td>
        <td class="cell cell-center grey-cell">${totalInArmory > 0 ? totalInArmory : ''}</td>
        <td class="cell cell-right"></td>
      </tr>`;
    })
    .join('');

  const signatureImg = data.operatorSignature
    ? `<img src="${data.operatorSignature}" style="max-width: 180px; max-height: 60px; object-fit: contain; filter: contrast(1.4) brightness(0.85);" />`
    : '';

  return `<!DOCTYPE html>
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
    html, body {
      width: 100%;
      height: 100%;
    }
    body {
      font-family: Arial, 'David', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 13px;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0;
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #000;
      padding: 6px 10px;
      background: #1a1a2e;
      color: #fff;
    }
    .header-side {
      font-size: 12px;
      min-width: 100px;
    }
    .doc-title {
      font-size: 20px;
      font-weight: bold;
      text-align: center;
      flex: 1;
      letter-spacing: 1px;
    }
    .doc-subtitle {
      font-size: 11px;
      text-align: center;
      opacity: 0.8;
    }

    /* ── Inventory table ── */
    .table-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 6px 4px 4px 4px;
    }
    .inventory-table {
      width: 100%;
      border-collapse: collapse;
      flex: 1;
    }
    .inventory-table thead th {
      background-color: #2c3e50;
      color: #fff;
      border: 1px solid #000;
      padding: 7px 3px;
      font-weight: bold;
      font-size: 13px;
      text-align: center;
    }
    .inventory-table tbody tr:nth-child(even) {
      background-color: #f0f0f0;
    }
    .inventory-table tbody tr:nth-child(odd) {
      background-color: #fff;
    }
    .cell {
      border: 1px solid #555;
      padding: 6px 3px;
      font-size: 13px;
    }
    .cell-center { text-align: center; }
    .cell-right  { text-align: right; padding-right: 5px; }
    .grey-cell   { background-color: #b8c6d0 !important; font-weight: bold; }

    /* ── Signature table ── */
    .sig-section {
      padding: 0 4px 4px 4px;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
    }
    .sig-table td,
    .sig-table th {
      border: 2px solid #000;
      padding: 5px 8px;
      font-size: 13px;
      vertical-align: middle;
    }
    .sig-header {
      background-color: #2c3e50;
      color: #fff;
      font-weight: bold;
      text-align: center;
      font-size: 14px;
    }
    .sig-label {
      background-color: #dde4ea;
      font-weight: bold;
      text-align: right;
      white-space: nowrap;
      width: 14%;
    }
    .sig-value {
      min-width: 120px;
    }
    .sig-area {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>

  <div class="page-header">
    <div class="header-side" style="text-align:right;">תאריך: ${dateStr}</div>
    <div style="text-align:center; flex:1;">
      <div class="doc-title">ספירת מחסן ארמו"ן – ${data.reportType}</div>
      <div class="doc-subtitle">גדוד 982 | שעה: ${timeStr}</div>
    </div>
    <div class="header-side" style="text-align:left;"></div>
  </div>

  <div class="table-wrapper">
    <table class="inventory-table">
      <thead>
        <tr>
          <th style="width:4%">מס"ד</th>
          <th style="width:7%">מק"ט</th>
          <th style="width:21%">שם פריט</th>
          <th style="width:13%">מלאי תקני / קיים</th>
          <th style="width:11%">השאלות זמניות</th>
          <th style="width:10%">מצאי</th>
          <th style="width:8%">איפסון</th>
          <th style="width:13%">סה"כ מצאי במחסן</th>
          <th style="width:13%">הערות</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <div class="sig-section">
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
  </div>

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
        dialogTitle: `ספירת מחסן ארמו"ן – ${data.reportType}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ html });
    }
  } else {
    await Print.printAsync({ html, orientation: Print.Orientation.portrait });
  }
};
