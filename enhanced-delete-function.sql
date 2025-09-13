-- Enhanced organization deletion function with comprehensive cleanup
-- This ensures all related data is completely removed

CREATE OR REPLACE FUNCTION delete_organization(org_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator
AS $$
DECLARE
  org_creator uuid;
  record_count integer;
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

  -- Log what we're about to delete (for debugging)
  RAISE NOTICE 'Starting deletion of organization %', org_id;

  -- Delete all related records in dependency order
  -- Count and delete drug usage history
  SELECT COUNT(*) INTO record_count FROM organization_drug_usage_history WHERE organization_id = org_id;
  RAISE NOTICE 'Deleting % drug usage history records', record_count;
  DELETE FROM organization_drug_usage_history WHERE organization_id = org_id;

  -- Count and delete diagnoses
  SELECT COUNT(*) INTO record_count FROM organization_diagnoses WHERE organization_id = org_id;
  RAISE NOTICE 'Deleting % diagnosis records', record_count;
  DELETE FROM organization_diagnoses WHERE organization_id = org_id;

  -- Count and delete patients
  SELECT COUNT(*) INTO record_count FROM organization_patients WHERE organization_id = org_id;
  RAISE NOTICE 'Deleting % patient records', record_count;
  DELETE FROM organization_patients WHERE organization_id = org_id;

  -- Count and delete drug inventory
  SELECT COUNT(*) INTO record_count FROM organization_drug_inventory WHERE organization_id = org_id;
  RAISE NOTICE 'Deleting % drug inventory records', record_count;
  DELETE FROM organization_drug_inventory WHERE organization_id = org_id;

  -- Count and delete invitations
  SELECT COUNT(*) INTO record_count FROM organization_invitations WHERE organization_id = org_id;
  RAISE NOTICE 'Deleting % invitation records', record_count;
  DELETE FROM organization_invitations WHERE organization_id = org_id;

  -- Count and delete members
  SELECT COUNT(*) INTO record_count FROM organization_members WHERE organization_id = org_id;
  RAISE NOTICE 'Deleting % member records', record_count;
  DELETE FROM organization_members WHERE organization_id = org_id;

  -- Finally delete the organization itself
  RAISE NOTICE 'Deleting organization record';
  DELETE FROM organizations WHERE id = org_id;

  -- Verify deletion
  SELECT COUNT(*) INTO record_count FROM organizations WHERE id = org_id;
  IF record_count > 0 THEN
    RAISE EXCEPTION 'Organization deletion failed - organization still exists';
  END IF;

  RAISE NOTICE 'Organization % successfully deleted', org_id;
  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete organization: %', SQLERRM;
END;
$$;