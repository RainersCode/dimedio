import { PatientService } from './patientService';
import { ModeAwarePatientService } from './modeAwarePatientService';
import { DatabaseService } from './database';
import type { UserWorkingMode } from '@/contexts/MultiOrgUserModeContext';

export interface UndispensedMedicationInfo {
  patientId: string;
  patientName: string;
  diagnosisId: string;
  primaryDiagnosis: string;
  undispensedDrugs: Array<{
    drugName: string;
    drugIndex: number;
    quantity: number;
  }>;
}

export class UndispensedMedicationsService {

  // Optimized batch method to get diagnoses for multiple patients
  private static async getBatchPatientDiagnoses(
    patientIds: string[],
    activeMode?: UserWorkingMode,
    organizationId?: string | null
  ): Promise<Map<string, any[]>> {
    const diagnosesByPatient = new Map<string, any[]>();

    if (patientIds.length === 0) {
      return diagnosesByPatient;
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Get organization diagnoses in batch
        const { supabase } = await import('./supabase');
        const { data: diagnoses } = await supabase
          .from('organization_diagnoses')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });

        console.log('🔍 UndispensedMedicationsService: Raw diagnoses found:', diagnoses?.length || 0);
        if (diagnoses && diagnoses.length > 0) {
          console.log('🔍 UndispensedMedicationsService: Sample diagnosis:', diagnoses[0]);
        }

