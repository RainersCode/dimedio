-- Add email column to organization_members table to store user email for display
ALTER TABLE organization_members ADD COLUMN user_email TEXT;

-- Update existing members with their email from auth.users (run this manually for each user)
-- You'll need to replace the user_id and email values manually for existing members
-- UPDATE organization_members SET user_email = 'user@example.com' WHERE user_id = 'user-uuid-here';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_organization_members_email ON organization_members(user_email);