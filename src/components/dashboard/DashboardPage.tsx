'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardService, DashboardStats, DashboardActivity } from '@/lib/dashboardService';
import ModeDemo from './ModeDemo';
import OrganizationDropdown from './OrganizationDropdown';
import OrganizationStatusCard from './OrganizationStatusCard';
import OrganizationModeSelector from '@/components/shared/OrganizationModeSelector';

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    activeMode,
    membershipStatus,
    organization,
    member,
    switchToOrganizationMode,
    switchToIndividualMode,
    canSwitchToOrganization,
    canSwitchToIndividual,
    loading: modeLoading,
    organizationId,
    allOrganizations
  } = useMultiOrgUserMode();

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // Loading guards to prevent duplicate API calls
  const fetchingRef = useRef(false);

  // Load dashboard data
  const loadDashboardData = async () => {
    if (modeLoading || fetchingRef.current) return;

    console.log('Dashboard loading data with:', { activeMode, organizationId, membershipStatus });

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      const [statsResult, activitiesResult] = await Promise.all([
        DashboardService.getDashboardStats(activeMode, organizationId),
        DashboardService.getRecentActivities(activeMode, organizationId)
      ]);

      if (statsResult.error) {
        console.error('Dashboard stats error:', statsResult.error);
        setError(statsResult.error);
      } else {
        setStats(statsResult.data);
      }

      if (activitiesResult.error) {
        console.error('Dashboard activities error:', activitiesResult.error);
      } else {
        setActivities(activitiesResult.data || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  // Load data on component mount and when mode changes
  useEffect(() => {
    if (!modeLoading) {
      // Add a small delay to debounce rapid context changes
      const timeoutId = setTimeout(() => {
        // Additional check to ensure we have stable context
        if (!modeLoading && activeMode !== undefined) {
          loadDashboardData();
        }
      }, 200); // Increased delay for more stability

      return () => clearTimeout(timeoutId);
    }
  }, [activeMode, organizationId, modeLoading]);

  // Handle mode switching with visual feedback
  const handleModeSwitch = async (targetMode: 'individual' | 'organization') => {
    if (switching) return;

    setSwitching(true);
    try {
      if (targetMode === 'organization' && canSwitchToOrganization) {
        const { error } = await switchToOrganizationMode();
        if (error) {
          setError(`Failed to switch to organization mode: ${error}`);
        }
      } else if (targetMode === 'individual' && canSwitchToIndividual) {
        const { error } = await switchToIndividualMode();
        if (error) {
          setError(`Failed to switch to individual mode: ${error}`);
        }
      }
    } finally {
      setSwitching(false);
    }
  };

  // Quick actions based on active mode
  const getQuickActions = () => {
    const baseActions = [
      {
        title: 'New Diagnosis',
        description: 'Start a new patient diagnosis',
        icon: '🩺',
        color: 'from-blue-500 to-blue-600',
        action: () => router.push('/diagnosis')
      }
    ];

    if (activeMode === 'individual') {
      return [
        ...baseActions,
        {
          title: 'My Patients',
          description: 'View and manage your patients',
          icon: '👥',
          color: 'from-green-500 to-green-600',
          action: () => router.push('/patients')
        },
        {
          title: 'Drug Inventory',
          description: 'Manage your drug inventory',
          icon: '💊',
          color: 'from-purple-500 to-purple-600',
          action: () => router.push('/drug-inventory')
        },
        {
          title: 'View Reports',
          description: 'Generate practice reports',
          icon: '📊',
          color: 'from-emerald-500 to-emerald-600',
          action: () => router.push('/drug-usage-report')
        }
      ];
    } else {
      return [
        ...baseActions,
        {
          title: 'Team Patients',
          description: 'View organization patients',
          icon: '🏥',
          color: 'from-green-500 to-green-600',
          action: () => router.push('/patients')
        },
        {
          title: 'Shared Inventory',
          description: 'Manage organization inventory',
          icon: '💊',
          color: 'from-purple-500 to-purple-600',
          action: () => router.push('/drug-inventory')
        },
        {
          title: 'Team Reports',
          description: 'Generate organization reports',
          icon: '📈',
          color: 'from-slate-500 to-slate-600',
          action: () => router.push('/drug-usage-report')
        }
      ];
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header with Mode Switching */}
        <div className="bg-white rounded-3xl shadow-xl border border-white/50 backdrop-blur-sm p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            {/* Welcome Section */}
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome to Your Dashboard
              </h1>
              <p className="text-slate-600">
                {activeMode === 'organization' && stats?.organizationName
                  ? `Managing ${stats.organizationName} as ${stats.userRole}`
                  : 'Managing your individual practice'
                }
              </p>
            </div>

            {/* Multi-Organization Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-4">


              {/* Organization Management Dropdown */}
              <OrganizationDropdown
                onError={setError}
                onSuccess={(message) => {
                  setError(null);
                }}
              />

              {/* Join Organization Button for Individual Users */}
              {membershipStatus === 'individual' && (
                <button
                  onClick={() => router.push('/organization')}
                  className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  Join Organization
                </button>
              )}

              {/* Organization Count Badge for Multi-Org Users */}
              {membershipStatus === 'multi_organization' && allOrganizations.length > 1 && (
                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                  {allOrganizations.length} Organizations
                </div>
              )}
            </div>
          </div>

          {/* Mode Switch Feedback */}
          {switching && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border border-blue-500 border-b-transparent"></div>
                <p className="text-sm text-blue-700">
                  Switching to {activeMode === 'individual' ? 'organization' : 'individual'} mode...
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Organization Mode Selector */}
        <OrganizationModeSelector
          title="Dashboard View"
          description="Switch between different contexts to view individual practice or organization dashboard data."
          individualLabel="Individual Dashboard"
          individualDescription="Your personal practice dashboard"
          organizationDescription="Organization dashboard"
          onError={setError}
          className="mb-8"
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {getQuickActions().map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-left border border-white/50 hover:border-white/80"
            >
              <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                {action.icon}
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{action.title}</h3>
              <p className="text-sm text-slate-600">{action.description}</p>
              <div className="mt-4 flex items-center text-sm text-blue-600 group-hover:text-blue-700">
                <span>Get started</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Statistics Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    stats.mode === 'organization' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {stats.mode === 'organization' ? 'Team' : 'Personal'}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalPatients}</h3>
                <p className="text-sm text-slate-600">Total Patients</p>
                {stats.newPatientsThisMonth > 0 && (
                  <p className="text-xs text-green-600 mt-2">+{stats.newPatientsThisMonth} this month</p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    stats.urgentCases > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {stats.urgentCases} urgent
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalDiagnoses}</h3>
                <p className="text-sm text-slate-600">Total Diagnoses</p>
                {stats.recentDiagnoses > 0 && (
                  <p className="text-xs text-green-600 mt-2">+{stats.recentDiagnoses} this week</p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                    </svg>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    stats.lowStockDrugs > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {stats.lowStockDrugs} low stock
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalDrugs}</h3>
                <p className="text-sm text-slate-600">Drug Inventory</p>
                {stats.expiredDrugs > 0 && (
                  <p className="text-xs text-red-600 mt-2">{stats.expiredDrugs} expired</p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">
                  ${stats.totalDrugValue.toLocaleString()}
                </h3>
                <p className="text-sm text-slate-600">Inventory Value</p>
                <p className="text-xs text-slate-500 mt-2">Total drug value</p>
              </div>
            </div>

            {/* Charts and Additional Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

              {/* Top Diagnoses */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Top Diagnoses</h3>
                {stats.topDiagnoses.length > 0 ? (
                  <div className="space-y-4">
                    {stats.topDiagnoses.map((diagnosis, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-medium text-blue-700">
                            {index + 1}
                          </div>
                          <span className="text-sm text-slate-700">{diagnosis.diagnosis}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{diagnosis.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No diagnoses yet</p>
                )}
              </div>

              {/* Patient Demographics */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Patient Demographics</h3>

                {/* Average Age */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Average Age</span>
                    <span className="text-lg font-semibold text-slate-900">{stats.averagePatientAge} years</span>
                  </div>
                </div>

                {/* Gender Distribution */}
                <div>
                  <p className="text-sm text-slate-600 mb-3">Gender Distribution</p>
                  <div className="space-y-3">
                    {Object.entries(stats.genderDistribution).map(([gender, count]) => {
                      const total = Object.values(stats.genderDistribution).reduce((sum, val) => sum + val, 0);
                      const percentage = total > 0 ? (count / total) * 100 : 0;

                      return (
                        <div key={gender} className="flex items-center gap-3">
                          <div className="w-16 text-sm text-slate-600 capitalize">{gender}</div>
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                gender === 'male' ? 'bg-blue-500' :
                                gender === 'female' ? 'bg-pink-500' : 'bg-gray-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <div className="w-12 text-sm text-slate-900 text-right">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Recent Activities</h3>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  stats.mode === 'organization' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {stats.mode === 'organization' ? 'Organization' : 'Individual'}
                </span>
              </div>

              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="text-2xl">{activity.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">{activity.title}</h4>
                        <p className="text-xs text-slate-600">{activity.description}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      {activity.urgency === 'high' && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          Urgent
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No recent activities</p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-slate-600">Unable to load dashboard data</p>
          </div>
        )}
      </div>
    </div>
  );
}