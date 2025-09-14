'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { MultiOrganizationService, UserOrganizationMembership } from '@/lib/multiOrganizationService';
import type { Organization } from '@/types/organization';

// User's working mode (what they're actively using)
export type UserWorkingMode = 'individual' | 'organization';

// User's membership status (their actual relationship to organizations)
export type UserMembershipStatus = 'individual' | 'multi_organization';

export interface MultiOrgUserModeContextType {
  // Core state
  membershipStatus: UserMembershipStatus;
  activeMode: UserWorkingMode;
  allOrganizations: UserOrganizationMembership[];
  activeOrganization: UserOrganizationMembership | null;

  // Computed properties for backward compatibility
  organization: Organization | null;
  member: UserOrganizationMembership | null;
  organizationId: string | null;

  // Mode switching capabilities
  canSwitchToOrganization: boolean;
  canSwitchToIndividual: boolean;

  // Actions
  switchToOrganizationMode: (organizationId?: string) => Promise<{ error: string | null }>;
  switchToIndividualMode: () => Promise<{ error: string | null }>;
  switchToSpecificOrganization: (organizationId: string) => Promise<{ error: string | null }>;
  refreshModeInfo: () => Promise<void>;

  // Multi-org specific actions
  getAvailableOrganizations: () => UserOrganizationMembership[];
  canAccessOrganization: (organizationId: string) => boolean;

  // Status
  loading: boolean;
  error: string | null;
}

const MultiOrgUserModeContext = createContext<MultiOrgUserModeContextType | undefined>(undefined);

// Local storage keys
const ACTIVE_MODE_KEY = 'dimedio_active_mode';
const ACTIVE_ORGANIZATION_KEY = 'dimedio_active_organization_id';

