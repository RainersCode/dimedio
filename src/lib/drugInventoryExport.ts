import { UserDrugInventory } from '@/types/database';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export class DrugInventoryExportService {
  // Export drug inventory to Excel
  static exportToExcel(drugs: UserDrugInventory[], fileName?: string) {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Create the main drug inventory data
    const drugData = [
      ['DRUG INVENTORY REPORT', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Date:', new Date().toLocaleDateString(), '', '', '', ''],
      ['Total Drugs:', drugs.length.toString(), '', '', '', ''],
      ['', '', '', '', '', ''],
      ['DRUG INVENTORY', '', '', '', '', ''],
      ['Drug Name', 'Generic Name', 'Category', 'Stock Quantity', 'Unit Price', 'Expiry Date'],
    ];

    // Add drug data rows
    drugs.forEach(drug => {
      drugData.push([
        drug.drug_name || drug.brand_name || 'N/A',
        drug.generic_name || 'N/A',
        drug.category?.name || 'Uncategorized',
        drug.stock_quantity?.toString() || '0',
        drug.unit_price ? `€${drug.unit_price.toFixed(2)}` : 'N/A',
        drug.expiry_date ? new Date(drug.expiry_date).toLocaleDateString() : 'N/A'
      ]);
    });

    // Convert to worksheet
    const ws = XLSX.utils.aoa_to_sheet(drugData);
    
    // Set column widths
    ws['!cols'] = [
      { width: 30 }, // Drug Name
      { width: 25 }, // Generic Name  
      { width: 20 }, // Category
      { width: 15 }, // Stock
      { width: 12 }, // Price
      { width: 15 }  // Expiry
    ];

    // Style the header
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      };
    }

    // Style section headers
    const sectionHeaders = ['A6'];
    sectionHeaders.forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true, sz: 12 },
          fill: { fgColor: { rgb: 'F3F4F6' } }
        };
      }
    });

    // Style column headers
    const columnHeaders = ['A7', 'B7', 'C7', 'D7', 'E7', 'F7'];
    columnHeaders.forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E5E7EB' } }
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Drug Inventory');
    
    const filename = fileName || `drug_inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Write file with proper encoding options for Unicode support
    XLSX.writeFile(wb, filename, {
      bookType: 'xlsx',
      type: 'binary',
      compression: true
    });
  }

  // Export drug inventory to PDF
  static exportToPDF(drugs: UserDrugInventory[], fileName?: string) {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Set up fonts and spacing
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 15;
    const lineHeight = 6;
    let currentY = margin;

    // Helper function to sanitize text for PDF output
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      // Replace problematic Unicode characters with closest ASCII equivalents for PDF compatibility
      return text
        .replace(/[āĀ]/g, 'a')
        .replace(/[čČ]/g, 'c')
        .replace(/[ēĒ]/g, 'e')
        .replace(/[ģĢ]/g, 'g')
        .replace(/[īĪ]/g, 'i')
        .replace(/[ķĶ]/g, 'k')
        .replace(/[ļĻ]/g, 'l')
        .replace(/[ņŅ]/g, 'n')
        .replace(/[šŠ]/g, 's')
        .replace(/[ūŪ]/g, 'u')
        .replace(/[žŽ]/g, 'z')
        .replace(/[^\x20-\x7E]/g, '?'); // Replace any remaining non-ASCII with ?
    };

    const addSection = (title: string) => {
      currentY += 3;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sanitizeText(title), margin, currentY);
      currentY += lineHeight + 2;
    };

    const addField = (label: string, value: string) => {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sanitizeText(`${label}:`), margin, currentY);
      pdf.setFont('helvetica', 'normal');
      const labelWidth = pdf.getTextWidth(`${label}: `);
      pdf.text(sanitizeText(value), margin + labelWidth, currentY);
      currentY += lineHeight;
    };

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sanitizeText('DRUG INVENTORY REPORT'), pageWidth / 2, currentY, { align: 'center' });
    currentY += lineHeight * 2;

    // Date and summary
    addField('Date', new Date().toLocaleDateString());
    addField('Total Drugs', drugs.length.toString());
    addField('Low Stock Items', drugs.filter(d => (d.stock_quantity || 0) <= 10).length.toString());
    addField('Out of Stock Items', drugs.filter(d => (d.stock_quantity || 0) === 0).length.toString());

    // Drug list
    addSection('DRUG INVENTORY');
    
    // Table headers
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    const colWidths = [45, 40, 25, 20, 20, 25]; // Column widths in mm
    const colPositions = [margin];
    for (let i = 1; i < colWidths.length; i++) {
      colPositions[i] = colPositions[i-1] + colWidths[i-1];
    }
    
    pdf.text('Drug Name', colPositions[0], currentY);
    pdf.text('Generic Name', colPositions[1], currentY);
    pdf.text('Category', colPositions[2], currentY);
    pdf.text('Stock', colPositions[3], currentY);
    pdf.text('Price', colPositions[4], currentY);
    pdf.text('Expiry', colPositions[5], currentY);
    
    currentY += lineHeight + 1;
    
    // Draw header line
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, currentY - 2, pageWidth - margin, currentY - 2);
    
    // Drug rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    drugs.forEach((drug, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 30) {
        pdf.addPage();
        currentY = margin + 10;
      }
      
      const drugName = sanitizeText(drug.drug_name || drug.brand_name || 'N/A');
      const genericName = sanitizeText(drug.generic_name || 'N/A');
      const category = sanitizeText(drug.category?.name || 'Uncategorized');
      const stock = drug.stock_quantity?.toString() || '0';
      const price = drug.unit_price ? `€${drug.unit_price.toFixed(2)}` : 'N/A';
      const expiry = drug.expiry_date ? new Date(drug.expiry_date).toLocaleDateString() : 'N/A';
      
      // Truncate long text to fit in columns
      const maxChars = [25, 20, 15, 8, 10, 12];
      const truncatedTexts = [
        drugName.length > maxChars[0] ? drugName.substring(0, maxChars[0]-3) + '...' : drugName,
        genericName.length > maxChars[1] ? genericName.substring(0, maxChars[1]-3) + '...' : genericName,
        category.length > maxChars[2] ? category.substring(0, maxChars[2]-3) + '...' : category,
        stock,
        price,
        expiry
      ];
      
      pdf.text(truncatedTexts[0], colPositions[0], currentY);
      pdf.text(truncatedTexts[1], colPositions[1], currentY);
      pdf.text(truncatedTexts[2], colPositions[2], currentY);
      pdf.text(truncatedTexts[3], colPositions[3], currentY);
      pdf.text(truncatedTexts[4], colPositions[4], currentY);
      pdf.text(truncatedTexts[5], colPositions[5], currentY);
      
      currentY += lineHeight;
      
      // Add subtle line every few rows for readability
      if ((index + 1) % 5 === 0) {
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, currentY - 2, pageWidth - margin, currentY - 2);
      }
    });

    const filename = fileName || `drug_inventory_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  }

  // Export drug inventory to Word-compatible format (RTF with Unicode support)
  static exportToWord(drugs: UserDrugInventory[], fileName?: string) {
    // Helper function to escape RTF text and handle Unicode characters
    const escapeRtfText = (text: string): string => {
      if (!text) return '';
      
      return text
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/[üûùúūũûăâåäáàậắằẵặấầẩẫậāæçčċćđðéêëèēęěğģīîïìíįķļńñňôöòóōõøšśşŧţțūûüùúžźż]/gi, (match) => {
          // Convert Unicode characters to RTF Unicode escape sequences
          const code = match.charCodeAt(0);
          return `\\u${code}?`;
        });
    };
    
    const rtfContent = `{\\rtf1\\ansi\\ansicpg1257\\uc1\\deff0 {\\fonttbl {\\f0\\froman\\fcharset186 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs24
{\\b\\fs28\\qc DRUG INVENTORY REPORT}\\par
\\par
{\\b Date:} ${escapeRtfText(new Date().toLocaleDateString())}\\par
{\\b Total Drugs:} ${drugs.length}\\par
{\\b Low Stock Items:} ${drugs.filter(d => (d.stock_quantity || 0) <= 10).length}\\par
{\\b Out of Stock Items:} ${drugs.filter(d => (d.stock_quantity || 0) === 0).length}\\par
\\par
{\\b\\fs26 DRUG INVENTORY}\\par
\\par
${drugs.map(drug => `{\\b Drug Name:} ${escapeRtfText(drug.drug_name || drug.brand_name || 'N/A')}\\par
${drug.generic_name ? `{\\b Generic Name:} ${escapeRtfText(drug.generic_name)}\\par` : ''}
{\\b Category:} ${escapeRtfText(drug.category?.name || 'Uncategorized')}\\par
{\\b Stock Quantity:} ${drug.stock_quantity || 0}\\par
${drug.unit_price ? `{\\b Unit Price:} €${drug.unit_price.toFixed(2)}\\par` : ''}
${drug.expiry_date ? `{\\b Expiry Date:} ${escapeRtfText(new Date(drug.expiry_date).toLocaleDateString())}\\par` : ''}
${drug.notes ? `{\\b Notes:} ${escapeRtfText(drug.notes)}\\par` : ''}
\\par`).join('')}
}`;

    // Create blob with proper encoding for RTF
    const blob = new Blob([rtfContent], { type: 'application/rtf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = fileName || `drug_inventory_${new Date().toISOString().split('T')[0]}.rtf`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}