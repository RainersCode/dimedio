import { supabase } from './supabase';
import { ModeAwarePatientService } from './modeAwarePatientService';
import { ModeAwareDrugInventoryService } from './modeAwareDrugInventoryService';
import type {
  DiagnosisRequest,
  Diagnosis,
  DiagnosisResult,
  DiagnosisDrugSuggestion
} from '@/types/database';
import type {
  OrganizationDiagnosis,
  OrganizationDiagnosisRequest
} from '@/types/organization';
import type { UserWorkingMode } from '@/contexts/UserModeContext';

export class ModeAwareDiagnosisService {
  // Create diagnosis based on active mode
  static async createDiagnosis(
    diagnosisData: DiagnosisRequest | OrganizationDiagnosisRequest,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (Diagnosis | OrganizationDiagnosis) | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Create organization diagnosis
        const orgDiagnosisData = {
          ...diagnosisData,
          organization_id: organizationId,
          created_by: user.id
        } as OrganizationDiagnosisRequest;

        const { data, error } = await supabase
          .from('organization_diagnoses')
          .insert([orgDiagnosisData])
          .select()
          .single();

        if (error) {
          console.error('Error creating organization diagnosis:', error);
          return { data: null, error: error.message, mode: 'organization' };
        }

        return { data, error: null, mode: 'organization' };
      } else {
        // Create individual diagnosis
        const individualDiagnosisData = {
          ...diagnosisData,
          user_id: user.id
        } as DiagnosisRequest;

        const { data, error } = await supabase
          .from('diagnoses')
          .insert([individualDiagnosisData])
          .select()
          .single();

        if (error) {
          console.error('Error creating individual diagnosis:', error);
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error creating diagnosis:', error);
      return { data: null, error: 'Failed to create diagnosis', mode: 'individual' };
    }
  }

  // Get diagnoses based on active mode
  static async getDiagnoses(
    activeMode: UserWorkingMode,
    organizationId?: string | null,
    limit = 50
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
        // Get organization diagnoses
        const { data, error } = await supabase
          .from('organization_diagnoses')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching organization diagnoses:', error);
          return { data: null, error: error.message, mode: 'organization' };
        }

        return { data, error: null, mode: 'organization' };
      } else {
        // Get individual diagnoses
        const { data, error } = await supabase
          .from('diagnoses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching individual diagnoses:', error);
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
      return { data: null, error: 'Failed to fetch diagnoses', mode: 'individual' };
    }
  }

  // Get drug suggestions for diagnosis based on active mode
  static async getDrugSuggestionsForDiagnosis(
    symptoms: string[],
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: DiagnosisDrugSuggestion[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    try {
      // Use mode-aware drug inventory service to get suggestions
      const { data, error, mode } = await ModeAwareDrugInventoryService.getDrugSuggestionsForSymptoms(
        symptoms,
        activeMode,
        organizationId
      );

      return { data, error, mode };
    } catch (error) {
      console.error('Error getting drug suggestions for diagnosis:', error);
      return { data: null, error: 'Failed to get drug suggestions', mode: 'individual' };
    }
  }

  // Process AI diagnosis and save results based on active mode
  static async processAIDiagnosis(
    diagnosisRequest: DiagnosisRequest | OrganizationDiagnosisRequest,
    aiResults: DiagnosisResult,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    diagnosis: (Diagnosis | OrganizationDiagnosis) | null;
    patient: any | null;
    drugSuggestions: DiagnosisDrugSuggestion[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        diagnosis: null,
        patient: null,
        drugSuggestions: null,
        error: 'User not authenticated',
        mode: 'individual'
      };
    }

    try {
      // Create the diagnosis record
      const diagnosisData = {
        ...diagnosisRequest,
        primary_diagnosis: aiResults.primary_diagnosis,
        differential_diagnoses: aiResults.differential_diagnoses,
        treatment_plan: aiResults.treatment_plan,
        recommended_tests: aiResults.recommended_tests,
        urgency_level: aiResults.urgency_level,
        confidence_score: aiResults.confidence_score
      };

      const { data: diagnosis, error: diagnosisError, mode } = await this.createDiagnosis(
        diagnosisData,
        activeMode,
        organizationId
      );

      if (diagnosisError || !diagnosis) {
        return {
          diagnosis: null,
          patient: null,
          drugSuggestions: null,
          error: diagnosisError,
          mode: 'individual'
        };
      }

      // Save/update patient profile if patient data is provided
      let patient = null;
      if (diagnosis.patient_name) {
        const { data: patientData, error: patientError } = await ModeAwarePatientService.savePatientFromDiagnosis(
          diagnosis,
          activeMode,
          organizationId
        );

        if (patientError) {
          console.error('Error saving patient profile:', patientError);
          // Don't fail the entire process if patient save fails
        } else {
          patient = patientData;
        }
      }

      // Get drug suggestions based on symptoms
      let drugSuggestions = null;
      const symptoms = diagnosisRequest.symptoms ?
        (Array.isArray(diagnosisRequest.symptoms) ? diagnosisRequest.symptoms : [diagnosisRequest.symptoms]) :
        [];

      if (symptoms.length > 0) {
        const { data: suggestionsData, error: suggestionsError } = await this.getDrugSuggestionsForDiagnosis(
          symptoms,
          activeMode,
          organizationId
        );

        if (suggestionsError) {
          console.error('Error getting drug suggestions:', suggestionsError);
          // Don't fail the entire process if drug suggestions fail
        } else {
          drugSuggestions = suggestionsData;
        }
      }

      return {
        diagnosis,
        patient,
        drugSuggestions,
        error: null,
        mode
      };
    } catch (error) {
      console.error('Error processing AI diagnosis:', error);
      return {
        diagnosis: null,
        patient: null,
        drugSuggestions: null,
        error: 'Failed to process AI diagnosis',
        mode: 'individual'
      };
    }
  }

  // Update diagnosis based on active mode
  static async updateDiagnosis(
    diagnosisId: string,
    updates: Partial<DiagnosisRequest | OrganizationDiagnosisRequest>,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (Diagnosis | OrganizationDiagnosis) | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Update organization diagnosis
        const { data, error } = await supabase
          .from('organization_diagnoses')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', diagnosisId)
          .eq('organization_id', organizationId)
          .select()
          .single();

        if (error) {
          console.error('Error updating organization diagnosis:', error);
          return { data: null, error: error.message, mode: 'organization' };
        }

        return { data, error: null, mode: 'organization' };
      } else {
        // Update individual diagnosis
        const { data, error } = await supabase
          .from('diagnoses')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', diagnosisId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating individual diagnosis:', error);
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error updating diagnosis:', error);
      return { data: null, error: 'Failed to update diagnosis', mode: 'individual' };
    }
  }

  // Delete diagnosis based on active mode
  static async deleteDiagnosis(
    diagnosisId: string,
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
      if (activeMode === 'organization' && organizationId) {
        // Delete organization diagnosis
        const { error } = await supabase
          .from('organization_diagnoses')
          .delete()
          .eq('id', diagnosisId)
          .eq('organization_id', organizationId);

        if (error) {
          console.error('Error deleting organization diagnosis:', error);
          return { error: error.message, mode: 'organization' };
        }

        return { error: null, mode: 'organization' };
      } else {
        // Delete individual diagnosis
        const { error } = await supabase
          .from('diagnoses')
          .delete()
          .eq('id', diagnosisId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting individual diagnosis:', error);
          return { error: error.message, mode: 'individual' };
        }

        return { error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error deleting diagnosis:', error);
      return { error: 'Failed to delete diagnosis', mode: 'individual' };
    }
  }
}