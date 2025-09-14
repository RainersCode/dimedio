'use client';

import React from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';

interface OrganizationContainerSwitcherProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export default function OrganizationContainerSwitcher({ onError, onSuccess }: OrganizationContainerSwitcherProps) {
  const {
    activeMode,
    membershipStatus,
    allOrganizations,
    activeOrganization,
    switchToIndividualMode,
    switchToSpecificOrganization,
  } = useMultiOrgUserMode();

  const handleSwitchToIndividual = async () => {
    const { error } = await switchToIndividualMode();
    if (error) {
      onError?.(error);
    } else {
      onSuccess?.('Switched to Individual mode');
    }
  };

  const handleSwitchToOrganization = async (organizationId: string, organizationName: string) => {
    const { error } = await switchToSpecificOrganization(organizationId);
    if (error) {
      onError?.(error);
    } else {
      onSuccess?.(`Switched to ${organizationName}`);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Switch Context</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Individual Mode Container */}
        <div
          onClick={handleSwitchToIndividual}
          className={`
            relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg
            ${activeMode === 'individual'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-slate-200 bg-white hover:border-slate-300'
            }
          `}
        >
          <div className="flex items-start gap-4">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
              ${activeMode === 'individual' ? 'bg-blue-500' : 'bg-slate-100'}
            `}>
              <svg
                className={`w-6 h-6 ${activeMode === 'individual' ? 'text-white' : 'text-slate-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold ${activeMode === 'individual' ? 'text-blue-900' : 'text-slate-800'}`}>
                Individual Practice
              </h3>
              <p className={`text-sm mt-1 ${activeMode === 'individual' ? 'text-blue-700' : 'text-slate-600'}`}>
                Personal practice and private patients
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${activeMode === 'individual' ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                <span className={`text-xs font-medium ${activeMode === 'individual' ? 'text-blue-700' : 'text-slate-500'}`}>
                  {activeMode === 'individual' ? 'Currently Active' : 'Available'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Indicator */}
          {activeMode === 'individual' && (
            <div className="absolute top-3 right-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          )}
        </div>

        {/* Organization Containers */}
        {membershipStatus === 'multi_organization' && allOrganizations.map((orgMembership) => (
          <div
            key={orgMembership.organization_id}
            onClick={() => handleSwitchToOrganization(orgMembership.organization_id, orgMembership.organization.name)}
            className={`
              relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg
              ${activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
              }
            `}
          >
            <div className="flex items-start gap-4">
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                ${activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                  ? 'bg-emerald-500'
                  : 'bg-slate-100'
                }
              `}>
                <svg
                  className={`w-6 h-6 ${
                    activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                      ? 'text-white'
                      : 'text-slate-600'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold truncate ${
                  activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                    ? 'text-emerald-900'
                    : 'text-slate-800'
                }`}>
                  {orgMembership.organization.name}
                </h3>
                <p className={`text-sm mt-1 ${
                  activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                    ? 'text-emerald-700'
                    : 'text-slate-600'
                }`}>
                  {orgMembership.role === 'admin' ? 'Administrator' : 'Member'} • {orgMembership.organization.member_count || 0} members
                </p>
                {orgMembership.organization.description && (
                  <p className={`text-xs mt-1 truncate ${
                    activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}>
                    {orgMembership.organization.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${
                    activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                  }`}></div>
                  <span className={`text-xs font-medium ${
                    activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                  }`}>
                    {activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                      ? 'Currently Active'
                      : 'Available'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Role Badge */}
            {orgMembership.role === 'admin' && (
              <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${
                activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                Admin
              </div>
            )}

            {/* Active Indicator */}
            {activeMode === 'organization' && activeOrganization?.organization_id === orgMembership.organization_id && (
              <div className="absolute top-3 right-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
        ))}

        {/* Add Organization Container (for users who can create/join) */}
        {membershipStatus !== 'multi_organization' && (
          <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center min-h-[160px]">
            <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Join or Create Organization</h3>
            <p className="text-sm text-slate-500">
              Collaborate with your team
            </p>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {activeMode === 'organization' && activeOrganization && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-800">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              Currently viewing {activeOrganization.organization.name} data
            </span>
          </div>
        </div>
      )}
    </div>
  );
}