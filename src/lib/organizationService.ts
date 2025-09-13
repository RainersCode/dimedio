import { supabase } from './supabase';
import type {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  UserMode,
  UserModeInfo
} from '@/types/organization';

export class OrganizationService {
  // =====================================================
  // USER MODE DETECTION
  // =====================================================

  static async getUserModeInfo(userId?: string): Promise<{ data: UserModeInfo | null; error: string | null }> {
    try {
      // Get current user if userId not provided
      if (!userId) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return { data: null, error: 'User not authenticated' };
        }
        userId = user.id;
      }

      // Check if user is member of any organization
      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (memberError && memberError.code !== 'PGRST116') { // PGRST116 = no rows returned
        return { data: null, error: memberError.message };
      }

      if (member) {
        return {
          data: {
            mode: 'organization',
            organization: member.organization,
            member: member
          },
          error: null
        };
      }

      return {
        data: {
          mode: 'individual'
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting user mode info:', error);
      return { data: null, error: 'Failed to determine user mode' };
    }
  }

  static async getUserMode(userId?: string): Promise<{ data: UserMode | null; error: string | null }> {
    const result = await this.getUserModeInfo(userId);
    if (result.error) {
      return { data: null, error: result.error };
    }
    return { data: result.data?.mode || null, error: null };
  }

  // =====================================================
  // ORGANIZATION MANAGEMENT
  // =====================================================

