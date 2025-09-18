-- Add enhanced AI response fields to diagnoses table
-- Run this in your Supabase SQL editor

-- Add clinical_assessment column (JSONB for structured data)
ALTER TABLE diagnoses
ADD COLUMN IF NOT EXISTS clinical_assessment JSONB;

-- Add monitoring_plan column (JSONB for structured data)
ALTER TABLE diagnoses
ADD COLUMN IF NOT EXISTS monitoring_plan JSONB;

-- Add the same columns to organization_diagnoses table
ALTER TABLE organization_diagnoses
ADD COLUMN IF NOT EXISTS clinical_assessment JSONB;

ALTER TABLE organization_diagnoses
ADD COLUMN IF NOT EXISTS monitoring_plan JSONB;

-- Add comments for documentation
COMMENT ON COLUMN diagnoses.clinical_assessment IS 'Enhanced AI clinical assessment including vital signs interpretation, risk stratification, red flags, and clinical pearls';
COMMENT ON COLUMN diagnoses.monitoring_plan IS 'Enhanced AI monitoring plan including immediate, short-term, long-term monitoring, success metrics, and warning signs';

COMMENT ON COLUMN organization_diagnoses.clinical_assessment IS 'Enhanced AI clinical assessment including vital signs interpretation, risk stratification, red flags, and clinical pearls';
COMMENT ON COLUMN organization_diagnoses.monitoring_plan IS 'Enhanced AI monitoring plan including immediate, short-term, long-term monitoring, success metrics, and warning signs';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_diagnoses_clinical_assessment ON diagnoses USING GIN (clinical_assessment);
CREATE INDEX IF NOT EXISTS idx_diagnoses_monitoring_plan ON diagnoses USING GIN (monitoring_plan);

CREATE INDEX IF NOT EXISTS idx_org_diagnoses_clinical_assessment ON organization_diagnoses USING GIN (clinical_assessment);
CREATE INDEX IF NOT EXISTS idx_org_diagnoses_monitoring_plan ON organization_diagnoses USING GIN (monitoring_plan);