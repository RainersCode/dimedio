-- Fix missing DELETE policy for organization_drug_usage_history table
-- This is causing deletion operations to silently fail due to RLS blocking

-- Add DELETE policy for organization drug usage history
CREATE POLICY "Organization members can delete usage history"
    ON organization_drug_usage_history FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND (permissions->>'dispense_drugs')::boolean = true
        )
    );

-- Also add UPDATE policy in case it's missing
CREATE POLICY "Organization members can update usage history"
    ON organization_drug_usage_history FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND (permissions->>'dispense_drugs')::boolean = true
        )
    );