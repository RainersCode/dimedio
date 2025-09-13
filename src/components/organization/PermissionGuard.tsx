'use client';

import React from 'react';
import { usePermissionCheck, PermissionHook } from '@/hooks/useOrganizationPermissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: keyof Omit<PermissionHook, 'loading' | 'error' | 'userMode' | 'userRole' | 'organizationId'>;
  fallback?: React.ReactNode;
  showError?: boolean;
  requireAuth?: boolean;
}

export default function PermissionGuard({
  children,
  permission,
  fallback,
  showError = true,
  requireAuth = false
}: PermissionGuardProps) {
  const { checkPermission, loading, error, userMode } = usePermissionCheck();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Show error state
  if (error && showError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex">
          <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-red-800">Permission Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasPermission = checkPermission(permission);

  // Show children if user has permission
  if (hasPermission) {
    return <>{children}</>;
  }

  // Show fallback or default denied message
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showError) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex">
          <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-2V9m0 0V7m0 2h2m-2 0H9m3-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-amber-800">Access Restricted</h3>
            <p className="text-sm text-amber-700 mt-1">
              You don't have permission to {permission.replace(/^can/, '').replace(/([A-Z])/g, ' $1').toLowerCase()}.
              {userMode === 'organization' && ' Please contact your organization administrator.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Return nothing if no fallback and showError is false
  return null;
}

// Specialized permission guards for common use cases
export function WriteOffGuard({ children, fallback, showError = true }: Omit<PermissionGuardProps, 'permission'>) {
  return (
    <PermissionGuard permission="canWriteOffDrugs" fallback={fallback} showError={showError}>
      {children}
    </PermissionGuard>
  );
}

export function ManageInventoryGuard({ children, fallback, showError = true }: Omit<PermissionGuardProps, 'permission'>) {
  return (
    <PermissionGuard permission="canManageInventory" fallback={fallback} showError={showError}>
      {children}
    </PermissionGuard>
  );
}

export function ManageMembersGuard({ children, fallback, showError = true }: Omit<PermissionGuardProps, 'permission'>) {
  return (
    <PermissionGuard permission="canManageMembers" fallback={fallback} showError={showError}>
      {children}
    </PermissionGuard>
  );
}

export function DiagnoseGuard({ children, fallback, showError = true }: Omit<PermissionGuardProps, 'permission'>) {
  return (
    <PermissionGuard permission="canDiagnosePatients" fallback={fallback} showError={showError}>
      {children}
    </PermissionGuard>
  );
}

export function DispenseGuard({ children, fallback, showError = true }: Omit<PermissionGuardProps, 'permission'>) {
  return (
    <PermissionGuard permission="canDispenseDrugs" fallback={fallback} showError={showError}>
      {children}
    </PermissionGuard>
  );
}