// Organization types
export interface Organization {
  id: string;
  name: string;
  description?: string;
  settings: {
    shared_inventory: boolean;
    shared_patients: boolean;
    require_approval_for_members: boolean;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'member';
  permissions: {
    write_off_drugs: boolean;
    manage_members: boolean;
    view_all_data: boolean;
    diagnose_patients: boolean;
    dispense_drugs: boolean;
    manage_inventory: boolean;
    view_reports: boolean;
  };
  status: 'active' | 'pending' | 'suspended';
  invited_by?: string;
  joined_at: string;
  updated_at: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  invited_by: string;
  role: 'admin' | 'member';
  permissions: OrganizationMember['permissions'];
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  expires_at: string;
  created_at: string;
}

// Organization-specific data types
export interface OrganizationDrugInventory {
  id: string;
  organization_id: string;
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

  // Pack Tracking Information
  units_per_pack?: number;
  unit_type?: 'tablet' | 'capsule' | 'ml' | 'dose' | 'patch' | 'suppository' | 'gram';
  whole_packs_count?: number;
  loose_units_count?: number;

  is_active: boolean;
  is_prescription_only: boolean;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationPatient {
  id: string;
  organization_id: string;
  patient_name?: string;
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
  created_by?: string;
  updated_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationDiagnosis {
  id: string;
  organization_id: string;
  user_id?: string;

  // Patient Information (same structure as regular diagnosis)
  patient_age?: number;
  patient_gender?: string;
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

  // Audit Trail
  last_edited_by?: string;
  last_edited_by_email?: string;
  last_edited_at?: string;
  edit_location?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface OrganizationDrugUsageHistory {
  id: string;
  organization_id: string;
  drug_id?: string;
  diagnosis_id?: string;
  user_id?: string;

  quantity_dispensed: number;
  dispensed_date: string;
  patient_info?: Record<string, any>;
  notes?: string;

  // Write-off tracking
  is_write_off: boolean;
  write_off_reason?: string;
  write_off_by?: string;
  write_off_date?: string;

  created_at: string;
}

// User mode types
export type UserMode = 'individual' | 'organization';

export interface UserModeInfo {
  mode: UserMode;
  organization?: Organization;
  member?: OrganizationMember;
}