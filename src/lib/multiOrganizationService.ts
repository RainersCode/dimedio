import { supabase } from './supabase';
import type { Organization, OrganizationMember } from '@/types/organization';

export interface UserOrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'member';
  permissions: {
    write_off_drugs: boolean;
    manage_members: boolean;
    view_all_data: boolean;
    diagnose_patients: boolean;
    dispense_drugs: boolean;
    manage_inventory: boolean;
    view_reports: boolean;
  };
  status: 'active' | 'inactive';
  organization: Organization;
  joined_at: string;
}

export interface MultiOrgUserInfo {
  mode: 'individual' | 'multi_organization';
  organizations: UserOrganizationMembership[];
  activeOrganization: UserOrganizationMembership | null;
  canSwitchToIndividual: boolean;
}

export class MultiOrganizationService {
  // Get all organizations user is a member of
  static async getUserOrganizations(userId?: string): Promise<{
    data: UserOrganizationMembership[] | null;
    error: string | null;
  }> {
    try {
      // Get current user if userId not provided
      if (!userId) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return { data: null, error: 'User not authenticated' };
        }
        userId = user.id;
      }

      // Get all organization memberships
      const { data: memberships, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('joined_at', { ascending: false });

      if (memberError && memberError.code !== 'PGRST116') { // PGRST116 = no rows returned
        return { data: null, error: memberError.message };
      }

      const organizations: UserOrganizationMembership[] = (memberships || []).map(membership => ({
        id: membership.id,
        organization_id: membership.organization_id,
        user_id: membership.user_id,
        role: membership.role,
        permissions: membership.permissions,
        status: membership.status,
        organization: membership.organization,
        joined_at: membership.joined_at
      }));

      return { data: organizations, error: null };
    } catch (error) {
      console.error('Error getting user organizations:', error);
      return { data: null, error: 'Failed to get user organizations' };
    }
  }

  // Get comprehensive multi-organization user info
  static async getMultiOrgUserInfo(userId?: string): Promise<{
    data: MultiOrgUserInfo | null;
    error: string | null;
  }> {
    try {
      const { data: organizations, error: orgError } = await this.getUserOrganizations(userId);

      if (orgError) {
        return { data: null, error: orgError };
      }

      if (!organizations || organizations.length === 0) {
        // User has no organization memberships - individual mode
        return {
          data: {
            mode: 'individual',
            organizations: [],
            activeOrganization: null,
            canSwitchToIndividual: true
          },
          error: null
        };
      }

      // User has organization memberships
      return {
        data: {
          mode: 'multi_organization',
          organizations,
          activeOrganization: null, // Will be set by UserModeContext based on user preference
          canSwitchToIndividual: true
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting multi-org user info:', error);
      return { data: null, error: 'Failed to determine user organization status' };
    }
  }

  // Get specific organization membership details
  static async getOrganizationMembership(
    organizationId: string,
    userId?: string
  ): Promise<{
    data: UserOrganizationMembership | null;
    error: string | null;
  }> {
    try {
      // Get current user if userId not provided
      if (!userId) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return { data: null, error: 'User not authenticated' };
        }
        userId = user.id;
      }

      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .maybeSingle();

      if (memberError && memberError.code !== 'PGRST116') {
        return { data: null, error: memberError.message };
      }

      if (!membership) {
        return { data: null, error: 'User is not a member of this organization' };
      }

      const organizationMembership: UserOrganizationMembership = {
        id: membership.id,
        organization_id: membership.organization_id,
        user_id: membership.user_id,
        role: membership.role,
        permissions: membership.permissions,
        status: membership.status,
        organization: membership.organization,
        joined_at: membership.joined_at
      };

      return { data: organizationMembership, error: null };
    } catch (error) {
      console.error('Error getting organization membership:', error);
      return { data: null, error: 'Failed to get organization membership' };
    }
  }

  // Check if user can access specific organization
  static async canAccessOrganization(
    organizationId: string,
    userId?: string
  ): Promise<{
    canAccess: boolean;
    membership: UserOrganizationMembership | null;
    error: string | null;
  }> {
    const { data: membership, error } = await this.getOrganizationMembership(organizationId, userId);

    return {
      canAccess: membership !== null,
      membership,
      error
    };
  }

  // Get organization statistics for specific organization
  static async getOrganizationStats(organizationId: string): Promise<{
    data: {
      totalMembers: number;
      adminCount: number;
      memberCount: number;
      organizationName: string;
      createdAt: string;
    } | null;
    error: string | null;
  }> {
    try {
      // Get organization info
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('name, created_at')
        .eq('id', organizationId)
        .single();

      if (orgError) {
        return { data: null, error: orgError.message };
      }

      // Get member statistics
      const { data: members, error: memberError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      if (memberError) {
        return { data: null, error: memberError.message };
      }

      const totalMembers = members?.length || 0;
      const adminCount = members?.filter(m => m.role === 'admin').length || 0;
      const memberCount = totalMembers - adminCount;

      return {
        data: {
          totalMembers,
          adminCount,
          memberCount,
          organizationName: org.name,
          createdAt: org.created_at
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting organization stats:', error);
      return { data: null, error: 'Failed to get organization statistics' };
    }
  }

  // Switch user's active organization (this will be handled by UserModeContext)
  // but we provide validation here
  static async validateOrganizationSwitch(
    organizationId: string,
    userId?: string
  ): Promise<{
    isValid: boolean;
    membership: UserOrganizationMembership | null;
    error: string | null;
  }> {
    const { canAccess, membership, error } = await this.canAccessOrganization(organizationId, userId);

    return {
      isValid: canAccess,
      membership,
      error: error || (canAccess ? null : 'User cannot access this organization')
    };
  }
}