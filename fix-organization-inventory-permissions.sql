-- Fix organization drug inventory RLS policies to be more practical

-- Drop the restrictive manage inventory policy
DROP POLICY IF EXISTS "Organization members can manage inventory" ON organization_drug_inventory;

-- Create separate policies for different operations
CREATE POLICY "Organization members can add drugs to inventory"
    ON organization_drug_inventory FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Organization members can update drugs in inventory"
    ON organization_drug_inventory FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Only users with manage_inventory permission can delete drugs
CREATE POLICY "Users with manage_inventory can delete drugs"
    ON organization_drug_inventory FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
            AND (permissions->>'manage_inventory')::boolean = true
        )
    );

-- Update default permissions to be more practical
-- Note: This only affects NEW members, existing members need manual update
UPDATE organization_members
SET permissions = jsonb_set(
    permissions,
    '{manage_inventory}',
    'true',
    false
)
WHERE (permissions->>'manage_inventory')::boolean = false;