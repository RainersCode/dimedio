-- =====================================================
-- Dimedio Database Schema for Supabase
-- =====================================================

-- Enable RLS (Row Level Security)
-- This ensures users can only access their own data

-- 1. DIAGNOSES TABLE
-- Stores patient complaints and AI-generated diagnoses
CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Patient Information
    patient_age INTEGER,
    patient_gender VARCHAR(20),
    
    -- Optional Patient Identification
    patient_name VARCHAR(100),
    patient_surname VARCHAR(100), 
    patient_id VARCHAR(50),
    date_of_birth DATE,
    
    -- Vital Signs
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    temperature DECIMAL(4,1),
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    weight DECIMAL(5,2),
    height INTEGER,
    
    -- Medical History
    allergies TEXT,
    current_medications TEXT,
    chronic_conditions TEXT,
    previous_surgeries TEXT,
    previous_injuries TEXT,
    
    -- Patient Complaint/Symptoms
    complaint TEXT NOT NULL,
    symptoms TEXT[],
    complaint_duration VARCHAR(100),
    pain_scale INTEGER CHECK (pain_scale >= 0 AND pain_scale <= 10),
    symptom_onset VARCHAR(20) CHECK (symptom_onset IN ('sudden', 'gradual', '')),
    associated_symptoms TEXT,
    
    -- AI Diagnosis Results
    primary_diagnosis TEXT,
    differential_diagnoses TEXT[],
    recommended_actions TEXT[],
    treatment TEXT[],
    drug_suggestions JSONB DEFAULT '[]'::jsonb, -- AI drug recommendations
    inventory_drugs JSONB DEFAULT '[]'::jsonb, -- Drugs from user's inventory
    additional_therapy JSONB DEFAULT '[]'::jsonb, -- Additional drug recommendations
    improved_patient_history TEXT, -- AI-improved/corrected patient complaint
    
    -- Additional Fields
    severity_level VARCHAR(20), -- low, moderate, high, critical
    confidence_score DECIMAL(3,2), -- AI confidence 0.00-1.00
    
    -- n8n Integration
    n8n_workflow_id VARCHAR(100),
    n8n_response JSONB, -- Store full n8n response
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DIAGNOSIS_HISTORY TABLE
-- Tracks changes/updates to diagnoses
CREATE TABLE IF NOT EXISTS diagnosis_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Change tracking
    changed_field VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER_PREFERENCES TABLE
-- Store user preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Preferences
    language VARCHAR(10) DEFAULT 'en',
    default_n8n_workflow VARCHAR(100),
    notification_settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PATIENT_PROFILES TABLE (Optional - for future use)
-- If users want to save patient information for repeat visits
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Patient Info
    patient_name VARCHAR(100),
    patient_surname VARCHAR(100),
    patient_age INTEGER,
    patient_gender VARCHAR(20),
    patient_id VARCHAR(50),
    date_of_birth DATE,
    medical_history TEXT[],
    allergies TEXT[],
    current_medications TEXT[],
    last_diagnosis_id VARCHAR(50),
    last_visit_date TIMESTAMPTZ,

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

-- Diagnoses policies
CREATE POLICY "Users can view own diagnoses" 
    ON diagnoses FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnoses" 
    ON diagnoses FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diagnoses" 
    ON diagnoses FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagnoses" 
    ON diagnoses FOR DELETE 
    USING (auth.uid() = user_id);

-- Diagnosis history policies
CREATE POLICY "Users can view own diagnosis history" 
    ON diagnosis_history FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnosis history" 
    ON diagnosis_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can view own preferences" 
    ON user_preferences FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
    ON user_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
    ON user_preferences FOR UPDATE 
    USING (auth.uid() = user_id);

-- Patient profiles policies
CREATE POLICY "Users can view own patient profiles" 
    ON patient_profiles FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patient profiles" 
    ON patient_profiles FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patient profiles" 
    ON patient_profiles FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patient profiles" 
    ON patient_profiles FOR DELETE 
    USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_diagnoses_updated_at 
    BEFORE UPDATE ON diagnoses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_profiles_updated_at 
    BEFORE UPDATE ON patient_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_diagnoses_user_id ON diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON diagnoses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient_id ON diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient_name_dob ON diagnoses(patient_name, date_of_birth);
CREATE INDEX IF NOT EXISTS idx_diagnosis_history_diagnosis_id ON diagnosis_history(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_patient_id ON patient_profiles(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_name_dob ON patient_profiles(patient_name, date_of_birth);

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- You can insert sample data after running this schema
-- INSERT INTO diagnoses (user_id, patient_age, patient_gender, complaint, primary_diagnosis)
-- VALUES (auth.uid(), 45, 'male', 'Chest pain and shortness of breath', 'Possible Acute Myocardial Infarction');