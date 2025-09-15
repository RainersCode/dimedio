-- Fix patient_profiles table schema
-- Add missing columns that are being used in the application

-- Add missing columns to patient_profiles table
ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS emergency_contact JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS insurance_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_diagnosis_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_symptoms TEXT[],
ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- Update the existing patient_gender column to gender if it exists
-- (This handles any potential column name inconsistencies)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'patient_profiles'
               AND column_name = 'patient_gender'
               AND table_schema = 'public') THEN
        -- Copy data from patient_gender to gender if gender column is empty
        UPDATE patient_profiles SET gender = patient_gender WHERE gender IS NULL;
    END IF;
END $$;