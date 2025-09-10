'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { DatabaseService, N8nService } from '@/lib/database';
import { DiagnosisFormData } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditsService } from '@/lib/credits';
import DiagnosisDebug from './DiagnosisDebug';

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
  const [creditInfo, setCreditInfo] = useState<{
    canUse: boolean;
    reason: string;
    credits: number;
    freeCredits: number;
    isAdmin: boolean;
  } | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(true);
  
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
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Diagnosis Complete</h2>
          <p className="text-slate-600">AI analysis has been completed for your patient.</p>
        </div>

        <div className="space-y-6">
          {/* Patient History (AI Improved) */}
          {diagnosisResult.improved_patient_history && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">📋 Patient History</h3>
              <p className="text-slate-700">{diagnosisResult.improved_patient_history}</p>
              <div className="text-xs text-slate-500 mt-2 italic">
                ✨ Grammar and clarity improved by AI from original complaint
              </div>
            </div>
          )}

          {/* Patient Information Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">👤 Patient Information</h3>
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
          </div>

          {/* Vital Signs */}
          {(diagnosisResult.blood_pressure_systolic || diagnosisResult.heart_rate || diagnosisResult.temperature || 
            diagnosisResult.respiratory_rate || diagnosisResult.oxygen_saturation) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-3">🩺 Vital Signs</h3>
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
            </div>
          )}

          {/* Medical History */}
          {(diagnosisResult.allergies || diagnosisResult.current_medications || diagnosisResult.chronic_conditions || 
            diagnosisResult.previous_surgeries || diagnosisResult.previous_injuries) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-semibold text-orange-900 mb-3">📋 Medical History</h3>
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
            </div>
          )}

          {/* Primary Diagnosis */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-semibold text-emerald-900 mb-2">Primary Diagnosis</h3>
            <p className="text-emerald-800">{diagnosisResult.primary_diagnosis}</p>
          </div>

          {/* Differential Diagnoses */}
          {diagnosisResult.differential_diagnoses && diagnosisResult.differential_diagnoses.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Differential Diagnoses</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                {diagnosisResult.differential_diagnoses.map((diagnosis: string, index: number) => (
                  <li key={index}>{diagnosis}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Actions */}
          {diagnosisResult.recommended_actions && diagnosisResult.recommended_actions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2">Recommended Actions</h3>
              <ul className="list-disc list-inside text-amber-800 space-y-1">
                {diagnosisResult.recommended_actions.map((action: string, index: number) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Treatment */}
          {diagnosisResult.treatment && diagnosisResult.treatment.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">Treatment</h3>
              <ul className="list-disc list-inside text-purple-800 space-y-1">
                {diagnosisResult.treatment.map((treatment: string, index: number) => (
                  <li key={index}>{treatment}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Inventory Drug Recommendations */}
          {diagnosisResult.inventory_drugs && diagnosisResult.inventory_drugs.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-3">🏥 Available from Your Inventory</h3>
              <div className="space-y-3">
                {diagnosisResult.inventory_drugs.map((drug: any, index: number) => (
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
            </div>
          )}

          {/* Additional External Therapy */}
          {diagnosisResult.additional_therapy && diagnosisResult.additional_therapy.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">💊 Additional Recommended Therapy</h3>
              <div className="space-y-3">
                {diagnosisResult.additional_therapy.map((drug: any, index: number) => (
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