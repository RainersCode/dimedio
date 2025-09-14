-- Comprehensive fix for organization drug inventory access issues

-- 1. First, check if the SELECT policy exists and drop it if it does
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'organization_drug_inventory'
        AND policyname = 'Organization members can view shared inventory'
    ) THEN
        DROP POLICY "Organization members can view shared inventory" ON organization_drug_inventory;
    END IF;
END $$;

-- 2. Create a more permissive SELECT policy that includes debugging
CREATE POLICY "Organization members can view shared inventory"
    ON organization_drug_inventory FOR SELECT
    USING (
        -- User must be an active member of the organization
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- 3. Ensure the table has RLS enabled
ALTER TABLE organization_drug_inventory ENABLE ROW LEVEL SECURITY;

-- 4. Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_drug_inventory TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 5. Create a function to debug inventory access
CREATE OR REPLACE FUNCTION debug_inventory_access(target_org_id UUID DEFAULT NULL)
RETURNS TABLE (
    user_id UUID,
    organization_id UUID,
    org_name TEXT,
    member_status TEXT,
    member_permissions JSONB,
    can_access_inventory BOOLEAN,
    inventory_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
    SELECT
        om.user_id,
        om.organization_id,
        o.name as org_name,
        om.status as member_status,
        om.permissions as member_permissions,
        CASE
            WHEN om.user_id IS NOT NULL AND om.status = 'active' THEN true
            ELSE false
        END as can_access_inventory,
        COALESCE(inv_count.count, 0) as inventory_count
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    LEFT JOIN (
        SELECT organization_id, COUNT(*) as count
        FROM organization_drug_inventory
        WHERE is_active = true
        GROUP BY organization_id
    ) inv_count ON om.organization_id = inv_count.organization_id
    WHERE om.user_id = auth.uid()
    AND (target_org_id IS NULL OR om.organization_id = target_org_id);
$$;