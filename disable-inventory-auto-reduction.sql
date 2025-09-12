-- Migration script to disable automatic inventory reduction when dispensing drugs
-- This will remove the trigger that automatically reduces stock_quantity when drugs are dispensed
-- After running this, inventory will need to be managed manually

-- Drop the trigger that automatically reduces inventory
DROP TRIGGER IF EXISTS trigger_update_drug_stock ON drug_usage_history;

-- Keep the function in case it's needed later, but it won't be called by any trigger
-- The function update_drug_stock_after_usage() remains available for manual use if needed

-- Note: After running this migration, drug dispensing will only record usage history
-- but will NOT automatically reduce inventory stock quantities.
-- Stock quantities must be reduced manually as needed.