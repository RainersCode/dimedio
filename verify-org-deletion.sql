-- Script to verify organization deletion worked properly
-- Run this after deleting an organization to check for leftover data

-- Check if organization still exists (should return no rows)
SELECT id, name, created_by FROM organizations WHERE name LIKE '%your-org-name%';

-- Check for leftover organization members (should return no rows)
SELECT id, organization_id, user_id, user_email FROM organization_members
WHERE organization_id = 'your-org-id-here';

-- Check for leftover organization patients (should return no rows)
SELECT id, organization_id, patient_name FROM organization_patients
WHERE organization_id = 'your-org-id-here';

-- Check for leftover organization invitations (should return no rows)
SELECT id, organization_id, email FROM organization_invitations
WHERE organization_id = 'your-org-id-here';

-- Check for leftover organization drug inventory (should return no rows)
SELECT id, organization_id, drug_name FROM organization_drug_inventory
WHERE organization_id = 'your-org-id-here';

-- Check for leftover organization diagnoses (should return no rows)
SELECT id, organization_id, patient_name FROM organization_diagnoses
WHERE organization_id = 'your-org-id-here';

-- Check for leftover drug usage history (should return no rows)
SELECT id, organization_id FROM organization_drug_usage_history
WHERE organization_id = 'your-org-id-here';