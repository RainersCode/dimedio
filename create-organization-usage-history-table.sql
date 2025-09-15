-- Create organization inventory usage history table
-- This tracks when organization dispensing records are deleted (drugs consumed/used)

CREATE TABLE IF NOT EXISTS organization_inventory_usage_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

    -- Drug Information
    drug_id UUID REFERENCES organization_drug_inventory(id) ON DELETE SET NULL,
    drug_name VARCHAR(255) NOT NULL,

    -- Usage Details
    quantity_removed INTEGER NOT NULL,
    removal_reason VARCHAR(50) DEFAULT 'dispensing_record_deleted',
    original_dispensing_record_id UUID,
    patient_name VARCHAR(100),
    notes TEXT,

    -- Timestamps
    removed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE organization_inventory_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can view usage history"
    ON organization_inventory_usage_history FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization members can record usage"
    ON organization_inventory_usage_history FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_inventory_usage_org_id ON organization_inventory_usage_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_inventory_usage_user_id ON organization_inventory_usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_org_inventory_usage_drug_id ON organization_inventory_usage_history(drug_id);
CREATE INDEX IF NOT EXISTS idx_org_inventory_usage_removed_at ON organization_inventory_usage_history(removed_at DESC);