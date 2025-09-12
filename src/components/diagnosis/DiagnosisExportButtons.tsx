'use client';

import { Diagnosis } from '@/types/database';
import { DiagnosisExportService } from '@/lib/diagnosisExport';
import { useState } from 'react';

interface DiagnosisExportButtonsProps {
  diagnosis: Diagnosis;
  className?: string;
}

export default function DiagnosisExportButtons({ diagnosis, className = '' }: DiagnosisExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'excel' | 'pdf' | 'word') => {
    setExporting(format);
    try {
      switch (format) {
        case 'excel':
          DiagnosisExportService.exportToExcel(diagnosis);
          break;
        case 'pdf':
          DiagnosisExportService.exportToPDF(diagnosis);
          break;
        case 'word':
          DiagnosisExportService.exportToWord(diagnosis);
          break;
      }
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      // You could add error handling/toast here
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Excel Export */}
      <button
        onClick={() => handleExport('excel')}
        disabled={exporting === 'excel'}
        className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Export to Excel format"
      >
        {exporting === 'excel' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        ) : (
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        Excel
      </button>

      {/* PDF Export */}
      <button
        onClick={() => handleExport('pdf')}
        disabled={exporting === 'pdf'}
        className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Export to PDF format"
      >
        {exporting === 'pdf' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        ) : (
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )}
        PDF
      </button>

      {/* Word Export */}
      <button
        onClick={() => handleExport('word')}
        disabled={exporting === 'word'}
        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Export to Word format"
      >
        {exporting === 'word' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        ) : (
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        Word
      </button>
    </div>
  );
}

// Ultra-simple button group that definitely works
export function DiagnosisExportDropdown({ diagnosis, className = '' }: DiagnosisExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  return (
    <div className={`relative z-50 ${className}`} style={{ pointerEvents: 'auto' }}>
      <div className="flex gap-2 items-center">
        <span className="text-sm text-slate-600 mr-2">Export:</span>
        
        <button
          onMouseDown={() => {
            console.log('PDF button clicked');
            setExporting('pdf');
            try {
              DiagnosisExportService.exportToPDF(diagnosis);
              console.log('PDF export initiated');
            } catch (error) {
              console.error('PDF export error:', error);
            } finally {
              setTimeout(() => setExporting(null), 1000);
            }
          }}
          disabled={!!exporting}
          className="px-2 py-1 text-xs bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded cursor-pointer disabled:opacity-50"
          style={{ pointerEvents: 'auto', zIndex: 100 }}
        >
          {exporting === 'pdf' ? '⏳' : '📄'} PDF
        </button>

        <button
          onMouseDown={() => {
            console.log('Excel button clicked');
            setExporting('excel');
            try {
              DiagnosisExportService.exportToExcel(diagnosis);
              console.log('Excel export initiated');
            } catch (error) {
              console.error('Excel export error:', error);
            } finally {
              setTimeout(() => setExporting(null), 1000);
            }
          }}
          disabled={!!exporting}
          className="px-2 py-1 text-xs bg-white hover:bg-green-50 text-green-600 hover:text-green-700 border border-green-300 hover:border-green-400 rounded cursor-pointer disabled:opacity-50"
          style={{ pointerEvents: 'auto', zIndex: 100 }}
        >
          {exporting === 'excel' ? '⏳' : '📊'} Excel
        </button>

        <button
          onMouseDown={() => {
            console.log('Word button clicked');
            setExporting('word');
            try {
              DiagnosisExportService.exportToWord(diagnosis);
              console.log('Word export initiated');
            } catch (error) {
              console.error('Word export error:', error);
            } finally {
              setTimeout(() => setExporting(null), 1000);
            }
          }}
          disabled={!!exporting}
          className="px-2 py-1 text-xs bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-blue-300 hover:border-blue-400 rounded cursor-pointer disabled:opacity-50"
          style={{ pointerEvents: 'auto', zIndex: 100 }}
        >
          {exporting === 'word' ? '⏳' : '📝'} Word
        </button>
      </div>
    </div>
  );
}