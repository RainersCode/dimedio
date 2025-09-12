'use client';

import { useState, useEffect, useRef } from 'react';
import { Diagnosis, UserDrugInventory } from '@/types/database';
import { DatabaseService } from '@/lib/database';
import { DrugInventoryService } from '@/lib/drugInventory';
import { DrugDispensingService } from '@/lib/drugDispensingService';

interface DiagnosisEditorProps {
  diagnosis: Diagnosis;
  onSave: (updatedDiagnosis: Diagnosis) => void;
  onCancel: () => void;
}

export default function DiagnosisEditor({ diagnosis, onSave, onCancel }: DiagnosisEditorProps) {
  const [editedDiagnosis, setEditedDiagnosis] = useState<Diagnosis>({ ...diagnosis });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorName, setEditorName] = useState('');
  
  // Drug management states
  const [userDrugInventory, setUserDrugInventory] = useState<UserDrugInventory[]>([]);
  const [drugQuantities, setDrugQuantities] = useState<{[key: string]: number}>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  
  // Refs for click outside detection
  const drugSearchRef = useRef<HTMLDivElement>(null);

  // Load user drug inventory on mount
  useEffect(() => {
    const loadDrugInventory = async () => {
      try {
        const { data: inventory } = await DrugInventoryService.getUserDrugInventory();
        if (inventory) {
          setUserDrugInventory(inventory);
        }
      } catch (error) {
        console.warn('Could not load drug inventory:', error);
      }
    };
    
    loadDrugInventory();
  }, []);

  // Initialize drug quantities from existing diagnosis
  useEffect(() => {
    const initializeQuantities = () => {
      const quantities: {[key: string]: number} = {};
      
      // Initialize from inventory_drugs
      if (editedDiagnosis.inventory_drugs) {
        editedDiagnosis.inventory_drugs.forEach((drug: any) => {
          const key = drug.drug_name;
          quantities[key] = drug.dispense_quantity || 1;
        });
      }
      
      setDrugQuantities(quantities);
    };
    
    initializeQuantities();
  }, [editedDiagnosis.inventory_drugs]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drugSearchRef.current && !drugSearchRef.current.contains(event.target as Node)) {
        setShowDrugDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updateDispensingRecords = async (updatedDiagnosis: Diagnosis) => {
    console.log('Updating dispensing records for diagnosis:', diagnosis.id);
    console.log('Updated diagnosis inventory_drugs:', updatedDiagnosis.inventory_drugs);
    
    // Prepare dispensing data from current drug state
    const dispensings = [];
    
    if (updatedDiagnosis.inventory_drugs && updatedDiagnosis.inventory_drugs.length > 0) {
      for (const drug of updatedDiagnosis.inventory_drugs) {
        const matchingInventoryDrug = userDrugInventory.find(invDrug => {
          const normalizeName = (name: string) => name?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
          return normalizeName(invDrug.drug_name) === normalizeName(drug.drug_name) || 
                 invDrug.id === drug.drug_id;
        });
        
        if (matchingInventoryDrug) {
          dispensings.push({
            drugId: matchingInventoryDrug.id,
            drugName: drug.drug_name,
            quantity: drug.dispense_quantity || 1,
            notes: `Updated via diagnosis edit. Duration: ${drug.duration || 'Not specified'}`
          });
        }
      }
    }

    console.log('Dispensings to record:', dispensings);
    console.log('Will record', dispensings.length, 'dispensings (0 means clear all)');

    // Always call recordMultipleDispensings, even with empty array to clear records
    const result = await DrugDispensingService.recordMultipleDispensings(
      dispensings,
      diagnosis.id,
      { primary_diagnosis: updatedDiagnosis.primary_diagnosis }
    );
    
    console.log('Dispensing update result:', result);
  };

  const updateDrugQuantity = (drugName: string, quantity: number) => {
    setDrugQuantities(prev => ({
      ...prev,
      [drugName]: Math.max(1, quantity)
    }));
  };

  const addDrugToInventory = (selectedDrug: UserDrugInventory) => {
    const newDrug = {
      drug_name: selectedDrug.drug_name,
      drug_id: selectedDrug.id,
      dosage: selectedDrug.dosage_adults || '1 daily',
      duration: '7 days',
      instructions: 'Take as directed',
      stock_quantity: selectedDrug.stock_quantity,
      dispense_quantity: 1
    };

    const currentInventoryDrugs = editedDiagnosis.inventory_drugs || [];
    
    // Check if drug already exists
    const exists = currentInventoryDrugs.some((drug: any) => 
      drug.drug_name === selectedDrug.drug_name
    );

    if (!exists) {
      setEditedDiagnosis(prev => ({
        ...prev,
        inventory_drugs: [...currentInventoryDrugs, newDrug]
      }));
      
      // Initialize quantity
      setDrugQuantities(prev => ({
        ...prev,
        [selectedDrug.drug_name]: 1
      }));
    }
    
    setSearchTerm('');
    setShowDrugDropdown(false);
  };

  const removeDrugFromInventory = (drugName: string) => {
    setEditedDiagnosis(prev => ({
      ...prev,
      inventory_drugs: prev.inventory_drugs?.filter((drug: any) => 
        drug.drug_name !== drugName
      ) || []
    }));
    
    // Remove from quantities
    setDrugQuantities(prev => {
      const updated = { ...prev };
      delete updated[drugName];
      return updated;
    });
  };

  const filteredDrugs = userDrugInventory.filter(drug =>
    drug.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    drug.stock_quantity > 0 &&
    !(editedDiagnosis.inventory_drugs?.some((invDrug: any) => 
      invDrug.drug_name === drug.drug_name
    ))
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Merge drug quantities into inventory_drugs before saving
      const updatedInventoryDrugs = editedDiagnosis.inventory_drugs?.map((drug: any) => ({
        ...drug,
        dispense_quantity: drugQuantities[drug.drug_name] || 1
      })) || [];

      const diagnosisToSave = {
        ...editedDiagnosis,
        inventory_drugs: updatedInventoryDrugs
      };

      const { data, error: updateError } = await DatabaseService.updateDiagnosisManually(
        diagnosis.id,
        diagnosisToSave,
        undefined, // Let the service get the user email
        'Patient History Edit',
        editorName
      );

      if (updateError) {
        setError(updateError);
      } else if (data) {
        // Update dispensing records after successful diagnosis save
        try {
          await updateDispensingRecords(data);
        } catch (dispensingError) {
          console.warn('Failed to update dispensing records:', dispensingError);
          // Don't fail the whole save for dispensing issues
        }
        
        onSave(data);
      } else {
        setError('No data returned from update');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save diagnosis');
    } finally {
      setSaving(false);
    }
  };

  const handleArrayFieldChange = (field: keyof Diagnosis, value: string) => {
    const items = value.split('\n').filter(item => item.trim().length > 0);
    setEditedDiagnosis(prev => ({
      ...prev,
      [field]: items
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Diagnosis</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Editor Name - Required Field */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Your Name (Required) *
            </label>
            <input
              type="text"
              value={editorName}
              onChange={(e) => setEditorName(e.target.value)}
              placeholder="Enter your full name to identify this edit"
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-blue-600 mt-1">
              This name will be recorded in the audit trail to track who made this edit.
            </p>
          </div>

          {/* Primary Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Diagnosis
            </label>
            <input
              type="text"
              value={editedDiagnosis.primary_diagnosis || ''}
              onChange={(e) => setEditedDiagnosis(prev => ({
                ...prev,
                primary_diagnosis: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Patient Complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient Complaint
            </label>
            <textarea
              value={editedDiagnosis.complaint || ''}
              onChange={(e) => setEditedDiagnosis(prev => ({
                ...prev,
                complaint: e.target.value
              }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms (one per line)
            </label>
            <textarea
              value={Array.isArray(editedDiagnosis.symptoms) 
                ? editedDiagnosis.symptoms.join('\n') 
                : (editedDiagnosis.symptoms || '')
              }
              onChange={(e) => handleArrayFieldChange('symptoms', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each symptom on a new line"
            />
          </div>

          {/* Differential Diagnoses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Differential Diagnoses (one per line)
            </label>
            <textarea
              value={editedDiagnosis.differential_diagnoses?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('differential_diagnoses', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each differential diagnosis on a new line"
            />
          </div>

          {/* Treatment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Treatment (one per line)
            </label>
            <textarea
              value={editedDiagnosis.treatment?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('treatment', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each treatment on a new line"
            />
          </div>

          {/* Recommended Actions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommended Actions (one per line)
            </label>
            <textarea
              value={editedDiagnosis.recommended_actions?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('recommended_actions', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each recommended action on a new line"
            />
          </div>


          {/* Vital Signs Section */}
          <div className="border-t pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Vital Signs</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editedDiagnosis.temperature || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    temperature: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  value={editedDiagnosis.heart_rate || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    heart_rate: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pain Scale (0-10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={editedDiagnosis.pain_scale || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    pain_scale: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Medical History Section */}
          <div className="border-t pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Medical History</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allergies
                </label>
                <textarea
                  value={editedDiagnosis.allergies || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    allergies: e.target.value || undefined
                  }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Medications
                </label>
                <textarea
                  value={editedDiagnosis.current_medications || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    current_medications: e.target.value || undefined
                  }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chronic Conditions
                </label>
                <textarea
                  value={editedDiagnosis.chronic_conditions || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    chronic_conditions: e.target.value || undefined
                  }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Drug Management Section */}
          <div className="border-t pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Prescribed Medications</h4>
            
            {/* Current Inventory Drugs */}
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Current Medications from Inventory</h5>
              
              {editedDiagnosis.inventory_drugs && editedDiagnosis.inventory_drugs.length > 0 ? (
                <div className="space-y-3">
                  {editedDiagnosis.inventory_drugs.map((drug: any, index: number) => (
                    <div key={`${drug.drug_name}-${index}`} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h6 className="font-medium text-emerald-900">{drug.drug_name}</h6>
                            <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded">
                              Stock: {drug.stock_quantity || 'N/A'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="font-medium text-emerald-700">Dosage:</span>
                              <p className="text-emerald-600">{drug.dosage}</p>
                            </div>
                            <div>
                              <span className="font-medium text-emerald-700">Duration:</span>
                              <p className="text-emerald-600">{drug.duration}</p>
                            </div>
                            <div>
                              <span className="font-medium text-emerald-700">Quantity to Dispense:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={drugQuantities[drug.drug_name] || 1}
                                  onChange={(e) => updateDrugQuantity(drug.drug_name, parseInt(e.target.value) || 1)}
                                  className="w-20 px-2 py-1 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                                <span className="text-emerald-600 text-xs">units</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => removeDrugFromInventory(drug.drug_name)}
                          className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">No inventory medications currently prescribed</p>
              )}
            </div>

            {/* Add New Drug */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-3">Add Medication from Inventory</h5>
              
              <div className="relative" ref={drugSearchRef}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDrugDropdown(true);
                  }}
                  onFocus={() => setShowDrugDropdown(true)}
                  placeholder="Search for medications in your inventory..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                
                {showDrugDropdown && (searchTerm || filteredDrugs.length > 0) && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10 mt-1">
                    {filteredDrugs.length > 0 ? (
                      filteredDrugs.slice(0, 10).map((drug) => (
                        <div
                          key={drug.id}
                          onClick={() => addDrugToInventory(drug)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{drug.drug_name}</p>
                              <p className="text-sm text-gray-500">
                                {drug.strength} • Stock: {drug.stock_quantity}
                              </p>
                            </div>
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              Add
                            </span>
                          </div>
                        </div>
                      ))
                    ) : searchTerm ? (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        No medications found matching "{searchTerm}"
                      </div>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-gray-500 text-sm mb-2">Available medications:</p>
                        {userDrugInventory.slice(0, 5).map((drug) => (
                          <div
                            key={drug.id}
                            onClick={() => addDrugToInventory(drug)}
                            className="px-2 py-2 hover:bg-gray-50 cursor-pointer rounded"
                          >
                            <p className="text-sm font-medium text-gray-700">{drug.drug_name}</p>
                            <p className="text-xs text-gray-500">Stock: {drug.stock_quantity}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                Start typing to search, or click to see available medications
              </p>
            </div>

            {/* External Medications (Read-only display) */}
            {editedDiagnosis.additional_therapy && editedDiagnosis.additional_therapy.length > 0 && (
              <div className="mt-6">
                <h5 className="text-sm font-medium text-gray-700 mb-3">External Medications (For Reference)</h5>
                <div className="space-y-2">
                  {editedDiagnosis.additional_therapy.map((drug: any, index: number) => (
                    <div key={`external-${index}`} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h6 className="font-medium text-blue-900">{drug.drug_name}</h6>
                          <p className="text-sm text-blue-700">{drug.dosage} • {drug.duration}</p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          External
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  These are external medications not in your inventory. Edit them in the treatment section if needed.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editorName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}