-- Add audit trail columns to the diagnoses table
ALTER TABLE diagnoses 
ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
ADD COLUMN IF NOT EXISTS last_edited_by_email TEXT,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_location TEXT;

-- Add comment for documentation
COMMENT ON COLUMN diagnoses.last_edited_by IS 'Name of the user who last edited this diagnosis';
COMMENT ON COLUMN diagnoses.last_edited_by_email IS 'Email of the user who last edited this diagnosis';
COMMENT ON COLUMN diagnoses.last_edited_at IS 'Timestamp when this diagnosis was last edited';
COMMENT ON COLUMN diagnoses.edit_location IS 'Location/page where the edit was made (e.g., Patient History Edit)';