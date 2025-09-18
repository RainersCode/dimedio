'use client';

import { useState, useRef } from 'react';
import { DrugInventoryService } from '@/lib/drugInventory';
import { OrganizationDrugInventoryService } from '@/lib/organizationDrugInventoryService';
import { OrganizationService } from '@/lib/organizationService';
import { supabase } from '@/lib/supabase';
import type { DrugCategory, DrugInventoryFormData } from '@/types/database';

interface ImportDrugsModalProps {
  categories: DrugCategory[];
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
  activeMode?: 'individual' | 'organization';
  organizationId?: string | null;
}

interface JsonDrug {
  id?: number;
  name: string;
  category?: string;
  type?: string;
  dosage?: string;
  package_size?: string;
  description?: string;
  active_ingredient?: string;
  form?: string;
  available?: boolean;
  price?: number;
  supplier?: string;
  original_row?: number;
  search_keywords?: string[];
  expiry?: string;
  expiry_date?: string;
  stock_quantity?: number;
  // Pack tracking fields
  units_per_pack?: number;
  unit_type?: string;
  whole_packs_count?: number;
  loose_units_count?: number;
}

// Excel parsing function using xlsx library
const parseExcelFile = async (file: File): Promise<JsonDrug[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Dynamic import of xlsx to avoid SSR issues
        const XLSX = await import('xlsx');
        
        // Parse the Excel file
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('Excel file contains no sheets'));
          return;
        }
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!jsonData || jsonData.length < 2) {
          reject(new Error('Excel file must have at least a header row and one data row'));
          return;
        }
        
        // Get headers from first row and normalize them
        const headers = (jsonData[0] as string[]).map(h => 
          h ? h.toString().trim().toLowerCase().replace(/\s+/g, '_') : ''
        );
        
        const drugs: JsonDrug[] = [];
        
        // Process data rows (skip header row)
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          const drug: JsonDrug = { name: '', original_row: i + 1 };
          
          // Map each column to drug properties
          headers.forEach((header, index) => {
            const value = row[index];
            if (value === null || value === undefined || value === '') return;
            
            const stringValue = value.toString().trim();
            if (!stringValue) return;

            switch (header) {
              case 'name':
              case 'drug_name':
              case 'drug_name_lv':
              case 'medicine':
              case 'medication':
                drug.name = stringValue;
                break;
              case 'dosage':
              case 'dose':
              case 'strength':
                drug.dosage = stringValue;
                break;
              case 'category':
              case 'type':
              case 'class':
                drug.category = stringValue;
                break;
              case 'active_ingredient':
              case 'active_ingredient_lv':
              case 'ingredient':
                drug.active_ingredient = stringValue;
                break;
              case 'form':
              case 'dosage_form':
              case 'dosage_form_lv':
                drug.form = stringValue;
                break;
              case 'price':
              case 'unit_price':
              case 'cost':
                const price = parseFloat(stringValue);
                if (!isNaN(price)) {
                  drug.price = price;
                }
                break;
              case 'supplier':
              case 'manufacturer':
                drug.supplier = stringValue;
                break;
              case 'description':
              case 'notes':
                drug.description = stringValue;
                break;
              case 'expiry':
              case 'expiry_date':
              case 'expiration':
              case 'expiration_date':
                drug.expiry = stringValue;
                break;
              case 'stock_quantity':
              case 'stock':
              case 'available':
                const stockValue = parseFloat(stringValue);
                if (!isNaN(stockValue)) {
                  drug.stock_quantity = stockValue;
                }
                break;
              case 'units_per_pack':
              case 'unitsperpack':
              case 'pack_size':
                const unitsPerPack = parseInt(stringValue);
                if (!isNaN(unitsPerPack) && unitsPerPack > 0) {
                  drug.units_per_pack = unitsPerPack;
                }
                break;
              case 'unit_type':
              case 'unittype':
              case 'type_unit':
                if (stringValue && stringValue.trim() !== '') {
                  drug.unit_type = stringValue.toLowerCase();
                }
                break;
              case 'whole_packs_count':
              case 'whole_packs':
              case 'pack_count':
              case 'packs':
                const wholePacks = parseInt(stringValue);
                if (!isNaN(wholePacks) && wholePacks >= 0) {
                  drug.whole_packs_count = wholePacks;
                }
                break;
              case 'loose_units_count':
              case 'loose_units':
              case 'loose':
                const looseUnits = parseInt(stringValue);
                if (!isNaN(looseUnits) && looseUnits >= 0) {
                  drug.loose_units_count = looseUnits;
                }
                break;
            }
          });

          // Only add drugs that have at least a name
          if (drug.name && drug.name.trim() !== '') {
            drugs.push(drug);
          }
        }

        if (drugs.length === 0) {
          reject(new Error('No valid drug data found. Make sure the "name" column contains drug names.'));
          return;
        }

        resolve(drugs);
      } catch (error) {
        console.error('Excel parsing error:', error);
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export default function ImportDrugsModal({ categories, onClose, onSuccess, activeMode, organizationId }: ImportDrugsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<JsonDrug[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResults, setImportResults] = useState<{
    successful: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    currentDrug: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isJson = file.name.endsWith('.json');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!isJson && !isExcel) {
      setError('Please select a JSON (.json) or Excel (.xlsx, .xls) file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let jsonData: any[];

      if (isJson) {
        // Handle JSON files
        const text = await file.text();
        jsonData = JSON.parse(text);

        if (!Array.isArray(jsonData)) {
          setError('JSON file must contain an array of drug objects');
          setLoading(false);
          return;
        }
      } else {
        // Handle Excel files
        jsonData = await parseExcelFile(file);
      }

      if (jsonData.length === 0) {
        setError('File is empty or contains no valid drug data');
        setLoading(false);
        return;
      }

      if (jsonData.length > 1000) {
        setError('Maximum 1000 drugs can be imported at once');
        setLoading(false);
        return;
      }

      setPreviewData(jsonData);
      setShowPreview(true);
    } catch (err) {
      setError('Invalid JSON file. Please check the file format.');
    }

    setLoading(false);
  };

  const mapJsonDrugToFormData = (jsonDrug: JsonDrug): DrugInventoryFormData => {
    // Find category by name or create a default one
    const category = categories.find(cat => 
      cat.name.toLowerCase() === jsonDrug.category?.toLowerCase() ||
      cat.name.toLowerCase() === jsonDrug.type?.toLowerCase()
    );

    // Extract dosage and form from name if not provided separately
    const drugName = jsonDrug.name || jsonDrug.description || '';
    
    // Clean up the form data to avoid empty strings for UUID fields
    const formData: DrugInventoryFormData = {
      drug_name: drugName,
      drug_name_lv: drugName || undefined, // Use undefined for empty strings
      generic_name: jsonDrug.active_ingredient || undefined,
      brand_name: undefined,
      dosage_form: mapDosageForm(jsonDrug.form || jsonDrug.type || '') || undefined,
      strength: jsonDrug.dosage || extractDosage(drugName) || undefined,
      active_ingredient: jsonDrug.active_ingredient || undefined,
      indications: [],
      contraindications: [],
      dosage_adults: undefined,
      dosage_children: undefined,
      stock_quantity: jsonDrug.stock_quantity || (typeof jsonDrug.available === 'number' ? jsonDrug.available : 0),
      unit_price: jsonDrug.price || undefined,
      supplier: jsonDrug.supplier || undefined,
      batch_number: undefined,
      expiry_date: parseExpiryDate(jsonDrug.expiry || jsonDrug.expiry_date || '') || undefined,
      is_prescription_only: false,
      notes: `Imported from JSON${jsonDrug.original_row ? ` (row ${jsonDrug.original_row})` : ''}`,

      // Pack tracking fields
      units_per_pack: jsonDrug.units_per_pack || undefined,
      unit_type: jsonDrug.unit_type as 'tablet' | 'capsule' | 'ml' | 'dose' | 'patch' | 'suppository' | 'gram' || undefined,
      whole_packs_count: jsonDrug.whole_packs_count !== undefined ? jsonDrug.whole_packs_count : undefined,
      loose_units_count: jsonDrug.loose_units_count !== undefined ? jsonDrug.loose_units_count : undefined,
    };

    // Only set category_id if we found a matching category
    if (category?.id) {
      formData.category_id = category.id;
    }

    return formData;
  };

  const mapDosageForm = (form: string): string | undefined => {
    if (!form || form.trim() === '') return undefined;
    
    const formLower = form.toLowerCase();
    
    if (formLower.includes('tablet')) return 'tablet';
    if (formLower.includes('capsul')) return 'capsule';
    if (formLower.includes('cream') || formLower.includes('krēms')) return 'cream';
    if (formLower.includes('ointment') || formLower.includes('ziede')) return 'ointment';
    if (formLower.includes('gel')) return 'cream';
    if (formLower.includes('solution') || formLower.includes('šķīdums')) return 'injection';
    if (formLower.includes('drops') || formLower.includes('pilieni')) return 'drops';
    if (formLower.includes('aerosol') || formLower.includes('spray')) return 'spray';
    if (formLower.includes('syrup') || formLower.includes('sīrups')) return 'syrup';
    if (formLower.includes('powder') || formLower.includes('pulveris')) return 'powder';
    
    return 'other';
  };

  const extractDosage = (name: string): string | undefined => {
    if (!name) return undefined;
    const dosageMatch = name.match(/(\d+(?:\.\d+)?(?:mg|g|ml|%|IU|SV|mkg|mcg))/i);
    return dosageMatch ? dosageMatch[1] : undefined;
  };

  const parseExpiryDate = (expiry: string): string | undefined => {
    if (!expiry || expiry.trim() === '') return undefined;
    
    // Remove trailing dot and clean the string
    const cleanExpiry = expiry.replace(/\.$/, '').trim();
    
    // Handle DD.MM.YYYY format (common in your data)
    const ddmmyyyyMatch = cleanExpiry.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      // Convert to YYYY-MM-DD format for the database
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Handle YYYY-MM-DD format (already correct)
    const yyyymmddMatch = cleanExpiry.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmddMatch) {
      return cleanExpiry;
    }
    
    // Try to parse other common formats
    const date = new Date(cleanExpiry);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return undefined;
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setLoading(true);
    setError(null);
    setImportResults(null);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    const total = previewData.length;

    try {
      // Use the context-provided mode instead of detecting it
      const isOrganizationMode = activeMode === 'organization' && organizationId;
      console.log('Import mode from context:', isOrganizationMode ? 'organization' : 'individual', {
        activeMode,
        organizationId,
        isOrganizationMode
      });

      for (let i = 0; i < previewData.length; i++) {
        const jsonDrug = previewData[i];
        const currentIndex = i + 1;
        const percentage = Math.round((currentIndex / total) * 100);

        // Update progress
        setImportProgress({
          current: currentIndex,
          total: total,
          percentage: percentage,
          currentDrug: jsonDrug.name
        });

        try {
          const formData = mapJsonDrugToFormData(jsonDrug);

          // Call the appropriate service directly based on context mode
          let result;
          if (isOrganizationMode && organizationId) {
            // Import to organization inventory
            result = await OrganizationDrugInventoryService.addDrugToOrganizationInventory(formData, organizationId);
          } else {
            // Import to individual inventory (fallback to original method)
            result = await DrugInventoryService.addDrugToInventory(formData);
          }

          if (result.error) {
            results.failed++;
            results.errors.push(`${jsonDrug.name}: ${result.error}`);
          } else {
            results.successful++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`${jsonDrug.name}: Failed to import - ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        // Add a small delay to avoid overwhelming the database and allow UI updates
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      setError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
      return;
    }

    // Clear progress and show results
    setImportProgress(null);
    setImportResults(results);
    setLoading(false);

    if (results.successful > 0) {
      onSuccess(results.successful);
    }
  };

  const handleReset = () => {
    setPreviewData([]);
    setShowPreview(false);
    setImportResults(null);
    setImportProgress(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Download Excel template
  const downloadTemplate = () => {
    const headers = [
      'name', 'category', 'dosage', 'form', 'active_ingredient', 
      'price', 'stock_quantity', 'supplier', 'expiry', 'description'
    ];

    const sampleData = [
      [
        'Paracetamol 500mg',
        'analgesics', 
        '500mg',
        'tablet',
        'Paracetamol',
        '0.15',
        '100',
        'Pharmacy Ltd',
        '31.12.2025',
        'Pain relief medication'
      ],
      [
        'Amoxicillin 250mg',
        'antibiotics',
        '250mg', 
        'capsule',
        'Amoxicillin',
        '0.85',
        '50',
        'MedSupply Inc',
        '15.06.2026',
        'Antibiotic for bacterial infections'
      ]
    ];

    // Create CSV content (Excel-compatible)
    const csvContent = [
      headers.join('\t'),
      ...sampleData.map(row => row.join('\t'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drug-import-template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Import Drugs from JSON</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {importProgress && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-emerald-800 mb-3">Importing Drugs...</h3>
              
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm text-emerald-700 mb-1">
                  <span>Progress: {importProgress.current} of {importProgress.total}</span>
                  <span>{importProgress.percentage}%</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-2.5">
                  <div 
                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${importProgress.percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Current Drug */}
              <div className="text-sm text-emerald-700">
                <span className="font-medium">Currently importing:</span>
                <div className="mt-1 p-2 bg-white rounded border text-emerald-900 truncate">
                  {importProgress.currentDrug}
                </div>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Import Results</h3>
              <p className="text-sm text-blue-700">
                Successfully imported: <strong>{importResults.successful}</strong> drugs
              </p>
              <p className="text-sm text-blue-700">
                Failed: <strong>{importResults.failed}</strong> drugs
              </p>
              {importResults.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm font-medium text-blue-800 cursor-pointer">Show Errors</summary>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {importResults.errors.map((error, index) => (
                      <p key={index} className="text-xs text-red-600">{error}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {!showPreview && !importResults && (
            <div>
              {/* Instructions */}
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">Import Format Requirements</h3>
                    <p className="text-sm text-blue-700 mb-2">Your file should contain these columns:</p>
                    <ul className="text-xs text-blue-600 space-y-1 ml-4">
                      <li><strong>name</strong> (required): Drug name</li>
                      <li><strong>category</strong> (optional): Drug category (tablets, capsules, etc.)</li>
                      <li><strong>dosage</strong> (optional): Strength (500mg, 10mg/ml)</li>
                      <li><strong>form</strong> (optional): Dosage form (tablet, capsule, syrup)</li>
                      <li><strong>active_ingredient</strong> (optional): Active ingredient</li>
                      <li><strong>price</strong> (optional): Unit price (0.15)</li>
                      <li><strong>stock_quantity</strong> (optional): Stock amount</li>
                      <li><strong>units_per_pack</strong> (optional): Number of units per pack (20, 30, 100)</li>
                      <li><strong>unit_type</strong> (optional): Unit type (tablet, capsule, ml, dose, patch, suppository, gram)</li>
                      <li><strong>whole_packs_count</strong> (optional): Number of whole packs</li>
                      <li><strong>loose_units_count</strong> (optional): Number of loose units</li>
                      <li><strong>supplier</strong> (optional): Supplier name</li>
                      <li><strong>expiry</strong> (optional): Expiry date (DD.MM.YYYY or YYYY-MM-DD)</li>
                    </ul>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={downloadTemplate}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select Import File</h3>
                <p className="text-slate-600 mb-4">Choose a JSON (.json) or Excel (.xlsx, .xls) file containing your drug data</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Choose File'}
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {showPreview && !importResults && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-900">
                  Preview: {previewData.length} drugs found
                </h3>
                <div className="space-x-2">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Choose Different File
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center"
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {loading ? (
                      importProgress ? 
                        `Importing... ${importProgress.percentage}%` : 
                        'Starting Import...'
                    ) : 'Import All Drugs'}
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <p className="text-sm text-slate-600">Showing first 10 entries for preview</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Dosage</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewData.slice(0, 10).map((drug, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm text-slate-900">{drug.name}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">{drug.category || drug.type || '-'}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">{drug.dosage || extractDosage(drug.name) || '-'}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">{drug.form || drug.type || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 10 && (
                    <div className="px-4 py-2 bg-slate-50 text-sm text-slate-600 text-center">
                      ... and {previewData.length - 10} more drugs
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Final Actions */}
          {importResults && (
            <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
              <button
                onClick={handleReset}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Import More
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}