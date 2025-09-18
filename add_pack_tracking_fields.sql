-- Add pack tracking fields to drug inventory tables
-- This enables dual tracking: whole packs + individual units (tablets/capsules)

-- Add pack tracking fields to user_drug_inventory table
ALTER TABLE user_drug_inventory
ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'tablet',
ADD COLUMN IF NOT EXISTS whole_packs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loose_units_count INTEGER DEFAULT 0;

-- Add pack tracking fields to organization_drug_inventory table
ALTER TABLE organization_drug_inventory
ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'tablet',
ADD COLUMN IF NOT EXISTS whole_packs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loose_units_count INTEGER DEFAULT 0;

-- Create function to calculate total individual units
CREATE OR REPLACE FUNCTION calculate_total_units(
    whole_packs INTEGER,
    loose_units INTEGER,
    units_per_pack INTEGER
) RETURNS INTEGER AS $$
BEGIN
    RETURN (whole_packs * units_per_pack) + loose_units;
END;
$$ LANGUAGE plpgsql;

-- Add computed column for total individual units (virtual column for easy queries)
-- Note: We'll calculate this in the application layer for better performance

-- Update existing records to have default pack structure
-- Assume existing stock_quantity represents whole packs with 20 units each
UPDATE user_drug_inventory
SET
    whole_packs_count = stock_quantity,
    loose_units_count = 0,
    units_per_pack = 20,
    unit_type = CASE
        WHEN dosage_form ILIKE '%tablet%' THEN 'tablet'
        WHEN dosage_form ILIKE '%capsule%' THEN 'capsule'
        WHEN dosage_form ILIKE '%ml%' OR dosage_form ILIKE '%liquid%' THEN 'ml'
        WHEN dosage_form ILIKE '%injection%' THEN 'dose'
        WHEN dosage_form ILIKE '%patch%' THEN 'patch'
        WHEN dosage_form ILIKE '%suppository%' THEN 'suppository'
        ELSE 'tablet'
    END
WHERE units_per_pack IS NULL OR units_per_pack = 0;

UPDATE organization_drug_inventory
SET
    whole_packs_count = stock_quantity,
    loose_units_count = 0,
    units_per_pack = 20,
    unit_type = CASE
        WHEN dosage_form ILIKE '%tablet%' THEN 'tablet'
        WHEN dosage_form ILIKE '%capsule%' THEN 'capsule'
        WHEN dosage_form ILIKE '%ml%' OR dosage_form ILIKE '%liquid%' THEN 'ml'
        WHEN dosage_form ILIKE '%injection%' THEN 'dose'
        WHEN dosage_form ILIKE '%patch%' THEN 'patch'
        WHEN dosage_form ILIKE '%suppository%' THEN 'suppository'
        ELSE 'tablet'
    END
WHERE units_per_pack IS NULL OR units_per_pack = 0;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_drug_inventory_pack_tracking
ON user_drug_inventory(whole_packs_count, loose_units_count);

CREATE INDEX IF NOT EXISTS idx_organization_drug_inventory_pack_tracking
ON organization_drug_inventory(whole_packs_count, loose_units_count);

-- Add check constraints to ensure data integrity (drop first if they exist)
DO $$
BEGIN
    -- Drop existing constraints if they exist (user_drug_inventory)
    BEGIN
        ALTER TABLE user_drug_inventory DROP CONSTRAINT IF EXISTS chk_user_drug_units_per_pack_positive;
        ALTER TABLE user_drug_inventory DROP CONSTRAINT IF EXISTS chk_user_drug_whole_packs_non_negative;
        ALTER TABLE user_drug_inventory DROP CONSTRAINT IF EXISTS chk_user_drug_loose_units_non_negative;
        ALTER TABLE user_drug_inventory DROP CONSTRAINT IF EXISTS chk_user_drug_loose_units_less_than_pack;
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;

    -- Drop existing constraints if they exist (organization_drug_inventory)
    BEGIN
        ALTER TABLE organization_drug_inventory DROP CONSTRAINT IF EXISTS chk_org_drug_units_per_pack_positive;
        ALTER TABLE organization_drug_inventory DROP CONSTRAINT IF EXISTS chk_org_drug_whole_packs_non_negative;
        ALTER TABLE organization_drug_inventory DROP CONSTRAINT IF EXISTS chk_org_drug_loose_units_non_negative;
        ALTER TABLE organization_drug_inventory DROP CONSTRAINT IF EXISTS chk_org_drug_loose_units_less_than_pack;
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
END $$;

