'use client';

import React, { useState } from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';

interface OrganizationModeSelectorProps {
  title: string;
  description: string;
  individualLabel: string;
  individualDescription: string;
  organizationDescription: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  className?: string;
  size?: 'compact' | 'normal' | 'large';
}

export default function OrganizationModeSelector({
  title,
  description,
  individualLabel,
  individualDescription,
  organizationDescription,
  onError,
  onSuccess,
  className = '',
  size = 'normal'
}: OrganizationModeSelectorProps) {
  const {
    activeMode,
    membershipStatus,
    allOrganizations,
    activeOrganization,
    switchToIndividualMode,
    switchToSpecificOrganization,
  } = useMultiOrgUserMode();

  const [switching, setSwitching] = useState(false);

  // Only show if user has organizations or is in organization mode
  if (membershipStatus === 'individual') {
    return null;
  }

  const handleSwitchToIndividual = async () => {
    setSwitching(true);
    try {
      const { error } = await switchToIndividualMode();
      if (error) {
        onError?.(error);
      }
    } catch (err) {
      onError?.('Failed to switch to individual mode');
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitchToOrganization = async (organizationId: string, organizationName: string) => {
    setSwitching(true);
    try {
      const { error } = await switchToSpecificOrganization(organizationId);
      if (error) {
        onError?.(error);
      }
    } catch (err) {
      onError?.(`Failed to switch to ${organizationName}`);
    } finally {
      setSwitching(false);
    }
  };

  // Size-based styling
  const containerPadding = {
    compact: 'p-4',
    normal: 'p-6',
    large: 'p-8'
  }[size];

  const titleSize = {
    compact: 'text-sm font-semibold',
    normal: 'text-lg font-semibold',
    large: 'text-xl font-semibold'
  }[size];

  const descriptionSize = {
    compact: 'text-xs',
    normal: 'text-sm',
    large: 'text-base'
  }[size];

  const buttonPadding = {
    compact: 'px-3 py-2',
    normal: 'px-4 py-3',
    large: 'px-6 py-4'
  }[size];

  const iconSize = {
    compact: 'w-6 h-6',
    normal: 'w-8 h-8',
    large: 'w-10 h-10'
  }[size];

  const iconInnerSize = {
    compact: 'w-3 h-3',
    normal: 'w-4 h-4',
    large: 'w-5 h-5'
  }[size];

  const checkmarkSize = {
    compact: 'w-4 h-4',
    normal: 'w-6 h-6',
    large: 'w-8 h-8'
  }[size];

  const checkmarkInnerSize = {
    compact: 'w-2 h-2',
    normal: 'w-3 h-3',
    large: 'w-4 h-4'
  }[size];

  return (
    <div className={`bg-white border border-slate-200 rounded-xl ${containerPadding} ${className}`}>
      <div className="mb-4">
        <h3 className={`${titleSize} text-slate-900 mb-2`}>{title}</h3>
        <p className={`${descriptionSize} text-slate-600`}>{description}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Individual Mode Option */}
        <button
          onClick={handleSwitchToIndividual}
          disabled={switching}
          className={`flex-1 min-w-[200px] ${buttonPadding} text-left rounded-lg transition-all duration-200 border-2 ${
            activeMode === 'individual'
              ? 'bg-blue-50 border-blue-200 shadow-sm'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`${iconSize} rounded-lg flex items-center justify-center ${
              activeMode === 'individual' ? 'bg-blue-100' : 'bg-slate-200'
            }`}>
              <svg className={`${iconInnerSize} ${
                activeMode === 'individual' ? 'text-blue-600' : 'text-slate-500'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium ${
                activeMode === 'individual' ? 'text-blue-900' : 'text-slate-900'
              }`}>{individualLabel}</div>
              <div className={`${descriptionSize} ${
                activeMode === 'individual' ? 'text-blue-700' : 'text-slate-600'
              }`}>{individualDescription}</div>
            </div>
            {activeMode === 'individual' && (
              <div className={`${checkmarkSize} bg-blue-600 rounded-full flex items-center justify-center`}>
                <svg className={`${checkmarkInnerSize} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        </button>

        {/* Organization Options */}
        {allOrganizations.map((org) => (
          <button
            key={org.organization_id}
            onClick={() => handleSwitchToOrganization(org.organization_id, org.organization.name)}
            disabled={switching}
            className={`flex-1 min-w-[200px] ${buttonPadding} text-left rounded-lg transition-all duration-200 border-2 ${
              activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`${iconSize} rounded-lg flex items-center justify-center ${
                activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                  ? 'bg-emerald-100' : 'bg-slate-200'
              }`}>
                <svg className={`${iconInnerSize} ${
                  activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                    ? 'text-emerald-600' : 'text-slate-500'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${
                  activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                    ? 'text-emerald-900' : 'text-slate-900'
                }`}>{org.organization.name}</div>
                <div className={`${descriptionSize} ${
                  activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                    ? 'text-emerald-700' : 'text-slate-600'
                }`}>
                  {org.role === 'admin' ? 'Administrator' : 'Member'} • {organizationDescription}
                </div>
              </div>

              {activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id && (
                <div className={`${checkmarkSize} bg-emerald-600 rounded-full flex items-center justify-center`}>
                  <svg className={`${checkmarkInnerSize} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {switching && (
        <div className="mt-4 flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-b-transparent mr-2"></div>
          <span className={`${descriptionSize} text-slate-600`}>Switching view...</span>
        </div>
      )}
    </div>
  );
}