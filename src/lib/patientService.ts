import { supabase } from './supabase';
import type { PatientProfile, Diagnosis } from '@/types/database';

export class PatientService {
  // Create or update a patient profile from diagnosis data
  static async savePatientFromDiagnosis(diagnosis: Diagnosis): Promise<{ data: PatientProfile | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    if (!diagnosis.patient_name) {
      return { data: null, error: 'Patient name is required to save patient profile' };
    }

    // Check if patient already exists
    const { data: existingPatient, error: searchError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('patient_name', diagnosis.patient_name)
      .maybeSingle();

    if (searchError) {
      console.error('Error searching for existing patient:', searchError);
      return { data: null, error: searchError.message };
    }

    const patientData = {
      user_id: user.id,
      patient_name: diagnosis.patient_name,
      patient_age: diagnosis.patient_age,
      patient_gender: diagnosis.patient_gender,
      medical_history: [
        ...(existingPatient?.medical_history || []),
        diagnosis.primary_diagnosis
      ].filter(Boolean),
      allergies: diagnosis.allergies ? [diagnosis.allergies] : (existingPatient?.allergies || []),
      current_medications: diagnosis.current_medications ? [diagnosis.current_medications] : (existingPatient?.current_medications || []),
      patient_id: diagnosis.patient_id || existingPatient?.patient_id,
      date_of_birth: diagnosis.date_of_birth || existingPatient?.date_of_birth,
      last_diagnosis_id: diagnosis.id,
      last_visit_date: new Date().toISOString(),
    };

    if (existingPatient) {
      // Update existing patient
      const { data, error } = await supabase
        .from('patient_profiles')
        .update(patientData)
        .eq('id', existingPatient.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating patient:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } else {
      // Create new patient
      const { data, error } = await supabase
        .from('patient_profiles')
        .insert([patientData])
        .select()
        .single();

      if (error) {
        console.error('Error creating patient:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    }
  }

  // Get all patients for the current user
  static async getPatients(limit = 50, offset = 0): Promise<{ data: (PatientProfile & { diagnosis_count: number; last_diagnosis: string })[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // First, get all patients with profiles
    const { data: patients, error: patientsError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('last_visit_date', { ascending: false, nullsFirst: false });

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return { data: null, error: patientsError.message };
    }

    // Get all diagnoses
    const { data: allDiagnoses, error: diagnosesError } = await supabase
      .from('diagnoses')
      .select('id, patient_name, primary_diagnosis, created_at, severity_level, patient_age, patient_gender')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (diagnosesError) {
      console.warn('Error fetching diagnoses:', diagnosesError);
      return { data: patients?.map(p => ({ ...p, diagnosis_count: 0, last_diagnosis: 'No diagnosis', last_diagnosis_severity: 'unknown' })) || [], error: null };
    }

    // Separate diagnoses into those with profiles and anonymous ones
    const existingPatientNames = patients?.map(p => p.patient_name) || [];
    const profileDiagnoses = allDiagnoses?.filter(d => d.patient_name && existingPatientNames.includes(d.patient_name)) || [];
    const anonymousDiagnoses = allDiagnoses?.filter(d => !d.patient_name || !existingPatientNames.includes(d.patient_name)) || [];

    // Process existing patients
    const processedPatients = (patients || []).map(patient => {
      const patientDiagnoses = profileDiagnoses.filter(d => d.patient_name === patient.patient_name);
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

    // Create anonymous patient entries grouped by diagnosis ID
    const anonymousPatients = anonymousDiagnoses.map((diagnosis, index) => {
      return {
        id: `anonymous-${diagnosis.id}`,
        user_id: user.id,
        patient_name: 'Anonymous Patient',
        patient_age: diagnosis.patient_age || null,
        patient_gender: diagnosis.patient_gender || null,
        patient_id: null,
        date_of_birth: null,
        allergies: [],
        current_medications: [],
        medical_history: [],
        contact_info: {},
        insurance_info: {},
        emergency_contacts: [],
        last_visit_date: diagnosis.created_at,
        created_at: diagnosis.created_at,
        updated_at: diagnosis.created_at,
        diagnosis_count: 1,
        last_diagnosis: diagnosis.primary_diagnosis || 'No diagnosis',
        last_diagnosis_severity: diagnosis.severity_level || 'unknown'
      };
    });

    // Combine and sort all patients by last visit date
    const allPatients = [...processedPatients, ...anonymousPatients].sort((a, b) => 
      new Date(b.last_visit_date || b.created_at).getTime() - new Date(a.last_visit_date || a.created_at).getTime()
    );

    // Apply pagination
    const paginatedData = allPatients.slice(offset, offset + limit);

    return { data: paginatedData, error: null };
  }

  // Get a single patient with their full diagnosis history
  static async getPatientById(patientId: string): Promise<{ data: (PatientProfile & { diagnoses: Diagnosis[] }) | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Check if this is an anonymous patient
    if (patientId.startsWith('anonymous-')) {
      const diagnosisId = patientId.replace('anonymous-', '');
      
      // Get the specific diagnosis for this anonymous patient
      const { data: diagnosis, error: diagnosisError } = await supabase
        .from('diagnoses')
        .select('*')
        .eq('id', diagnosisId)
        .eq('user_id', user.id)
        .single();

      if (diagnosisError) {
        console.error('Error fetching anonymous patient diagnosis:', diagnosisError);
        return { data: null, error: diagnosisError.message };
      }

      // Create anonymous patient profile
      const anonymousPatient = {
        id: patientId,
        user_id: user.id,
        patient_name: 'Anonymous Patient',
        patient_age: diagnosis.patient_age || null,
        patient_gender: diagnosis.patient_gender || null,
        patient_id: null,
        date_of_birth: null,
        allergies: [],
        current_medications: [],
        medical_history: [],
        contact_info: {},
        insurance_info: {},
        emergency_contacts: [],
        last_visit_date: diagnosis.created_at,
        created_at: diagnosis.created_at,
        updated_at: diagnosis.created_at,
        diagnoses: [diagnosis]
      };

      return { data: anonymousPatient, error: null };
    }

    // Handle regular patients with profiles
    const { data: patient, error: patientError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single();

    if (patientError) {
      console.error('Error fetching patient:', patientError);
      return { data: null, error: patientError.message };
    }

    // Get all diagnoses for this patient
    const { data: diagnoses, error: diagnosesError } = await supabase
      .from('diagnoses')
      .select('*')
      .eq('user_id', user.id)
      .eq('patient_name', patient.patient_name)
      .order('created_at', { ascending: false });

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
  }


  // Delete a patient profile
  static async deletePatient(patientId: string): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    // Check if this is an anonymous patient (format: anonymous-{diagnosisId})
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
        return { error: diagnosisError.message };
      }

      return { error: null };
    }

    // For regular patients with profiles, delete both profile and all their diagnoses
    try {
      // First, get the patient to find their name
      const { data: patient, error: fetchError } = await supabase
        .from('patient_profiles')
        .select('patient_name')
        .eq('id', patientId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching patient for deletion:', fetchError);
        return { error: fetchError.message };
      }

      // Delete all diagnoses for this patient
      const { error: diagnosesError } = await supabase
        .from('diagnoses')
        .delete()
        .eq('patient_name', patient.patient_name)
        .eq('user_id', user.id);

      if (diagnosesError) {
        console.error('Error deleting patient diagnoses:', diagnosesError);
        return { error: diagnosesError.message };
      }

      // Delete the patient profile
      const { error: profileError } = await supabase
        .from('patient_profiles')
        .delete()
        .eq('id', patientId)
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error deleting patient profile:', profileError);
        return { error: profileError.message };
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected error during patient deletion:', err);
      return { error: 'Failed to delete patient completely' };
    }
  }

  // Update patient profile
  static async updatePatient(patientId: string, updates: Partial<PatientProfile>): Promise<{ data: PatientProfile | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('patient_profiles')
      .update(updates)
      .eq('id', patientId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating patient:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }
}