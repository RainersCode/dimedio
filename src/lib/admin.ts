import { supabase } from './supabase';
import type { UserRole, UserRoles, AdminUser, RoleChangeHistory } from '@/types/database';

export class AdminService {
  // Check if current user is admin
  static async isCurrentUserAdmin(): Promise<{ isAdmin: boolean; role: UserRole }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { isAdmin: false, role: 'user' };
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return { isAdmin: false, role: 'user' };
      }

      const isAdmin = ['admin', 'super_admin'].includes(data.role as UserRole);
      return { isAdmin, role: data.role as UserRole };
    } catch (error) {
      console.error('Error checking admin status:', error);
      return { isAdmin: false, role: 'user' };
    }
  }

  // Get all users with their roles
  static async getAllUsers(): Promise<{ data: AdminUser[] | null; error: string | null }> {
    try {
      // Get all roles with basic user info from our user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*');

      if (roleError) {
        console.error('Error fetching roles:', roleError);
        return { data: null, error: roleError.message };
      }

      // Create admin users array with available data
      const adminUsers: AdminUser[] = (roleData || []).map(role => ({
        id: role.user_id,
        email: 'User', // We'll show just 'User' since we can't access email directly
        name: `User ${role.user_id.slice(0, 8)}`, // Show partial ID as name
        email_verified: true, // Assume verified since they have a role
        role: role.role as UserRole,
        created_at: role.created_at,
        last_sign_in_at: null,
      }));

      return { data: adminUsers, error: null };
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      return { data: null, error: 'Failed to fetch users' };
    }
  }

  // Change user role
  static async changeUserRole(
    userId: string, 
    newRole: UserRole, 
    reason?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if current user is admin
      const { isAdmin } = await this.isCurrentUserAdmin();
      if (!isAdmin) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Update user role
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ 
          role: newRole,
          assigned_by: user.id,
          assigned_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating user role:', updateError);
        return { success: false, error: updateError.message };
      }

      // Log the change (trigger will handle this, but we can also do it manually)
      if (reason) {
        await supabase
          .from('role_change_history')
          .insert({
            user_id: userId,
            changed_by: user.id,
            new_role: newRole,
            reason: reason
          });
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error changing user role:', error);
      return { success: false, error: 'Failed to change user role' };
    }
  }

  // Get role change history
  static async getRoleHistory(): Promise<{ data: RoleChangeHistory[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('role_change_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching role history:', error);
        return { data: null, error: error.message };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error in getRoleHistory:', error);
      return { data: null, error: 'Failed to fetch role history' };
    }
  }

  // Get system statistics
  static async getSystemStats(): Promise<{
    data: {
      totalUsers: number;
      totalDiagnoses: number;
      adminUsers: number;
      moderatorUsers: number;
      recentSignups: number;
    } | null;
    error: string | null;
  }> {
    try {
      // Get user counts by role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role');

      if (roleError) {
        return { data: null, error: roleError.message };
      }

      // Get total diagnoses count
      const { count: diagnosesCount, error: diagnosesError } = await supabase
        .from('diagnoses')
        .select('*', { count: 'exact', head: true });

      if (diagnosesError) {
        console.error('Error fetching diagnoses count:', diagnosesError);
      }

      // Count users by role
      const roleCounts = (roleData || []).reduce((acc: any, item) => {
        acc[item.role] = (acc[item.role] || 0) + 1;
        return acc;
      }, {});

      const totalUsers = roleData?.length || 0;
      const adminUsers = (roleCounts.admin || 0) + (roleCounts.super_admin || 0);
      const moderatorUsers = roleCounts.moderator || 0;

      // Get recent signups (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentSignups, error: recentError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      return {
        data: {
          totalUsers,
          totalDiagnoses: diagnosesCount || 0,
          adminUsers,
          moderatorUsers,
          recentSignups: recentSignups || 0,
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return { data: null, error: 'Failed to fetch system statistics' };
    }
  }

  // Create or update user role (for new users)
  static async ensureUserRole(userId: string, role: UserRole = 'user'): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          role: role,
          assigned_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error ensuring user role:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in ensureUserRole:', error);
      return { success: false, error: 'Failed to ensure user role' };
    }
  }
}