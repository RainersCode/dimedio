-- Add extended patient fields to patient_profiles table
ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS insurance_info TEXT,
ADD COLUMN IF NOT EXISTS chronic_conditions TEXT;

-- Add extended patient fields to organization_patients table
ALTER TABLE organization_patients
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS insurance_info TEXT,
ADD COLUMN IF NOT EXISTS chronic_conditions TEXT;

-- Add indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_patient_profiles_phone ON patient_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_email ON patient_profiles(email);
CREATE INDEX IF NOT EXISTS idx_organization_patients_phone ON organization_patients(phone);
CREATE INDEX IF NOT EXISTS idx_organization_patients_email ON organization_patients(email);

-- Add updated_at timestamp columns if they don't exist
ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE organization_patients
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create triggers to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for patient_profiles
DROP TRIGGER IF EXISTS update_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER update_patient_profiles_updated_at
    BEFORE UPDATE ON patient_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add triggers for organization_patients
DROP TRIGGER IF EXISTS update_organization_patients_updated_at ON organization_patients;
CREATE TRIGGER update_organization_patients_updated_at
    BEFORE UPDATE ON organization_patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN patient_profiles.phone IS 'Patient contact phone number';
COMMENT ON COLUMN patient_profiles.email IS 'Patient email address';
COMMENT ON COLUMN patient_profiles.address IS 'Patient residential address';
COMMENT ON COLUMN patient_profiles.emergency_contact IS 'Emergency contact information';
COMMENT ON COLUMN patient_profiles.insurance_info IS 'Insurance and billing information';
COMMENT ON COLUMN patient_profiles.chronic_conditions IS 'Long-term medical conditions';

COMMENT ON COLUMN organization_patients.phone IS 'Patient contact phone number';
COMMENT ON COLUMN organization_patients.email IS 'Patient email address';
COMMENT ON COLUMN organization_patients.address IS 'Patient residential address';
COMMENT ON COLUMN organization_patients.emergency_contact IS 'Emergency contact information';
COMMENT ON COLUMN organization_patients.insurance_info IS 'Insurance and billing information';
COMMENT ON COLUMN organization_patients.chronic_conditions IS 'Long-term medical conditions';