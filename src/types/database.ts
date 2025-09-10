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
  
  // Patient Complaint/Symptoms
  complaint: string;
  symptoms?: string[];
  
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
  patient_age?: number;
  patient_gender?: string;
  medical_history?: string[];
  allergies?: string[];
  current_medications?: string[];
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Form data types for creating diagnoses
export interface DiagnosisFormData {
  patient_age?: number;
  patient_gender?: string;
  complaint: string;
  symptoms?: string;
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
}