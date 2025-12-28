// Service de génération de PDF pour les attributions d'équipement
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Assignment } from '../types';

/**
 * Génère un PDF 1 page A4 pour une attribution d'équipement
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
    // Créer un nouveau document PDF
    const pdfDoc = await PDFDocument.create();

    // Ajouter une page A4
    const page = pdfDoc.addPage([595, 842]); // A4: 595x842 points
    const { width, height } = page.getSize();

    // Charger les fonts (Standard fonts, pas besoin d'embed)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Marges
    const margin = 50;
    const contentWidth = width - 2 * margin;
    let yPosition = height - margin;

    // ========================================
    // 1. EN-TÊTE - TITRE
    // ========================================
    const titleText = assignment.type === 'combat'
      ? 'טופס מסירת ציוד לחימה'
      : 'טופס מסירת ביגוד וציוד אישי';

    page.drawText(titleText, {
      x: width / 2 - 100, // Centré approximativement (RTL)
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 10;

    page.drawText('גדוד 982', {
      x: width / 2 - 30,
      y: yPosition,
      size: 14,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 40;

    // ========================================
    // 2. DÉTAILS DU SOLDAT (Encadré)
    // ========================================
    page.drawRectangle({
      x: margin,
      y: yPosition - 80,
      width: contentWidth,
      height: 90,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    yPosition -= 15;
    const labelX = width - margin - 10; // RTL: labels à droite
    const valueX = labelX - 150;

    // Nom
    page.drawText('שם חייל:', {
      x: labelX - 50,
      y: yPosition,
      size: 11,
      font: fontBold,
    });
    page.drawText(assignment.soldierName, {
      x: valueX - 50,
      y: yPosition,
      size: 11,
      font: font,
    });
    yPosition -= 20;

    // Numéro personnel
    page.drawText('מספר אישי:', {
      x: labelX - 50,
      y: yPosition,
      size: 11,
      font: fontBold,
    });
    page.drawText(assignment.soldierPersonalNumber, {
      x: valueX - 50,
      y: yPosition,
      size: 11,
      font: font,
    });
    yPosition -= 20;

    // Compagnie
    if (assignment.soldierCompany) {
      page.drawText('פלוגה:', {
        x: labelX - 50,
        y: yPosition,
        size: 11,
        font: fontBold,
      });
      page.drawText(assignment.soldierCompany, {
        x: valueX - 50,
        y: yPosition,
        size: 11,
        font: font,
      });
      yPosition -= 20;
    }

    // Téléphone
    if (assignment.soldierPhone) {
      page.drawText('טלפון:', {
        x: labelX - 50,
        y: yPosition,
        size: 11,
        font: fontBold,
      });
      page.drawText(assignment.soldierPhone, {
        x: valueX - 50,
        y: yPosition,
        size: 11,
        font: font,
      });
    }

    yPosition -= 50;

    // ========================================
    // 3. TABLEAU DES ITEMS
    // ========================================
    page.drawText('פירוט ציוד:', {
      x: labelX - 50,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;

    // Dessiner le tableau (header)
    const tableStartY = yPosition;
    const rowHeight = 25;
    const colWidths = [150, 100, 150]; // [שם ציוד, כמות, מסטב]

    // Header du tableau
    page.drawRectangle({
      x: margin,
      y: tableStartY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.9),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    // Colonnes header (RTL)
    page.drawText('שם ציוד', {
      x: width - margin - colWidths[0] + 40,
      y: tableStartY - 18,
      size: 10,
      font: fontBold,
    });
    page.drawText('כמות', {
      x: width - margin - colWidths[0] - colWidths[1] + 30,
      y: tableStartY - 18,
      size: 10,
      font: fontBold,
    });
    page.drawText('מסטב', {
      x: width - margin - colWidths[0] - colWidths[1] - colWidths[2] + 40,
      y: tableStartY - 18,
      size: 10,
      font: fontBold,
    });

    yPosition -= rowHeight;

    // Lignes du tableau (items)
    const maxItems = 15; // Limite pour tenir sur 1 page
    const itemsToShow = assignment.items.slice(0, maxItems);

    itemsToShow.forEach((item, index) => {
      page.drawRectangle({
        x: margin,
        y: yPosition - rowHeight,
        width: contentWidth,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });

      // Nom équipement
      page.drawText(item.equipmentName, {
        x: width - margin - colWidths[0] + 10,
        y: yPosition - 18,
        size: 9,
        font: font,
      });

      // Quantité
      page.drawText(item.quantity.toString(), {
        x: width - margin - colWidths[0] - colWidths[1] + 40,
        y: yPosition - 18,
        size: 9,
        font: font,
      });

      // Serial
      if (item.serial) {
        page.drawText(item.serial, {
          x: width - margin - colWidths[0] - colWidths[1] - colWidths[2] + 10,
          y: yPosition - 18,
          size: 9,
          font: font,
        });
      }

      yPosition -= rowHeight;
    });

    if (assignment.items.length > maxItems) {
      page.drawText(`(+ ${assignment.items.length - maxItems} items supplémentaires)`, {
        x: margin + 10,
        y: yPosition - 10,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 20;
    }

    yPosition -= 30;

    // ========================================
    // 4. DATE ET OPÉRATEUR
    // ========================================
    const dateStr = new Date(assignment.timestamp).toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    page.drawText(`תאריך ושעה: ${dateStr}`, {
      x: labelX - 150,
      y: yPosition,
      size: 10,
      font: font,
    });
    yPosition -= 20;

    if (assignment.assignedByName || assignment.assignedByEmail) {
      const operatorText = assignment.assignedByName || assignment.assignedByEmail || '';
      page.drawText(`בוצע על ידי: ${operatorText}`, {
        x: labelX - 150,
        y: yPosition,
        size: 10,
        font: font,
      });
      yPosition -= 30;
    }

    // ========================================
    // 5. SIGNATURE
    // ========================================
    if (assignment.signature) {
      try {
        page.drawText('חתימת מקבל:', {
          x: labelX - 50,
          y: yPosition,
          size: 11,
          font: fontBold,
        });
        yPosition -= 10;

        // Embed signature image (PNG ou JPEG depuis base64)
        let signatureImage;
        const signatureData = assignment.signature.replace(/^data:image\/\w+;base64,/, '');

        if (assignment.signature.includes('image/png')) {
          signatureImage = await pdfDoc.embedPng(signatureData);
        } else {
          signatureImage = await pdfDoc.embedJpg(signatureData);
        }

        // Dessiner la signature (redimensionnée)
        const signatureHeight = 60;
        const signatureWidth = (signatureImage.width / signatureImage.height) * signatureHeight;

        page.drawImage(signatureImage, {
          x: width - margin - signatureWidth - 20,
          y: yPosition - signatureHeight,
          width: signatureWidth,
          height: signatureHeight,
        });

        yPosition -= signatureHeight + 10;
      } catch (error) {
        console.error('Error embedding signature:', error);
        // Continuer sans signature si erreur
        page.drawText('(Signature non disponible)', {
          x: width - margin - 150,
          y: yPosition - 20,
          size: 9,
          font: font,
          color: rgb(0.7, 0, 0),
        });
      }
    }

    // ========================================
    // 6. PIED DE PAGE
    // ========================================
    page.drawText('מסמך זה נוצר אוטומטית באמצעות מערכת ניהול ציוד גדוד 982', {
      x: margin,
      y: 30,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Générer le PDF en Uint8Array
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
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
