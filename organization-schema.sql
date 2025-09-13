-- Organization Multi-Tenancy Schema
-- Run this in Supabase SQL Editor

-- =====================================================
-- ORGANIZATIONS CORE TABLES
-- =====================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{
        "shared_inventory": true,
        "shared_patients": true,
        "require_approval_for_members": true
    }',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organization members with roles and permissions
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member'
    permissions JSONB DEFAULT '{
        "write_off_drugs": false,
        "manage_members": false,
        "view_all_data": true,
        "diagnose_patients": true,
        "dispense_drugs": true,
        "manage_inventory": false,
        "view_reports": true
    }',
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'pending', 'suspended'
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 3. Organization invitations
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    permissions JSONB DEFAULT '{
        "write_off_drugs": false,
        "manage_members": false,
        "view_all_data": true,
        "diagnose_patients": true,
        "dispense_drugs": true,
        "manage_inventory": false,
        "view_reports": true
    }',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SHARED ORGANIZATION DATA TABLES
-- =====================================================

-- 4. Organization shared drug inventory
CREATE TABLE IF NOT EXISTS organization_drug_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

    -- Drug Information (same as user_drug_inventory)
    drug_name VARCHAR(255) NOT NULL,
    drug_name_lv VARCHAR(255),
    generic_name VARCHAR(255),
    brand_name VARCHAR(255),

    -- Classification
    category_id UUID,
    dosage_form VARCHAR(100),
    strength VARCHAR(100),

    -- Medical Information
    active_ingredient TEXT,
    indications TEXT[],
    contraindications TEXT[],
    dosage_adults TEXT,
    dosage_children TEXT,

    -- Business Information
    stock_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2),
    supplier VARCHAR(255),
    batch_number VARCHAR(100),
    expiry_date DATE,

    -- System Fields
    is_active BOOLEAN DEFAULT TRUE,
    is_prescription_only BOOLEAN DEFAULT FALSE,
    notes TEXT,

    -- Audit Fields
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Organization shared patients
CREATE TABLE IF NOT EXISTS organization_patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

    -- Patient Info (same as patient_profiles)
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

    -- Audit Fields
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Organization shared diagnoses
CREATE TABLE IF NOT EXISTS organization_diagnoses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- who created the diagnosis

    -- Patient Information (same as diagnoses table)
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
    drug_suggestions JSONB DEFAULT '[]'::jsonb,
    inventory_drugs JSONB DEFAULT '[]'::jsonb,
    additional_therapy JSONB DEFAULT '[]'::jsonb,
    improved_patient_history TEXT,

    -- Additional Fields
    severity_level VARCHAR(20),
    confidence_score DECIMAL(3,2),

    -- n8n Integration
    n8n_workflow_id VARCHAR(100),
    n8n_response JSONB,

    -- Audit Trail
    last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_edited_by_email VARCHAR(255),
    last_edited_at TIMESTAMPTZ,
    edit_location TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Organization drug usage history
CREATE TABLE IF NOT EXISTS organization_drug_usage_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    drug_id UUID REFERENCES organization_drug_inventory(id) ON DELETE CASCADE,
    diagnosis_id UUID REFERENCES organization_diagnoses(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- who dispensed

    quantity_dispensed INTEGER NOT NULL,
    dispensed_date TIMESTAMPTZ DEFAULT NOW(),
    patient_info JSONB,
    notes TEXT,

    -- Write-off tracking
    is_write_off BOOLEAN DEFAULT FALSE,
    write_off_reason TEXT,
    write_off_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    write_off_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all organization tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_drug_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_drug_usage_history ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view organizations they belong to"
    ON organizations FOR SELECT
    USING (
        id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create organizations"
    ON organizations FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Organization admins can update organizations"
    ON organizations FOR UPDATE
    USING (
        id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Organization members policies
CREATE POLICY "Users can view organization members"
    ON organization_members FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization admins can manage members"
    ON organization_members FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Organization drug inventory policies
CREATE POLICY "Organization members can view shared inventory"
    ON organization_drug_inventory FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization members can manage inventory"
    ON organization_drug_inventory FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND (permissions->>'manage_inventory')::boolean = true
        )
    );

-- Organization patients policies
CREATE POLICY "Organization members can view shared patients"
    ON organization_patients FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization members can manage patients"
    ON organization_patients FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Organization diagnoses policies
CREATE POLICY "Organization members can view shared diagnoses"
    ON organization_diagnoses FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization members can create diagnoses"
    ON organization_diagnoses FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND (permissions->>'diagnose_patients')::boolean = true
        )
    );

CREATE POLICY "Organization members can update diagnoses"
    ON organization_diagnoses FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Organization drug usage history policies
CREATE POLICY "Organization members can view usage history"
    ON organization_drug_usage_history FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization members can record dispensing"
    ON organization_drug_usage_history FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND (permissions->>'dispense_drugs')::boolean = true
        )
    );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Organization indexes
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);

-- Organization data indexes
CREATE INDEX IF NOT EXISTS idx_org_drug_inventory_org_id ON organization_drug_inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_patients_org_id ON organization_patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_diagnoses_org_id ON organization_diagnoses(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_diagnoses_user_id ON organization_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_org_drug_usage_org_id ON organization_drug_usage_history(organization_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Update triggers for organization tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_drug_inventory_updated_at
    BEFORE UPDATE ON organization_drug_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_patients_updated_at
    BEFORE UPDATE ON organization_patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_diagnoses_updated_at
    BEFORE UPDATE ON organization_diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();