export function MultiOrgUserModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth();

  // Core state
  const [membershipStatus, setMembershipStatus] = useState<UserMembershipStatus>('individual');
  const [activeMode, setActiveMode] = useState<UserWorkingMode>('individual');
  const [allOrganizations, setAllOrganizations] = useState<UserOrganizationMembership[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<UserOrganizationMembership | null>(null);

  // Status state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from localStorage
  const loadPreferences = useCallback(() => {
    if (typeof window === 'undefined') return { mode: 'individual' as UserWorkingMode, organizationId: null };

    try {
      const savedMode = localStorage.getItem(ACTIVE_MODE_KEY) as UserWorkingMode;
      const savedOrgId = localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
      return {
        mode: savedMode || 'individual',
        organizationId: savedOrgId
      };
    } catch {
      return { mode: 'individual' as UserWorkingMode, organizationId: null };
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((mode: UserWorkingMode, organizationId?: string | null) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(ACTIVE_MODE_KEY, mode);
      if (organizationId) {
        localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
      } else {
        localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Load user mode information
  const refreshModeInfo = useCallback(async () => {
    if (!user) {
      setMembershipStatus('individual');
      setActiveMode('individual');
      setAllOrganizations([]);
      setActiveOrganization(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all organizations user belongs to
      const { data: organizations, error: orgError } = await MultiOrganizationService.getUserOrganizations(user.id);

      if (orgError) {
        setError(orgError);
        setLoading(false);
        return;
      }

      if (!organizations || organizations.length === 0) {
        // User has no organization memberships
        setMembershipStatus('individual');
        setActiveMode('individual');
        setAllOrganizations([]);
        setActiveOrganization(null);
        savePreferences('individual');
      } else {
        // User has organization memberships
        setMembershipStatus('multi_organization');
        setAllOrganizations(organizations);

        // Load user preferences
        const { mode: preferredMode, organizationId: preferredOrgId } = loadPreferences();

        if (preferredMode === 'organization' && preferredOrgId) {
          // Try to set the preferred organization
          const preferredOrg = organizations.find(org => org.organization_id === preferredOrgId);
          if (preferredOrg) {
            setActiveMode('organization');
            setActiveOrganization(preferredOrg);
          } else {
            // Preferred org not found, default to first organization
            setActiveMode('organization');
            setActiveOrganization(organizations[0]);
            savePreferences('organization', organizations[0].organization_id);
          }
        } else if (preferredMode === 'organization') {
          // User prefers organization mode but no specific org saved, use first
          setActiveMode('organization');
          setActiveOrganization(organizations[0]);
          savePreferences('organization', organizations[0].organization_id);
        } else {
          // User prefers individual mode
          setActiveMode('individual');
          setActiveOrganization(null);
          savePreferences('individual');
        }
      }
    } catch (err) {
      console.error('Error refreshing mode info:', err);
      setError('Failed to load user mode information');
    } finally {
      setLoading(false);
    }
  }, [user, loadPreferences, savePreferences]);

  // Switch to individual mode
  const switchToIndividualMode = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      setActiveMode('individual');
      setActiveOrganization(null);
      savePreferences('individual');
      return { error: null };
    } catch (err) {
      console.error('Error switching to individual mode:', err);
      return { error: 'Failed to switch to individual mode' };
    }
  }, [savePreferences]);

  // Switch to organization mode (use first available org if no specific org provided)
  const switchToOrganizationMode = useCallback(async (organizationId?: string): Promise<{ error: string | null }> => {
    if (membershipStatus !== 'multi_organization' || allOrganizations.length === 0) {
      return { error: 'You must be a member of an organization to use organization mode' };
    }

    try {
      let targetOrg: UserOrganizationMembership;

      if (organizationId) {
        const requestedOrg = allOrganizations.find(org => org.organization_id === organizationId);
        if (!requestedOrg) {
          return { error: 'You are not a member of the specified organization' };
        }
        targetOrg = requestedOrg;
      } else {
        // No specific org requested, use first available
        targetOrg = allOrganizations[0];
      }

      setActiveMode('organization');
      setActiveOrganization(targetOrg);
      savePreferences('organization', targetOrg.organization_id);
      return { error: null };
    } catch (err) {
      console.error('Error switching to organization mode:', err);
      return { error: 'Failed to switch to organization mode' };
    }
  }, [membershipStatus, allOrganizations, savePreferences]);

  // Switch to a specific organization
  const switchToSpecificOrganization = useCallback(async (organizationId: string): Promise<{ error: string | null }> => {
    const targetOrg = allOrganizations.find(org => org.organization_id === organizationId);
    if (!targetOrg) {
      return { error: 'You are not a member of this organization' };
    }

    try {
      setActiveMode('organization');
      setActiveOrganization(targetOrg);
      savePreferences('organization', organizationId);
      return { error: null };
    } catch (err) {
      console.error('Error switching to organization:', err);
      return { error: 'Failed to switch to organization' };
    }
  }, [allOrganizations, savePreferences]);

  // Get available organizations
  const getAvailableOrganizations = useCallback((): UserOrganizationMembership[] => {
    return allOrganizations;
  }, [allOrganizations]);

  // Check if user can access specific organization
  const canAccessOrganization = useCallback((organizationId: string): boolean => {
    return allOrganizations.some(org => org.organization_id === organizationId);
  }, [allOrganizations]);

  // Load mode info when user changes
  useEffect(() => {
    refreshModeInfo();
  }, [refreshModeInfo]);

  // Computed properties for backward compatibility
  const organization = activeOrganization?.organization || null;
  const member = activeOrganization || null;
  const organizationId = activeOrganization?.organization_id || null;

  // Mode switching capabilities
  const canSwitchToOrganization = allOrganizations.length > 0 && activeMode !== 'organization';
  const canSwitchToIndividual = activeMode !== 'individual';

  const contextValue: MultiOrgUserModeContextType = {
    // Core state
    membershipStatus,
    activeMode,
    allOrganizations,
    activeOrganization,

    // Computed properties for backward compatibility
    organization,
    member,
    organizationId,

    // Mode switching capabilities
    canSwitchToOrganization,
    canSwitchToIndividual,

    // Actions
    switchToOrganizationMode,
    switchToIndividualMode,
    switchToSpecificOrganization,
    refreshModeInfo,

    // Multi-org specific actions
    getAvailableOrganizations,
    canAccessOrganization,

    // Status
    loading,
    error
  };

  return (
    <MultiOrgUserModeContext.Provider value={contextValue}>
      {children}
    </MultiOrgUserModeContext.Provider>
  );
}

export function useMultiOrgUserMode(): MultiOrgUserModeContextType {
  const context = useContext(MultiOrgUserModeContext);
  if (context === undefined) {
    throw new Error('useMultiOrgUserMode must be used within a MultiOrgUserModeProvider');
  }
  return context;
}

// Helper hook for backward compatibility with existing permission system
export function useMultiOrgUserModePermissions() {
  const { activeMode, activeOrganization, loading, error } = useMultiOrgUserMode();

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
  } else if (activeMode === 'organization' && activeOrganization) {
    // Organization mode - permission-based
    return {
      canWriteOffDrugs: activeOrganization.permissions.write_off_drugs || false,
      canManageMembers: activeOrganization.permissions.manage_members || false,
      canManageInventory: activeOrganization.permissions.manage_inventory || false,
      canDiagnosePatients: activeOrganization.permissions.diagnose_patients || false,
      canDispenseDrugs: activeOrganization.permissions.dispense_drugs || false,
      canViewReports: activeOrganization.permissions.view_reports || false,
      loading,
      error,
      userMode: 'organization' as const,
      userRole: activeOrganization.role,
      organizationId: activeOrganization.organization_id
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