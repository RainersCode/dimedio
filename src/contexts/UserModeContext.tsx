'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { OrganizationService } from '@/lib/organizationService';
import type { UserModeInfo, Organization, OrganizationMember } from '@/types/organization';

// User's working mode (what they're actively using)
export type UserWorkingMode = 'individual' | 'organization';

// User's membership status (their actual relationship to organizations)
export type UserMembershipStatus = 'individual' | 'organization_member';

export interface UserModeContextType {
  // Core state
  membershipStatus: UserMembershipStatus;
  activeMode: UserWorkingMode;
  organization: Organization | null;
  member: OrganizationMember | null;

  // Mode switching capabilities
  canSwitchToOrganization: boolean;
  canSwitchToIndividual: boolean;

  // Actions
  switchToOrganizationMode: () => Promise<{ error: string | null }>;
  switchToIndividualMode: () => Promise<{ error: string | null }>;
  refreshModeInfo: () => Promise<void>;

  // Status
  loading: boolean;
  error: string | null;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

// Local storage key for user mode preference
const USER_MODE_PREFERENCE_KEY = 'dimedio_user_mode_preference';

export function UserModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth();

  // Core state
  const [membershipStatus, setMembershipStatus] = useState<UserMembershipStatus>('individual');
  const [activeMode, setActiveMode] = useState<UserWorkingMode>('individual');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [member, setMember] = useState<OrganizationMember | null>(null);

  // Status state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user mode preference from localStorage
  const loadModePreference = useCallback((): UserWorkingMode => {
    if (typeof window === 'undefined') return 'individual';

    try {
      const saved = localStorage.getItem(USER_MODE_PREFERENCE_KEY);
      return (saved as UserWorkingMode) || 'individual';
    } catch {
      return 'individual';
    }
  }, []);

  // Save user mode preference to localStorage
  const saveModePreference = useCallback((mode: UserWorkingMode) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(USER_MODE_PREFERENCE_KEY, mode);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Load user mode information
  const refreshModeInfo = useCallback(async () => {
    if (!user) {
      setMembershipStatus('individual');
      setActiveMode('individual');
      setOrganization(null);
      setMember(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user's organization membership status
      const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);

      if (modeError) {
        setError(modeError);
        setLoading(false);
        return;
      }

      if (modeInfo?.mode === 'organization' && modeInfo.organization && modeInfo.member) {
        // User is a member of an organization
        setMembershipStatus('organization_member');
        setOrganization(modeInfo.organization);
        setMember(modeInfo.member);

        // Set active mode based on user preference or default to organization
        const preferredMode = loadModePreference();
        const finalMode = preferredMode === 'organization' ? 'organization' : preferredMode;
        setActiveMode(finalMode);
      } else {
        // User is in individual mode
        setMembershipStatus('individual');
        setActiveMode('individual');
        setOrganization(null);
        setMember(null);
      }
    } catch (err) {
      console.error('Error refreshing mode info:', err);
      setError('Failed to load user mode information');
    } finally {
      setLoading(false);
    }
  }, [user, loadModePreference]);

  // Switch to organization mode
  const switchToOrganizationMode = useCallback(async (): Promise<{ error: string | null }> => {
    if (membershipStatus !== 'organization_member') {
      return { error: 'You must be a member of an organization to use organization mode' };
    }

    try {
      setActiveMode('organization');
      saveModePreference('organization');
      return { error: null };
    } catch (err) {
      console.error('Error switching to organization mode:', err);
      return { error: 'Failed to switch to organization mode' };
    }
  }, [membershipStatus, saveModePreference]);

  // Switch to individual mode
  const switchToIndividualMode = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      setActiveMode('individual');
      saveModePreference('individual');
      return { error: null };
    } catch (err) {
      console.error('Error switching to individual mode:', err);
      return { error: 'Failed to switch to individual mode' };
    }
  }, [saveModePreference]);

  // Load mode info when user changes
  useEffect(() => {
    refreshModeInfo();
  }, [refreshModeInfo]);

  // Computed properties
  const canSwitchToOrganization = membershipStatus === 'organization_member' && activeMode !== 'organization';
  const canSwitchToIndividual = activeMode !== 'individual';

  const contextValue: UserModeContextType = {
    // Core state
    membershipStatus,
    activeMode,
    organization,
    member,

    // Mode switching capabilities
    canSwitchToOrganization,
    canSwitchToIndividual,

    // Actions
    switchToOrganizationMode,
    switchToIndividualMode,
    refreshModeInfo,

    // Status
    loading,
    error
  };

  return (
    <UserModeContext.Provider value={contextValue}>
      {children}
    </UserModeContext.Provider>
  );
}

export function useUserMode(): UserModeContextType {
  const context = useContext(UserModeContext);
  if (context === undefined) {
    throw new Error('useUserMode must be used within a UserModeProvider');
  }
  return context;
}

// Helper hook for backward compatibility with existing code
export function useUserModePermissions() {
  const { activeMode, member, loading, error } = useUserMode();

  // Calculate permissions based on active mode
  if (activeMode === 'individual') {
    // Individual mode - full permissions
    return {
      canWriteOffDrugs: true,
      canManageMembers: true,
      canManageInventory: true,
      canDiagnosePatients: true,
      canDispenseDrugs: true,
      canViewReports: true,
      loading,
      error,
      userMode: 'individual' as const,
      userRole: null,
      organizationId: null
    };
  } else if (activeMode === 'organization' && member) {
    // Organization mode - permission-based
    return {
      canWriteOffDrugs: member.permissions.write_off_drugs || false,
      canManageMembers: member.permissions.manage_members || false,
      canManageInventory: member.permissions.manage_inventory || false,
      canDiagnosePatients: member.permissions.diagnose_patients || false,
      canDispenseDrugs: member.permissions.dispense_drugs || false,
      canViewReports: member.permissions.view_reports || false,
      loading,
      error,
      userMode: 'organization' as const,
      userRole: member.role,
      organizationId: member.organization_id
    };
  } else {
    // Loading or error state
    return {
      canWriteOffDrugs: false,
      canManageMembers: false,
      canManageInventory: false,
      canDiagnosePatients: false,
      canDispenseDrugs: false,
      canViewReports: false,
      loading,
      error: error || 'Unable to determine user permissions',
      userMode: null,
      userRole: null,
      organizationId: null
    };
  }
}