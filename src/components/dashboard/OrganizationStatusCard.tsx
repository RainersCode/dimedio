'use client';

import React from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';

export default function OrganizationStatusCard() {
  const { activeMode, membershipStatus, organization, member } = useMultiOrgUserMode();

  if (membershipStatus !== 'multi_organization' || !organization) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-emerald-900">{organization.name}</h3>
            <p className="text-sm text-emerald-700">
              You are {member?.role === 'admin' ? 'an Administrator' : 'a Member'} of this organization
            </p>
            {activeMode === 'organization' && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-emerald-600">Currently viewing organization data</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            activeMode === 'organization'
              ? 'bg-emerald-500 text-white'
              : 'bg-emerald-200 text-emerald-800'
          }`}>
            {activeMode === 'organization' ? 'Active' : 'Available'}
          </div>
          {member?.role === 'admin' && (
            <p className="text-xs text-emerald-600 mt-1">Admin privileges</p>
          )}
        </div>
      </div>

      {activeMode !== 'organization' && (
        <div className="mt-4 pt-4 border-t border-emerald-200">
          <p className="text-sm text-emerald-700">
            💡 Switch to Organization mode to view and manage team data, collaborate with members, and access shared resources.
          </p>
        </div>
      )}
    </div>
  );
}