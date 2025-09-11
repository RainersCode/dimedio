'use client';

import Navigation from '@/components/layout/Navigation';
import { PatientService } from '@/lib/patientService';
import { DrugDispensingService } from '@/lib/drugDispensingService';
import { DrugInventoryService } from '@/lib/drugInventory';
import { DatabaseService } from '@/lib/database';
import { PatientProfile, Diagnosis, UserDrugInventory } from '@/types/database';
import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DiagnosisExportDropdown } from '@/components/diagnosis/DiagnosisExportButtons';

interface PatientDetailsProps {
  params: { id: string };
}

export default function PatientDetails({ params }: PatientDetailsProps) {
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<(PatientProfile & { diagnoses: Diagnosis[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userDrugInventory, setUserDrugInventory] = useState<UserDrugInventory[]>([]);
  const [recordingDispensing, setRecordingDispensing] = useState<{[key: string]: boolean}>({});
  const [dispensingRecorded, setDispensingRecorded] = useState<{[key: string]: boolean}>({});
  const [deletingDiagnosis, setDeletingDiagnosis] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAllDiagnoses, setDeletingAllDiagnoses] = useState(false);

  useEffect(() => {
    if (user && params.id) {
      fetchPatient();
    }
  }, [user, params.id]);

  // Check localStorage for recorded dispensings when patient data loads
  useEffect(() => {
    if (patient?.diagnoses) {
      const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
      const recorded: {[key: string]: boolean} = {};
      
      patient.diagnoses.forEach(diagnosis => {
        if (recordedDispensings.includes(diagnosis.id)) {
          recorded[diagnosis.id] = true;
        }
      });
      
      setDispensingRecorded(recorded);
    }
  }, [patient?.diagnoses]);

  const fetchPatient = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch patient data
      const { data, error: fetchError } = await PatientService.getPatientById(params.id);
      
      if (fetchError) {
        setError(fetchError);
      } else if (data) {
        setPatient(data);
      }

      // Also fetch user's drug inventory for dispensing
      try {
        const { data: inventory } = await DrugInventoryService.getUserDrugInventory();
        if (inventory) {
          setUserDrugInventory(inventory);
        }
      } catch (invError) {
        console.warn('Could not fetch drug inventory:', invError);
      }

    } catch (err) {
      setError('Failed to fetch patient details');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Critical';
      case 'high': return 'High Priority';
      case 'moderate': return 'Active Treatment';
      case 'low': return 'Resolved';
      default: return 'Unknown';
    }
  };

  const recordDrugDispensing = async (diagnosis: Diagnosis) => {
    if (!diagnosis || !diagnosis.inventory_drugs || diagnosis.inventory_drugs.length === 0) {
      console.log('No inventory drugs to dispense for diagnosis:', diagnosis.id);
      return;
    }

    try {
      setRecordingDispensing(prev => ({ ...prev, [diagnosis.id]: true }));
      console.log('Recording drug dispensing for diagnosis:', diagnosis.id);
      console.log('Inventory drugs in diagnosis:', diagnosis.inventory_drugs);
      console.log('Available user inventory:', userDrugInventory);

      const patientInfo = {
        patient_name: patient?.patient_name,
        patient_age: patient?.patient_age,
        patient_gender: patient?.patient_gender,
        primary_diagnosis: diagnosis.primary_diagnosis
      };

      // Match inventory drugs by name to find their IDs from userDrugInventory
      const dispensings = [];
      
      for (const drug of diagnosis.inventory_drugs) {
        console.log('Processing drug:', drug);
        
        // Try to find the drug ID from userDrugInventory by matching drug name
        const matchingInventoryDrug = userDrugInventory.find(invDrug => {
          // Normalize names for comparison (lowercase, remove extra spaces)
          const normalizeName = (name: string) => name?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
          const normalizeForMatching = (name: string) => {
            return normalizeName(name)
              .replace(/\s+n\d+.*$/i, '') // Remove package size (N12, N14, etc.)
              .replace(/\s+(tabletes?|kapsulas?|ml|mg|g)\b/gi, '') // Remove common units
              .replace(/\s+mutē\s+disperģējamās/gi, '') // Remove specific Latvian terms
              .replace(/\s+apvalkotās/gi, '')
              .replace(/\bmg\/\d+\s*mg\b/gi, 'mg') // Normalize dosage like "500 mg/125 mg" to "500mg"
              .replace(/\s+/g, ' ').trim();
          };
          
          const invDrugNormalized = normalizeForMatching(invDrug.drug_name);
          const diagnosisDrugNormalized = normalizeForMatching(drug.drug_name);
          
          return (
            // Exact match
            normalizeName(invDrug.drug_name) === normalizeName(drug.drug_name) ||
            // Normalized match
            invDrugNormalized === diagnosisDrugNormalized ||
            // Check if one contains the other (partial match)
            (invDrugNormalized.includes(diagnosisDrugNormalized) && diagnosisDrugNormalized.length > 5) ||
            (diagnosisDrugNormalized.includes(invDrugNormalized) && invDrugNormalized.length > 5) ||
            // ID matches
            (drug.id && invDrug.id === drug.id) ||
            (drug.drug_id && invDrug.id === drug.drug_id)
          );
        });
        
        if (matchingInventoryDrug) {
          console.log('Found matching inventory drug:', matchingInventoryDrug);
          dispensings.push({
            drugId: matchingInventoryDrug.id,
            drugName: drug.drug_name, // Store the original drug name from diagnosis
            quantity: extractQuantityFromDosage(drug.dosage) || 1,
            notes: `Prescribed for: ${diagnosis.complaint}. Duration: ${drug.duration || 'Not specified'}`
          });
        } else {
          console.warn('Could not find matching inventory drug for:', drug.drug_name);
          console.log('Recording drug without inventory match...');
          // Still record the drug even if not found in inventory
          dispensings.push({
            drugId: null, // No inventory drug ID
            drugName: drug.drug_name, // Store the drug name from diagnosis
            quantity: extractQuantityFromDosage(drug.dosage) || 1,
            notes: `Prescribed for: ${diagnosis.complaint}. Duration: ${drug.duration || 'Not specified'}. Note: Drug not found in current inventory.`
          });
        }
      }

      console.log('Dispensings to record:', dispensings);

      if (dispensings.length > 0) {
        const { error } = await DrugDispensingService.recordMultipleDispensings(
          dispensings,
          diagnosis.id,
          patientInfo
        );

        if (error) {
          console.error('Failed to record drug dispensing:', error);
          setError('Failed to record dispensing: ' + error);
        } else {
          console.log('Successfully recorded drug dispensing for', dispensings.length, 'drugs');
          setDispensingRecorded(prev => ({ ...prev, [diagnosis.id]: true }));
          
          // Store in localStorage for persistence across pages
          const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
          if (!recordedDispensings.includes(diagnosis.id)) {
            recordedDispensings.push(diagnosis.id);
            localStorage.setItem('recordedDispensings', JSON.stringify(recordedDispensings));
          }
        }
      } else {
        console.warn('No dispensings recorded - could not match any inventory drugs');
        setError('No matching drugs found in inventory');
      }
    } catch (err) {
      console.error('Error recording drug dispensing:', err);
      setError('Failed to record dispensing');
    } finally {
      setRecordingDispensing(prev => ({ ...prev, [diagnosis.id]: false }));
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

  const handleDeleteDiagnosis = async (diagnosisId: string) => {
    try {
      setDeletingDiagnosis(diagnosisId);
      const { error: deleteError } = await DatabaseService.deleteDiagnosis(diagnosisId);
      
      if (deleteError) {
        setError('Failed to delete diagnosis: ' + deleteError);
      } else {
        // Remove the diagnosis from local state
        setPatient(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            diagnoses: prev.diagnoses.filter(d => d.id !== diagnosisId)
          };
        });
        setShowDeleteConfirm(null);
        
        // Remove from localStorage if it was recorded
        const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
        const updatedRecorded = recordedDispensings.filter((id: string) => id !== diagnosisId);
        localStorage.setItem('recordedDispensings', JSON.stringify(updatedRecorded));
      }
    } catch (err) {
      setError('Failed to delete diagnosis');
    } finally {
      setDeletingDiagnosis(null);
    }
  };

  const handleDeleteAllDiagnoses = async () => {
    if (!patient?.diagnoses?.length) return;
    
    try {
      setDeletingAllDiagnoses(true);
      
      // Delete all diagnoses
      const deletePromises = patient.diagnoses.map(diagnosis => 
        DatabaseService.deleteDiagnosis(diagnosis.id)
      );
      
      const results = await Promise.all(deletePromises);
      const errors = results.filter(result => result.error);
      
      if (errors.length > 0) {
        setError(`Failed to delete ${errors.length} diagnosis(es)`);
      } else {
        // Clear all diagnoses from local state
        setPatient(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            diagnoses: []
          };
        });
        setShowDeleteAllConfirm(false);
        
        // Clear all from localStorage
        localStorage.setItem('recordedDispensings', JSON.stringify([]));
      }
    } catch (err) {
      setError('Failed to delete all diagnoses');
    } finally {
      setDeletingAllDiagnoses(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Please log in to view patient details.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading patient details...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-800 mb-2">Error</h1>
            <p className="text-red-600">{error}</p>
            <div className="mt-4">
              <Link
                href="/patients"
                className="text-red-600 hover:text-red-800 font-medium"
              >
                ← Back to Patients
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-yellow-800 mb-2">Patient Not Found</h1>
            <p className="text-yellow-600">The requested patient could not be found.</p>
            <div className="mt-4">
              <Link
                href="/patients"
                className="text-yellow-600 hover:text-yellow-800 font-medium"
              >
                ← Back to Patients
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/patients"
              className="text-slate-600 hover:text-slate-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <span className={patient.id.startsWith('anonymous-') ? 'text-amber-700 italic' : ''}>
                  {patient.patient_name}
                </span>
                {patient.id.startsWith('anonymous-') && (
                  <span className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-full">
                    Anonymous Patient
                  </span>
                )}
              </h1>
              <p className="text-slate-600 mt-1">
                Patient ID: #{patient.patient_id || (patient.id.startsWith('anonymous-') ? 'ANON-' + patient.id.slice(10, 18) : patient.id.slice(0, 8))} • 
                {patient.diagnoses?.length || 0} diagnosis{patient.diagnoses?.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Patient Information */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Patient Information</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600">Name</label>
                  <p className="text-slate-900 font-medium flex items-center gap-2">
                    <span className={patient.id.startsWith('anonymous-') ? 'text-amber-700 italic' : ''}>
                      {patient.patient_name}
                    </span>
                    {patient.id.startsWith('anonymous-') && (
                      <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">
                        Anonymous
                      </span>
                    )}
                  </p>
                </div>
                
                {patient.patient_age && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Age</label>
                    <p className="text-slate-900">{patient.patient_age} years old</p>
                  </div>
                )}
                
                {patient.patient_gender && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Gender</label>
                    <p className="text-slate-900 capitalize">{patient.patient_gender}</p>
                  </div>
                )}
                
                {patient.date_of_birth && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Date of Birth</label>
                    <p className="text-slate-900">{new Date(patient.date_of_birth).toLocaleDateString()}</p>
                  </div>
                )}

                {patient.allergies && patient.allergies.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Allergies</label>
                    <div className="mt-1">
                      {patient.allergies.map((allergy, index) => (
                        <span 
                          key={index}
                          className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-2 mb-1"
                        >
                          {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {patient.current_medications && patient.current_medications.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Current Medications</label>
                    <ul className="mt-1 text-sm text-slate-700">
                      {patient.current_medications.map((medication, index) => (
                        <li key={index} className="flex items-start">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                          {medication}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-600">Last Visit</label>
                  <p className="text-slate-900">
                    {patient.last_visit_date ? 
                      new Date(patient.last_visit_date).toLocaleDateString() : 
                      new Date(patient.created_at).toLocaleDateString()
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnosis History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Diagnosis History</h2>
                {patient?.diagnoses && patient.diagnoses.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete All
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-200">
                {patient.diagnoses && patient.diagnoses.length > 0 ? (
                  patient.diagnoses.map((diagnosis, index) => (
                    <div key={diagnosis.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-slate-900">
                            {diagnosis.primary_diagnosis || 'No primary diagnosis'}
                          </h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {new Date(diagnosis.created_at).toLocaleDateString()} • 
                            Complaint: {diagnosis.complaint}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setShowDeleteConfirm(diagnosis.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                          <DiagnosisExportDropdown diagnosis={diagnosis} />
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getSeverityColor(diagnosis.severity_level || 'unknown')}`}>
                            {getSeverityText(diagnosis.severity_level || 'unknown')}
                          </span>
                        </div>
                      </div>

                      {diagnosis.symptoms && (
                        <div className="mb-4">
                          <label className="text-sm font-medium text-slate-600 block mb-1">Symptoms</label>
                          <p className="text-sm text-slate-700">{Array.isArray(diagnosis.symptoms) ? diagnosis.symptoms.join(', ') : diagnosis.symptoms}</p>
                        </div>
                      )}

                      {diagnosis.differential_diagnoses && diagnosis.differential_diagnoses.length > 0 && (
                        <div className="mb-4">
                          <label className="text-sm font-medium text-slate-600 block mb-1">Differential Diagnoses</label>
                          <ul className="text-sm text-slate-700">
                            {diagnosis.differential_diagnoses.map((diff, i) => (
                              <li key={i} className="flex items-start">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                {diff}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {diagnosis.treatment && diagnosis.treatment.length > 0 && (
                        <div className="mb-4">
                          <label className="text-sm font-medium text-slate-600 block mb-1">Treatment</label>
                          <ul className="text-sm text-slate-700">
                            {diagnosis.treatment.map((treatment, i) => (
                              <li key={i} className="flex items-start">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                {treatment}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {((diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0) || 
                        (diagnosis.additional_therapy && diagnosis.additional_therapy.length > 0)) && (
                        <div className="mb-4">
                          <label className="text-sm font-medium text-slate-600 block mb-2">Medications</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {diagnosis.inventory_drugs && diagnosis.inventory_drugs.map((drug: any, i: number) => (
                              <div key={`inventory-${i}`} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-emerald-900">{drug.drug_name}</h4>
                                  <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded">
                                    In Stock
                                  </span>
                                </div>
                                <p className="text-sm text-emerald-700 mb-1">
                                  <strong>Dosage:</strong> {drug.dosage}
                                </p>
                                <p className="text-sm text-emerald-700 mb-1">
                                  <strong>Duration:</strong> {drug.duration}
                                </p>
                                {drug.instructions && (
                                  <p className="text-sm text-emerald-700">
                                    <strong>Instructions:</strong> {drug.instructions}
                                  </p>
                                )}
                              </div>
                            ))}
                            
                            {diagnosis.additional_therapy && diagnosis.additional_therapy.map((drug: any, i: number) => (
                              <div key={`additional-${i}`} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-blue-900">{drug.drug_name}</h4>
                                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                    External
                                  </span>
                                </div>
                                <p className="text-sm text-blue-700 mb-1">
                                  <strong>Dosage:</strong> {drug.dosage}
                                </p>
                                <p className="text-sm text-blue-700 mb-1">
                                  <strong>Duration:</strong> {drug.duration}
                                </p>
                                {drug.instructions && (
                                  <p className="text-sm text-blue-700">
                                    <strong>Instructions:</strong> {drug.instructions}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {diagnosis.recommended_actions && diagnosis.recommended_actions.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-slate-600 block mb-1">Recommended Actions</label>
                          <ul className="text-sm text-slate-700">
                            {diagnosis.recommended_actions.map((action, i) => (
                              <li key={i} className="flex items-start">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Record Dispensing Button */}
                      {diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <button
                            onClick={() => recordDrugDispensing(diagnosis)}
                            disabled={recordingDispensing[diagnosis.id] || dispensingRecorded[diagnosis.id]}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {recordingDispensing[diagnosis.id] ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Recording Dispensing...
                              </>
                            ) : dispensingRecorded[diagnosis.id] ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Dispensing Recorded
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
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium text-slate-600 mb-2">No Diagnosis History</p>
                    <p className="text-slate-500">This patient hasn't had any diagnoses yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Individual Diagnosis Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-slate-900">Delete Diagnosis</h3>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this diagnosis? This action cannot be undone and will permanently remove this diagnosis record.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDiagnosis(showDeleteConfirm)}
                disabled={deletingDiagnosis === showDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {deletingDiagnosis === showDeleteConfirm ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete Diagnosis'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Diagnoses Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-slate-900">Delete All Diagnoses</h3>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete ALL diagnoses for this patient? This action cannot be undone and will permanently remove all {patient?.diagnoses?.length || 0} diagnosis records.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllDiagnoses}
                disabled={deletingAllDiagnoses}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {deletingAllDiagnoses ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete All Diagnoses'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}