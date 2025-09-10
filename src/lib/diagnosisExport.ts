import { Diagnosis } from '@/types/database';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export class DiagnosisExportService {
  // Export diagnosis to Excel
  static exportToExcel(diagnosis: Diagnosis, fileName?: string) {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Helper function to fix encoding issues
    const fixEncoding = (text: string): string => {
      if (!text) return '';
      return text
        .replace(/paciÅ†as/g, 'paciņas')
        .replace(/Å†/g, 'ņ')
        .replace(/Ä/g, 'ā')
        .replace(/Å/g, 'š')
        .replace(/Ä«/g, 'ī')
        .replace(/Äķ/g, 'ķ')
        .replace(/Ä/g, 'č')
        .replace(/Ě/g, 'ē')
        .replace(/Ł/g, 'ļ')
        .replace(/Ū/g, 'ū')
        .replace(/Ž/g, 'ž');
    };
    
    // Create compact diagnosis data - fit in half A4 page
    const diagnosisData = [
      ['MEDICAL DIAGNOSIS REPORT', '', '', ''],
      ['Date:', new Date(diagnosis.created_at).toLocaleDateString(), '', ''],
      ['Patient:', `${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim() || 'Not specified', 'Age:', diagnosis.patient_age || 'N/A'],
      ['Complaint:', fixEncoding(diagnosis.improved_patient_history || diagnosis.complaint), '', ''],
      ['Primary Diagnosis:', fixEncoding(diagnosis.primary_diagnosis || 'Pending evaluation'), '', ''],
      ...(diagnosis.differential_diagnoses && diagnosis.differential_diagnoses.length > 0 ? [
        ['Differential Diagnoses:', fixEncoding(diagnosis.differential_diagnoses.join(', ')), '', '']
      ] : []),
      ['Treatment:', fixEncoding(diagnosis.treatment?.join(', ') || 'None prescribed'), '', ''],
      ['Current Medications:', fixEncoding(diagnosis.current_medications || 'None'), '', ''],
      // All drugs listed by name only
      ...((diagnosis.drug_suggestions && diagnosis.drug_suggestions.length > 0) ? 
        diagnosis.drug_suggestions.map((drug: any) => [
          fixEncoding(drug.drug_name || drug.name || 'Unknown drug'),
          fixEncoding(drug.suggested_dosage || ''),
          fixEncoding(drug.treatment_duration || ''),
          fixEncoding(drug.administration_notes || '')
        ]) : []),
      ...((diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0) ? 
        diagnosis.inventory_drugs.map((drug: any) => [
          fixEncoding(drug.drug_name || drug.name || 'Unknown drug'),
          fixEncoding(drug.dosage || drug.suggested_dosage || ''),
          fixEncoding(drug.duration || drug.treatment_duration || ''),
          fixEncoding(drug.instructions || drug.administration_notes || '')
        ]) : []),
      ...((diagnosis.additional_therapy && diagnosis.additional_therapy.length > 0) ? 
        diagnosis.additional_therapy.map((therapy: any) => [
          fixEncoding(typeof therapy === 'string' ? therapy : 
            (therapy.drug_name || therapy.name || therapy.therapy_name || 'Unknown therapy')),
          fixEncoding(therapy.duration || ''),
          fixEncoding(therapy.notes || therapy.instructions || ''),
          ''
        ]) : []),
      ['Physician:', '________________________________', 'Date:', '________________'],
    ];

    // Convert to worksheet
    const ws = XLSX.utils.aoa_to_sheet(diagnosisData);
    
    // Set column widths
    ws['!cols'] = [
      { width: 25 }, // Column A
      { width: 40 }, // Column B  
      { width: 15 }, // Column C
      { width: 15 }  // Column D
    ];

    // Style the header for compact format
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'center' }
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Diagnosis Report');
    
    const filename = fileName || `diagnosis_report_${diagnosis.id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Write file with proper encoding options for Unicode support
    XLSX.writeFile(wb, filename, {
      bookType: 'xlsx',
      type: 'binary',
      compression: true
    });
  }

  // Export diagnosis to PDF
  static exportToPDF(diagnosis: Diagnosis, fileName?: string) {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Set up fonts and spacing for compact layout (half A4 page max)
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 15;
    const lineHeight = 4.5; // Reduced line height
    let currentY = margin;

    // Helper function to sanitize text for PDF output
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      
      // First fix common encoding corruption issues for Latvian
      let fixedText = text
        .replace(/paciÅ†as/g, 'pacinas')
        .replace(/Å†/g, 'n')
        .replace(/Ä/g, 'a')
        .replace(/Å/g, 's')
        .replace(/Ä«/g, 'i')
        .replace(/Äķ/g, 'k')
        .replace(/Ä/g, 'c')
        .replace(/Ě/g, 'e')
        .replace(/Ł/g, 'l')
        .replace(/Ū/g, 'u')
        .replace(/Ž/g, 'z');
      
      // Replace problematic Unicode characters with closest ASCII equivalents for PDF compatibility
      return fixedText
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


    const addCompactField = (label: string, value: string) => {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sanitizeText(`${label}:`), margin, currentY);
      pdf.setFont('helvetica', 'normal');
      const labelWidth = pdf.getTextWidth(`${label}: `);
      
      const sanitizedValue = sanitizeText(value);
      pdf.text(sanitizedValue, margin + labelWidth, currentY);
      currentY += lineHeight;
    };

    // Compact Header
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sanitizeText('MEDICAL DIAGNOSIS REPORT'), pageWidth / 2, currentY, { align: 'center' });
    currentY += lineHeight * 1.5;

    // Compact essential information only
    addCompactField('Date', new Date(diagnosis.created_at).toLocaleDateString());
    addCompactField('Patient', `${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim() || 'Not specified');
    if (diagnosis.patient_age) addCompactField('Age', diagnosis.patient_age.toString());
    addCompactField('Complaint', diagnosis.improved_patient_history || diagnosis.complaint);
    addCompactField('Primary Diagnosis', diagnosis.primary_diagnosis || 'Pending evaluation');
    if (diagnosis.differential_diagnoses && diagnosis.differential_diagnoses.length > 0) {
      addCompactField('Differential Diagnoses', diagnosis.differential_diagnoses.join(', '));
    }
    if (diagnosis.treatment?.length) addCompactField('Treatment', diagnosis.treatment.join(', '));
    if (diagnosis.current_medications) addCompactField('Current Medications', diagnosis.current_medications);

    // All drugs listed by name only (no categories)
    if (diagnosis.drug_suggestions && diagnosis.drug_suggestions.length > 0) {
      diagnosis.drug_suggestions.forEach((drug: any) => {
        const drugName = drug.drug_name || drug.name || 'Unknown drug';
        const dosage = drug.suggested_dosage ? ` ${drug.suggested_dosage}` : '';
        const duration = drug.treatment_duration ? ` for ${drug.treatment_duration}` : '';
        addCompactField(drugName, `${dosage}${duration}`);
      });
    }
    
    if (diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0) {
      diagnosis.inventory_drugs.forEach((drug: any) => {
        const drugName = drug.drug_name || drug.name || 'Unknown drug';
        const dosage = drug.dosage || drug.suggested_dosage || '';
        const duration = drug.duration || drug.treatment_duration || '';
        const instructions = drug.instructions || drug.administration_notes || '';
        const details = `${dosage} ${duration} ${instructions}`.trim();
        addCompactField(drugName, details);
      });
    }
    
    if (diagnosis.additional_therapy && diagnosis.additional_therapy.length > 0) {
      diagnosis.additional_therapy.forEach((therapy: any) => {
        const therapyName = typeof therapy === 'string' ? therapy : 
          (therapy.drug_name || therapy.name || therapy.therapy_name || 'Unknown therapy');
        const duration = therapy.duration || '';
        const notes = therapy.notes || therapy.instructions || '';
        addCompactField(therapyName, `${duration} ${notes}`.trim());
      });
    }

    // Compact signature area
    currentY += lineHeight;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Physician: ____________________________  Date: __________', margin, currentY);

    const filename = fileName || `diagnosis_report_${diagnosis.id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  }

  // Export diagnosis to Word-compatible format (actually RTF)
  static exportToWord(diagnosis: Diagnosis, fileName?: string) {
    // Helper function to escape RTF text and handle Unicode characters
    const escapeRtfText = (text: string): string => {
      if (!text) return '';
      
      // First fix common encoding corruption issues for Latvian
      let fixedText = text
        .replace(/paciÅ†as/g, 'paciņas')
        .replace(/Å†/g, 'ņ')
        .replace(/Ä/g, 'ā')
        .replace(/Å/g, 'š')
        .replace(/Ä«/g, 'ī')
        .replace(/Äķ/g, 'ķ')
        .replace(/Ä/g, 'č')
        .replace(/Ě/g, 'ē')
        .replace(/Ł/g, 'ļ')
        .replace(/Ū/g, 'ū')
        .replace(/Ž/g, 'ž');
      
      return fixedText
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/[üûùúūũûăâåäáàậắằẵặấầẩẫậāæçčċćđðéêëèēęěğģīîïìíįķļńñňôöòóōõøšśşŧţțūûüùúžźż]/gi, (match) => {
          // Convert Unicode characters to RTF Unicode escape sequences
          const code = match.charCodeAt(0);
          return `\\u${code}?`;
        });
    };

    // Helper function to format drug lists for RTF with drug names as titles
    const formatDrugListWithTitles = (drugs: any[], suffix: string, formatFunc: (drug: any) => { name: string, details: string }): string => {
      if (!drugs || drugs.length === 0) {
        return `{\\b ${suffix}:} None\\par`;
      }
      
      let result = '';
      drugs.forEach(drug => {
        const { name, details } = formatFunc(drug);
        result += `{\\b ${escapeRtfText(name)}: ${suffix}}\\par`;
        if (details) {
          result += `\\tab ${escapeRtfText(details)}\\par`;
        }
      });
      return result;
    };

    // Helper function to format regular drug lists for RTF
    const formatDrugList = (drugs: any[], listTitle: string, formatFunc: (drug: any) => string): string => {
      if (!drugs || drugs.length === 0) {
        return `{\\b ${listTitle}:} None\\par`;
      }
      
      let result = `{\\b ${listTitle}:}\\par`;
      drugs.forEach(drug => {
        result += `\\tab - ${escapeRtfText(formatFunc(drug))}\\par`;
      });
      return result;
    };
    
    const rtfContent = `{\\rtf1\\ansi\\ansicpg1257\\uc1\\deff0 {\\fonttbl {\\f0\\froman\\fcharset186 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs20
{\\b\\fs24\\qc MEDICAL DIAGNOSIS REPORT}\\par
{\\b Date:} ${escapeRtfText(new Date(diagnosis.created_at).toLocaleDateString())}\\par
{\\b Patient:} ${escapeRtfText(`${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim() || 'Not specified')}\\par
${diagnosis.patient_age ? `{\\b Age:} ${diagnosis.patient_age}\\par` : ''}
{\\b Complaint:} ${escapeRtfText(diagnosis.improved_patient_history || diagnosis.complaint)}\\par
{\\b Primary Diagnosis:} ${escapeRtfText(diagnosis.primary_diagnosis || 'Pending evaluation')}\\par
${diagnosis.differential_diagnoses && diagnosis.differential_diagnoses.length > 0 ? `{\\b Differential Diagnoses:} ${escapeRtfText(diagnosis.differential_diagnoses.join(', '))}\\par` : ''}
${diagnosis.treatment?.length ? `{\\b Treatment:} ${escapeRtfText(diagnosis.treatment.join(', '))}\\par` : ''}
${diagnosis.current_medications ? `{\\b Current Medications:} ${escapeRtfText(diagnosis.current_medications)}\\par` : ''}
${diagnosis.drug_suggestions && diagnosis.drug_suggestions.length > 0 ? 
  diagnosis.drug_suggestions.map((drug: any) => {
    const drugName = drug.drug_name || drug.name || 'Unknown drug';
    const dosage = drug.suggested_dosage ? ` ${drug.suggested_dosage}` : '';
    const duration = drug.treatment_duration ? ` for ${drug.treatment_duration}` : '';
    return `{\\b ${escapeRtfText(drugName)}:} ${escapeRtfText(`${dosage}${duration}`.trim())}\\par`;
  }).join('') : ''}
${diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0 ? 
  diagnosis.inventory_drugs.map((drug: any) => {
    const drugName = drug.drug_name || drug.name || 'Unknown drug';
    const dosage = drug.dosage || drug.suggested_dosage || '';
    const duration = drug.duration || drug.treatment_duration || '';
    const instructions = drug.instructions || drug.administration_notes || '';
    const details = `${dosage} ${duration} ${instructions}`.trim();
    return `{\\b ${escapeRtfText(drugName)}:} ${escapeRtfText(details)}\\par`;
  }).join('') : ''}
${diagnosis.additional_therapy && diagnosis.additional_therapy.length > 0 ? 
  diagnosis.additional_therapy.map((therapy: any) => {
    const therapyName = typeof therapy === 'string' ? therapy : 
      (therapy.drug_name || therapy.name || therapy.therapy_name || 'Unknown therapy');
    const duration = therapy.duration || '';
    const notes = therapy.notes || therapy.instructions || '';
    return `{\\b ${escapeRtfText(therapyName)}:} ${escapeRtfText(`${duration} ${notes}`.trim())}\\par`;
  }).join('') : ''}
\\par
{\\b Physician:} ____________________________  {\\b Date:} __________\\par
}`;

    // Create blob with proper encoding for RTF
    const blob = new Blob([rtfContent], { type: 'application/rtf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = fileName || `diagnosis_report_${diagnosis.id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.rtf`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}