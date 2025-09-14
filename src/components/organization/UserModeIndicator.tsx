'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserMode } from '@/contexts/UserModeContext';
import { OrganizationService } from '@/lib/organizationService';

interface UserModeIndicatorProps {
  compact?: boolean;
  showModeSwitch?: boolean;
  showOrganizationManagement?: boolean;
}

export default function UserModeIndicator({
  compact = false,
  showModeSwitch = true,
  showOrganizationManagement = true
}: UserModeIndicatorProps) {
  const {
    activeMode,
    membershipStatus,
    member,
    canSwitchToOrganization,
    canSwitchToIndividual,
    switchToOrganizationMode,
    switchToIndividualMode,
    loading
  } = useUserMode();
  const [switching, setSwitching] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const router = useRouter();

  const handleModeSwitch = async () => {
    if (activeMode === 'organization') {
      // Switch to individual mode (keeps org membership)
      setSwitching(true);
      const { error } = await switchToIndividualMode();
      if (error) {
        alert('Failed to switch to individual mode: ' + error);
      }
      setSwitching(false);
    } else if (canSwitchToOrganization) {
      // Switch to organization mode
      setSwitching(true);
      const { error } = await switchToOrganizationMode();
      if (error) {
        alert('Failed to switch to organization mode: ' + error);
      }
      setSwitching(false);
    } else {
      // Redirect to organization management to join/create
      router.push('/organization');
    }
  };

  const handleLeaveOrganization = async () => {
    if (!confirm('Are you sure you want to leave the organization? You will lose access to shared resources.')) {
      return;
    }

    setSwitching(true);
    const { error } = await OrganizationService.leaveOrganization();
    if (error) {
      alert('Failed to leave organization: ' + error);
    } else {
      // Reload the page to refresh the user mode
      window.location.reload();
    }
    setSwitching(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className="animate-pulse bg-slate-200 rounded h-4 w-16"></div>
        <div className="animate-pulse bg-slate-200 rounded h-4 w-8"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          activeMode === 'organization'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {activeMode === 'organization' ? 'Org' : 'Individual'}
        </span>
        {activeMode === 'organization' && member?.role && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            member.role === 'admin'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-slate-100 text-slate-800'
          }`}>
            {member.role}
          </span>
        )}
        {membershipStatus === 'organization_member' && (canSwitchToOrganization || canSwitchToIndividual) && (
          <button
            onClick={handleModeSwitch}
            disabled={switching}
            className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            title={`Switch to ${activeMode === 'organization' ? 'individual' : 'organization'} mode`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            activeMode === 'organization'
              ? 'bg-emerald-100'
              : 'bg-blue-100'
          }`}>
            {activeMode === 'organization' ? (
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>

          <div>
            <h3 className="font-medium text-slate-900">
              {activeMode === 'organization' ? 'Organization Mode' : 'Individual Mode'}
            </h3>
            <p className="text-sm text-slate-600">
              {activeMode === 'organization' && member
                ? `Working as ${member.role} in organization`
                : 'Working independently'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle Switch */}
          {showModeSwitch && membershipStatus === 'organization_member' && (canSwitchToOrganization || canSwitchToIndividual) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Individual</span>
              <button
                onClick={handleModeSwitch}
                disabled={switching}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  activeMode === 'organization'
                    ? 'bg-emerald-600'
                    : 'bg-slate-200'
                }`}
                title={`Switch to ${activeMode === 'organization' ? 'individual' : 'organization'} mode`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    activeMode === 'organization' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
                {switching && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-b-transparent"></div>
                  </div>
                )}
              </button>
              <span className="text-sm text-slate-600">Organization</span>
            </div>
          )}

          {/* Join Organization Button */}
          {showModeSwitch && membershipStatus === 'individual' && (
            <button
              onClick={handleModeSwitch}
              disabled={switching}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {switching && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2 inline-block"></div>
              )}
              Join Organization
            </button>
          )}

          {/* Organization Management */}
          {showOrganizationManagement && membershipStatus === 'organization_member' && (
            <button
              onClick={handleLeaveOrganization}
              disabled={switching}
              className="px-3 py-1 text-xs font-medium rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Leave organization permanently"
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Mode Benefits */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-900 mb-2">
          Current Mode Benefits
        </h4>
        <ul className="text-sm text-slate-600 space-y-1">
          {activeMode === 'organization' ? (
            <>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Shared drug inventory and patient data
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Collaborative team workflows
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Role-based permissions and security
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Complete control over your data
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Full access to all features
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Private practice workflow
              </li>
            </>
          )}
        </ul>

        {/* Show available modes if user is an organization member */}
        {membershipStatus === 'organization_member' && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {activeMode === 'organization'
                ? 'Switch to Individual mode to use your personal data and have full control'
                : 'Switch to Organization mode to collaborate with your team and use shared resources'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}