-- Add constraints for user_drug_inventory
ALTER TABLE user_drug_inventory
ADD CONSTRAINT chk_user_drug_units_per_pack_positive
CHECK (units_per_pack > 0);

ALTER TABLE user_drug_inventory
ADD CONSTRAINT chk_user_drug_whole_packs_non_negative
CHECK (whole_packs_count >= 0);

ALTER TABLE user_drug_inventory
ADD CONSTRAINT chk_user_drug_loose_units_non_negative
CHECK (loose_units_count >= 0);

ALTER TABLE user_drug_inventory
ADD CONSTRAINT chk_user_drug_loose_units_less_than_pack
CHECK (loose_units_count < units_per_pack);

-- Add constraints for organization_drug_inventory
ALTER TABLE organization_drug_inventory
ADD CONSTRAINT chk_org_drug_units_per_pack_positive
CHECK (units_per_pack > 0);

ALTER TABLE organization_drug_inventory
ADD CONSTRAINT chk_org_drug_whole_packs_non_negative
CHECK (whole_packs_count >= 0);

ALTER TABLE organization_drug_inventory
ADD CONSTRAINT chk_org_drug_loose_units_non_negative
CHECK (loose_units_count >= 0);

ALTER TABLE organization_drug_inventory
ADD CONSTRAINT chk_org_drug_loose_units_less_than_pack
CHECK (loose_units_count < units_per_pack);

-- Add comments for documentation
COMMENT ON COLUMN user_drug_inventory.units_per_pack IS 'Number of individual units (tablets/capsules/ml) per pack';
COMMENT ON COLUMN user_drug_inventory.unit_type IS 'Type of individual unit: tablet, capsule, ml, dose, patch, suppository';
COMMENT ON COLUMN user_drug_inventory.whole_packs_count IS 'Number of complete, unopened packs available';
COMMENT ON COLUMN user_drug_inventory.loose_units_count IS 'Number of individual units from opened packs (must be < units_per_pack)';

COMMENT ON COLUMN organization_drug_inventory.units_per_pack IS 'Number of individual units (tablets/capsules/ml) per pack';
COMMENT ON COLUMN organization_drug_inventory.unit_type IS 'Type of individual unit: tablet, capsule, ml, dose, patch, suppository';
COMMENT ON COLUMN organization_drug_inventory.whole_packs_count IS 'Number of complete, unopened packs available';
COMMENT ON COLUMN organization_drug_inventory.loose_units_count IS 'Number of individual units from opened packs (must be < units_per_pack)';

-- Create trigger to automatically update stock_quantity based on pack counts
-- This keeps backward compatibility with existing code
CREATE OR REPLACE FUNCTION update_stock_quantity_from_packs()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stock_quantity to reflect whole packs (for backward compatibility)
    NEW.stock_quantity = NEW.whole_packs_count;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for both tables
DROP TRIGGER IF EXISTS update_user_drug_stock_quantity ON user_drug_inventory;
CREATE TRIGGER update_user_drug_stock_quantity
    BEFORE INSERT OR UPDATE ON user_drug_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_quantity_from_packs();

DROP TRIGGER IF EXISTS update_org_drug_stock_quantity ON organization_drug_inventory;
CREATE TRIGGER update_org_drug_stock_quantity
    BEFORE INSERT OR UPDATE ON organization_drug_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_quantity_from_packs();