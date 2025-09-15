'use client';

import React, { useState } from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';

interface DiagnosisOrganizationSelectorProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export default function DiagnosisOrganizationSelector({ onError, onSuccess }: DiagnosisOrganizationSelectorProps) {
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
      } else {
        onSuccess?.('Switched to Individual mode');
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
      } else {
        onSuccess?.(`Switched to ${organizationName}`);
      }
    } catch (err) {
      onError?.(`Failed to switch to ${organizationName}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Diagnosis Context</h3>
        <p className="text-xs text-slate-600">Choose which context to create this diagnosis in</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Individual Mode Option */}
        <button
          onClick={handleSwitchToIndividual}
          disabled={switching}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-all duration-200 border ${
            activeMode === 'individual'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
          }`}
        >
          <div className={`w-4 h-4 rounded flex items-center justify-center ${
            activeMode === 'individual' ? 'bg-blue-100' : 'bg-slate-200'
          }`}>
            <svg className={`w-2.5 h-2.5 ${
              activeMode === 'individual' ? 'text-blue-600' : 'text-slate-500'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="font-medium">Personal</span>
          {activeMode === 'individual' && (
            <div className="w-3 h-3 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>

        {/* Organization Options */}
        {allOrganizations.map((org) => (
          <button
            key={org.organization_id}
            onClick={() => handleSwitchToOrganization(org.organization_id, org.organization.name)}
            disabled={switching}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-all duration-200 border ${
              activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center ${
              activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                ? 'bg-emerald-100' : 'bg-slate-200'
            }`}>
              <svg className={`w-2.5 h-2.5 ${
                activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                  ? 'text-emerald-600' : 'text-slate-500'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
              </svg>
            </div>
            <span className="font-medium truncate max-w-[120px]">{org.organization.name}</span>
            <span className="text-xs text-slate-500">({org.role})</span>
            {activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id && (
              <div className="w-3 h-3 bg-emerald-600 rounded-full flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {switching && (
        <div className="mt-3 flex items-center justify-center">
          <div className="animate-spin rounded-full h-3 w-3 border border-slate-400 border-b-transparent mr-1"></div>
          <span className="text-xs text-slate-600">Switching context...</span>
        </div>
      )}
    </div>
  );
}