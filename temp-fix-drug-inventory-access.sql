-- Temporary fix for drug inventory access issues
-- This disables the credit-based restriction temporarily

-- Drop both existing policies to avoid conflicts
DROP POLICY IF EXISTS "Drug inventory requires credits" ON user_drug_inventory;
DROP POLICY IF EXISTS "Users can access drug inventory" ON user_drug_inventory;

-- Also drop the individual CRUD policies that might exist
DROP POLICY IF EXISTS "Users can view own drug inventory" ON user_drug_inventory;
DROP POLICY IF EXISTS "Users can insert own drugs" ON user_drug_inventory;
DROP POLICY IF EXISTS "Users can update own drugs" ON user_drug_inventory;
DROP POLICY IF EXISTS "Users can delete own drugs" ON user_drug_inventory;

-- Create a single comprehensive policy for all operations
CREATE POLICY "Users can manage own drug inventory"
    ON user_drug_inventory FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Note: This should be reverted once we fix the credit system integration