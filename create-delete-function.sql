-- Create a database function to delete organization with elevated privileges
-- This bypasses RLS policies and ensures proper cleanup

CREATE OR REPLACE FUNCTION delete_organization(org_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator
AS $$
DECLARE
  org_creator uuid;
BEGIN
  -- Check if the user is the organization creator
  SELECT created_by INTO org_creator
  FROM organizations
  WHERE id = org_id;

  IF org_creator IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF org_creator != user_id THEN
    RAISE EXCEPTION 'Only the organization creator can delete the organization';
  END IF;

  -- Delete all related records in order (using CASCADE should handle this automatically)
  -- But we'll be explicit to ensure everything is cleaned up

  DELETE FROM organization_drug_usage_history WHERE organization_id = org_id;
  DELETE FROM organization_diagnoses WHERE organization_id = org_id;
  DELETE FROM organization_patients WHERE organization_id = org_id;
  DELETE FROM organization_drug_inventory WHERE organization_id = org_id;
  DELETE FROM organization_invitations WHERE organization_id = org_id;
  DELETE FROM organization_members WHERE organization_id = org_id;
  DELETE FROM organizations WHERE id = org_id;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete organization: %', SQLERRM;
END;
$$;