        // Group by patient - for organization diagnoses, we need to match by patient identifier or name
        if (diagnoses) {
          // Get organization patients to match diagnoses
          const { data: orgPatients } = await supabase
            .from('organization_patients')
            .select('id, patient_name, patient_surname, patient_id')
            .eq('organization_id', organizationId);

          const patientMap = new Map();
          if (orgPatients) {
            orgPatients.forEach(patient => {
              // Map by patient UUID
              patientMap.set(patient.id, patient);
              // Also map by patient identifier if available
              if (patient.patient_id) {
                patientMap.set(patient.patient_id, patient);
              }
              // Map by full name as fallback
              const fullName = `${patient.patient_name} ${patient.patient_surname || ''}`.trim();
              patientMap.set(fullName, patient);
            });
          }

          diagnoses.forEach(diagnosis => {
            // Try to find matching patient by various methods
            let matchingPatientId = null;

            // Method 1: Match by diagnosis patient_id to patient patient_id
            if (diagnosis.patient_id && patientMap.has(diagnosis.patient_id)) {
              matchingPatientId = patientMap.get(diagnosis.patient_id).id;
            }
            // Method 2: Match by full name
            else if (diagnosis.patient_name) {
              const diagnosisFullName = `${diagnosis.patient_name} ${diagnosis.patient_surname || ''}`.trim();
              if (patientMap.has(diagnosisFullName)) {
                matchingPatientId = patientMap.get(diagnosisFullName).id;
              }
            }

            if (matchingPatientId) {
              if (!diagnosesByPatient.has(matchingPatientId)) {
                diagnosesByPatient.set(matchingPatientId, []);
              }
              diagnosesByPatient.get(matchingPatientId)!.push(diagnosis);
            }
          });
        }
      } else {
        // Get individual diagnoses in batch
        const { supabase } = await import('./supabase');
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const regularPatientIds = patientIds.filter(id => id && !id.startsWith('anonymous-'));
          const anonymousPatientIds = patientIds.filter(id => id && id.startsWith('anonymous-'));

          // Get regular patient diagnoses
          if (regularPatientIds.length > 0) {
            const { data: diagnoses } = await supabase
              .from('diagnoses')
              .select('*')
              .eq('user_id', user.id)
              .in('patient_id', regularPatientIds)
              .order('created_at', { ascending: false });

            if (diagnoses) {
              diagnoses.forEach(diagnosis => {
                const patientId = diagnosis.patient_id;
                if (!diagnosesByPatient.has(patientId)) {
                  diagnosesByPatient.set(patientId, []);
                }
                diagnosesByPatient.get(patientId)!.push(diagnosis);
              });
            }
          }

          // Handle anonymous patients
          if (anonymousPatientIds.length > 0) {
            const diagnosisIds = anonymousPatientIds.map(id => id.replace('anonymous-', ''));
            const { data: diagnoses } = await supabase
              .from('diagnoses')
              .select('*')
              .eq('user_id', user.id)
              .in('id', diagnosisIds);

            if (diagnoses) {
              diagnoses.forEach(diagnosis => {
                const anonymousPatientId = `anonymous-${diagnosis.id}`;
                diagnosesByPatient.set(anonymousPatientId, [diagnosis]);
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching batch patient diagnoses:', error);
    }

    return diagnosesByPatient;
  }

  static async getPatientsWithUndispensedMedications(
    activeMode?: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    patients: UndispensedMedicationInfo[];
    totalUndispensedCount: number;
    hasAnyUndispensed: boolean;
  }> {
    try {
      console.log('🔍 UndispensedMedicationsService: Checking for undispensed medications', { activeMode, organizationId });

      // Get all patients with their diagnoses using mode-aware service
      const { data: patients, error } = activeMode
        ? await ModeAwarePatientService.getPatients(activeMode, organizationId)
        : await PatientService.getPatients();
      if (error || !patients) {
        console.log('🔍 UndispensedMedicationsService: No patients found or error:', error);
        return { patients: [], totalUndispensedCount: 0, hasAnyUndispensed: false };
      }

      console.log('🔍 UndispensedMedicationsService: Found', patients.length, 'patients');

      // Get stored dispensing records from localStorage
      const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
      const individualDispensed = JSON.parse(localStorage.getItem('individualDrugDispensed') || '[]');

      const undispensedPatients: UndispensedMedicationInfo[] = [];
      let totalUndispensedCount = 0;

      // Optimize: Get all diagnoses for all patients in batch queries instead of individual calls
      const patientIds = patients.map(p => p.id).filter(Boolean);
      console.log('🔍 UndispensedMedicationsService: Patient IDs:', patientIds);
      const allDiagnoses = await this.getBatchPatientDiagnoses(patientIds, activeMode, organizationId);
      console.log('🔍 UndispensedMedicationsService: Found diagnoses for', allDiagnoses.size, 'patients');

      // For each patient, check their diagnoses for undispensed medications
      for (const patient of patients) {
        try {
          const patientDiagnoses = allDiagnoses.get(patient.id) || [];
          console.log(`🔍 UndispensedMedicationsService: Patient ${patient.patient_name} (${patient.id}) has ${patientDiagnoses.length} diagnoses`);

          if (patientDiagnoses.length === 0) {
            // Skip patients that don't have diagnoses
            continue;
          }

          const patientUndispensedDrugs: UndispensedMedicationInfo[] = [];

          // Check each diagnosis for undispensed medications
          for (const diagnosis of patientDiagnoses) {
            console.log(`🔍 UndispensedMedicationsService: Checking diagnosis ${diagnosis.id} for patient ${patient.patient_name}`);
            console.log(`🔍 UndispensedMedicationsService: Diagnosis has ${diagnosis.inventory_drugs?.length || 0} inventory drugs`);

            // Skip if entire diagnosis has been dispensed
            if (recordedDispensings.includes(diagnosis.id)) {
              console.log(`🔍 UndispensedMedicationsService: Diagnosis ${diagnosis.id} already fully dispensed`);
              continue;
            }

            // Check individual drugs in this diagnosis
            if (diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0) {
              const undispensedDrugs: Array<{
                drugName: string;
                drugIndex: number;
                quantity: number;
              }> = [];

              diagnosis.inventory_drugs.forEach((drug: any, index: number) => {
                const drugKey = `${diagnosis.id}-${index}`;

                // If this individual drug hasn't been dispensed
                if (!individualDispensed.includes(drugKey)) {
                  undispensedDrugs.push({
                    drugName: drug.drug_name,
                    drugIndex: index,
                    quantity: drug.dispense_quantity || 1
                  });
                  totalUndispensedCount++;
                }
              });

              // If there are undispensed drugs for this diagnosis
              if (undispensedDrugs.length > 0) {
                patientUndispensedDrugs.push({
                  patientId: patient.id,
                  patientName: patient.patient_name,
                  diagnosisId: diagnosis.id,
                  primaryDiagnosis: diagnosis.primary_diagnosis,
                  undispensedDrugs
                });
              }
            }
          }

          // Add this patient if they have any undispensed medications
          if (patientUndispensedDrugs.length > 0) {
            undispensedPatients.push(...patientUndispensedDrugs);
          }

        } catch (err) {
          console.warn(`Failed to check undispensed medications for patient ${patient.id}:`, err);
          continue;
        }
      }

      return {
        patients: undispensedPatients,
        totalUndispensedCount,
        hasAnyUndispensed: undispensedPatients.length > 0
      };

    } catch (error) {
      console.error('Error checking for undispensed medications:', error);
      return { patients: [], totalUndispensedCount: 0, hasAnyUndispensed: false };
    }
  }

  static async getPatientUndispensedMedications(
    patientId: string,
    activeMode?: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    undispensedDrugs: UndispensedMedicationInfo[];
    hasUndispensed: boolean;
  }> {
    try {
      const { data: patient, error } = activeMode
        ? await ModeAwarePatientService.getPatientById(patientId, activeMode, organizationId)
        : await PatientService.getPatientById(patientId);
      if (error || !patient?.diagnoses) {
        return { undispensedDrugs: [], hasUndispensed: false };
      }

      // Get stored dispensing records from localStorage
      const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
      const individualDispensed = JSON.parse(localStorage.getItem('individualDrugDispensed') || '[]');

      const undispensedDrugs: UndispensedMedicationInfo[] = [];

      // Check each diagnosis for undispensed medications
      for (const diagnosis of patient.diagnoses) {
        // Skip if entire diagnosis has been dispensed
        if (recordedDispensings.includes(diagnosis.id)) {
          continue;
        }

        // Check individual drugs in this diagnosis
        if (diagnosis.inventory_drugs && diagnosis.inventory_drugs.length > 0) {
          const undispensedDrugsForDiagnosis: Array<{
            drugName: string;
            drugIndex: number;
            quantity: number;
          }> = [];

          diagnosis.inventory_drugs.forEach((drug: any, index: number) => {
            const drugKey = `${diagnosis.id}-${index}`;
            
            // If this individual drug hasn't been dispensed
            if (!individualDispensed.includes(drugKey)) {
              undispensedDrugsForDiagnosis.push({
                drugName: drug.drug_name,
                drugIndex: index,
                quantity: drug.dispense_quantity || 1
              });
            }
          });

          // If there are undispensed drugs for this diagnosis
          if (undispensedDrugsForDiagnosis.length > 0) {
            undispensedDrugs.push({
              patientId: patient.id,
              patientName: patient.patient_name,
              diagnosisId: diagnosis.id,
              primaryDiagnosis: diagnosis.primary_diagnosis,
              undispensedDrugs: undispensedDrugsForDiagnosis
            });
          }
        }
      }

      return {
        undispensedDrugs,
        hasUndispensed: undispensedDrugs.length > 0
      };

    } catch (error) {
      console.error(`Error checking undispensed medications for patient ${patientId}:`, error);
      return { undispensedDrugs: [], hasUndispensed: false };
    }
  }
}