import { supabase } from './supabase';
import { OrganizationService } from './organizationService';
import type { OrganizationPatient, OrganizationDiagnosis } from '@/types/organization';
import type { Diagnosis } from '@/types/database';

export class OrganizationPatientService {
  // =====================================================
  // PATIENT MANAGEMENT
  // =====================================================

  static async savePatientFromDiagnosis(diagnosis: OrganizationDiagnosis): Promise<{
    data: OrganizationPatient | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    if (!diagnosis.patient_name) {
      return { data: null, error: 'Patient name is required to save patient profile' };
    }

    try {
      // Check if patient already exists using multiple identifying fields for better matching
      let existingPatient = null;
      let searchError = null;

      // First try to match by patient_id if provided (most reliable)
      if (diagnosis.patient_id?.trim()) {
        const { data, error } = await supabase
          .from('organization_patients')
          .select('*')
          .eq('organization_id', diagnosis.organization_id)
          .eq('patient_id', diagnosis.patient_id.trim())
          .maybeSingle();
        existingPatient = data;
        searchError = error;
      }

      // If no patient_id match, try matching by full name + date of birth (if available)
      if (!existingPatient && !searchError && diagnosis.date_of_birth?.trim()) {
        const { data, error } = await supabase
          .from('organization_patients')
          .select('*')
          .eq('organization_id', diagnosis.organization_id)
          .eq('patient_name', diagnosis.patient_name)
          .eq('date_of_birth', diagnosis.date_of_birth)
          .maybeSingle();
        existingPatient = data;
        searchError = error;
      }

      // Finally, fall back to name matching but only if no other identifiers are available
      if (!existingPatient && !searchError && !diagnosis.patient_id?.trim() && !diagnosis.date_of_birth?.trim()) {
        const fullName = `${diagnosis.patient_name || ''} ${diagnosis.patient_surname || ''}`.trim();
        const { data, error } = await supabase
          .from('organization_patients')
          .select('*')
          .eq('organization_id', diagnosis.organization_id)
          .eq('patient_name', diagnosis.patient_name)
          .maybeSingle();
        existingPatient = data;
        searchError = error;

        // If we found a match by first name only, let's double-check it's really the same patient
        if (existingPatient && diagnosis.patient_surname?.trim()) {
          const existingFullName = `${existingPatient.patient_name || ''} ${existingPatient.patient_surname || ''}`.trim();
          if (existingFullName !== fullName) {
            // Names don't fully match, treat as different patient
            existingPatient = null;
          }
        }
      }

      if (searchError) {
        console.error('Error searching for existing patient:', searchError);
        return { data: null, error: searchError.message };
      }

      const patientData = {
        organization_id: diagnosis.organization_id,
        patient_name: diagnosis.patient_name,
        patient_surname: diagnosis.patient_surname || existingPatient?.patient_surname,
        patient_age: diagnosis.patient_age,
        patient_gender: diagnosis.patient_gender,
        patient_id: diagnosis.patient_id || existingPatient?.patient_id,
        date_of_birth: diagnosis.date_of_birth || existingPatient?.date_of_birth,
        medical_history: [
          ...(existingPatient?.medical_history || []),
          diagnosis.primary_diagnosis
        ].filter(Boolean),
        allergies: diagnosis.allergies ? [diagnosis.allergies] : (existingPatient?.allergies || []),
        current_medications: diagnosis.current_medications ? [diagnosis.current_medications] : (existingPatient?.current_medications || []),
        last_diagnosis_id: diagnosis.id,
        last_visit_date: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id
      };

      if (existingPatient) {
        // Update existing patient
        const { data, error } = await supabase
          .from('organization_patients')
          .update(patientData)
          .eq('id', existingPatient.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating organization patient:', error);
          return { data: null, error: error.message };
        }

        return { data, error: null };
      } else {
        // Create new patient
        const { data, error } = await supabase
          .from('organization_patients')
          .insert([patientData])
          .select()
          .single();

        if (error) {
          console.error('Error creating organization patient:', error);
          return { data: null, error: error.message };
        }

        return { data, error: null };
      }
    } catch (error) {
      console.error('Error in savePatientFromDiagnosis:', error);
      return { data: null, error: 'Failed to save patient' };
    }
  }

