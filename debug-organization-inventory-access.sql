-- Debug organization inventory access issues

-- 1. Check current RLS policies for organization_drug_inventory
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'organization_drug_inventory'
ORDER BY policyname;

-- 2. Check if current user is a member of any organization
SELECT
    om.organization_id,
    o.name as organization_name,
    om.role,
    om.status,
    om.permissions,
    om.joined_at
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.user_id = auth.uid();

-- 3. Check organization drug inventory count by organization
SELECT
    organization_id,
    COUNT(*) as drug_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_drug_count
FROM organization_drug_inventory
GROUP BY organization_id;

-- 4. Test direct query to see what the user can access
-- (Replace with your actual organization_id)
SELECT
    id,
    drug_name,
    organization_id,
    is_active,
    created_by,
    created_at
FROM organization_drug_inventory
WHERE is_active = true
ORDER BY drug_name;