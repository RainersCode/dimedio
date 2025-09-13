-- Fix RLS policies for organizations table to allow creation

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can manage their created organizations" ON organizations;

-- Allow authenticated users to create organizations
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Allow users to view organizations they're members of
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT
  USING (
    auth.uid() = created_by
    OR
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Allow organization creators to update their organizations
CREATE POLICY "Users can manage their created organizations" ON organizations
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);