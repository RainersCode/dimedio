-- Create a database function for leaving organization
-- This bypasses RLS policies and ensures proper cleanup

CREATE OR REPLACE FUNCTION leave_organization(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator
AS $$
DECLARE
  org_id uuid;
  org_creator uuid;
  member_record RECORD;
BEGIN
  -- Get the user's current organization membership
  SELECT * INTO member_record
  FROM organization_members
  WHERE organization_members.user_id = leave_organization.user_id
  AND status = 'active'
  LIMIT 1;

  IF member_record IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;

  -- Get organization info
  SELECT id, created_by INTO org_id, org_creator
  FROM organizations
  WHERE id = member_record.organization_id;

  -- Check if user is trying to leave their own organization (creator cannot leave)
  IF org_creator = leave_organization.user_id THEN
    RAISE EXCEPTION 'Organization creator cannot leave organization. Delete the organization instead.';
  END IF;

  -- Log the action
  RAISE NOTICE 'User % leaving organization %', user_id, org_id;

  -- Remove the user from organization_members
  DELETE FROM organization_members
  WHERE organization_members.user_id = leave_organization.user_id
  AND organization_id = org_id;

  -- Verify removal
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = leave_organization.user_id
    AND organization_id = org_id
  ) THEN
    RAISE EXCEPTION 'Failed to remove user from organization';
  END IF;

  RAISE NOTICE 'User % successfully left organization %', user_id, org_id;
  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to leave organization: %', SQLERRM;
END;
$$;