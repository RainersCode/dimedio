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
        // Get organization patients with diagnosis information
        console.log('Fetching organization patients for organizationId:', organizationId);
        const { data: patientsData, error: patientsError } = await supabase
          .from('organization_patients')
          .select(`
            *,
            last_diagnosis_id
          `)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });

        console.log('Organization patients query result:', { patientsData, patientsError });

        if (patientsError) {
          console.error('Error fetching organization patients:', patientsError);
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
        // Get individual patients with diagnosis information
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
        // Use individual patient service
        const { data, error } = await supabase
          .from('diagnoses')
          .select('*')
          .eq('user_id', user.id)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching patient diagnoses:', error);
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error fetching patient diagnoses:', error);
      return { data: null, error: 'Failed to fetch patient diagnoses', mode: 'individual' };
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