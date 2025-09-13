'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { OrganizationService } from '@/lib/organizationService';
import type { Organization, OrganizationMember, UserModeInfo } from '@/types/organization';
import CreateOrganizationModal from './CreateOrganizationModal';
import OrganizationSettings from './OrganizationSettings';
import MemberManagement from './MemberManagement';
import JoinOrganizationModal from './JoinOrganizationModal';

export default function OrganizationManager() {
  const { user } = useSupabaseAuth();
  const [userModeInfo, setUserModeInfo] = useState<UserModeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');

  useEffect(() => {
    if (user) {
      loadUserMode();
    }
  }, [user]);

  const loadUserMode = async () => {
    setLoading(true);
    setError(null);

    const { data, error: modeError } = await OrganizationService.getUserModeInfo();
    if (modeError) {
      setError(modeError);
    } else {
      setUserModeInfo(data);
    }
    setLoading(false);
  };

  const handleCreateOrganization = async (name: string, description?: string) => {
    const { data, error: createError } = await OrganizationService.createOrganization(name, description);
    if (createError) {
      setError(createError);
    } else {
      setSuccessMessage(`Organization "${name}" created successfully!`);
      setShowCreateModal(false);
      await loadUserMode(); // Refresh user mode

      // Clear success message after 5 seconds
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
      await loadUserMode(); // Refresh user mode

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  if (loading) {
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
          <h1 className="text-3xl font-light text-slate-900 mb-2">Organization Management</h1>
          <p className="text-slate-600">
            {userModeInfo?.mode === 'organization'
              ? `Manage your organization and team members`
              : 'Create or join an organization to collaborate with your team'
            }
          </p>
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

        {userModeInfo?.mode === 'individual' ? (
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
          // Organization Mode - Show organization management
          <div>
            {/* Organization Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{userModeInfo?.organization?.name}</h2>
                    <p className="text-slate-600">
                      {userModeInfo?.member?.role === 'admin' ? 'Organization Administrator' : 'Organization Member'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Organization Mode
                  </span>
                  <button
                    onClick={handleLeaveOrganization}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Leave Organization
                  </button>
                </div>
              </div>
            </div>

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
                  {userModeInfo?.member?.role === 'admin' && (
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
                            <p className="text-sm text-slate-600 capitalize">{userModeInfo?.member?.role}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <h4 className="text-md font-medium text-slate-900 mb-4">Your Permissions</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {Object.entries(userModeInfo?.member?.permissions || {}).map(([permission, hasPermission]) => (
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

                {activeTab === 'members' && (
                  <MemberManagement
                    organizationId={userModeInfo?.organization?.id || ''}
                    currentUserRole={userModeInfo?.member?.role || 'member'}
                    onError={setError}
                    onSuccess={setSuccessMessage}
                  />
                )}

                {activeTab === 'settings' && userModeInfo?.member?.role === 'admin' && (
                  <OrganizationSettings
                    organization={userModeInfo.organization!}
                    onError={setError}
                    onSuccess={setSuccessMessage}
                    onOrganizationUpdated={loadUserMode}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showCreateModal && (
          <CreateOrganizationModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateOrganization}
          />
        )}

        {showJoinModal && (
          <JoinOrganizationModal
            onClose={() => setShowJoinModal(false)}
            onSuccess={() => {
              setShowJoinModal(false);
              setSuccessMessage('Successfully joined organization!');
              loadUserMode();
              setTimeout(() => setSuccessMessage(null), 5000);
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}