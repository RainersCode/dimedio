-- Fix missing SELECT policy for organization_drug_inventory
-- This adds back the ability to view organization drug inventory

-- Add the missing SELECT policy for organization members
CREATE POLICY "Organization members can view shared inventory"
    ON organization_drug_inventory FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );