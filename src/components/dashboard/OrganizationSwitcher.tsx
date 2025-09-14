'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';

interface OrganizationSwitcherProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export default function OrganizationSwitcher({ onError, onSuccess }: OrganizationSwitcherProps) {
  const {
    activeMode,
    membershipStatus,
    allOrganizations,
    activeOrganization,
    switchToIndividualMode,
    switchToSpecificOrganization,
    canSwitchToIndividual
  } = useMultiOrgUserMode();

  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSwitchToIndividual = async () => {
    setSwitching(true);
    try {
      const { error } = await switchToIndividualMode();
      if (error) {
        onError?.(error);
      } else {
        onSuccess?.('Switched to Individual mode');
        setIsOpen(false);
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
        setIsOpen(false);
      }
    } catch (err) {
      onError?.(`Failed to switch to ${organizationName}`);
    } finally {
      setSwitching(false);
    }
  };

  // Don't show if user has no organizations
  if (membershipStatus === 'individual') {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Mode Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors min-w-[200px]"
        disabled={switching}
      >
        <div className={`w-3 h-3 rounded-full ${
          activeMode === 'organization' ? 'bg-emerald-500' : 'bg-blue-500'
        }`}></div>

        <div className="flex-1 text-left">
          {activeMode === 'organization' && activeOrganization ? (
            <>
              <div className="text-sm font-medium text-slate-900 truncate">
                {activeOrganization.organization.name}
              </div>
              <div className="text-xs text-slate-600">
                {activeOrganization.role === 'admin' ? 'Administrator' : 'Member'}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-900">Individual Mode</div>
              <div className="text-xs text-slate-600">Personal practice</div>
            </>
          )}
        </div>

        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>

        {switching && (
          <div className="animate-spin rounded-full h-3 w-3 border border-slate-400 border-b-transparent ml-2"></div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 max-h-96 overflow-y-auto">

          {/* Individual Mode Option */}
          <button
            onClick={handleSwitchToIndividual}
            disabled={switching}
            className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 ${
              activeMode === 'individual' ? 'bg-blue-50 border-r-2 border-blue-500' : ''
            }`}
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">Individual Mode</div>
              <div className="text-xs text-slate-600">Personal practice & full control</div>
            </div>
            {activeMode === 'individual' && (
              <div className="flex items-center gap-1 text-blue-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium">Active</span>
              </div>
            )}
          </button>

          {/* Divider */}
          <div className="border-t border-slate-100 my-2"></div>

          {/* Organizations Header */}
          <div className="px-4 py-2">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Organizations ({allOrganizations.length})
            </h4>
          </div>

          {/* Organization Options */}
          {allOrganizations.map((org) => (
            <button
              key={org.organization_id}
              onClick={() => handleSwitchToOrganization(org.organization_id, org.organization.name)}
              disabled={switching}
              className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id
                  ? 'bg-emerald-50 border-r-2 border-emerald-500'
                  : ''
              }`}
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {org.organization.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`px-2 py-0.5 rounded-full ${
                    org.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {org.role === 'admin' ? 'Administrator' : 'Member'}
                  </span>
                  <span>•</span>
                  <span>Joined {new Date(org.joined_at).toLocaleDateString()}</span>
                </div>

                {/* Permissions Preview */}
                <div className="flex items-center gap-1 mt-1">
                  {org.permissions.diagnose_patients && (
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" title="Can diagnose patients"></span>
                  )}
                  {org.permissions.manage_inventory && (
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" title="Can manage inventory"></span>
                  )}
                  {org.permissions.manage_members && (
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" title="Can manage members"></span>
                  )}
                  {org.permissions.write_off_drugs && (
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" title="Can write off drugs"></span>
                  )}
                  {org.permissions.view_reports && (
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" title="Can view reports"></span>
                  )}
                </div>
              </div>

              {activeMode === 'organization' && activeOrganization?.organization_id === org.organization_id && (
                <div className="flex items-center gap-1 text-emerald-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-medium">Active</span>
                </div>
              )}
            </button>
          ))}

          {/* Footer */}
          <div className="border-t border-slate-100 mt-2 px-4 py-3">
            <p className="text-xs text-slate-500">
              Switch organizations to work with different teams and data sets
            </p>
          </div>
        </div>
      )}
    </div>
  );
}