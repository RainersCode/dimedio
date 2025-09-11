'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { DatabaseService, N8nService } from '@/lib/database';
import { PatientService } from '@/lib/patientService';
import { DrugDispensingService } from '@/lib/drugDispensingService';
import { DiagnosisFormData, UserDrugInventory } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditsService } from '@/lib/credits';
import { DrugInventoryService } from '@/lib/drugInventory';
import DiagnosisDebug from './DiagnosisDebug';
import { DiagnosisExportDropdown } from './DiagnosisExportButtons';

interface DiagnosisFormProps {
  onDiagnosisComplete?: (diagnosisId: string) => void;
  initialComplaint?: string;
}

export default function DiagnosisForm({ onDiagnosisComplete, initialComplaint = '' }: DiagnosisFormProps) {
  const { user } = useSupabaseAuth();
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState<DiagnosisFormData>({
    // Basic Info
    complaint: initialComplaint,
    patient_age: undefined,
    patient_gender: '',
    symptoms: '',
    
    // Patient Identification
    patient_name: '',
    patient_surname: '',
    patient_id: '',
    date_of_birth: '',
    
    // Vital Signs
    blood_pressure_systolic: undefined,
    blood_pressure_diastolic: undefined,
    heart_rate: undefined,
    temperature: undefined,
    respiratory_rate: undefined,
    oxygen_saturation: undefined,
    weight: undefined,
    height: undefined,
    
    // Medical History
    allergies: '',
    current_medications: '',
    chronic_conditions: '',
    previous_surgeries: '',
    previous_injuries: '',
    
    // Clinical Details
    complaint_duration: '',
    pain_scale: undefined,
    symptom_onset: '',
    associated_symptoms: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDiagnosis, setEditedDiagnosis] = useState<any>(null);
  const [creditInfo, setCreditInfo] = useState<{
    canUse: boolean;
    reason: string;
    credits: number;
    freeCredits: number;
    isAdmin: boolean;
  } | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(true);
  const [userDrugInventory, setUserDrugInventory] = useState<UserDrugInventory[]>([]);
  const [drugSearchResults, setDrugSearchResults] = useState<UserDrugInventory[]>([]);
  const [showDrugSuggestions, setShowDrugSuggestions] = useState<{[key: string]: boolean}>({});
  const [savingPatient, setSavingPatient] = useState(false);
  const [patientSaved, setPatientSaved] = useState(false);
  const [recordingDispensing, setRecordingDispensing] = useState(false);
  const [dispensingRecorded, setDispensingRecorded] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    patientDetails: false,
    vitalSigns: false,
    medicalHistory: false,
    clinicalDetails: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Progress simulation for medical analysis
  const simulateProgress = () => {
    const steps = [
      { progress: 10, message: 'Analyzing patient complaint...', duration: 800 },
      { progress: 25, message: 'Processing medical history...', duration: 1200 },
      { progress: 40, message: 'Consulting medical databases...', duration: 1500 },
      { progress: 55, message: 'Evaluating drug interactions...', duration: 2000 },
      { progress: 70, message: 'Generating differential diagnoses...', duration: 2500 },
      { progress: 85, message: 'Selecting treatment recommendations...', duration: 1800 },
      { progress: 95, message: 'Finalizing medical analysis...', duration: 1000 },
      { progress: 100, message: 'Analysis complete!', duration: 500 }
    ];

    let currentStep = 0;
    
    const runStep = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setProgress(step.progress);
        setProgressMessage(step.message);
        
        setTimeout(() => {
          currentStep++;
          runStep();
        }, step.duration);
      }
    };

    runStep();
  };

  // Edit mode functions
  const startEditing = () => {
    setIsEditing(true);
    // Deep clone the diagnosis result to avoid reference issues with nested objects/arrays
    setEditedDiagnosis({
      ...diagnosisResult,
      inventory_drugs: diagnosisResult.inventory_drugs ? [...diagnosisResult.inventory_drugs.map(drug => ({ ...drug }))] : [],
      additional_therapy: diagnosisResult.additional_therapy ? [...diagnosisResult.additional_therapy.map(drug => ({ ...drug }))] : [],
      differential_diagnoses: diagnosisResult.differential_diagnoses ? [...diagnosisResult.differential_diagnoses] : [],
      recommended_actions: diagnosisResult.recommended_actions ? [...diagnosisResult.recommended_actions] : [],
      treatment: diagnosisResult.treatment ? [...diagnosisResult.treatment] : [],
    });
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedDiagnosis(null);
  };

  const saveEditing = async () => {
    if (!editedDiagnosis) return;
    
    try {
      setLoading(true);
      
      // Update the diagnosis in the database with manual edits
      const { data: updatedDiagnosis, error: updateError } = await DatabaseService.updateDiagnosisManually(
        editedDiagnosis.id,
        editedDiagnosis
      );

      if (updateError) {
        setError('Failed to save changes: ' + updateError);
      } else if (updatedDiagnosis) {
        setDiagnosisResult(updatedDiagnosis);
        setIsEditing(false);
        setEditedDiagnosis(null);
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const savePatient = async () => {
    if (!diagnosisResult || !diagnosisResult.patient_name) {
      setError('Patient name is required to save patient profile');
      return;
    }

    try {
      setSavingPatient(true);
      setError('');

      const { data: savedPatient, error: saveError } = await PatientService.savePatientFromDiagnosis(diagnosisResult);

      if (saveError) {
        setError('Failed to save patient: ' + saveError);
      } else if (savedPatient) {
        setPatientSaved(true);
        setTimeout(() => setPatientSaved(false), 3000); // Reset after 3 seconds
      }
    } catch (err) {
      setError('Failed to save patient profile');
    } finally {
      setSavingPatient(false);
    }
  };

  const recordDrugDispensing = async (diagnosis: any) => {
    console.log('🩺 Starting drug dispensing process for diagnosis:', diagnosis?.id);
    console.log('🔍 Checking diagnosis object:', { 
      hasId: !!diagnosis?.id, 
      hasInventoryDrugs: !!diagnosis?.inventory_drugs,
      inventoryDrugsLength: diagnosis?.inventory_drugs?.length || 0,
      inventoryDrugs: diagnosis?.inventory_drugs
    });
    
    if (!diagnosis || !diagnosis.inventory_drugs || diagnosis.inventory_drugs.length === 0) {
      console.log('⚠️ No inventory drugs to dispense for diagnosis:', diagnosis?.id);
      console.log('📋 Diagnosis inventory drugs:', diagnosis?.inventory_drugs);
      return; // No inventory drugs to dispense
    }

    try {
      console.log('💊 Recording drug dispensing for diagnosis:', diagnosis.id);
      console.log('📦 Inventory drugs from diagnosis:', diagnosis.inventory_drugs);
      console.log('🏪 Current userDrugInventory state:', {
        isLoaded: !!userDrugInventory,
        length: userDrugInventory?.length || 0,
        items: userDrugInventory?.map(d => d.drug_name) || []
      });

      // Always try to load fresh inventory to ensure we have the latest data
      let currentInventory = userDrugInventory;
      console.log('🔄 Loading fresh drug inventory for dispensing...');
      
      try {
        const { data: freshInventory, error: inventoryError } = await DrugInventoryService.getUserDrugInventory();
        if (inventoryError) {
          console.error('❌ Error loading drug inventory:', inventoryError);
          throw new Error(`Failed to load inventory: ${inventoryError}`);
        }
        
        if (freshInventory && freshInventory.length > 0) {
          currentInventory = freshInventory;
          setUserDrugInventory(freshInventory); // Update state for future use
          console.log('✅ Loaded fresh inventory:', {
            count: freshInventory.length,
            drugs: freshInventory.map(d => d.drug_name)
          });
        } else {
          console.warn('⚠️ No inventory data received from service');
          if (!currentInventory || currentInventory.length === 0) {
            console.error('❌ No inventory available for dispensing');
            return;
          }
        }
      } catch (invError) {
        console.error('❌ Failed to load drug inventory:', invError);
        if (!currentInventory || currentInventory.length === 0) {
          console.error('❌ No fallback inventory available, cannot proceed with dispensing');
          return;
        }
        console.log('⚠️ Using existing inventory as fallback');
      }

      const patientInfo = {
        patient_name: diagnosis.patient_name,
        patient_age: diagnosis.patient_age,
        patient_gender: diagnosis.patient_gender,
        primary_diagnosis: diagnosis.primary_diagnosis
      };

      // Match inventory drugs by name to find their IDs from currentInventory
      console.log('🔍 Starting drug matching process...');
      console.log('📋 Drugs to match:', diagnosis.inventory_drugs.map(d => ({ name: d.drug_name, id: d.id || d.drug_id })));
      console.log('🏪 Available inventory:', currentInventory.map(d => ({ name: d.drug_name, id: d.id })));
      
      const dispensings = [];
      
      for (const drug of diagnosis.inventory_drugs) {
        console.log('🔎 Processing drug:', { 
          name: drug.drug_name, 
          id: drug.id || drug.drug_id, 
          dosage: drug.dosage,
          duration: drug.duration
        });
        
        // Try to find the drug ID from currentInventory by matching drug name
        const matchingInventoryDrug = currentInventory.find(invDrug => 
          invDrug.drug_name === drug.drug_name ||
          (drug.id && invDrug.id === drug.id) ||
          (drug.drug_id && invDrug.id === drug.drug_id)
        );
        
        if (matchingInventoryDrug) {
          console.log('✅ Found matching inventory drug:', {
            inventoryDrug: { name: matchingInventoryDrug.drug_name, id: matchingInventoryDrug.id },
            diagnosisDrug: { name: drug.drug_name, id: drug.id || drug.drug_id }
          });
          const quantity = extractQuantityFromDosage(drug.dosage) || 1;
          console.log('📊 Extracted quantity:', quantity, 'from dosage:', drug.dosage);
          
          dispensings.push({
            drugId: matchingInventoryDrug.id,
            quantity: quantity,
            notes: `Prescribed for: ${diagnosis.complaint}. Duration: ${drug.duration || 'Not specified'}`
          });
        } else {
          console.warn('❌ Could not find matching inventory drug for:', drug.drug_name);
          console.warn('🏪 Available inventory drugs:', currentInventory.map(inv => inv.drug_name));
          console.warn('🔍 Tried matching by:', {
            byName: drug.drug_name,
            byId: drug.id || drug.drug_id,
            availableNames: currentInventory.map(inv => inv.drug_name),
            availableIds: currentInventory.map(inv => inv.id)
          });
        }
      }

      console.log('📝 Final dispensings to record:', dispensings);

      if (dispensings.length > 0) {
        console.log('💾 Recording', dispensings.length, 'dispensings to database...');
        console.log('📋 Patient info for dispensing:', patientInfo);
        
        const { error } = await DrugDispensingService.recordMultipleDispensings(
          dispensings,
          diagnosis.id,
          patientInfo
        );

        if (error) {
          console.error('❌ Failed to record drug dispensing:', error);
          // Don't show error to user as this is a background operation
        } else {
          console.log('✅ Successfully recorded drug dispensing for', dispensings.length, 'drugs');
          console.log('🎉 Automatic dispensing completed successfully!');
        }
      } else {
        console.warn('⚠️ No dispensings recorded - could not match any inventory drugs');
        console.warn('🔍 This might indicate a mismatch between diagnosis drugs and inventory');
      }
    } catch (err) {
      console.error('❌ Error in drug dispensing process:', err);
      console.error('🔍 Full error details:', err);
    }
  };

  const manuallyRecordDispensing = async () => {
    if (!diagnosisResult) return;

    try {
      setRecordingDispensing(true);
      await recordDrugDispensing(diagnosisResult);
      setDispensingRecorded(true);
      
      // Store in localStorage for persistence across pages
      const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
      if (!recordedDispensings.includes(diagnosisResult.id)) {
        recordedDispensings.push(diagnosisResult.id);
        localStorage.setItem('recordedDispensings', JSON.stringify(recordedDispensings));
      }
      
    } catch (err) {
      console.error('Manual dispensing record failed:', err);
    } finally {
      setRecordingDispensing(false);
    }
  };

  const extractQuantityFromDosage = (dosage: string): number => {
    if (!dosage) return 1;
    
    // Try to extract number from dosage string (e.g., "2 tablets" -> 2)
    const match = dosage.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    
    // Default to 1 if no number found
    return 1;
  };

  const updateEditedField = (field: string, value: any) => {
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const addArrayItem = (field: string, item: string) => {
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: [...(prev[field] || []), item]
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }));
  };

  const updateArrayItem = (field: string, index: number, value: string) => {
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: prev[field].map((item: any, i: number) => i === index ? value : item)
    }));
  };

  // Drug-specific functions for handling complex drug objects
  const addDrugItem = (field: string) => {
    const newDrug = {
      drug_name: '',
      dosage: '',
      duration: '',
      instructions: '',
      therapeutic_class: '',
      clinical_rationale: '',
      prescription_required: false
    };
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: [...(prev[field] || []), newDrug]
    }));
  };

  const removeDrugItem = (field: string, index: number) => {
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }));
  };

  const updateDrugItem = (field: string, index: number, drugField: string, value: any) => {
    setEditedDiagnosis((prev: any) => ({
      ...prev,
      [field]: prev[field].map((drug: any, i: number) => 
        i === index 
          ? { ...drug, [drugField]: value }
          : drug
      )
    }));
  };

  // Drug search and autocomplete functions
  const fetchUserDrugInventory = async () => {
    try {
      const { data, error } = await DrugInventoryService.getUserDrugInventory();
      if (data && !error) {
        setUserDrugInventory(data);
      }
    } catch (err) {
      console.log('Could not fetch drug inventory:', err);
    }
  };

  const searchDrugs = (query: string, fieldKey: string) => {
    if (!query.trim() || query.length < 2) {
      setDrugSearchResults([]);
      setShowDrugSuggestions(prev => ({ ...prev, [fieldKey]: false }));
      return;
    }

    const filtered = userDrugInventory.filter(drug => 
      drug.drug_name.toLowerCase().includes(query.toLowerCase()) ||
      (drug.generic_name && drug.generic_name.toLowerCase().includes(query.toLowerCase())) ||
      (drug.brand_name && drug.brand_name.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 25); // Increased to 25 suggestions for larger drug choice from inventory

    setDrugSearchResults(filtered);
    setShowDrugSuggestions(prev => ({ ...prev, [fieldKey]: filtered.length > 0 }));
  };

  const selectDrug = (drug: UserDrugInventory, field: string, index: number) => {
    // Populate the drug fields from inventory
    updateDrugItem(field, index, 'drug_name', drug.drug_name);
    if (drug.dosage_adults) updateDrugItem(field, index, 'dosage', drug.dosage_adults);
    if (drug.active_ingredient) updateDrugItem(field, index, 'therapeutic_class', drug.active_ingredient);
    updateDrugItem(field, index, 'prescription_required', drug.is_prescription_only);
    
    // Clear suggestions
    setDrugSearchResults([]);
    setShowDrugSuggestions(prev => ({ ...prev, [`${field}_${index}`]: false }));
  };

  // Load drug inventory when editing starts
  useEffect(() => {
    if (isEditing && userDrugInventory.length === 0) {
      fetchUserDrugInventory();
    }
  }, [isEditing]);

  // Check credits when component mounts or user changes
  useEffect(() => {
    const checkCredits = async () => {
      if (user) {
        setCheckingCredits(true);
        const credits = await CreditsService.canUseDiagnosis();
        setCreditInfo(credits);
        setCheckingCredits(false);
      } else {
        setCreditInfo({
          canUse: false,
          reason: 'Please sign in to use diagnosis',
          credits: 0,
          freeCredits: 0,
          isAdmin: false
        });
        setCheckingCredits(false);
      }
    };

    checkCredits();
  }, [user]);

  // Check if dispensing was already recorded for this diagnosis
  useEffect(() => {
    if (diagnosisResult?.id) {
      const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
      setDispensingRecorded(recordedDispensings.includes(diagnosisResult.id));
    }
  }, [diagnosisResult?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please sign in to create a diagnosis');
      return;
    }

    // Check if user can use diagnosis (credits/admin check)
    if (!creditInfo?.canUse) {
      setError(creditInfo?.reason || 'Cannot use diagnosis at this time');
      return;
    }

    if (!formData.complaint.trim()) {
      setError('Please enter the patient complaint');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);
    setProgressMessage('Starting medical analysis...');
    
    // Start progress simulation
    simulateProgress();

    try {
      // First, consume a credit (unless admin)
      if (!creditInfo.isAdmin) {
        const { success, error: creditError } = await CreditsService.useCredit();
        if (!success) {
          setError(creditError || 'Failed to use credit');
          setLoading(false);
          return;
        }
        
        // Refresh credit info after using credit
        const updatedCredits = await CreditsService.canUseDiagnosis();
        setCreditInfo(updatedCredits);
      }
      // 1. Create diagnosis in database
      const { data: diagnosis, error: dbError } = await DatabaseService.createDiagnosis(formData);
      
      if (dbError || !diagnosis) {
        throw new Error(dbError || 'Failed to create diagnosis');
      }

      // 2. Send to n8n for AI analysis
      const { data: n8nResponse, error: n8nError } = await N8nService.sendDiagnosisRequest(formData);
      
      if (n8nError) {
        // If n8n fails, we still have the diagnosis saved, just without AI results
        console.error('n8n error:', n8nError);
        setError(`Diagnosis saved, but AI analysis failed: ${n8nError}`);
        onDiagnosisComplete?.(diagnosis.id);
        return;
      }

      // 3. Update diagnosis with AI results
      if (n8nResponse) {
        const { data: updatedDiagnosis, error: updateError } = await DatabaseService.updateDiagnosisWithAI(
          diagnosis.id,
          n8nResponse
        );
        
        if (updateError) {
          console.error('Update error:', updateError);
          setError('Diagnosis created but failed to save AI results');
        } else {
          console.log('Setting diagnosis result:', updatedDiagnosis);
          console.log('Drug suggestions in result:', updatedDiagnosis?.drug_suggestions);
          setDiagnosisResult(updatedDiagnosis);
          
          // Record drug dispensing for inventory drugs (background operation)
          // Enhanced automatic dispensing with better error handling
          console.log('🔄 Initiating automatic drug dispensing for diagnosis:', updatedDiagnosis?.id);
          console.log('📋 Available inventory drugs for dispensing:', updatedDiagnosis?.inventory_drugs);
          
          if (updatedDiagnosis?.inventory_drugs && updatedDiagnosis.inventory_drugs.length > 0) {
            console.log('✅ Found inventory drugs, proceeding with automatic dispensing...');
            setTimeout(async () => {
              try {
                await recordDrugDispensing(updatedDiagnosis);
                console.log('✅ Automatic dispensing completed successfully');
              } catch (error) {
                console.error('❌ Automatic dispensing failed:', error);
              }
            }, 1500); // Increased delay to ensure better timing
          } else {
            console.log('ℹ️ No inventory drugs found for automatic dispensing');
          }
        }
      }

      onDiagnosisComplete?.(diagnosis.id);

    } catch (err) {
      console.error('Diagnosis error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: any = value;
    
    // Handle numeric fields
    if (type === 'number') {
      if (value === '' || value === null) {
        processedValue = undefined;
      } else {
        const numValue = parseFloat(value);
        processedValue = isNaN(numValue) ? undefined : numValue;
      }
    }
    // Handle date fields
    else if (type === 'date') {
      processedValue = value === '' ? undefined : value;
    }
    // Handle text fields
    else {
      processedValue = value === '' ? undefined : value;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    if (error) setError('');
  };

  if (diagnosisResult) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-semibold text-slate-900">Diagnosis Complete</h2>
              {!isEditing ? (
                <div className="flex gap-2">
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Diagnosis
                  </button>
                  <button
                    onClick={savePatient}
                    disabled={savingPatient || !diagnosisResult?.patient_name}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPatient ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : patientSaved ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Patient Saved!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Save Patient
                      </>
                    )}
                  </button>
                  <button
                    onClick={manuallyRecordDispensing}
                    disabled={recordingDispensing || dispensingRecorded || !diagnosisResult?.inventory_drugs?.length}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recordingDispensing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Recording...
                      </>
                    ) : dispensingRecorded ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Recorded!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Record Dispensing
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={saveEditing}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                </div>
              )}
            </div>
            
            {/* Export Buttons */}
            <DiagnosisExportDropdown diagnosis={diagnosisResult} />
          </div>
          <p className="text-slate-600">
            {isEditing ? 'Edit the diagnosis details below and save your changes.' : 'AI analysis has been completed for your patient.'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Patient History (AI Improved) */}
          {(diagnosisResult.improved_patient_history || isEditing) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">📋 Patient History</h3>
              {isEditing ? (
                <div>
                  <textarea
                    value={editedDiagnosis?.improved_patient_history || ''}
                    onChange={(e) => updateEditedField('improved_patient_history', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                    placeholder="Enter improved patient history..."
                  />
                  <div className="text-xs text-slate-500 mt-2 italic">
                    ✏️ Edit the patient history to improve grammar and medical accuracy
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-slate-700">{diagnosisResult.improved_patient_history}</p>
                  <div className="text-xs text-slate-500 mt-2 italic">
                    ✨ Grammar and clarity improved by AI from original complaint
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Patient Information Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">👤 Patient Information</h3>
            {isEditing ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {/* Demographics */}
                <div>
                  <span className="font-medium text-blue-800 block mb-2">Demographics:</span>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-blue-600">Age:</label>
                      <input
                        type="number"
                        value={editedDiagnosis?.patient_age || ''}
                        onChange={(e) => updateEditedField('patient_age', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                        placeholder="Age"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-blue-600">Gender:</label>
                      <select
                        value={editedDiagnosis?.patient_gender || ''}
                        onChange={(e) => updateEditedField('patient_gender', e.target.value || null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Identity */}
                <div>
                  <span className="font-medium text-blue-800 block mb-2">Identity:</span>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-blue-600">First Name:</label>
                      <input
                        type="text"
                        value={editedDiagnosis?.patient_name || ''}
                        onChange={(e) => updateEditedField('patient_name', e.target.value || null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-blue-600">Last Name:</label>
                      <input
                        type="text"
                        value={editedDiagnosis?.patient_surname || ''}
                        onChange={(e) => updateEditedField('patient_surname', e.target.value || null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                        placeholder="Last name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-blue-600">Patient ID:</label>
                      <input
                        type="text"
                        value={editedDiagnosis?.patient_id || ''}
                        onChange={(e) => updateEditedField('patient_id', e.target.value || null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                        placeholder="Patient ID"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-blue-600">Date of Birth:</label>
                      <input
                        type="date"
                        value={editedDiagnosis?.date_of_birth || ''}
                        onChange={(e) => updateEditedField('date_of_birth', e.target.value || null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Physical Measurements */}
                <div>
                  <span className="font-medium text-blue-800 block mb-2">Physical:</span>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-blue-600">Weight (kg):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editedDiagnosis?.weight || ''}
                        onChange={(e) => updateEditedField('weight', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                        placeholder="Weight"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-blue-600">Height (cm):</label>
                      <input
                        type="number"
                        value={editedDiagnosis?.height || ''}
                        onChange={(e) => updateEditedField('height', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-1 border border-blue-300 rounded text-blue-800 text-sm"
                        placeholder="Height"
                      />
                    </div>
                    {editedDiagnosis?.weight && editedDiagnosis?.height && (
                      <div className="text-xs text-blue-600">
                        BMI: {(editedDiagnosis.weight / Math.pow(editedDiagnosis.height / 100, 2)).toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {/* Basic Info */}
                {(diagnosisResult.patient_age || diagnosisResult.patient_gender) && (
                  <div>
                    <span className="font-medium text-blue-800">Demographics:</span>
                    <div className="text-blue-700">
                      {diagnosisResult.patient_age && `Age: ${diagnosisResult.patient_age}`}
                      {diagnosisResult.patient_age && diagnosisResult.patient_gender && ', '}
                      {diagnosisResult.patient_gender && `Gender: ${diagnosisResult.patient_gender}`}
                    </div>
                  </div>
                )}
                
                {/* Patient Details */}
                {(diagnosisResult.patient_name || diagnosisResult.patient_surname || diagnosisResult.patient_id) && (
                  <div>
                    <span className="font-medium text-blue-800">Identity:</span>
                    <div className="text-blue-700">
                      {(diagnosisResult.patient_name || diagnosisResult.patient_surname) && 
                        `${diagnosisResult.patient_name || ''} ${diagnosisResult.patient_surname || ''}`.trim()
                      }
                      {diagnosisResult.patient_id && (
                        <div>ID: {diagnosisResult.patient_id}</div>
                      )}
                      {diagnosisResult.date_of_birth && (
                        <div>DOB: {diagnosisResult.date_of_birth}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Physical Measurements */}
                {(diagnosisResult.weight || diagnosisResult.height) && (
                  <div>
                    <span className="font-medium text-blue-800">Physical:</span>
                    <div className="text-blue-700">
                      {diagnosisResult.weight && `Weight: ${diagnosisResult.weight}kg`}
                      {diagnosisResult.weight && diagnosisResult.height && ', '}
                      {diagnosisResult.height && `Height: ${diagnosisResult.height}cm`}
                      {diagnosisResult.weight && diagnosisResult.height && (
                        <div>BMI: {(diagnosisResult.weight / Math.pow(diagnosisResult.height / 100, 2)).toFixed(1)}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vital Signs */}
          {((diagnosisResult.blood_pressure_systolic || diagnosisResult.heart_rate || diagnosisResult.temperature || 
            diagnosisResult.respiratory_rate || diagnosisResult.oxygen_saturation || 
            diagnosisResult.complaint_duration || diagnosisResult.pain_scale) || isEditing) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-3">🩺 Vital Signs</h3>
              {isEditing ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {/* Blood Pressure */}
                  <div>
                    <span className="font-medium text-red-800 block mb-2">Blood Pressure:</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-red-600">Systolic (mmHg):</label>
                        <input
                          type="number"
                          value={editedDiagnosis?.blood_pressure_systolic || ''}
                          onChange={(e) => updateEditedField('blood_pressure_systolic', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Systolic"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-600">Diastolic (mmHg):</label>
                        <input
                          type="number"
                          value={editedDiagnosis?.blood_pressure_diastolic || ''}
                          onChange={(e) => updateEditedField('blood_pressure_diastolic', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Diastolic"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Heart Rate & Temperature */}
                  <div>
                    <span className="font-medium text-red-800 block mb-2">Vitals:</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-red-600">Heart Rate (BPM):</label>
                        <input
                          type="number"
                          value={editedDiagnosis?.heart_rate || ''}
                          onChange={(e) => updateEditedField('heart_rate', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Heart rate"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-600">Temperature (°C):</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editedDiagnosis?.temperature || ''}
                          onChange={(e) => updateEditedField('temperature', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Temperature"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-600">Respiratory Rate (/min):</label>
                        <input
                          type="number"
                          value={editedDiagnosis?.respiratory_rate || ''}
                          onChange={(e) => updateEditedField('respiratory_rate', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Respiratory rate"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-600">O₂ Saturation (%):</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editedDiagnosis?.oxygen_saturation || ''}
                          onChange={(e) => updateEditedField('oxygen_saturation', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="O₂ saturation"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Clinical Information */}
                  <div>
                    <span className="font-medium text-red-800 block mb-2">Clinical:</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-red-600">Duration:</label>
                        <input
                          type="text"
                          value={editedDiagnosis?.complaint_duration || ''}
                          onChange={(e) => updateEditedField('complaint_duration', e.target.value || null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Duration"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-600">Pain Scale (0-10):</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={editedDiagnosis?.pain_scale || ''}
                          onChange={(e) => updateEditedField('pain_scale', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                          placeholder="Pain scale"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-600">Symptom Onset:</label>
                        <select
                          value={editedDiagnosis?.symptom_onset || ''}
                          onChange={(e) => updateEditedField('symptom_onset', e.target.value || null)}
                          className="w-full p-1 border border-red-300 rounded text-red-800 text-sm"
                        >
                          <option value="">Select onset</option>
                          <option value="sudden">Sudden</option>
                          <option value="gradual">Gradual</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {(diagnosisResult.blood_pressure_systolic || diagnosisResult.blood_pressure_diastolic) && (
                    <div>
                      <span className="font-medium text-red-800">Blood Pressure:</span>
                      <div className="text-red-700">
                        {diagnosisResult.blood_pressure_systolic || '?'}/{diagnosisResult.blood_pressure_diastolic || '?'} mmHg
                      </div>
                    </div>
                  )}
                  
                  {diagnosisResult.heart_rate && (
                    <div>
                      <span className="font-medium text-red-800">Heart Rate:</span>
                      <div className="text-red-700">{diagnosisResult.heart_rate} BPM</div>
                    </div>
                  )}
                  
                  {diagnosisResult.temperature && (
                    <div>
                      <span className="font-medium text-red-800">Temperature:</span>
                      <div className="text-red-700">{diagnosisResult.temperature}°C</div>
                    </div>
                  )}
                  
                  {diagnosisResult.respiratory_rate && (
                    <div>
                      <span className="font-medium text-red-800">Respiratory Rate:</span>
                      <div className="text-red-700">{diagnosisResult.respiratory_rate}/min</div>
                    </div>
                  )}
                  
                  {diagnosisResult.oxygen_saturation && (
                    <div>
                      <span className="font-medium text-red-800">O₂ Saturation:</span>
                      <div className="text-red-700">{diagnosisResult.oxygen_saturation}%</div>
                    </div>
                  )}
                  
                  {(diagnosisResult.complaint_duration || diagnosisResult.pain_scale) && (
                    <div>
                      <span className="font-medium text-red-800">Clinical:</span>
                      <div className="text-red-700">
                        {diagnosisResult.complaint_duration && `Duration: ${diagnosisResult.complaint_duration}`}
                        {diagnosisResult.pain_scale !== undefined && diagnosisResult.pain_scale !== null && (
                          <div>Pain: {diagnosisResult.pain_scale}/10</div>
                        )}
                        {diagnosisResult.symptom_onset && (
                          <div>Onset: {diagnosisResult.symptom_onset}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Medical History */}
          {((diagnosisResult.allergies || diagnosisResult.current_medications || diagnosisResult.chronic_conditions || 
            diagnosisResult.previous_surgeries || diagnosisResult.previous_injuries || diagnosisResult.associated_symptoms) || isEditing) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-semibold text-orange-900 mb-3">📋 Medical History</h3>
              {isEditing ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="font-medium text-orange-800 block mb-1">⚠️ Allergies:</label>
                    <textarea
                      value={editedDiagnosis?.allergies || ''}
                      onChange={(e) => updateEditedField('allergies', e.target.value || null)}
                      className="w-full p-2 border border-orange-300 rounded text-orange-800 resize-none"
                      rows={2}
                      placeholder="Enter allergies..."
                    />
                  </div>
                  
                  <div>
                    <label className="font-medium text-orange-800 block mb-1">💊 Current Medications:</label>
                    <textarea
                      value={editedDiagnosis?.current_medications || ''}
                      onChange={(e) => updateEditedField('current_medications', e.target.value || null)}
                      className="w-full p-2 border border-orange-300 rounded text-orange-800 resize-none"
                      rows={2}
                      placeholder="Enter current medications..."
                    />
                  </div>
                  
                  <div>
                    <label className="font-medium text-orange-800 block mb-1">🩺 Chronic Conditions:</label>
                    <textarea
                      value={editedDiagnosis?.chronic_conditions || ''}
                      onChange={(e) => updateEditedField('chronic_conditions', e.target.value || null)}
                      className="w-full p-2 border border-orange-300 rounded text-orange-800 resize-none"
                      rows={2}
                      placeholder="Enter chronic conditions..."
                    />
                  </div>
                  
                  <div>
                    <label className="font-medium text-orange-800 block mb-1">🏥 Previous Surgeries:</label>
                    <textarea
                      value={editedDiagnosis?.previous_surgeries || ''}
                      onChange={(e) => updateEditedField('previous_surgeries', e.target.value || null)}
                      className="w-full p-2 border border-orange-300 rounded text-orange-800 resize-none"
                      rows={2}
                      placeholder="Enter previous surgeries..."
                    />
                  </div>
                  
                  <div>
                    <label className="font-medium text-orange-800 block mb-1">🩹 Previous Injuries:</label>
                    <textarea
                      value={editedDiagnosis?.previous_injuries || ''}
                      onChange={(e) => updateEditedField('previous_injuries', e.target.value || null)}
                      className="w-full p-2 border border-orange-300 rounded text-orange-800 resize-none"
                      rows={2}
                      placeholder="Enter previous injuries..."
                    />
                  </div>
                  
                  <div>
                    <label className="font-medium text-orange-800 block mb-1">🔍 Associated Symptoms:</label>
                    <textarea
                      value={editedDiagnosis?.associated_symptoms || ''}
                      onChange={(e) => updateEditedField('associated_symptoms', e.target.value || null)}
                      className="w-full p-2 border border-orange-300 rounded text-orange-800 resize-none"
                      rows={2}
                      placeholder="Enter associated symptoms..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {diagnosisResult.allergies && (
                    <div>
                      <span className="font-medium text-orange-800">⚠️ Allergies:</span>
                      <div className="text-orange-700 mt-1">{diagnosisResult.allergies}</div>
                    </div>
                  )}
                  
                  {diagnosisResult.current_medications && (
                    <div>
                      <span className="font-medium text-orange-800">💊 Current Medications:</span>
                      <div className="text-orange-700 mt-1">{diagnosisResult.current_medications}</div>
                    </div>
                  )}
                  
                  {diagnosisResult.chronic_conditions && (
                    <div>
                      <span className="font-medium text-orange-800">🩺 Chronic Conditions:</span>
                      <div className="text-orange-700 mt-1">{diagnosisResult.chronic_conditions}</div>
                    </div>
                  )}
                  
                  {diagnosisResult.previous_surgeries && (
                    <div>
                      <span className="font-medium text-orange-800">🏥 Previous Surgeries:</span>
                      <div className="text-orange-700 mt-1">{diagnosisResult.previous_surgeries}</div>
                    </div>
                  )}
                  
                  {diagnosisResult.previous_injuries && (
                    <div>
                      <span className="font-medium text-orange-800">🩹 Previous Injuries:</span>
                      <div className="text-orange-700 mt-1">{diagnosisResult.previous_injuries}</div>
                    </div>
                  )}
                  
                  {diagnosisResult.associated_symptoms && (
                    <div>
                      <span className="font-medium text-orange-800">🔍 Associated Symptoms:</span>
                      <div className="text-orange-700 mt-1">{diagnosisResult.associated_symptoms}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Primary Diagnosis */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-semibold text-emerald-900 mb-2">Primary Diagnosis</h3>
            {isEditing ? (
              <textarea
                value={editedDiagnosis?.primary_diagnosis || ''}
                onChange={(e) => updateEditedField('primary_diagnosis', e.target.value)}
                className="w-full p-2 border border-emerald-300 rounded text-emerald-800 min-h-[60px]"
                placeholder="Enter primary diagnosis"
              />
            ) : (
              <p className="text-emerald-800">{diagnosisResult.primary_diagnosis}</p>
            )}
          </div>

          {/* Differential Diagnoses */}
          {((diagnosisResult.differential_diagnoses && diagnosisResult.differential_diagnoses.length > 0) || isEditing) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Differential Diagnoses</h3>
              {isEditing ? (
                <div className="space-y-2">
                  {editedDiagnosis?.differential_diagnoses?.map((diagnosis: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={diagnosis}
                        onChange={(e) => updateArrayItem('differential_diagnoses', index, e.target.value)}
                        className="flex-1 p-2 border border-blue-300 rounded text-blue-800"
                        placeholder="Enter differential diagnosis"
                      />
                      <button
                        onClick={() => removeArrayItem('differential_diagnoses', index)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('differential_diagnoses', '')}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Add Differential Diagnosis
                  </button>
                </div>
              ) : (
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                  {diagnosisResult.differential_diagnoses?.map((diagnosis: string, index: number) => (
                    <li key={index}>{diagnosis}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Recommended Actions */}
          {((diagnosisResult.recommended_actions && diagnosisResult.recommended_actions.length > 0) || isEditing) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2">Recommended Actions</h3>
              {isEditing ? (
                <div className="space-y-2">
                  {editedDiagnosis.recommended_actions?.map((action: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={action}
                        onChange={(e) => updateArrayItem('recommended_actions', index, e.target.value)}
                        className="flex-1 p-2 border border-amber-300 rounded text-amber-800"
                        placeholder="Enter recommended action"
                      />
                      <button
                        onClick={() => removeArrayItem('recommended_actions', index)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('recommended_actions', '')}
                    className="px-3 py-1 bg-amber-500 text-white rounded text-sm hover:bg-amber-600"
                  >
                    Add Recommended Action
                  </button>
                </div>
              ) : (
                <ul className="list-disc list-inside text-amber-800 space-y-1">
                  {diagnosisResult.recommended_actions?.map((action: string, index: number) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Treatment */}
          {((diagnosisResult.treatment && diagnosisResult.treatment.length > 0) || isEditing) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">Treatment</h3>
              {isEditing ? (
                <div className="space-y-2">
                  {editedDiagnosis.treatment?.map((treatment: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={treatment}
                        onChange={(e) => updateArrayItem('treatment', index, e.target.value)}
                        className="flex-1 p-2 border border-purple-300 rounded text-purple-800"
                        placeholder="Enter treatment"
                      />
                      <button
                        onClick={() => removeArrayItem('treatment', index)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('treatment', '')}
                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
                  >
                    Add Treatment
                  </button>
                </div>
              ) : (
                <ul className="list-disc list-inside text-purple-800 space-y-1">
                  {diagnosisResult.treatment?.map((treatment: string, index: number) => (
                    <li key={index}>{treatment}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Inventory Drug Recommendations */}
          {((diagnosisResult.inventory_drugs && diagnosisResult.inventory_drugs.length > 0) || isEditing) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-3">🏥 Available from Your Inventory</h3>
              {isEditing ? (
                <div className="space-y-3">
                  {editedDiagnosis?.inventory_drugs?.map((drug: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg border border-green-200 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-green-900">Drug #{index + 1}</h4>
                        <button
                          onClick={() => removeDrugItem('inventory_drugs', index)}
                          className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div className="relative">
                          <label className="font-medium text-green-800 block mb-1">
                            Drug Name: 
                            <span className="text-xs font-normal text-green-600 ml-1">
                              (type to search your inventory)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={drug.drug_name || ''}
                            onChange={(e) => {
                              updateDrugItem('inventory_drugs', index, 'drug_name', e.target.value);
                              searchDrugs(e.target.value, `inventory_drugs_${index}`);
                            }}
                            onFocus={() => {
                              if (drug.drug_name && drug.drug_name.length >= 2) {
                                searchDrugs(drug.drug_name, `inventory_drugs_${index}`);
                              }
                            }}
                            onBlur={() => {
                              // Delay hiding suggestions to allow click
                              setTimeout(() => {
                                setShowDrugSuggestions(prev => ({ ...prev, [`inventory_drugs_${index}`]: false }));
                              }, 200);
                            }}
                            className="w-full p-2 border border-green-300 rounded text-green-800"
                            placeholder="🔍 Type drug name to search your inventory..."
                          />
                          {showDrugSuggestions[`inventory_drugs_${index}`] && drugSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-green-300 rounded-b shadow-lg max-h-40 overflow-y-auto">
                              {drugSearchResults.map((inventoryDrug, drugIndex) => (
                                <div
                                  key={drugIndex}
                                  onClick={() => selectDrug(inventoryDrug, 'inventory_drugs', index)}
                                  className="p-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-green-900">{inventoryDrug.drug_name}</div>
                                  {inventoryDrug.generic_name && (
                                    <div className="text-xs text-green-600">Generic: {inventoryDrug.generic_name}</div>
                                  )}
                                  {inventoryDrug.strength && (
                                    <div className="text-xs text-green-600">{inventoryDrug.strength}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="font-medium text-green-800 block mb-1">Therapeutic Class:</label>
                          <input
                            type="text"
                            value={drug.therapeutic_class || ''}
                            onChange={(e) => updateDrugItem('inventory_drugs', index, 'therapeutic_class', e.target.value)}
                            className="w-full p-2 border border-green-300 rounded text-green-800"
                            placeholder="Enter therapeutic class"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-green-800 block mb-1">Dosage:</label>
                          <input
                            type="text"
                            value={drug.dosage || ''}
                            onChange={(e) => updateDrugItem('inventory_drugs', index, 'dosage', e.target.value)}
                            className="w-full p-2 border border-green-300 rounded text-green-800"
                            placeholder="Enter dosage"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-green-800 block mb-1">Duration:</label>
                          <input
                            type="text"
                            value={drug.duration || ''}
                            onChange={(e) => updateDrugItem('inventory_drugs', index, 'duration', e.target.value)}
                            className="w-full p-2 border border-green-300 rounded text-green-800"
                            placeholder="Enter duration"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="font-medium text-green-800 block mb-1">Instructions:</label>
                          <textarea
                            value={drug.instructions || ''}
                            onChange={(e) => updateDrugItem('inventory_drugs', index, 'instructions', e.target.value)}
                            className="w-full p-2 border border-green-300 rounded text-green-800 resize-none"
                            rows={2}
                            placeholder="Enter instructions"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="font-medium text-green-800 block mb-1">Clinical Rationale:</label>
                          <textarea
                            value={drug.clinical_rationale || ''}
                            onChange={(e) => updateDrugItem('inventory_drugs', index, 'clinical_rationale', e.target.value)}
                            className="w-full p-2 border border-green-300 rounded text-green-800 resize-none"
                            rows={2}
                            placeholder="Enter clinical rationale"
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`inventory_prescription_${index}`}
                            checked={drug.prescription_required || false}
                            onChange={(e) => updateDrugItem('inventory_drugs', index, 'prescription_required', e.target.checked)}
                            className="mr-2"
                          />
                          <label htmlFor={`inventory_prescription_${index}`} className="text-green-800">
                            Prescription Required
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addDrugItem('inventory_drugs')}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Add Inventory Drug
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosisResult.inventory_drugs?.map((drug: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg border border-green-200 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-green-900">{drug.drug_name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ In Stock
                          </span>
                          {drug.prescription_required && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Prescription Required
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-green-700 space-y-1">
                        {drug.therapeutic_class && <p><strong>Class:</strong> {drug.therapeutic_class}</p>}
                        <p><strong>Dosage:</strong> {drug.dosage}</p>
                        {drug.duration && <p><strong>Duration:</strong> {drug.duration}</p>}
                        {drug.instructions && <p><strong>Instructions:</strong> {drug.instructions}</p>}
                        {drug.clinical_rationale && <p><strong>Rationale:</strong> {drug.clinical_rationale}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Additional External Therapy */}
          {((diagnosisResult.additional_therapy && diagnosisResult.additional_therapy.length > 0) || isEditing) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">💊 Additional Recommended Therapy</h3>
              {isEditing ? (
                <div className="space-y-3">
                  {editedDiagnosis?.additional_therapy?.map((drug: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg border border-blue-200 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-blue-900">Therapy #{index + 1}</h4>
                        <button
                          onClick={() => removeDrugItem('additional_therapy', index)}
                          className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div className="relative">
                          <label className="font-medium text-blue-800 block mb-1">
                            Drug Name: 
                            <span className="text-xs font-normal text-blue-600 ml-1">
                              (type to search your inventory)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={drug.drug_name || ''}
                            onChange={(e) => {
                              updateDrugItem('additional_therapy', index, 'drug_name', e.target.value);
                              searchDrugs(e.target.value, `additional_therapy_${index}`);
                            }}
                            onFocus={() => {
                              if (drug.drug_name && drug.drug_name.length >= 2) {
                                searchDrugs(drug.drug_name, `additional_therapy_${index}`);
                              }
                            }}
                            onBlur={() => {
                              // Delay hiding suggestions to allow click
                              setTimeout(() => {
                                setShowDrugSuggestions(prev => ({ ...prev, [`additional_therapy_${index}`]: false }));
                              }, 200);
                            }}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800"
                            placeholder="🔍 Type drug name to search your inventory..."
                          />
                          {showDrugSuggestions[`additional_therapy_${index}`] && drugSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-blue-300 rounded-b shadow-lg max-h-40 overflow-y-auto">
                              {drugSearchResults.map((inventoryDrug, drugIndex) => (
                                <div
                                  key={drugIndex}
                                  onClick={() => selectDrug(inventoryDrug, 'additional_therapy', index)}
                                  className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-blue-900">{inventoryDrug.drug_name}</div>
                                  {inventoryDrug.generic_name && (
                                    <div className="text-xs text-blue-600">Generic: {inventoryDrug.generic_name}</div>
                                  )}
                                  {inventoryDrug.strength && (
                                    <div className="text-xs text-blue-600">{inventoryDrug.strength}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="font-medium text-blue-800 block mb-1">Therapeutic Class:</label>
                          <input
                            type="text"
                            value={drug.therapeutic_class || ''}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'therapeutic_class', e.target.value)}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800"
                            placeholder="Enter therapeutic class"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-blue-800 block mb-1">Dosage:</label>
                          <input
                            type="text"
                            value={drug.dosage || ''}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'dosage', e.target.value)}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800"
                            placeholder="Enter dosage"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-blue-800 block mb-1">Duration:</label>
                          <input
                            type="text"
                            value={drug.duration || ''}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'duration', e.target.value)}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800"
                            placeholder="Enter duration"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-blue-800 block mb-1">Availability:</label>
                          <input
                            type="text"
                            value={drug.availability || ''}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'availability', e.target.value)}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800"
                            placeholder="Enter availability"
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`therapy_prescription_${index}`}
                            checked={drug.prescription_required || false}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'prescription_required', e.target.checked)}
                            className="mr-2"
                          />
                          <label htmlFor={`therapy_prescription_${index}`} className="text-blue-800">
                            Prescription Required
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <label className="font-medium text-blue-800 block mb-1">Instructions:</label>
                          <textarea
                            value={drug.instructions || ''}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'instructions', e.target.value)}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800 resize-none"
                            rows={2}
                            placeholder="Enter instructions"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="font-medium text-blue-800 block mb-1">Clinical Rationale:</label>
                          <textarea
                            value={drug.clinical_rationale || ''}
                            onChange={(e) => updateDrugItem('additional_therapy', index, 'clinical_rationale', e.target.value)}
                            className="w-full p-2 border border-blue-300 rounded text-blue-800 resize-none"
                            rows={2}
                            placeholder="Enter clinical rationale"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addDrugItem('additional_therapy')}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Additional Therapy
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosisResult.additional_therapy?.map((drug: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg border border-blue-200 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-blue-900">{drug.drug_name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            External
                          </span>
                          {drug.prescription_required && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Prescription Required
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-blue-700 space-y-1">
                        {drug.therapeutic_class && <p><strong>Class:</strong> {drug.therapeutic_class}</p>}
                        <p><strong>Dosage:</strong> {drug.dosage}</p>
                        {drug.duration && <p><strong>Duration:</strong> {drug.duration}</p>}
                        {drug.instructions && <p><strong>Instructions:</strong> {drug.instructions}</p>}
                        {drug.availability && <p><strong>Availability:</strong> {drug.availability}</p>}
                        {drug.clinical_rationale && <p><strong>Rationale:</strong> {drug.clinical_rationale}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fallback - Old drug_suggestions format */}
          {diagnosisResult.drug_suggestions && diagnosisResult.drug_suggestions.length > 0 && !diagnosisResult.inventory_drugs && !diagnosisResult.additional_therapy && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <h3 className="font-semibold text-teal-900 mb-3">Drug Recommendations</h3>
              <div className="space-y-3">
                {diagnosisResult.drug_suggestions.map((drug: any, index: number) => (
                  <div key={index} className="bg-white rounded-lg border border-teal-200 p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-teal-900">{drug.drug_name}</h4>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          drug.source === 'inventory' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {drug.source === 'inventory' ? '✓ In Stock' : 'External'}
                        </span>
                        {drug.prescription_required && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Prescription Required
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-teal-700 space-y-1">
                      <p><strong>Dosage:</strong> {drug.dosage}</p>
                      {drug.duration && <p><strong>Duration:</strong> {drug.duration}</p>}
                      {drug.instructions && <p><strong>Instructions:</strong> {drug.instructions}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Severity & Confidence */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            {diagnosisResult.severity_level && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">Severity:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  diagnosisResult.severity_level === 'critical' ? 'bg-red-100 text-red-800' :
                  diagnosisResult.severity_level === 'high' ? 'bg-orange-100 text-orange-800' :
                  diagnosisResult.severity_level === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {diagnosisResult.severity_level.charAt(0).toUpperCase() + diagnosisResult.severity_level.slice(1)}
                </span>
              </div>
            )}
            
            {diagnosisResult.confidence_score && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">Confidence:</span>
                <span className="text-sm font-medium text-slate-900">
                  {Math.round(diagnosisResult.confidence_score * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>


        <div className="mt-8 flex justify-center">
          <button
            onClick={() => {
              setDiagnosisResult(null);
              setFormData({ complaint: '', patient_age: undefined, patient_gender: '', symptoms: '' });
            }}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Create New Diagnosis
          </button>
        </div>
      </div>
    );
  }

  // Show loading while checking credits
  if (checkingCredits) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  // Show access denied if user can't use diagnosis
  if (creditInfo && !creditInfo.canUse) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Diagnosis Access Restricted</h2>
          <p className="text-slate-600 mb-4">{creditInfo.reason}</p>
          
          {!user && (
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Sign In
            </button>
          )}
          
          {user && creditInfo.credits === 0 && creditInfo.freeCredits === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800">
                Purchase credits to continue using AI diagnosis. Credits will be available for purchase soon!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      {/* Credits Display */}
      {creditInfo && !creditInfo.isAdmin && (
        <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Available Credits</h3>
                <p className="text-sm text-slate-600">
                  {creditInfo.freeCredits} free + {creditInfo.credits} purchased = {creditInfo.freeCredits + creditInfo.credits} total
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-600">
                {creditInfo.freeCredits + creditInfo.credits}
              </div>
              <div className="text-xs text-slate-500">diagnoses left</div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Badge */}
      {creditInfo?.isAdmin && (
        <div className="mb-6 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-purple-800">Admin Access - Unlimited Diagnoses</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Patient Diagnosis</h2>
        <p className="text-slate-600">Enter patient information to get AI-powered medical diagnosis and treatment recommendations.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information - Always Visible */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
          
          {/* Patient Age & Gender */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Patient Age
              </label>
              <input
                type="number"
                name="patient_age"
                value={formData.patient_age || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g., 45"
                min="0"
                max="150"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Patient Gender
              </label>
              <select
                name="patient_gender"
                value={formData.patient_gender}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Patient Complaint */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Patient Complaint <span className="text-red-500">*</span>
            </label>
            <textarea
              name="complaint"
              value={formData.complaint}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Describe the patient's main complaint, symptoms, and any relevant information..."
              required
            />
          </div>

          {/* Additional Symptoms */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Additional Symptoms (Optional)
            </label>
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Any additional symptoms, medical history, or relevant details..."
            />
          </div>
        </div>

        {/* Patient Details - Collapsible */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('patientDetails')}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h3 className="text-lg font-semibold text-slate-900">👤 Patient Details (Optional)</h3>
            <svg 
              className={`w-5 h-5 text-slate-500 transform transition-transform ${expandedSections.patientDetails ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.patientDetails && (
            <div className="px-6 pb-6 border-t border-slate-200">
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Name</label>
                  <input
                    type="text"
                    name="patient_name"
                    value={formData.patient_name || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="First name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Surname</label>
                  <input
                    type="text"
                    name="patient_surname"
                    value={formData.patient_surname || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Last name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient ID</label>
                  <input
                    type="text"
                    name="patient_id"
                    value={formData.patient_id || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Medical record number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vital Signs - Collapsible */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('vitalSigns')}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h3 className="text-lg font-semibold text-slate-900">🩺 Vital Signs (Optional)</h3>
            <svg 
              className={`w-5 h-5 text-slate-500 transform transition-transform ${expandedSections.vitalSigns ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.vitalSigns && (
            <div className="px-6 pb-6 border-t border-slate-200">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Systolic BP</label>
                  <input
                    type="number"
                    name="blood_pressure_systolic"
                    value={formData.blood_pressure_systolic || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="120"
                    min="50"
                    max="300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Diastolic BP</label>
                  <input
                    type="number"
                    name="blood_pressure_diastolic"
                    value={formData.blood_pressure_diastolic || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="80"
                    min="30"
                    max="200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Heart Rate (BPM)</label>
                  <input
                    type="number"
                    name="heart_rate"
                    value={formData.heart_rate || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="72"
                    min="30"
                    max="200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Temperature (°C)</label>
                  <input
                    type="number"
                    name="temperature"
                    value={formData.temperature || ''}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="36.5"
                    min="30"
                    max="45"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Respiratory Rate</label>
                  <input
                    type="number"
                    name="respiratory_rate"
                    value={formData.respiratory_rate || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="16"
                    min="5"
                    max="50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">O₂ Saturation (%)</label>
                  <input
                    type="number"
                    name="oxygen_saturation"
                    value={formData.oxygen_saturation || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="98"
                    min="50"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Weight (kg)</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight || ''}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="70"
                    min="1"
                    max="300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                  <input
                    type="number"
                    name="height"
                    value={formData.height || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="175"
                    min="50"
                    max="250"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Medical History - Collapsible */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('medicalHistory')}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h3 className="text-lg font-semibold text-slate-900">📋 Medical History (Optional)</h3>
            <svg 
              className={`w-5 h-5 text-slate-500 transform transition-transform ${expandedSections.medicalHistory ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.medicalHistory && (
            <div className="px-6 pb-6 border-t border-slate-200">
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Known Allergies</label>
                  <textarea
                    name="allergies"
                    value={formData.allergies || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Drug allergies, food allergies, environmental allergies..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Medications</label>
                  <textarea
                    name="current_medications"
                    value={formData.current_medications || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Current prescriptions, over-the-counter medications, supplements..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Chronic Conditions</label>
                  <textarea
                    name="chronic_conditions"
                    value={formData.chronic_conditions || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Diabetes, hypertension, heart disease, asthma, etc..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Previous Surgeries</label>
                  <textarea
                    name="previous_surgeries"
                    value={formData.previous_surgeries || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Previous surgical procedures, dates, complications..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Previous Injuries</label>
                  <textarea
                    name="previous_injuries"
                    value={formData.previous_injuries || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Significant injuries, trauma history, complications..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clinical Details - Collapsible */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('clinicalDetails')}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h3 className="text-lg font-semibold text-slate-900">🔍 Clinical Details (Optional)</h3>
            <svg 
              className={`w-5 h-5 text-slate-500 transform transition-transform ${expandedSections.clinicalDetails ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.clinicalDetails && (
            <div className="px-6 pb-6 border-t border-slate-200">
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Complaint Duration</label>
                  <input
                    type="text"
                    name="complaint_duration"
                    value={formData.complaint_duration || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="3 days, 2 weeks, 1 month..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pain Scale (0-10)</label>
                  <input
                    type="number"
                    name="pain_scale"
                    value={formData.pain_scale || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0 = No pain, 10 = Severe pain"
                    min="0"
                    max="10"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Symptom Onset</label>
                  <select
                    name="symptom_onset"
                    value={formData.symptom_onset || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select onset type</option>
                    <option value="sudden">Sudden onset</option>
                    <option value="gradual">Gradual onset</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Associated Symptoms</label>
                  <textarea
                    name="associated_symptoms"
                    value={formData.associated_symptoms || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Other symptoms that occur along with the main complaint..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Progress Display */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">{progressMessage}</span>
                  <span className="text-sm font-bold text-emerald-600">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 text-center">
              🩺 Advanced medical AI is analyzing your patient data...
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !formData.complaint.trim() || !creditInfo?.canUse}
          className="w-full px-6 py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing {progress}%
            </span>
          ) : (
            <span className="flex items-center justify-center">
              {creditInfo?.isAdmin ? (
                'Get AI Diagnosis (Admin)'
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Use 1 Credit - Get AI Diagnosis
                </>
              )}
            </span>
          )}
        </button>

        {/* Credit Info Below Button */}
        {creditInfo && !creditInfo.isAdmin && (
          <div className="text-center text-sm text-slate-500">
            <p>
              Each diagnosis costs 1 credit. You have{' '}
              <span className="font-medium text-slate-700">
                {creditInfo.freeCredits + creditInfo.credits} credits
              </span>{' '}
              remaining.
            </p>
            {(creditInfo.freeCredits + creditInfo.credits) <= 3 && (
              <p className="text-amber-600 mt-1">
                ⚠️ Running low on credits. Purchase more to continue using AI diagnosis.
              </p>
            )}
          </div>
        )}
      </form>

      {/* AI Notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-medium text-blue-900">AI Medical Assistant</h4>
            <p className="text-sm text-blue-700 mt-1">
              This AI diagnosis is for reference only and should not replace professional medical judgment. 
              Always consult with qualified healthcare professionals for patient care decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Debug Component - Remove this in production */}
      <DiagnosisDebug />
    </div>
  );
}