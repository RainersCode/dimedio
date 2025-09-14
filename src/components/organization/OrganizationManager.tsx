'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import { OrganizationService } from '@/lib/organizationService';
import type { Organization, OrganizationMember, UserModeInfo } from '@/types/organization';
import CreateOrganizationModal from './CreateOrganizationModal';
import OrganizationSettings from './OrganizationSettings';
import MemberManagement from './MemberManagement';
import JoinOrganizationModal from './JoinOrganizationModal';

export default function OrganizationManager() {
  const { user } = useSupabaseAuth();
  const {
    membershipStatus,
    activeMode,
    allOrganizations,
    activeOrganization,
    organization,
    member,
    loading: modeLoading,
    refreshModeInfo
  } = useMultiOrgUserMode();

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');

  // For managing specific organization (when user has multiple)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Get the organization to display (either selected one or active one)
  const displayOrganization = selectedOrgId
    ? allOrganizations.find(org => org.organization_id === selectedOrgId)
    : activeOrganization;

  const handleCreateOrganization = async (name: string, description?: string) => {
    const { data, error: createError } = await OrganizationService.createOrganization(name, description);
    if (createError) {
      setError(createError);
    } else {
      setSuccessMessage(`Organization "${name}" created successfully!`);
      setShowCreateModal(false);

      // Multiple refresh attempts to ensure context updates
      try {
        await refreshModeInfo();

        setTimeout(async () => {
          await refreshModeInfo();

          // Final check - if still individual after 2 seconds, force reload
          setTimeout(() => {
            if (membershipStatus === 'individual') {
              setSuccessMessage('Organization created! Reloading page...');
              setTimeout(() => window.location.reload(), 500);
            }
          }, 2000);
        }, 1000);
      } catch (error) {
        console.error('Error refreshing organization info:', error);
        window.location.reload();
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!confirm('Are you sure you want to leave this organization? You will lose access to all shared data.')) {
      return;
    }

    const { error: leaveError } = await OrganizationService.leaveOrganization();
    if (leaveError) {
      setError(leaveError);
    } else {
      setSuccessMessage('Successfully left organization');
      await refreshModeInfo(); // Refresh user mode

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  if (modeLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading organization information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light text-slate-900 mb-2">Organization Management</h1>
              <p className="text-slate-600">
                {membershipStatus === 'multi_organization'
                  ? `Manage your organizations and team members`
                  : 'Create or join an organization to collaborate with your team'
                }
              </p>
            </div>
            <button
              onClick={refreshModeInfo}
              disabled={modeLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh organization status"
            >
              <svg className={`w-4 h-4 ${modeLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {membershipStatus === 'individual' ? (
          // Individual Mode - Show options to create or join organization
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">Individual Mode</h2>
              <p className="text-slate-600 mb-8">
                You're currently working individually. Create an organization to collaborate with your team,
                or join an existing organization if you've received an invitation.
              </p>
              {successMessage?.includes('joined') && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-blue-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">
                      Just joined an organization? Click the "Refresh" button above if the page doesn't update automatically.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Create Organization Card */}
              <div className="border border-slate-200 rounded-lg p-6 hover:border-emerald-200 transition-colors">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Create Organization</h3>
                <p className="text-slate-600 mb-4">
                  Start your own organization and invite team members to collaborate on patient care and drug inventory.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Create Organization
                </button>
              </div>

              {/* Join Organization Card */}
              <div className="border border-slate-200 rounded-lg p-6 hover:border-blue-200 transition-colors">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Join Organization</h3>
                <p className="text-slate-600 mb-4">
                  Have an invitation link? Join an existing organization to access shared resources and collaborate.
                </p>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Join Organization
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Multi-Organization Mode - Show organization management
          <div>
            {/* Organization Selector */}
            {allOrganizations.length > 1 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Organization to Manage</h3>
                <div className="grid gap-3">
                  {allOrganizations.map((org) => (
                    <button
                      key={org.organization_id}
                      onClick={() => setSelectedOrgId(org.organization_id)}
                      className={`p-4 text-left rounded-lg border-2 transition-all ${
                        (selectedOrgId === org.organization_id || (!selectedOrgId && org.organization_id === activeOrganization?.organization_id))
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900">{org.organization.name}</h4>
                          <p className="text-sm text-slate-600">
                            {org.role === 'admin' ? 'Administrator' : 'Member'}
                            {org.organization.created_by === user?.id && ' • Owner'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {org.organization_id === activeOrganization?.organization_id && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Active
                            </span>
                          )}
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Organization Header */}
            {displayOrganization && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{displayOrganization.organization.name}</h2>
                      <p className="text-slate-600">
                        {displayOrganization.role === 'admin' ? 'Organization Administrator' : 'Organization Member'}
                        {displayOrganization.organization.created_by === user?.id && ' • Owner'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Managing Organization
                    </span>
                    {/* Show different buttons based on whether user is owner or member */}
                    {displayOrganization.organization.created_by !== user?.id && (
                      // Regular members can leave the organization
                      <button
                        onClick={handleLeaveOrganization}
                        className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Leave Organization
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
              <div className="border-b border-slate-200">
                <nav className="flex space-x-8 px-6">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 border-b-2 font-medium text-sm ${
                      activeTab === 'overview'
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`py-4 border-b-2 font-medium text-sm ${
                      activeTab === 'members'
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Members
                  </button>
                  {displayOrganization?.organization.created_by === user?.id && (
                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`py-4 border-b-2 font-medium text-sm ${
                        activeTab === 'settings'
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      Settings
                    </button>
                  )}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Organization Overview</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <h4 className="text-lg font-semibold text-slate-900">Members</h4>
                            <p className="text-sm text-slate-600">Active team members</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <h4 className="text-lg font-semibold text-slate-900">Shared Resources</h4>
                            <p className="text-sm text-slate-600">Drugs, patients, diagnoses</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <h4 className="text-lg font-semibold text-slate-900">Your Role</h4>
                            <p className="text-sm text-slate-600 capitalize">{displayOrganization?.role}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <h4 className="text-md font-medium text-slate-900 mb-4">Your Permissions</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {Object.entries(displayOrganization?.permissions || {}).map(([permission, hasPermission]) => (
                          <div key={permission} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-700 capitalize">
                              {permission.replace(/_/g, ' ')}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              hasPermission
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {hasPermission ? 'Allowed' : 'Denied'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'members' && displayOrganization && (
                  <MemberManagement
                    organizationId={displayOrganization.organization_id}
                    currentUserRole={displayOrganization.role}
                    onError={setError}
                    onSuccess={setSuccessMessage}
                  />
                )}

                {activeTab === 'settings' && displayOrganization?.organization.created_by === user?.id && (
                  <OrganizationSettings
                    organization={displayOrganization.organization}
                    onError={setError}
                    onSuccess={setSuccessMessage}
                    onOrganizationUpdated={refreshModeInfo}
                  />
                )}
              </div>
            </div>

            {/* Actions for managing multiple organizations */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Organization Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center justify-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Create New Organization</div>
                    <div className="text-sm text-slate-600">Start another organization</div>
                  </div>
                </button>

                <button
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center justify-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Join Another Organization</div>
                    <div className="text-sm text-slate-600">Use an invitation link</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showCreateModal && (
          <CreateOrganizationModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateOrganization}
          />
        )}

        {showJoinModal && (
          <JoinOrganizationModal
            isOpen={showJoinModal}
            onClose={() => setShowJoinModal(false)}
            onSuccess={async () => {
              setShowJoinModal(false);
              setSuccessMessage('Successfully joined organization!');

              // Multiple refresh attempts to ensure the context updates
              try {
                await refreshModeInfo();

                // Wait a moment and try again if still showing individual
                setTimeout(async () => {
                  await refreshModeInfo();

                  // Final check - if still individual after 2 seconds, force reload
                  setTimeout(() => {
                    if (membershipStatus === 'individual') {
                      setSuccessMessage('Joined successfully! Reloading page...');
                      setTimeout(() => window.location.reload(), 500);
                    }
                  }, 2000);
                }, 1000);
              } catch (error) {
                console.error('Error refreshing organization info:', error);
                window.location.reload();
              }

              setTimeout(() => setSuccessMessage(null), 5000);
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}