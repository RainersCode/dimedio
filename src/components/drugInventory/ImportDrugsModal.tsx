'use client';

import { useState, useRef } from 'react';
import { DrugInventoryService } from '@/lib/drugInventory';
import type { DrugCategory, DrugInventoryFormData } from '@/types/database';

interface ImportDrugsModalProps {
  categories: DrugCategory[];
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
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
}

export default function ImportDrugsModal({ categories, onClose, onSuccess }: ImportDrugsModalProps) {
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

    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (!Array.isArray(jsonData)) {
        setError('JSON file must contain an array of drug objects');
        setLoading(false);
        return;
      }

      if (jsonData.length === 0) {
        setError('JSON file is empty');
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
      stock_quantity: jsonDrug.available !== false ? 1 : 0, // Default to 1 unless explicitly false
      unit_price: jsonDrug.price || undefined,
      supplier: jsonDrug.supplier || undefined,
      batch_number: undefined,
      expiry_date: undefined,
      is_prescription_only: false,
      notes: `Imported from JSON${jsonDrug.original_row ? ` (row ${jsonDrug.original_row})` : ''}`,
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
        const { error } = await DrugInventoryService.addDrugToInventory(formData);
        
        if (error) {
          results.failed++;
          results.errors.push(`${jsonDrug.name}: ${error}`);
        } else {
          results.successful++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`${jsonDrug.name}: Failed to import`);
      }

      // Add a small delay to avoid overwhelming the database and allow UI updates
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
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
                <h3 className="text-sm font-medium text-blue-800 mb-2">JSON Format Requirements</h3>
                <p className="text-sm text-blue-700 mb-2">Your JSON file should contain an array of drug objects with these fields:</p>
                <ul className="text-xs text-blue-600 space-y-1 ml-4">
                  <li><strong>name</strong> (required): Drug name</li>
                  <li><strong>category</strong> (optional): Drug category</li>
                  <li><strong>type</strong> (optional): Drug type/form</li>
                  <li><strong>dosage</strong> (optional): Dosage information</li>
                  <li><strong>active_ingredient</strong> (optional): Active ingredient</li>
                  <li><strong>price</strong> (optional): Unit price</li>
                  <li><strong>supplier</strong> (optional): Supplier name</li>
                  <li><strong>available</strong> (optional): Availability status</li>
                </ul>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select JSON File</h3>
                <p className="text-slate-600 mb-4">Choose a JSON file containing your drug data</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
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