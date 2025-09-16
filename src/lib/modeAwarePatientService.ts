import { supabase } from './supabase';
import { OrganizationPatientService } from './organizationPatientService';
import type { PatientProfile, Diagnosis } from '@/types/database';
import type { OrganizationPatient, OrganizationDiagnosis } from '@/types/organization';
import type { UserWorkingMode } from '@/contexts/MultiOrgUserModeContext';

export class ModeAwarePatientService {
  // Create or update a patient profile from diagnosis data based on active mode
  static async savePatientFromDiagnosis(
    diagnosis: Diagnosis | OrganizationDiagnosis,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (PatientProfile | OrganizationPatient) | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization patient service
        const orgDiagnosis = {
          ...diagnosis,
          organization_id: organizationId
        } as OrganizationDiagnosis;

        const { data: orgData, error: orgError } = await OrganizationPatientService.savePatientFromDiagnosis(orgDiagnosis);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual patient service
        const result = await this.saveIndividualPatientFromDiagnosis(diagnosis as Diagnosis);
        return { ...result, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error saving patient from diagnosis:', error);
      return { data: null, error: 'Failed to save patient', mode: 'individual' };
    }
  }

  // Get patients based on active mode with diagnosis information
  static async getPatients(
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: ((PatientProfile | OrganizationPatient) & {
      diagnosis_count: number;
      last_diagnosis: string;
      last_diagnosis_severity: string;
      last_visit_date?: string;
    })[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Get organization patients with diagnosis information using optimized queries
        console.log('Fetching organization patients for organizationId:', organizationId);

        // First, get all patients
        const { data: patientsData, error: patientsError } = await supabase
          .from('organization_patients')
          .select(`
            *,
            last_diagnosis_id
          `)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        console.log('Organization patients query result:', { patientsData, patientsError });

        if (patientsError) {
          console.error('Error fetching organization patients:', patientsError);
          return { data: null, error: patientsError.message, mode: 'organization' };
        }

        if (!patientsData || patientsData.length === 0) {
          return { data: [], error: null, mode: 'organization' };
        }

        // Bulk fetch all diagnosis data for all patients in a single query
        const patientIds = patientsData.map(p => p.patient_id).filter(Boolean);
        const patientNames = patientsData.map(p => p.patient_name).filter(Boolean);

        const diagnosisFilters = [];
        patientIds.forEach(id => diagnosisFilters.push(`patient_id.eq.${id}`));
        patientNames.forEach(name => diagnosisFilters.push(`patient_name.eq.${name}`));

        const { data: allDiagnoses } = await supabase
          .from('organization_diagnoses')
          .select('patient_id, patient_name, primary_diagnosis, severity_level, created_at')
          .eq('organization_id', organizationId)
          .or(diagnosisFilters.join(','))
          .order('created_at', { ascending: false });

        // Group diagnoses by patient
        const diagnosisByPatient = new Map();
        (allDiagnoses || []).forEach(diagnosis => {
          const key = diagnosis.patient_id || diagnosis.patient_name;
          if (!diagnosisByPatient.has(key)) {
            diagnosisByPatient.set(key, []);
          }
          diagnosisByPatient.get(key).push(diagnosis);
        });

        // Enrich patients with their diagnosis data
        const enrichedPatients = patientsData.map(patient => {
          const patientKey = patient.patient_id || patient.patient_name;
          const patientDiagnoses = diagnosisByPatient.get(patientKey) || [];
          const lastDiagnosis = patientDiagnoses[0];

          return {
            ...patient,
            diagnosis_count: patientDiagnoses.length,
            last_diagnosis: lastDiagnosis?.primary_diagnosis || 'No diagnosis',
            last_diagnosis_severity: lastDiagnosis?.severity_level || 'unknown',
            last_visit_date: lastDiagnosis?.created_at || patient.created_at
          };
        });

        return { data: enrichedPatients, error: null, mode: 'organization' };
      } else {
        // Get individual patients with diagnosis information using optimized queries
        console.log('Fetching individual patients for user_id:', user.id);
        const { data: patientsData, error: patientsError } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        console.log('Individual patients query result:', { patientsData, patientsError });

        if (patientsError) {
          console.error('Error fetching individual patients:', patientsError);
          return { data: null, error: patientsError.message, mode: 'individual' };
        }

        if (!patientsData || patientsData.length === 0) {
          return { data: [], error: null, mode: 'individual' };
        }

        // Bulk fetch all diagnosis data for all patients in a single query
        const patientIds = patientsData.map(p => p.patient_id).filter(Boolean);
        const patientNames = patientsData.map(p => p.patient_name).filter(Boolean);

        const diagnosisFilters = [];
        patientIds.forEach(id => diagnosisFilters.push(`patient_id.eq.${id}`));
        patientNames.forEach(name => diagnosisFilters.push(`patient_name.eq.${name}`));

        const { data: allDiagnoses } = await supabase
          .from('diagnoses')
          .select('patient_id, patient_name, primary_diagnosis, severity_level, created_at')
          .eq('user_id', user.id)
          .or(diagnosisFilters.join(','))
          .order('created_at', { ascending: false });

        // Group diagnoses by patient
        const diagnosisByPatient = new Map();
        (allDiagnoses || []).forEach(diagnosis => {
          const key = diagnosis.patient_id || diagnosis.patient_name;
          if (!diagnosisByPatient.has(key)) {
            diagnosisByPatient.set(key, []);
          }
          diagnosisByPatient.get(key).push(diagnosis);
        });

        // Enrich patients with their diagnosis data
        const enrichedPatients = patientsData.map(patient => {
          const patientKey = patient.patient_id || patient.patient_name;
          const patientDiagnoses = diagnosisByPatient.get(patientKey) || [];
          const lastDiagnosis = patientDiagnoses[0];

          return {
            ...patient,
            diagnosis_count: patientDiagnoses.length,
            last_diagnosis: lastDiagnosis?.primary_diagnosis || 'No diagnosis',
            last_diagnosis_severity: lastDiagnosis?.severity_level || 'unknown',
            last_visit_date: lastDiagnosis?.created_at || patient.created_at
          };
        });

        return { data: enrichedPatients, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      return { data: null, error: 'Failed to fetch patients', mode: 'individual' };
    }
  }

  // Search patients based on active mode with diagnosis information
  static async searchPatients(
    searchQuery: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: ((PatientProfile | OrganizationPatient) & {
      diagnosis_count: number;
      last_diagnosis: string;
      last_diagnosis_severity: string;
      last_visit_date?: string;
    })[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Search organization patients with diagnosis information
        const { data: patientsData, error: patientsError } = await supabase
          .from('organization_patients')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .or(`patient_name.ilike.%${searchQuery}%,patient_id.ilike.%${searchQuery}%`)
          .order('created_at', { ascending: false });

        if (patientsError) {
          console.error('Error searching organization patients:', patientsError);
          return { data: null, error: patientsError.message, mode: 'organization' };
        }

        // Enrich with diagnosis information
        const enrichedPatients = await Promise.all(
          (patientsData || []).map(async (patient) => {
            // Get diagnosis count and last diagnosis
            const { data: diagnosisData, error: diagnosisError } = await supabase
              .from('organization_diagnoses')
              .select('id, primary_diagnosis, severity_level, created_at')
              .eq('organization_id', organizationId)
              .or(`patient_id.eq.${patient.patient_id},patient_name.eq.${patient.patient_name}`)
              .order('created_at', { ascending: false });

            const diagnosis_count = diagnosisData?.length || 0;
            const lastDiagnosis = diagnosisData?.[0];

            return {
              ...patient,
              diagnosis_count,
              last_diagnosis: lastDiagnosis?.primary_diagnosis || 'No diagnosis',
              last_diagnosis_severity: lastDiagnosis?.severity_level || 'unknown',
              last_visit_date: lastDiagnosis?.created_at || patient.created_at
            };
          })
        );

        return { data: enrichedPatients, error: null, mode: 'organization' };
      } else {
        // Search individual patients with diagnosis information
        const { data: patientsData, error: patientsError } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('user_id', user.id)
          .or(`patient_name.ilike.%${searchQuery}%,patient_id.ilike.%${searchQuery}%`)
          .order('created_at', { ascending: false });

        if (patientsError) {
          console.error('Error searching individual patients:', patientsError);
          return { data: null, error: patientsError.message, mode: 'individual' };
        }

        // Enrich with diagnosis information
        const enrichedPatients = await Promise.all(
          (patientsData || []).map(async (patient) => {
            // Get diagnosis count and last diagnosis
            const { data: diagnosisData, error: diagnosisError } = await supabase
              .from('diagnoses')
              .select('id, primary_diagnosis, severity_level, created_at')
              .eq('user_id', user.id)
              .or(`patient_id.eq.${patient.patient_id},patient_name.eq.${patient.patient_name}`)
              .order('created_at', { ascending: false });

            const diagnosis_count = diagnosisData?.length || 0;
            const lastDiagnosis = diagnosisData?.[0];

            return {
              ...patient,
              diagnosis_count,
              last_diagnosis: lastDiagnosis?.primary_diagnosis || 'No diagnosis',
              last_diagnosis_severity: lastDiagnosis?.severity_level || 'unknown',
              last_visit_date: lastDiagnosis?.created_at || patient.created_at
            };
          })
        );

        return { data: enrichedPatients, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error searching patients:', error);
      return { data: null, error: 'Failed to search patients', mode: 'individual' };
    }
  }

  // Get a single patient with their full diagnosis history based on active mode
  static async getPatientById(
    patientId: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: ((PatientProfile | OrganizationPatient) & { diagnoses: (Diagnosis | OrganizationDiagnosis)[] }) | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization patient service
        const { data: orgData, error: orgError } = await OrganizationPatientService.getOrganizationPatientById(patientId, organizationId);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual patient service

        // Check if this is an anonymous patient (format: anonymous-{diagnosisId})
        if (patientId.startsWith('anonymous-')) {
          const diagnosisId = patientId.replace('anonymous-', '');

          // Get the diagnosis
          const { data: diagnosis, error: diagnosisError } = await supabase
            .from('diagnoses')
            .select('*')
            .eq('id', diagnosisId)
            .eq('user_id', user.id)
            .single();

          if (diagnosisError) {
            console.error('Error fetching anonymous patient diagnosis:', diagnosisError);
            return { data: null, error: diagnosisError.message, mode: 'individual' };
          }

          // Create a mock patient profile for anonymous patients
          const anonymousPatient = {
            id: patientId,
            patient_name: diagnosis.patient_name || 'Anonymous Patient',
            patient_id: diagnosis.patient_id,
            date_of_birth: diagnosis.date_of_birth,
            gender: diagnosis.gender,
            contact_info: diagnosis.contact_info,
            emergency_contact: diagnosis.emergency_contact,
            medical_history: diagnosis.medical_history,
            allergies: diagnosis.allergies,
            current_medications: diagnosis.current_medications,
            insurance_info: diagnosis.insurance_info,
            user_id: user.id,
            created_at: diagnosis.created_at,
            updated_at: diagnosis.updated_at,
            last_diagnosis_date: diagnosis.created_at,
            last_symptoms: diagnosis.symptoms,
            diagnoses: [diagnosis]
          };

          return { data: anonymousPatient, error: null, mode: 'individual' };
        }

        // For regular patients, get the patient profile first
        const { data: patient, error: patientError } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('id', patientId)
          .eq('user_id', user.id)
          .single();

        if (patientError) {
          console.error('Error fetching patient profile:', patientError);
          return { data: null, error: patientError.message, mode: 'individual' };
        }

        // Get patient diagnoses using the existing method
        const { data: diagnoses, error: diagnosesError } = await this.getPatientDiagnoses(patientId, activeMode, organizationId);

        if (diagnosesError) {
          console.error('Error fetching patient diagnoses:', diagnosesError);
          return { data: null, error: diagnosesError, mode: 'individual' };
        }

        // Combine patient with diagnoses
        const patientWithDiagnoses = {
          ...patient,
          diagnoses: diagnoses || []
        };

        return { data: patientWithDiagnoses, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error getting patient by ID:', error);
      return { data: null, error: 'Failed to get patient', mode: 'individual' };
    }
  }

  // Get patient diagnoses based on active mode
  static async getPatientDiagnoses(
    patientId: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (Diagnosis | OrganizationDiagnosis)[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization patient service
        const { data: orgData, error: orgError } = await OrganizationPatientService.getPatientDiagnoses(patientId, organizationId);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual patient service with comprehensive matching logic
        let diagnoses: any[] = [];
        let diagnosesError = null;

        console.log('Fetching diagnoses for patientId:', patientId);

        // First try to get diagnoses by patient_id if available
        if (patientId && patientId !== 'undefined' && patientId !== 'null') {
          const { data, error } = await supabase
            .from('diagnoses')
            .select('*')
            .eq('user_id', user.id)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

          console.log('Diagnoses found by patient_id:', data?.length || 0);
          diagnoses = data || [];
          diagnosesError = error;
        }

        // If no diagnoses found by patient_id, try searching by patient name
        // This handles cases where diagnoses were created without patient_id
        if (diagnoses.length === 0 && !diagnosesError) {
          console.log('No diagnoses found by patient_id, trying to search by name...');

          // Try to get patient profile directly to get the name
          let patient = null;

          // First try to get from patient_profiles table
          if (patientId && !patientId.startsWith('anonymous-')) {
            const { data: patientData } = await supabase
              .from('patient_profiles')
              .select('*')
              .eq('user_id', user.id)
              .eq('id', patientId)
              .maybeSingle();
            patient = patientData;
          }

          if (patient && patient.patient_name) {
            console.log('Trying to find diagnoses by patient_name:', patient.patient_name);

            // Try by name + date_of_birth if available
            if (patient.date_of_birth) {
              const { data, error } = await supabase
                .from('diagnoses')
                .select('*')
                .eq('user_id', user.id)
                .eq('patient_name', patient.patient_name)
                .eq('date_of_birth', patient.date_of_birth)
                .order('created_at', { ascending: false });

              console.log('Diagnoses found by name + DOB:', data?.length || 0);
              diagnoses = [...diagnoses, ...(data || [])];
              diagnosesError = error;
            }

            // Finally, fall back to name matching for backward compatibility
            if (diagnoses.length === 0 && !diagnosesError) {
              const { data, error } = await supabase
                .from('diagnoses')
                .select('*')
                .eq('user_id', user.id)
                .eq('patient_name', patient.patient_name)
                .order('created_at', { ascending: false });

              console.log('Diagnoses found by name only:', data?.length || 0);

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
          }
        }

        if (diagnosesError) {
          console.error('Error fetching patient diagnoses:', diagnosesError);
          return { data: null, error: diagnosesError.message, mode: 'individual' };
        }

        console.log('Total diagnoses found:', diagnoses.length);
        return { data: diagnoses, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error fetching patient diagnoses:', error);
      return { data: null, error: 'Failed to fetch patient diagnoses', mode: 'individual' };
    }
  }

  // Delete patient based on active mode
  static async deletePatient(
    patientId: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated', mode: 'individual' };
    }

    try {
      console.log('ModeAwarePatientService.deletePatient called with:', { patientId, activeMode, organizationId });

      if (activeMode === 'organization' && organizationId) {
        console.log('Using organization patient service for deletion');
        // Use organization patient service
        const { error: orgError } = await OrganizationPatientService.deleteOrganizationPatient(patientId);
        console.log('Organization deletion result:', { orgError });
        return { error: orgError, mode: 'organization' };
      } else {
        // Use individual patient service
        // Handle anonymous patients (format: anonymous-{diagnosisId})
        if (patientId.startsWith('anonymous-')) {
          const diagnosisId = patientId.replace('anonymous-', '');

          // Delete only the specific diagnosis for anonymous patients
          const { error: diagnosisError } = await supabase
            .from('diagnoses')
            .delete()
            .eq('id', diagnosisId)
            .eq('user_id', user.id);

          if (diagnosisError) {
            console.error('Error deleting anonymous patient diagnosis:', diagnosisError);
            return { error: diagnosisError.message, mode: 'individual' };
          }

          return { error: null, mode: 'individual' };
        }

        // For regular patients with profiles, delete both profile and all their diagnoses
        try {
          // First, get the patient to find their identifying information
          const { data: patient, error: fetchError } = await supabase
            .from('patient_profiles')
            .select('*')
            .eq('id', patientId)
            .eq('user_id', user.id)
            .single();

          if (fetchError) {
            console.error('Error fetching patient for deletion:', fetchError);
            return { error: fetchError.message, mode: 'individual' };
          }

          // Delete all diagnoses for this patient using comprehensive matching
          let diagnosesError = null;

          // First try to delete by patient_id if available
          if (patient.patient_id) {
            const { error } = await supabase
              .from('diagnoses')
              .delete()
              .eq('patient_id', patient.patient_id)
              .eq('user_id', user.id);
            if (error) diagnosesError = error;
          }

          // Also delete by name matching for backward compatibility
          if (!diagnosesError) {
            const { error } = await supabase
              .from('diagnoses')
              .delete()
              .eq('patient_name', patient.patient_name)
              .eq('user_id', user.id);
            // Don't overwrite previous error, but log this one if it exists
            if (error) {
              console.warn('Error deleting diagnoses by name:', error);
            }
          }

          if (diagnosesError) {
            console.error('Error deleting patient diagnoses:', diagnosesError);
            return { error: diagnosesError.message, mode: 'individual' };
          }

          // Delete the patient profile
          const { error: profileError } = await supabase
            .from('patient_profiles')
            .delete()
            .eq('id', patientId)
            .eq('user_id', user.id);

          if (profileError) {
            console.error('Error deleting patient profile:', profileError);
            return { error: profileError.message, mode: 'individual' };
          }

          return { error: null, mode: 'individual' };
        } catch (err) {
          console.error('Unexpected error during patient deletion:', err);
          return { error: 'Failed to delete patient completely', mode: 'individual' };
        }
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      return { error: 'Failed to delete patient', mode: 'individual' };
    }
  }

  // Private method for individual patient service (original method)
  private static async saveIndividualPatientFromDiagnosis(diagnosis: Diagnosis): Promise<{ data: PatientProfile | null; error: string | null }> {
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
          .from('patient_profiles')
          .select('*')
          .eq('user_id', user.id)
          .eq('patient_id', diagnosis.patient_id.trim())
          .maybeSingle();
        existingPatient = data;
        searchError = error;
      }

      // If no patient_id match, try matching by full name + date of birth (if available)
      if (!existingPatient && !searchError && diagnosis.date_of_birth?.trim()) {
        const { data, error } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('user_id', user.id)
          .eq('patient_name', diagnosis.patient_name)
          .eq('date_of_birth', diagnosis.date_of_birth)
          .maybeSingle();
        existingPatient = data;
        searchError = error;
      }

      // If no exact match, try matching by name only (less reliable, but better than creating duplicates)
      if (!existingPatient && !searchError) {
        const { data, error } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('user_id', user.id)
          .eq('patient_name', diagnosis.patient_name)
          .maybeSingle();
        existingPatient = data;
        searchError = error;
      }

      if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error searching for existing patient:', searchError);
        return { data: null, error: 'Failed to check for existing patient' };
      }

      const patientData = {
        patient_name: diagnosis.patient_name,
        patient_id: diagnosis.patient_id || existingPatient?.patient_id || null,
        date_of_birth: diagnosis.date_of_birth || existingPatient?.date_of_birth || null,
        gender: diagnosis.gender || existingPatient?.gender || null,
        contact_info: diagnosis.contact_info || existingPatient?.contact_info || null,
        emergency_contact: diagnosis.emergency_contact || existingPatient?.emergency_contact || null,
        medical_history: diagnosis.medical_history || existingPatient?.medical_history || null,
        allergies: diagnosis.allergies || existingPatient?.allergies || null,
        current_medications: diagnosis.current_medications || existingPatient?.current_medications || null,
        insurance_info: diagnosis.insurance_info || existingPatient?.insurance_info || null,
        last_diagnosis_date: new Date().toISOString(),
        last_symptoms: diagnosis.symptoms || existingPatient?.last_symptoms || null
      };

      if (existingPatient) {
        // Update existing patient
        const { data: updatedPatient, error: updateError } = await supabase
          .from('patient_profiles')
          .update(patientData)
          .eq('id', existingPatient.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating patient:', updateError);
          return { data: null, error: updateError.message };
        }

        return { data: updatedPatient, error: null };
      } else {
        // Create new patient
        const { data: newPatient, error: insertError } = await supabase
          .from('patient_profiles')
          .insert([{
            ...patientData,
            user_id: user.id
          }])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating patient:', insertError);
          return { data: null, error: insertError.message };
        }

        return { data: newPatient, error: null };
      }
    } catch (error) {
      console.error('Error in saveIndividualPatientFromDiagnosis:', error);
      return { data: null, error: 'Failed to save patient profile' };
    }
  }
}