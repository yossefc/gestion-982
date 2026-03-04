/**
 * companyReportService.ts
 * Logic for generating the "דוח ציוד חתום" (signed equipment report) per פלוגה.
 *
 * Rules:
 *  - Only include items that have a מסט"ב (serial / catalogue ID).
 *  - Group by equipment name.
 *  - Calculate totals per group.
 *  - Generate A4 RTL PDF HTML.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SoldierHolding {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    soldierCompany?: string;
    items: {
        equipmentId: string;
        equipmentName: string;
        quantity: number;
        serial?: string;
    }[];
}

export interface ReportRow {
    soldierName: string;
    soldierPersonalNumber: string;
    equipmentName: string;
    serial: string;
}

export interface EquipmentGroup {
    equipmentName: string;
    rows: ReportRow[];
    total: number;
}

export interface CompanyReportData {
    company: string;
    generatedAt: Date;
    groups: EquipmentGroup[];
    grandTotal: number;
}

// ─── Core Processing Function ─────────────────────────────────────────────────

/**
 * Takes raw soldier holdings and a company name, then:
 * 1. Filters to only the soldiers from that company.
 * 2. Filters items that have a מסט"ב (serial).
 * 3. Groups by equipment name.
 * 4. Calculates totals.
 */
export function buildCompanyReport(
    allHoldings: SoldierHolding[],
    company: string
): CompanyReportData {
    // 1. Filter to selected company
    const companyHoldings = company === 'הכל'
        ? allHoldings
        : allHoldings.filter(h => h.soldierCompany === company);

    // 2. Collect all rows, only if item has a serial (מסט"ב)
    const groupMap = new Map<string, EquipmentGroup>();

    for (const holding of companyHoldings) {
        for (const item of holding.items) {
            // Only include items with a serial (מסט"ב)
            if (!item.serial || item.serial.trim() === '' || item.serial === '-') {
                continue;
            }

            const name = item.equipmentName;
            if (!groupMap.has(name)) {
                groupMap.set(name, { equipmentName: name, rows: [], total: 0 });
            }

            const group = groupMap.get(name)!;

            // Each serial can be comma-separated (e.g., "SN1, SN2")
            const serials = item.serial
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            for (const sn of serials) {
                group.rows.push({
                    soldierName: holding.soldierName,
                    soldierPersonalNumber: holding.soldierPersonalNumber,
                    equipmentName: name,
                    serial: sn,
                });
                group.total += 1;
            }
        }
    }

    // 3. Sort groups alphabetically by equipment name
    const groups = Array.from(groupMap.values()).sort((a, b) =>
        a.equipmentName.localeCompare(b.equipmentName, 'he')
    );

    const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);

    return {
        company,
        generatedAt: new Date(),
        groups,
        grandTotal,
    };
}

// ─── HTML / PDF Generation ────────────────────────────────────────────────────

export function generateCompanyReportHTML(report: CompanyReportData): string {
    const dateStr = report.generatedAt.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    let rowIndex = 0;
    const tableRows = report.groups.flatMap(group => {
        const dataRows = group.rows.map(row => {
            rowIndex++;
            return `
      <tr>
        <td class="c">${rowIndex}</td>
        <td class="r">${row.soldierName}</td>
        <td class="c">${row.soldierPersonalNumber}</td>
        <td class="r">${row.equipmentName}</td>
        <td class="c">${row.serial}</td>
      </tr>`;
        });

        const totalRow = `
      <tr class="total-row">
        <td colspan="4" class="r bold">סה"כ ${group.equipmentName}:</td>
        <td class="c bold">${group.total}</td>
      </tr>`;

        return [...dataRows, totalRow];
    });

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, 'David', sans-serif;
    direction: rtl;
    text-align: right;
    font-size: 10px;
    line-height: 1.4;
    color: #000;
  }
  .header {
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
  }
  h1 { font-size: 16px; font-weight: bold; margin-bottom: 3px; }
  h2 { font-size: 12px; font-weight: normal; color: #333; }
  .meta { font-size: 9px; color: #555; margin-top: 4px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th {
    background: #2c3e50;
    color: #fff;
    border: 1px solid #000;
    padding: 5px 4px;
    font-size: 10px;
    font-weight: bold;
    text-align: center;
  }
  td {
    border: 1px solid #000;
    padding: 4px;
    font-size: 9.5px;
    height: 20px;
  }
  td.c { text-align: center; }
  td.r { text-align: right; }
  .bold { font-weight: bold; }
  tr.total-row td {
    background: #e8e8e8;
    font-weight: bold;
  }
  .footer {
    margin-top: 10px;
    font-size: 8px;
    color: #888;
    text-align: center;
    border-top: 1px solid #ccc;
    padding-top: 5px;
  }
  .grand-total {
    margin-top: 8px;
    font-size: 11px;
    font-weight: bold;
    text-align: left;
    background: #2c3e50;
    color: #fff;
    padding: 5px 10px;
    display: inline-block;
  }
</style>
</head>
<body>

<div class="header">
  <h1>דוח ציוד חתום</h1>
  <h2>פלוגה: ${report.company}</h2>
  <div class="meta">תאריך הפקה: ${dateStr} | סה"כ פריטים: ${report.grandTotal}</div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:6%">מס"ד</th>
      <th style="width:26%">שם החייל</th>
      <th style="width:14%">מ.א.</th>
      <th style="width:30%">שם פריט</th>
      <th style="width:24%">מסט"ב</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows.join('')}
  </tbody>
</table>

<div class="grand-total">סה"כ כולל: ${report.grandTotal} פריטים</div>

<div class="footer">
  מסמך זה הופק אוטומטית · מערכת ניהול ציוד גדוד 982 · ${dateStr}
</div>

</body>
</html>`;
}

// ─── Print / Share ─────────────────────────────────────────────────────────────

export async function printCompanyReport(report: CompanyReportData): Promise<void> {
    const html = generateCompanyReportHTML(report);

    if (Platform.OS === 'ios') {
        await Print.printAsync({ html });
    } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: `דוח פלוגה ${report.company}`,
        });
    }
}
