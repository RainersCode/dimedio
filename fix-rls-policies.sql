-- Fix RLS infinite recursion error for organization_members table
-- Complete solution: disable RLS temporarily, then create simple policies

-- First, disable RLS to break the recursion
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view organization members if they are part of the organization" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Members can view organization" ON organization_members;
DROP POLICY IF EXISTS "Users can create their own membership" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage existing members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "Admins manage members" ON organization_members;

-- Create a simple function to check organization membership
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
  );
END;
$$;

-- Create a simple function to check if user is admin
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role = 'admin'
  );
END;
$$;

-- Create simple non-recursive policies using functions
CREATE POLICY "Users can view own membership" ON organization_members
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Members can view organization" ON organization_members
  FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

-- Separate policies for INSERT and UPDATE/DELETE to handle organization creation
CREATE POLICY "Users can create their own membership" ON organization_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage existing members" ON organization_members
  FOR UPDATE
  USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can delete members" ON organization_members
  FOR DELETE
  USING (is_organization_admin(organization_id, auth.uid()));

-- Re-enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;