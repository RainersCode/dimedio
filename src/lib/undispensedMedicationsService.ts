import { PatientService } from './patientService';
import { DatabaseService } from './database';

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
  
  static async getPatientsWithUndispensedMedications(): Promise<{
    patients: UndispensedMedicationInfo[];
    totalUndispensedCount: number;
    hasAnyUndispensed: boolean;
  }> {
    try {
      // Get all patients with their diagnoses
      const { data: patients, error } = await PatientService.getPatients();
      if (error || !patients) {
        return { patients: [], totalUndispensedCount: 0, hasAnyUndispensed: false };
      }

      // Get stored dispensing records from localStorage
      const recordedDispensings = JSON.parse(localStorage.getItem('recordedDispensings') || '[]');
      const individualDispensed = JSON.parse(localStorage.getItem('individualDrugDispensed') || '[]');

      const undispensedPatients: UndispensedMedicationInfo[] = [];
      let totalUndispensedCount = 0;

      // For each patient, get their full details including diagnoses
      for (const patient of patients) {
        try {
          const { data: patientDetails, error: detailsError } = await PatientService.getPatientById(patient.id);
          
          if (detailsError || !patientDetails?.diagnoses) {
            continue;
          }

          const patientUndispensedDrugs: UndispensedMedicationInfo[] = [];

          // Check each diagnosis for undispensed medications
          for (const diagnosis of patientDetails.diagnoses) {
            // Skip if entire diagnosis has been dispensed
            if (recordedDispensings.includes(diagnosis.id)) {
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

  static async getPatientUndispensedMedications(patientId: string): Promise<{
    undispensedDrugs: UndispensedMedicationInfo[];
    hasUndispensed: boolean;
  }> {
    try {
      const { data: patient, error } = await PatientService.getPatientById(patientId);
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