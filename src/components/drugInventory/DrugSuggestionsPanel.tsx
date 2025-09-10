'use client';

import { useState, useEffect } from 'react';
import { DrugInventoryService, formatDrugName, getDrugStockStatus } from '@/lib/drugInventory';
import type { UserDrugInventory, DiagnosisDrugSuggestion } from '@/types/database';

interface DrugSuggestionsPanelProps {
  diagnosisId: string;
  primaryDiagnosis: string;
  onDrugSuggestionAdded?: () => void;
}

export default function DrugSuggestionsPanel({ 
  diagnosisId, 
  primaryDiagnosis,
  onDrugSuggestionAdded 
}: DrugSuggestionsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [availableDrugs, setAvailableDrugs] = useState<UserDrugInventory[]>([]);
  const [currentSuggestions, setCurrentSuggestions] = useState<DiagnosisDrugSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null);

  useEffect(() => {
    checkAccessAndLoadData();
  }, [diagnosisId, primaryDiagnosis]);

  const checkAccessAndLoadData = async () => {
    setLoading(true);
    
    // Check if user has drug inventory access
    const { hasAccess: accessGranted, error: accessError } = await DrugInventoryService.checkDrugInventoryAccess();
    if (accessError) {
      setError(accessError);
      setLoading(false);
      return;
    }
    
    setHasAccess(accessGranted);
    
    if (!accessGranted) {
      setLoading(false);
      return;
    }

    try {
      // Load suitable drugs and current suggestions in parallel
      const [drugsResult, suggestionsResult] = await Promise.all([
        DrugInventoryService.getDrugsForDiagnosis(primaryDiagnosis),
        DrugInventoryService.getDrugSuggestionsForDiagnosis(diagnosisId)
      ]);

      if (drugsResult.error) {
        setError(drugsResult.error);
      } else {
        setAvailableDrugs(drugsResult.data || []);
      }

      if (suggestionsResult.error) {
        setError(suggestionsResult.error);
      } else {
        setCurrentSuggestions(suggestionsResult.data || []);
      }
    } catch (err) {
      setError('Failed to load drug suggestions');
    }

    setLoading(false);
  };

  const handleAddDrugSuggestion = async (drugId: string, dosage?: string, duration?: string) => {
    try {
      const { error } = await DrugInventoryService.addDrugSuggestionToDiagnosis(
        diagnosisId,
        drugId,
        {
          suggested_dosage: dosage,
          treatment_duration: duration,
          priority_level: currentSuggestions.length + 1,
          manual_selection: true
        }
      );

      if (error) {
        setError(error);
      } else {
        await checkAccessAndLoadData(); // Refresh data
        onDrugSuggestionAdded?.();
        setExpandedDrug(null);
      }
    } catch (err) {
      setError('Failed to add drug suggestion');
    }
  };

  const handleRecordUsage = async (drugId: string, quantity: number) => {
    try {
      const { error } = await DrugInventoryService.recordDrugUsage(
        drugId,
        quantity,
        diagnosisId,
        `Dispensed for diagnosis: ${primaryDiagnosis}`
      );

      if (error) {
        setError(error);
      } else {
        await checkAccessAndLoadData(); // Refresh data to show updated stock
      }
    } catch (err) {
      setError('Failed to record drug usage');
    }
  };

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Drug Inventory Suggestions</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-2V9m0 0V7m0 2h2m-2 0H9m3-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-slate-900 mb-2">Premium Feature</h4>
          <p className="text-slate-600 mb-4">
            Drug inventory integration requires credits. Upgrade to suggest treatments from your own inventory.
          </p>
          <a 
            href="/credits" 
            className="inline-block px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Get Credits
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mr-3"></div>
          <h3 className="text-lg font-semibold text-slate-900">Loading Drug Suggestions...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Drug Inventory Suggestions</h3>
        </div>
        <a 
          href="/drug-inventory" 
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          Manage Inventory →
        </a>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Current Suggestions */}
      {currentSuggestions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Selected Medications:</h4>
          <div className="space-y-2">
            {currentSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {suggestion.drug ? formatDrugName(suggestion.drug) : 'Drug not found'}
                  </div>
                  {suggestion.suggested_dosage && (
                    <div className="text-sm text-slate-600">Dosage: {suggestion.suggested_dosage}</div>
                  )}
                  {suggestion.treatment_duration && (
                    <div className="text-sm text-slate-600">Duration: {suggestion.treatment_duration}</div>
                  )}
                </div>
                {suggestion.drug && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500">
                      Stock: {suggestion.drug.stock_quantity}
                    </span>
                    <button
                      onClick={() => {
                        const quantity = prompt('Enter quantity to dispense:');
                        if (quantity && parseInt(quantity) > 0) {
                          handleRecordUsage(suggestion.drug!.id, parseInt(quantity));
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Dispense
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Drugs */}
      {availableDrugs.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            Suggested from your inventory ({availableDrugs.length} matches):
          </h4>
          <div className="space-y-2">
            {availableDrugs
              .filter(drug => !currentSuggestions.some(s => s.drug_id === drug.id))
              .map((drug) => {
                const stockStatus = getDrugStockStatus(drug);
                const isExpanded = expandedDrug === drug.id;
                
                return (
                  <div key={drug.id} className="border border-slate-200 rounded-lg">
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-slate-900">{formatDrugName(drug)}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              stockStatus === 'in_stock' ? 'bg-green-100 text-green-800' :
                              stockStatus === 'low_stock' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {drug.stock_quantity} in stock
                            </span>
                          </div>
                          {drug.indications && drug.indications.length > 0 && (
                            <div className="text-sm text-slate-600 mt-1">
                              Treats: {drug.indications.slice(0, 3).join(', ')}
                              {drug.indications.length > 3 && '...'}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setExpandedDrug(isExpanded ? null : drug.id)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            {isExpanded ? 'Less' : 'More'}
                          </button>
                          <button
                            onClick={() => handleAddDrugSuggestion(drug.id)}
                            disabled={stockStatus === 'out_of_stock'}
                            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add to Treatment
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                          {drug.dosage_adults && (
                            <div className="text-sm">
                              <span className="font-medium text-slate-700">Adult Dosage:</span> {drug.dosage_adults}
                            </div>
                          )}
                          {drug.contraindications && drug.contraindications.length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium text-slate-700">Contraindications:</span> {drug.contraindications.join(', ')}
                            </div>
                          )}
                          <div className="flex space-x-2 mt-2">
                            <input
                              type="text"
                              placeholder="Dosage (e.g., 1 tablet twice daily)"
                              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                              id={`dosage-${drug.id}`}
                            />
                            <input
                              type="text"
                              placeholder="Duration (e.g., 7 days)"
                              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                              id={`duration-${drug.id}`}
                            />
                            <button
                              onClick={() => {
                                const dosageEl = document.getElementById(`dosage-${drug.id}`) as HTMLInputElement;
                                const durationEl = document.getElementById(`duration-${drug.id}`) as HTMLInputElement;
                                handleAddDrugSuggestion(drug.id, dosageEl?.value, durationEl?.value);
                              }}
                              className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                            >
                              Add with Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
          </svg>
          <p className="text-sm">No matching drugs found in your inventory for this diagnosis.</p>
          <p className="text-xs mt-1">
            <a href="/drug-inventory" className="text-emerald-600 hover:text-emerald-700">
              Add medications to your inventory
            </a> to get personalized suggestions.
          </p>
        </div>
      )}
    </div>
  );
}