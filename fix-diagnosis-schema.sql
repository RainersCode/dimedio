-- Fix Diagnosis System for Multi-Organization Support
-- Run this in Supabase SQL Editor

-- Add missing created_by and updated_by columns to organization_diagnoses table
ALTER TABLE organization_diagnoses
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update existing records to use user_id as created_by
UPDATE organization_diagnoses
SET created_by = user_id
WHERE created_by IS NULL AND user_id IS NOT NULL;

-- Create index for created_by column
CREATE INDEX IF NOT EXISTS idx_org_diagnoses_created_by ON organization_diagnoses(created_by);

-- Add missing fields that might be expected by the service
ALTER TABLE organization_diagnoses
ADD COLUMN IF NOT EXISTS treatment_plan TEXT[],
ADD COLUMN IF NOT EXISTS recommended_tests TEXT[],
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20);

-- Update RLS policies to use created_by if needed
-- Ensure users can only see diagnoses they created or are organization members
DROP POLICY IF EXISTS "Organization members can view shared diagnoses" ON organization_diagnoses;
CREATE POLICY "Organization members can view shared diagnoses"
    ON organization_diagnoses FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Ensure users can update diagnoses they created
DROP POLICY IF EXISTS "Organization members can update diagnoses" ON organization_diagnoses;
CREATE POLICY "Organization members can update diagnoses"
    ON organization_diagnoses FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        AND (created_by = auth.uid() OR user_id = auth.uid())
    );

-- Add policy for delete operations
DROP POLICY IF EXISTS "Organization members can delete diagnoses" ON organization_diagnoses;
CREATE POLICY "Organization members can delete diagnoses"
    ON organization_diagnoses FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        AND (created_by = auth.uid() OR user_id = auth.uid())
    );

-- Ensure individual diagnoses table has proper structure too
-- Check if individual diagnoses table needs similar updates
DO $$
BEGIN
    -- Add created_by and updated_by to individual diagnoses if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'diagnoses' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE diagnoses
        ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

        -- Update existing records
        UPDATE diagnoses
        SET created_by = user_id
        WHERE created_by IS NULL AND user_id IS NOT NULL;

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_diagnoses_created_by ON diagnoses(created_by);
    END IF;

    -- Add missing fields to individual diagnoses if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'diagnoses' AND column_name = 'treatment_plan'
    ) THEN
        ALTER TABLE diagnoses
        ADD COLUMN IF NOT EXISTS treatment_plan TEXT[],
        ADD COLUMN IF NOT EXISTS recommended_tests TEXT[],
        ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20);
    END IF;
END $$;