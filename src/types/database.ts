// Database types for Supabase tables

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export interface UserRoles {
  id: string;
  user_id: string;
  role: UserRole;
  permissions: Record<string, any>;
  assigned_by?: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

export interface RoleChangeHistory {
  id: string;
  user_id: string;
  changed_by?: string;
  old_role: string;
  new_role: string;
  reason?: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  role: UserRole;
  created_at: string;
  last_sign_in_at?: string;
  diagnosis_count?: number;
}

export interface Diagnosis {
  id: string;
  user_id: string;
  
  // Patient Information
  patient_age?: number;
  patient_gender?: string;
  
  // Optional Patient Identification
  patient_name?: string;
  patient_surname?: string;
  patient_id?: string;
  date_of_birth?: string;
  
  // Vital Signs
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
  
  // Medical History
  allergies?: string;
  current_medications?: string;
  chronic_conditions?: string;
  previous_surgeries?: string;
  previous_injuries?: string;
  
  // Patient Complaint/Symptoms
  complaint: string;
  symptoms?: string[];
  complaint_duration?: string;
  pain_scale?: number;
  symptom_onset?: string;
  associated_symptoms?: string;
  
  // AI Diagnosis Results
  primary_diagnosis?: string;
  differential_diagnoses?: string[];
  recommended_actions?: string[];
  treatment?: string[];
  drug_suggestions?: any[];
  inventory_drugs?: any[];
  additional_therapy?: any[];
  improved_patient_history?: string;
  
  // Additional Fields
  severity_level?: 'low' | 'moderate' | 'high' | 'critical';
  confidence_score?: number;
  
  // n8n Integration
  n8n_workflow_id?: string;
  n8n_response?: any;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Audit Trail
  last_edited_by?: string;
  last_edited_by_email?: string;
  last_edited_at?: string;
  edit_location?: string;
}

export interface DiagnosisHistory {
  id: string;
  diagnosis_id: string;
  user_id: string;
  
  changed_field: string;
  old_value?: string;
  new_value?: string;
  change_reason?: string;
  
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  
  language: string;
  default_n8n_workflow?: string;
  notification_settings: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export interface PatientProfile {
  id: string;
  user_id: string;

  patient_name: string;
  patient_surname?: string;
  patient_age?: number;
  patient_gender?: string;
  patient_id?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  insurance_info?: string;
  chronic_conditions?: string;
  medical_history?: string[];
  allergies?: string[];
  current_medications?: string[];
  last_diagnosis_id?: string;
  last_visit_date?: string;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Form data types for creating diagnoses
export interface DiagnosisFormData {
  // Basic Patient Info
  patient_age?: number;
  patient_gender?: string;
  complaint: string;
  symptoms?: string;
  
  // Optional Patient Identification
  patient_name?: string;
  patient_surname?: string;
  patient_id?: string;
  date_of_birth?: string;
  
  // Vital Signs
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
  
  // Medical History
  allergies?: string;
  current_medications?: string;
  chronic_conditions?: string;
  previous_surgeries?: string;
  previous_injuries?: string;
  
  // Additional Clinical Information
  complaint_duration?: string;
  pain_scale?: number;
  symptom_onset?: 'sudden' | 'gradual' | '';
  associated_symptoms?: string;
}

// Drug suggestion from AI
export interface DrugSuggestion {
  drug_name: string;
  source: 'inventory' | 'external';
  dosage: string;
  duration?: string;
  instructions?: string;
  prescription_required?: boolean;
}

// Enhanced AI response structures
export interface ClinicalAssessment {
  vital_signs_interpretation: string;
  severity_assessment: string;
  risk_stratification: string;
  red_flags: string[];
  clinical_pearls: string[];
}

export interface MonitoringPlan {
  immediate: string[];
  short_term: string[];
  long_term: string[];
  success_metrics: string[];
  warning_signs: string[];
}

// n8n response format based on your sample
export interface N8nDiagnosisResponse {
  primary_diagnosis: string;
  differential_diagnoses: string;
  recommended_actions: string;
  treatment: string;
  drug_suggestions?: DrugSuggestion[];
  inventory_drugs?: any[];
  additional_therapy?: any[];
  improved_patient_history?: string;
  severity_level?: 'low' | 'moderate' | 'high' | 'critical';
  confidence_score?: number;

  // Enhanced AI response fields
  clinical_assessment?: ClinicalAssessment;
  monitoring_plan?: MonitoringPlan;
}

// Parsed n8n response
export interface ParsedDiagnosis {
  primary_diagnosis: string;
  differential_diagnoses: string[];
  recommended_actions: string[];
  treatment: string[];
  drug_suggestions?: DrugSuggestion[];
  inventory_drugs?: any[];
  additional_therapy?: any[];
  improved_patient_history?: string;
  confidence_score?: number;
  severity_level?: 'low' | 'moderate' | 'high' | 'critical';

  // Enhanced AI response fields
  clinical_assessment?: ClinicalAssessment;
  monitoring_plan?: MonitoringPlan;
}

// Drug Inventory Types
export interface DrugCategory {
  id: string;
  name: string;
  name_lv?: string;
  description?: string;
  description_lv?: string;
  parent_category_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserDrugInventory {
  id: string;
  user_id: string;
  
  // Drug Information
  drug_name: string;
  drug_name_lv?: string;
  generic_name?: string;
  brand_name?: string;
  
  // Classification
  category_id?: string;
  dosage_form?: string;
  strength?: string;
  
  // Medical Information
  active_ingredient?: string;
  indications?: string[];
  contraindications?: string[];
  dosage_adults?: string;
  dosage_children?: string;
  
  // Business Information
  stock_quantity: number;
  unit_price?: number;
  supplier?: string;
  batch_number?: string;
  expiry_date?: string;

  // Pack Tracking Information
  units_per_pack?: number;
  unit_type?: 'tablet' | 'capsule' | 'ml' | 'dose' | 'patch' | 'suppository' | 'gram';
  whole_packs_count?: number;
  loose_units_count?: number;
  
  // System Fields
  is_active: boolean;
  is_prescription_only: boolean;
  notes?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  category?: DrugCategory;
}

export interface DrugInteraction {
  id: string;
  drug_id_1: string;
  drug_id_2: string;
  interaction_type?: 'major' | 'moderate' | 'minor';
  description: string;
  severity_level: number;
  created_at: string;
}

export interface DiagnosisDrugSuggestion {
  id: string;
  diagnosis_id: string;
  drug_id: string;
  user_id: string;
  
  suggested_dosage?: string;
  treatment_duration?: string;
  administration_notes?: string;
  priority_level: number;
  
  suggested_by_ai: boolean;
  manual_selection: boolean;
  
  created_at: string;
  
  // Joined data
  drug?: UserDrugInventory;
}

export interface DrugUsageHistory {
  id: string;
  user_id: string;
  drug_id: string;
  diagnosis_id?: string;
  
  quantity_dispensed: number;
  dispensed_date: string;
  patient_info?: Record<string, any>;
  notes?: string;
  
  created_at: string;
  
  // Joined data
  drug?: UserDrugInventory;
}

// Form data types
export interface DrugInventoryFormData {
  drug_name: string;
  drug_name_lv?: string;
  generic_name?: string;
  brand_name?: string;
  category_id?: string;
  dosage_form?: string;
  strength?: string;
  active_ingredient?: string;
  indications?: string[];
  contraindications?: string[];
  dosage_adults?: string;
  dosage_children?: string;
  stock_quantity: number;
  unit_price?: number;
  supplier?: string;
  batch_number?: string;
  expiry_date?: string;
  is_prescription_only?: boolean;
  notes?: string;

  // Pack tracking fields
  units_per_pack?: number;
  unit_type?: 'tablet' | 'capsule' | 'ml' | 'dose' | 'patch' | 'suppository' | 'gram';
  whole_packs_count?: number;
  loose_units_count?: number;
}