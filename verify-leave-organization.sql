-- Script to verify leaving organization worked properly
-- Run this after a member leaves an organization

-- Replace with the actual user ID who left
SET @user_id = 'user-id-who-left-here';

-- Check if user still has organization membership (should return no rows)
SELECT
    om.id,
    om.organization_id,
    om.user_email,
    om.role,
    om.status,
    o.name as organization_name
FROM organization_members om
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE om.user_id = @user_id;

-- Check if user still has individual data (should still exist)
SELECT
    'Individual drug inventory' as data_type,
    COUNT(*) as count
FROM drug_inventory
WHERE user_id = @user_id

UNION ALL

SELECT
    'Individual patients' as data_type,
    COUNT(*) as count
FROM patients
WHERE user_id = @user_id

UNION ALL

SELECT
    'Individual diagnoses' as data_type,
    COUNT(*) as count
FROM diagnoses
WHERE user_id = @user_id;