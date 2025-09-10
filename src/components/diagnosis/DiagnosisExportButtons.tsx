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

// Also export a simple dropdown version
export function DiagnosisExportDropdown({ diagnosis, className = '' }: DiagnosisExportButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'excel' | 'pdf' | 'word') => {
    setExporting(format);
    setIsOpen(false);
    
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
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        disabled={!!exporting}
      >
        {exporting ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        ) : (
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        Export Report
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="py-1">
              <button
                onClick={() => handleExport('pdf')}
                className="group flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-4 h-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export as PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="group flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-4 h-4 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as Excel
              </button>
              <button
                onClick={() => handleExport('word')}
                className="group flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-4 h-4 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as Word
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}