  static async createOrganization(name: string, description?: string): Promise<{ data: Organization | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Create organization
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name,
          description,
          created_by: user.id
        }])
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        return { data: null, error: `Failed to create organization: ${orgError.message}` };
      }

      console.log('Organization created successfully:', organization);

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: organization.id,
          user_id: user.id,
          user_email: user.email,
          role: 'admin',
          permissions: {
            write_off_drugs: true,
            manage_members: true,
            view_all_data: true,
            diagnose_patients: true,
            dispense_drugs: true,
            manage_inventory: true,
            view_reports: true
          },
          status: 'active'
        }]);

      if (memberError) {
        console.error('Error creating organization member:', memberError);
        // Rollback organization creation
        await supabase.from('organizations').delete().eq('id', organization.id);
        return { data: null, error: `Failed to add admin member: ${memberError.message}` };
      }

      console.log('Organization member created successfully');

      return { data: organization, error: null };
    } catch (error) {
      console.error('Error creating organization:', error);
      return { data: null, error: 'Failed to create organization' };
    }
  }

  static async getOrganization(organizationId: string): Promise<{ data: Organization | null; error: string | null }> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  static async updateOrganization(
    organizationId: string,
    updates: Partial<Pick<Organization, 'name' | 'description' | 'settings'>>
  ): Promise<{ data: Organization | null; error: string | null }> {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  static async deleteOrganization(organizationId: string): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    try {
      // Call the database function to delete organization with elevated privileges
      const { data, error: functionError } = await supabase.rpc('delete_organization', {
        org_id: organizationId,
        user_id: user.id
      });

      if (functionError) {
        console.error('Database function error:', functionError);
        return { error: functionError.message };
      }

      return { error: null };
    } catch (error) {
      console.error('Error deleting organization:', error);
      return { error: 'Failed to delete organization' };
    }
  }

  // =====================================================
  // MEMBER MANAGEMENT
  // =====================================================

  static async getOrganizationMembers(organizationId: string): Promise<{ data: OrganizationMember[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    // Add user info structure for compatibility with existing UI
    if (data) {
      const membersWithUserInfo = data.map(member => ({
        ...member,
        user: {
          id: member.user_id,
          email: member.user_email || 'Unknown Email'
        }
      }));

      return { data: membersWithUserInfo, error: null };
    }

    return { data, error: null };
  }

  static async updateMemberPermissions(
    memberId: string,
    permissions: Partial<OrganizationMember['permissions']>
  ): Promise<{ data: OrganizationMember | null; error: string | null }> {
    // Get current permissions first
    const { data: currentMember, error: fetchError } = await supabase
      .from('organization_members')
      .select('permissions')
      .eq('id', memberId)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    // Merge with new permissions
    const updatedPermissions = {
      ...currentMember.permissions,
      ...permissions
    };

    const { data, error } = await supabase
      .from('organization_members')
      .update({ permissions: updatedPermissions })
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  static async updateMemberRole(
    memberId: string,
    role: OrganizationMember['role']
  ): Promise<{ data: OrganizationMember | null; error: string | null }> {
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  static async removeMember(memberId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }

  // =====================================================
  // INVITATION MANAGEMENT
  // =====================================================

  static async inviteUser(
    organizationId: string,
    email: string,
    role: OrganizationMember['role'] = 'member',
    permissions?: Partial<OrganizationMember['permissions']>
  ): Promise<{ data: OrganizationInvitation | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const defaultPermissions = {
      write_off_drugs: false,
      manage_members: false,
      view_all_data: true,
      diagnose_patients: true,
      dispense_drugs: true,
      manage_inventory: false,
      view_reports: true,
      ...permissions
    };

    const { data, error } = await supabase
      .from('organization_invitations')
      .insert([{
        organization_id: organizationId,
        email,
        invited_by: user.id,
        role,
        permissions: defaultPermissions
      }])
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Send invitation email
    try {
      const invitationUrl = `${window.location.origin}/organization/invite?token=${data.token}`;

      // Get organization info for the email
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      // For now, we'll use a simple approach - in a real app you'd want to use
      // Supabase Edge Functions or a proper email service
      console.log(`
        Invitation Email Details:
        To: ${email}
        Subject: Invitation to join ${orgData?.name || 'organization'} on Dimedio

        You've been invited to join ${orgData?.name || 'an organization'} on Dimedio!

        Click here to accept the invitation:
        ${invitationUrl}

        This invitation will expire in 7 days.
      `);

      // TODO: Replace this with actual email sending
      // For now, copy the invitation URL to clipboard and show a message
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(invitationUrl);
        console.log('Invitation URL copied to clipboard:', invitationUrl);
      }

    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      // Don't fail the invitation creation if email fails
    }

    return { data, error: null };
  }

  static async getInvitation(token: string): Promise<{ data: OrganizationInvitation | null; error: string | null }> {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Check if invitation is expired
    if (new Date(data.expires_at) < new Date()) {
      await supabase
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('id', data.id);

      return { data: null, error: 'Invitation has expired' };
    }

    return { data, error: null };
  }

  static async acceptInvitation(token: string): Promise<{ data: OrganizationMember | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Get invitation details
      const { data: invitation, error: inviteError } = await this.getInvitation(token);
      if (inviteError || !invitation) {
        return { data: null, error: inviteError || 'Invalid invitation' };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        return { data: null, error: 'You are already a member of this organization' };
      }

      // Create membership
      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: invitation.organization_id,
          user_id: user.id,
          user_email: user.email,
          role: invitation.role,
          permissions: invitation.permissions,
          status: 'active',
          invited_by: invitation.invited_by
        }])
        .select()
        .single();

      if (memberError) {
        return { data: null, error: memberError.message };
      }

      // Update invitation status
      await supabase
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      return { data: member, error: null };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { data: null, error: 'Failed to accept invitation' };
    }
  }

  static async declineInvitation(token: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'declined' })
      .eq('token', token);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }

  // =====================================================
  // PERMISSION CHECKS
  // =====================================================

  static async hasPermission(
    userId: string,
    permission: keyof OrganizationMember['permissions']
  ): Promise<{ data: boolean; error: string | null }> {
    try {
      const { data: member, error } = await supabase
        .from('organization_members')
        .select('permissions')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        return { data: false, error: error.message };
      }

      if (!member) {
        // User is in individual mode, grant all permissions
        return { data: true, error: null };
      }

      return { data: member.permissions[permission] === true, error: null };
    } catch (error) {
      console.error('Error checking permission:', error);
      return { data: false, error: 'Failed to check permission' };
    }
  }

  static async canWriteOffDrugs(userId?: string): Promise<{ data: boolean; error: string | null }> {
    if (!userId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: false, error: 'User not authenticated' };
      }
      userId = user.id;
    }

    return this.hasPermission(userId, 'write_off_drugs');
  }

  static async canManageMembers(userId?: string): Promise<{ data: boolean; error: string | null }> {
    if (!userId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: false, error: 'User not authenticated' };
      }
      userId = user.id;
    }

    return this.hasPermission(userId, 'manage_members');
  }

  // =====================================================
  // ORGANIZATION SWITCHING
  // =====================================================

  static async leaveOrganization(): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }
}