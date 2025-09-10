import { Diagnosis } from '@/types/database';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export class DiagnosisExportService {
  // Export diagnosis to Excel
  static exportToExcel(diagnosis: Diagnosis, fileName?: string) {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Create the main diagnosis data
    const diagnosisData = [
      ['MEDICAL DIAGNOSIS REPORT', '', '', ''],
      ['', '', '', ''],
      ['Date:', new Date(diagnosis.created_at).toLocaleDateString(), '', ''],
      ['Diagnosis ID:', diagnosis.id, '', ''],
      ['', '', '', ''],
      ['PATIENT INFORMATION', '', '', ''],
      ['Name:', `${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim() || 'Not specified', '', ''],
      ['Patient ID:', diagnosis.patient_id || 'Not specified', '', ''],
      ['Age:', diagnosis.patient_age || 'Not specified', '', ''],
      ['Gender:', diagnosis.patient_gender || 'Not specified', '', ''],
      ['Date of Birth:', diagnosis.date_of_birth || 'Not specified', '', ''],
      ['', '', '', ''],
      ['VITAL SIGNS', '', '', ''],
      ['Blood Pressure:', diagnosis.blood_pressure_systolic && diagnosis.blood_pressure_diastolic ? 
        `${diagnosis.blood_pressure_systolic}/${diagnosis.blood_pressure_diastolic} mmHg` : 'Not recorded', '', ''],
      ['Heart Rate:', diagnosis.heart_rate ? `${diagnosis.heart_rate} bpm` : 'Not recorded', '', ''],
      ['Temperature:', diagnosis.temperature ? `${diagnosis.temperature}°C` : 'Not recorded', '', ''],
      ['Respiratory Rate:', diagnosis.respiratory_rate ? `${diagnosis.respiratory_rate}/min` : 'Not recorded', '', ''],
      ['Oxygen Saturation:', diagnosis.oxygen_saturation ? `${diagnosis.oxygen_saturation}%` : 'Not recorded', '', ''],
      ['Weight:', diagnosis.weight ? `${diagnosis.weight} kg` : 'Not recorded', '', ''],
      ['Height:', diagnosis.height ? `${diagnosis.height} cm` : 'Not recorded', '', ''],
      ['', '', '', ''],
      ['CHIEF COMPLAINT', '', '', ''],
      ['Complaint:', diagnosis.complaint, '', ''],
      ['Duration:', diagnosis.complaint_duration || 'Not specified', '', ''],
      ['Pain Scale:', diagnosis.pain_scale ? `${diagnosis.pain_scale}/10` : 'Not assessed', '', ''],
      ['Symptom Onset:', diagnosis.symptom_onset || 'Not specified', '', ''],
      ['Associated Symptoms:', diagnosis.associated_symptoms || 'None reported', '', ''],
      ['', '', '', ''],
      ['MEDICAL HISTORY', '', '', ''],
      ['Allergies:', diagnosis.allergies || 'None known', '', ''],
      ['Current Medications:', diagnosis.current_medications || 'None', '', ''],
      ['Chronic Conditions:', diagnosis.chronic_conditions || 'None', '', ''],
      ['Previous Surgeries:', diagnosis.previous_surgeries || 'None', '', ''],
      ['Previous Injuries:', diagnosis.previous_injuries || 'None', '', ''],
      ['', '', '', ''],
      ['DIAGNOSIS', '', '', ''],
      ['Primary Diagnosis:', diagnosis.primary_diagnosis || 'Pending evaluation', '', ''],
      ['Differential Diagnoses:', diagnosis.differential_diagnoses?.join(', ') || 'None listed', '', ''],
      ['Severity Level:', diagnosis.severity_level || 'Not assessed', '', ''],
      ['Confidence Score:', diagnosis.confidence_score ? `${Math.round(diagnosis.confidence_score * 100)}%` : 'Not available', '', ''],
      ['', '', '', ''],
      ['TREATMENT PLAN', '', '', ''],
      ['Recommended Actions:', diagnosis.recommended_actions?.join(', ') || 'None specified', '', ''],
      ['Treatment:', diagnosis.treatment?.join(', ') || 'None prescribed', '', ''],
      ['', '', '', ''],
      ['PHYSICIAN INFORMATION', '', '', ''],
      ['Physician Name:', '________________________________', '', ''],
      ['License Number:', '________________________________', '', ''],
      ['Signature:', '________________________________', '', ''],
      ['Date:', '________________________________', '', ''],
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

    // Style the header
    ws['A1'].s = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'center' }
    };

    // Style section headers
    const sectionHeaders = ['A6', 'A13', 'A22', 'A28', 'A35', 'A40', 'A43'];
    sectionHeaders.forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true, sz: 12 },
          fill: { fgColor: { rgb: 'F3F4F6' } }
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Diagnosis Report');
    
    const filename = fileName || `diagnosis_report_${diagnosis.id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // Export diagnosis to PDF
  static exportToPDF(diagnosis: Diagnosis, fileName?: string) {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Set up fonts and spacing
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;
    const lineHeight = 6;
    let currentY = margin;

    // Helper function to add text with proper formatting
    const addText = (text: string, x: number, fontSize: number = 10, style: 'normal' | 'bold' = 'normal') => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', style);
      pdf.text(text, x, currentY);
      currentY += lineHeight;
    };

    const addSection = (title: string) => {
      currentY += 3;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, currentY);
      currentY += lineHeight + 2;
    };

    const addField = (label: string, value: string) => {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${label}:`, margin, currentY);
      pdf.setFont('helvetica', 'normal');
      const labelWidth = pdf.getTextWidth(`${label}: `);
      
      // Handle long text with word wrapping
      const maxWidth = pageWidth - margin - labelWidth - 10;
      const lines = pdf.splitTextToSize(value, maxWidth);
      
      if (lines.length === 1) {
        pdf.text(value, margin + labelWidth, currentY);
        currentY += lineHeight;
      } else {
        pdf.text(lines[0], margin + labelWidth, currentY);
        currentY += lineHeight;
        for (let i = 1; i < lines.length; i++) {
          pdf.text(lines[i], margin + 10, currentY);
          currentY += lineHeight;
        }
      }
    };

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('MEDICAL DIAGNOSIS REPORT', pageWidth / 2, currentY, { align: 'center' });
    currentY += lineHeight * 2;

    // Date and ID
    addField('Date', new Date(diagnosis.created_at).toLocaleDateString());
    addField('Diagnosis ID', diagnosis.id);

    // Patient Information
    addSection('PATIENT INFORMATION');
    addField('Name', `${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim() || 'Not specified');
    addField('Patient ID', diagnosis.patient_id || 'Not specified');
    addField('Age', diagnosis.patient_age?.toString() || 'Not specified');
    addField('Gender', diagnosis.patient_gender || 'Not specified');
    if (diagnosis.date_of_birth) {
      addField('Date of Birth', diagnosis.date_of_birth);
    }

    // Vital Signs
    addSection('VITAL SIGNS');
    if (diagnosis.blood_pressure_systolic && diagnosis.blood_pressure_diastolic) {
      addField('Blood Pressure', `${diagnosis.blood_pressure_systolic}/${diagnosis.blood_pressure_diastolic} mmHg`);
    }
    if (diagnosis.heart_rate) addField('Heart Rate', `${diagnosis.heart_rate} bpm`);
    if (diagnosis.temperature) addField('Temperature', `${diagnosis.temperature}°C`);
    if (diagnosis.respiratory_rate) addField('Respiratory Rate', `${diagnosis.respiratory_rate}/min`);
    if (diagnosis.oxygen_saturation) addField('Oxygen Saturation', `${diagnosis.oxygen_saturation}%`);
    if (diagnosis.weight) addField('Weight', `${diagnosis.weight} kg`);
    if (diagnosis.height) addField('Height', `${diagnosis.height} cm`);

    // Chief Complaint
    addSection('CHIEF COMPLAINT');
    addField('Complaint', diagnosis.complaint);
    if (diagnosis.complaint_duration) addField('Duration', diagnosis.complaint_duration);
    if (diagnosis.pain_scale) addField('Pain Scale', `${diagnosis.pain_scale}/10`);
    if (diagnosis.symptom_onset) addField('Symptom Onset', diagnosis.symptom_onset);
    if (diagnosis.associated_symptoms) addField('Associated Symptoms', diagnosis.associated_symptoms);

    // Medical History  
    addSection('MEDICAL HISTORY');
    addField('Allergies', diagnosis.allergies || 'None known');
    addField('Current Medications', diagnosis.current_medications || 'None');
    addField('Chronic Conditions', diagnosis.chronic_conditions || 'None');
    if (diagnosis.previous_surgeries) addField('Previous Surgeries', diagnosis.previous_surgeries);
    if (diagnosis.previous_injuries) addField('Previous Injuries', diagnosis.previous_injuries);

    // Check if we need a new page
    if (currentY > 250) {
      pdf.addPage();
      currentY = margin;
    }

    // Diagnosis
    addSection('DIAGNOSIS');
    addField('Primary Diagnosis', diagnosis.primary_diagnosis || 'Pending evaluation');
    if (diagnosis.differential_diagnoses?.length) {
      addField('Differential Diagnoses', diagnosis.differential_diagnoses.join(', '));
    }
    if (diagnosis.severity_level) addField('Severity Level', diagnosis.severity_level);
    if (diagnosis.confidence_score) {
      addField('Confidence Score', `${Math.round(diagnosis.confidence_score * 100)}%`);
    }

    // Treatment Plan
    addSection('TREATMENT PLAN');
    if (diagnosis.recommended_actions?.length) {
      addField('Recommended Actions', diagnosis.recommended_actions.join(', '));
    }
    if (diagnosis.treatment?.length) {
      addField('Treatment', diagnosis.treatment.join(', '));
    }

    // Physician signature area (bottom 1/4 of page)
    const signatureY = pdf.internal.pageSize.height - 50;
    currentY = Math.max(currentY + 10, signatureY);
    
    addSection('PHYSICIAN INFORMATION');
    currentY += 5;
    
    // Signature fields
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Physician Name: _________________________________', margin, currentY);
    currentY += lineHeight * 2;
    pdf.text('License Number: _________________________________', margin, currentY);
    currentY += lineHeight * 2;
    pdf.text('Signature: _________________________________', margin, currentY);
    currentY += lineHeight * 2;
    pdf.text('Date: _________________________________', margin, currentY);

    const filename = fileName || `diagnosis_report_${diagnosis.id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  }

  // Export diagnosis to Word-compatible format (actually RTF)
  static exportToWord(diagnosis: Diagnosis, fileName?: string) {
    const rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs24
{\\b\\fs28\\qc MEDICAL DIAGNOSIS REPORT}\\par
\\par
{\\b Date:} ${new Date(diagnosis.created_at).toLocaleDateString()}\\par
{\\b Diagnosis ID:} ${diagnosis.id}\\par
\\par
{\\b\\fs26 PATIENT INFORMATION}\\par
{\\b Name:} ${`${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim() || 'Not specified'}\\par
{\\b Patient ID:} ${diagnosis.patient_id || 'Not specified'}\\par
{\\b Age:} ${diagnosis.patient_age || 'Not specified'}\\par
{\\b Gender:} ${diagnosis.patient_gender || 'Not specified'}\\par
${diagnosis.date_of_birth ? `{\\b Date of Birth:} ${diagnosis.date_of_birth}\\par` : ''}
\\par
{\\b\\fs26 VITAL SIGNS}\\par
${diagnosis.blood_pressure_systolic && diagnosis.blood_pressure_diastolic ? 
  `{\\b Blood Pressure:} ${diagnosis.blood_pressure_systolic}/${diagnosis.blood_pressure_diastolic} mmHg\\par` : ''}
${diagnosis.heart_rate ? `{\\b Heart Rate:} ${diagnosis.heart_rate} bpm\\par` : ''}
${diagnosis.temperature ? `{\\b Temperature:} ${diagnosis.temperature}°C\\par` : ''}
${diagnosis.respiratory_rate ? `{\\b Respiratory Rate:} ${diagnosis.respiratory_rate}/min\\par` : ''}
${diagnosis.oxygen_saturation ? `{\\b Oxygen Saturation:} ${diagnosis.oxygen_saturation}%\\par` : ''}
${diagnosis.weight ? `{\\b Weight:} ${diagnosis.weight} kg\\par` : ''}
${diagnosis.height ? `{\\b Height:} ${diagnosis.height} cm\\par` : ''}
\\par
{\\b\\fs26 CHIEF COMPLAINT}\\par
{\\b Complaint:} ${diagnosis.complaint}\\par
${diagnosis.complaint_duration ? `{\\b Duration:} ${diagnosis.complaint_duration}\\par` : ''}
${diagnosis.pain_scale ? `{\\b Pain Scale:} ${diagnosis.pain_scale}/10\\par` : ''}
${diagnosis.symptom_onset ? `{\\b Symptom Onset:} ${diagnosis.symptom_onset}\\par` : ''}
${diagnosis.associated_symptoms ? `{\\b Associated Symptoms:} ${diagnosis.associated_symptoms}\\par` : ''}
\\par
{\\b\\fs26 MEDICAL HISTORY}\\par
{\\b Allergies:} ${diagnosis.allergies || 'None known'}\\par
{\\b Current Medications:} ${diagnosis.current_medications || 'None'}\\par
{\\b Chronic Conditions:} ${diagnosis.chronic_conditions || 'None'}\\par
${diagnosis.previous_surgeries ? `{\\b Previous Surgeries:} ${diagnosis.previous_surgeries}\\par` : ''}
${diagnosis.previous_injuries ? `{\\b Previous Injuries:} ${diagnosis.previous_injuries}\\par` : ''}
\\par
{\\b\\fs26 DIAGNOSIS}\\par
{\\b Primary Diagnosis:} ${diagnosis.primary_diagnosis || 'Pending evaluation'}\\par
${diagnosis.differential_diagnoses?.length ? `{\\b Differential Diagnoses:} ${diagnosis.differential_diagnoses.join(', ')}\\par` : ''}
${diagnosis.severity_level ? `{\\b Severity Level:} ${diagnosis.severity_level}\\par` : ''}
${diagnosis.confidence_score ? `{\\b Confidence Score:} ${Math.round(diagnosis.confidence_score * 100)}%\\par` : ''}
\\par
{\\b\\fs26 TREATMENT PLAN}\\par
${diagnosis.recommended_actions?.length ? `{\\b Recommended Actions:} ${diagnosis.recommended_actions.join(', ')}\\par` : ''}
${diagnosis.treatment?.length ? `{\\b Treatment:} ${diagnosis.treatment.join(', ')}\\par` : ''}
\\par
\\par
{\\b\\fs26 PHYSICIAN INFORMATION}\\par
\\par
{\\b Physician Name:} ________________________________\\par
\\par
{\\b License Number:} ________________________________\\par
\\par
{\\b Signature:} ________________________________\\par
\\par
{\\b Date:} ________________________________\\par
}`;

    const blob = new Blob([rtfContent], { type: 'application/rtf' });
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