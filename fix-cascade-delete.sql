-- Add CASCADE DELETE to organization-related tables
-- This allows deleting an organization to automatically clean up related records

-- First, drop existing foreign key constraints and recreate them with CASCADE DELETE

-- Fix organization_members table
ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Fix organization_invitations table
ALTER TABLE organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_fkey;

ALTER TABLE organization_invitations
  ADD CONSTRAINT organization_invitations_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Fix organization_drug_inventory table
ALTER TABLE organization_drug_inventory
  DROP CONSTRAINT IF EXISTS organization_drug_inventory_organization_id_fkey;

ALTER TABLE organization_drug_inventory
  ADD CONSTRAINT organization_drug_inventory_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Fix organization_patients table
ALTER TABLE organization_patients
  DROP CONSTRAINT IF EXISTS organization_patients_organization_id_fkey;

ALTER TABLE organization_patients
  ADD CONSTRAINT organization_patients_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Fix organization_diagnoses table
ALTER TABLE organization_diagnoses
  DROP CONSTRAINT IF EXISTS organization_diagnoses_organization_id_fkey;

ALTER TABLE organization_diagnoses
  ADD CONSTRAINT organization_diagnoses_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Fix organization_drug_usage_history table
ALTER TABLE organization_drug_usage_history
  DROP CONSTRAINT IF EXISTS organization_drug_usage_history_organization_id_fkey;

ALTER TABLE organization_drug_usage_history
  ADD CONSTRAINT organization_drug_usage_history_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;