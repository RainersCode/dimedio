import { useMultiOrgUserModePermissions } from '@/contexts/MultiOrgUserModeContext';

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

// Backward compatibility wrapper - delegates to new MultiOrgUserModeContext
export function useOrganizationPermissions(): PermissionHook {
  return useMultiOrgUserModePermissions();
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