import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { OrganizationService } from '@/lib/organizationService';
import type { OrganizationMember } from '@/types/organization';

export interface PermissionHook {
  canWriteOffDrugs: boolean;
  canManageMembers: boolean;
  canManageInventory: boolean;
  canDiagnosePatients: boolean;
  canDispenseDrugs: boolean;
  canViewReports: boolean;
  loading: boolean;
  error: string | null;
  userMode: 'individual' | 'organization' | null;
  userRole: 'admin' | 'member' | null;
  organizationId: string | null;
}

export function useOrganizationPermissions(): PermissionHook {
  const { user } = useSupabaseAuth();
  const [permissions, setPermissions] = useState<PermissionHook>({
    canWriteOffDrugs: false,
    canManageMembers: false,
    canManageInventory: false,
    canDiagnosePatients: false,
    canDispenseDrugs: false,
    canViewReports: false,
    loading: true,
    error: null,
    userMode: null,
    userRole: null,
    organizationId: null
  });

  useEffect(() => {
    if (user) {
      loadPermissions();
    } else {
      setPermissions(prev => ({
        ...prev,
        loading: false,
        userMode: null,
        userRole: null,
        organizationId: null
      }));
    }
  }, [user]);

  const loadPermissions = async () => {
    if (!user) return;

    try {
      setPermissions(prev => ({ ...prev, loading: true, error: null }));

      // Get user mode info
      const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
      if (modeError) {
        setPermissions(prev => ({ ...prev, error: modeError, loading: false }));
        return;
      }

      if (modeInfo?.mode === 'individual') {
        // Individual users have all permissions
        setPermissions({
          canWriteOffDrugs: true,
          canManageMembers: true,
          canManageInventory: true,
          canDiagnosePatients: true,
          canDispenseDrugs: true,
          canViewReports: true,
          loading: false,
          error: null,
          userMode: 'individual',
          userRole: null,
          organizationId: null
        });
      } else if (modeInfo?.mode === 'organization' && modeInfo.member) {
        // Organization users follow permission system
        const member = modeInfo.member;
        setPermissions({
          canWriteOffDrugs: member.permissions.write_off_drugs || false,
          canManageMembers: member.permissions.manage_members || false,
          canManageInventory: member.permissions.manage_inventory || false,
          canDiagnosePatients: member.permissions.diagnose_patients || false,
          canDispenseDrugs: member.permissions.dispense_drugs || false,
          canViewReports: member.permissions.view_reports || false,
          loading: false,
          error: null,
          userMode: 'organization',
          userRole: member.role,
          organizationId: modeInfo.organization?.id || null
        });
      } else {
        setPermissions(prev => ({
          ...prev,
          loading: false,
          error: 'Unable to determine user permissions'
        }));
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions(prev => ({
        ...prev,
        error: 'Failed to load permissions',
        loading: false
      }));
    }
  };

  return permissions;
}

// Hook for checking specific permissions
export function usePermissionCheck() {
  const permissions = useOrganizationPermissions();

  const checkPermission = (permission: keyof Omit<PermissionHook, 'loading' | 'error' | 'userMode' | 'userRole' | 'organizationId'>) => {
    if (permissions.loading) return null; // Still loading
    return permissions[permission];
  };

  const requirePermission = (permission: keyof Omit<PermissionHook, 'loading' | 'error' | 'userMode' | 'userRole' | 'organizationId'>) => {
    const hasPermission = checkPermission(permission);
    if (hasPermission === null) return { loading: true, hasPermission: false, error: null };
    if (!hasPermission) return { loading: false, hasPermission: false, error: `You don't have permission to ${permission.replace(/^can/, '').replace(/([A-Z])/g, ' $1').toLowerCase()}` };
    return { loading: false, hasPermission: true, error: null };
  };

  return {
    ...permissions,
    checkPermission,
    requirePermission
  };
}