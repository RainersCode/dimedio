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

    // First, get all patients
    const { data: patients, error: patientsError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('last_visit_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return { data: null, error: patientsError.message };
    }

    if (!patients || patients.length === 0) {
      return { data: [], error: null };
    }

    // Get all diagnoses for these patients
    const { data: diagnoses, error: diagnosesError } = await supabase
      .from('diagnoses')
      .select('id, patient_name, primary_diagnosis, created_at, severity_level')
      .eq('user_id', user.id)
      .in('patient_name', patients.map(p => p.patient_name))
      .order('created_at', { ascending: false });

    if (diagnosesError) {
      console.warn('Error fetching diagnoses:', diagnosesError);
      // Continue without diagnosis data rather than failing completely
    }

    // Process the data to add diagnosis counts and last diagnosis
    const processedData = patients.map(patient => {
      const patientDiagnoses = diagnoses?.filter(d => d.patient_name === patient.patient_name) || [];
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

    return { data: processedData, error: null };
  }

  // Get a single patient with their full diagnosis history
  static async getPatientById(patientId: string): Promise<{ data: (PatientProfile & { diagnoses: Diagnosis[] }) | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Get the patient profile
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

    const { error } = await supabase
      .from('patient_profiles')
      .delete()
      .eq('id', patientId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting patient:', error);
      return { error: error.message };
    }

    return { error: null };
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