  static async getOrganizationPatients(
    organizationId?: string,
    limit = 50,
    offset = 0
  ): Promise<{
    data: (OrganizationPatient & { diagnosis_count: number; last_diagnosis: string })[] | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      // Get all patients with profiles
      const { data: patients, error: patientsError } = await supabase
        .from('organization_patients')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('is_active', true)
        .order('last_visit_date', { ascending: false, nullsFirst: false });

      if (patientsError) {
        console.error('Error fetching organization patients:', patientsError);
        return { data: null, error: patientsError.message };
      }

      // Get all diagnoses for this organization
      const { data: allDiagnoses, error: diagnosesError } = await supabase
        .from('organization_diagnoses')
        .select('id, patient_name, patient_surname, primary_diagnosis, created_at, severity_level, patient_age, patient_gender')
        .eq('organization_id', targetOrgId)
        .order('created_at', { ascending: false });

      if (diagnosesError) {
        console.warn('Error fetching organization diagnoses:', diagnosesError);
        return {
          data: patients?.map(p => ({
            ...p,
            diagnosis_count: 0,
            last_diagnosis: 'No diagnosis',
            last_diagnosis_severity: 'unknown'
          })) || [],
          error: null
        };
      }

      // Process existing patients with improved matching logic
      const processedPatients = (patients || []).map(patient => {
        let patientDiagnoses = [];

        // First try to match by patient_id
        if (patient.patient_id) {
          patientDiagnoses = allDiagnoses.filter(d => d.patient_id === patient.patient_id);
        }

        // If no matches by ID, try by name + date_of_birth
        if (patientDiagnoses.length === 0 && patient.date_of_birth) {
          patientDiagnoses = allDiagnoses.filter(d =>
            d.patient_name === patient.patient_name &&
            d.date_of_birth === patient.date_of_birth
          );
        }

        // Fall back to name matching with surname verification
        if (patientDiagnoses.length === 0) {
          patientDiagnoses = allDiagnoses.filter(d => {
            if (d.patient_name !== patient.patient_name) return false;

            // If both have surnames, they must match
            if (patient.patient_surname && d.patient_surname) {
              return d.patient_surname === patient.patient_surname;
            }

            // If only one has surname, still consider it a match for backward compatibility
            return true;
          });
        }

        const sortedDiagnoses = patientDiagnoses.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return {
          ...patient,
          diagnosis_count: patientDiagnoses.length,
          last_diagnosis: sortedDiagnoses[0]?.primary_diagnosis || 'No diagnosis',
          last_diagnosis_severity: sortedDiagnoses[0]?.severity_level || 'unknown'
        };
      });

      // Apply pagination
      const paginatedData = processedPatients.slice(offset, offset + limit);

      return { data: paginatedData, error: null };
    } catch (error) {
      console.error('Error fetching organization patients:', error);
      return { data: null, error: 'Failed to fetch patients' };
    }
  }

  static async getOrganizationPatientById(
    patientId: string,
    organizationId?: string
  ): Promise<{
    data: (OrganizationPatient & { diagnoses: OrganizationDiagnosis[] }) | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      // Get patient
      const { data: patient, error: patientError } = await supabase
        .from('organization_patients')
        .select('*')
        .eq('id', patientId)
        .eq('organization_id', targetOrgId)
        .single();

      if (patientError) {
        console.error('Error fetching organization patient:', patientError);
        return { data: null, error: patientError.message };
      }

      // Get all diagnoses for this patient using improved matching logic
      let diagnoses = [];
      let diagnosesError = null;

      // First try to get diagnoses by patient_id if available
      if (patient.patient_id) {
        const { data, error } = await supabase
          .from('organization_diagnoses')
          .select('*')
          .eq('organization_id', targetOrgId)
          .eq('patient_id', patient.patient_id)
          .order('created_at', { ascending: false });
        diagnoses = data || [];
        diagnosesError = error;
      }

      // If no diagnoses found by patient_id, try by name + date_of_birth
      if (diagnoses.length === 0 && !diagnosesError && patient.date_of_birth) {
        const { data, error } = await supabase
          .from('organization_diagnoses')
          .select('*')
          .eq('organization_id', targetOrgId)
          .eq('patient_name', patient.patient_name)
          .eq('date_of_birth', patient.date_of_birth)
          .order('created_at', { ascending: false });
        diagnoses = [...diagnoses, ...(data || [])];
        diagnosesError = error;
      }

      // Finally, fall back to name matching for backward compatibility
      if (diagnoses.length === 0 && !diagnosesError) {
        const { data, error } = await supabase
          .from('organization_diagnoses')
          .select('*')
          .eq('organization_id', targetOrgId)
          .eq('patient_name', patient.patient_name)
          .order('created_at', { ascending: false });

        // Filter results to ensure they match the full name if surname is available
        const filteredData = (data || []).filter(diagnosis => {
          if (!patient.patient_surname || !diagnosis.patient_surname) {
            return true; // Include if either doesn't have surname
          }
          return diagnosis.patient_surname === patient.patient_surname;
        });

        diagnoses = [...diagnoses, ...filteredData];
        diagnosesError = error;
      }

      if (diagnosesError) {
        console.warn('Error fetching patient diagnoses:', diagnosesError);
        // Return patient without diagnoses rather than failing
        return {
          data: {
            ...patient,
            diagnoses: []
          },
          error: null
        };
      }

      return {
        data: {
          ...patient,
          diagnoses: diagnoses || []
        },
        error: null
      };
    } catch (error) {
      console.error('Error fetching organization patient by ID:', error);
      return { data: null, error: 'Failed to fetch patient' };
    }
  }

  static async deleteOrganizationPatient(patientId: string): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('organization_patients')
        .update({
          is_active: false,
          updated_by: user.id
        })
        .eq('id', patientId);

      if (error) {
        console.error('Error deleting organization patient:', error);
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in deleteOrganizationPatient:', error);
      return { error: 'Failed to delete patient' };
    }
  }

  static async updateOrganizationPatient(
    patientId: string,
    updates: Partial<OrganizationPatient>
  ): Promise<{ data: OrganizationPatient | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('organization_patients')
      .update({
        ...updates,
        updated_by: user.id
      })
      .eq('id', patientId)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization patient:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }
}