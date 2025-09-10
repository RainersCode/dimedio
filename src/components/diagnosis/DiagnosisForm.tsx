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
    complaint: initialComplaint,
    patient_age: undefined,
    patient_gender: '',
    symptoms: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [creditInfo, setCreditInfo] = useState<{
    canUse: boolean;
    reason: string;
    credits: number;
    freeCredits: number;
    isAdmin: boolean;
  } | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(true);

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
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'patient_age' ? (value ? parseInt(value) : undefined) : value
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
        {/* Patient Age & Gender */}
        <div className="grid md:grid-cols-2 gap-4">
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
        <div>
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

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
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
              Analyzing...
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