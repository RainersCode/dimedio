-- Check user mode after organization deletion
-- This helps verify that users properly return to individual mode

-- Replace with your actual user ID
SET @user_id = 'your-user-id-here';

-- Check if user has any organization memberships (should be empty after org deletion)
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

-- Check user's individual data (should still exist)
SELECT
    'drug_inventory' as table_name,
    COUNT(*) as record_count
FROM drug_inventory
WHERE user_id = @user_id

UNION ALL

SELECT
    'patients' as table_name,
    COUNT(*) as record_count
FROM patients
WHERE user_id = @user_id

UNION ALL

SELECT
    'diagnoses' as table_name,
    COUNT(*) as record_count
FROM diagnoses
WHERE user_id = @user_id;