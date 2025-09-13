-- Test manual organization creation
-- Replace 'your-user-id-here' with your actual user ID from auth.users table

-- First, let's see what user ID you have
SELECT id, email FROM auth.users LIMIT 5;

-- Test creating organization manually (replace the user_id with yours)
-- INSERT INTO organizations (name, description, created_by)
-- VALUES ('Test Organization', 'Test Description', 'your-user-id-here');

-- Check if any organizations exist
SELECT * FROM organizations;