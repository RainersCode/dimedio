-- Fix RLS policies for organization_invitations table

-- Enable RLS on organization_invitations table
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can create invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Users can view invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Users can manage invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Anyone can view pending invitations by token" ON organization_invitations;

-- Allow organization admins to create invitations
CREATE POLICY "Users can create invitations" ON organization_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_id = organization_invitations.organization_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

-- Allow users to view invitations for organizations they're admin of
CREATE POLICY "Users can view invitations" ON organization_invitations
  FOR SELECT
  USING (
    invited_by = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_id = organization_invitations.organization_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

-- Allow users to update/delete invitations they created or are admin of the organization
CREATE POLICY "Users can manage invitations" ON organization_invitations
  FOR UPDATE
  USING (
    invited_by = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_id = organization_invitations.organization_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  )
  WITH CHECK (
    invited_by = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_id = organization_invitations.organization_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

-- Allow anyone to view pending invitations by token (needed for invitation acceptance)
CREATE POLICY "Anyone can view pending invitations by token" ON organization_invitations
  FOR SELECT
  USING (status = 'pending');