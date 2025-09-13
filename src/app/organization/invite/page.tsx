'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { OrganizationService } from '@/lib/organizationService';
import Navigation from '@/components/layout/Navigation';
import type { OrganizationInvitation } from '@/types/organization';

export default function OrganizationInvitePage() {
  const { user, loading } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setError('No invitation token provided');
      setLoadingInvitation(false);
    }
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    setLoadingInvitation(true);
    setError(null);

    const { data, error: inviteError } = await OrganizationService.getInvitation(token);
    if (inviteError) {
      setError(inviteError);
    } else {
      setInvitation(data);
    }
    setLoadingInvitation(false);
  };

  const handleAccept = async () => {
    if (!token || !user) return;

    setAccepting(true);
    setError(null);

    const { data, error: acceptError } = await OrganizationService.acceptInvitation(token);
    if (acceptError) {
      setError(acceptError);
    } else {
      // Redirect to organization page
      router.push('/organization?joined=true');
    }
    setAccepting(false);
  };

  const handleDecline = async () => {
    if (!token) return;

    setDeclining(true);
    setError(null);

    const { error: declineError } = await OrganizationService.declineInvitation(token);
    if (declineError) {
      setError(declineError);
    } else {
      router.push('/organization?declined=true');
    }
    setDeclining(false);
  };

  if (loading || loadingInvitation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">Loading invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Sign In Required</h2>
            <p className="text-slate-600 mb-6">
              You need to be signed in to accept organization invitations.
            </p>
            <div className="space-x-4">
              <a
                href="/auth"
                className="inline-block px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Sign In
              </a>
              <a
                href="/auth?mode=signup"
                className="inline-block px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Create Account
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Invalid Invitation</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <a
              href="/organization"
              className="inline-block px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              Go to Organizations
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Invitation Not Found</h2>
            <p className="text-slate-600 mb-6">
              The invitation you're looking for could not be found or may have expired.
            </p>
            <a
              href="/organization"
              className="inline-block px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              Go to Organizations
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
              </svg>
            </div>
            <h1 className="text-3xl font-light text-slate-900 mb-2">Organization Invitation</h1>
            <p className="text-slate-600">
              You've been invited to join an organization
            </p>
          </div>

          {/* Invitation Details */}
          <div className="bg-slate-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {(invitation as any).organization?.name || 'Organization'}
            </h2>

            <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="font-medium text-slate-700">Invited by:</span>
                <span className="text-slate-600 ml-2">
                  {(invitation as any).invited_by_user?.email || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Role:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  invitation.role === 'admin'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {invitation.role}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-slate-700 mb-2">Permissions you'll receive:</h3>
              <div className="grid md:grid-cols-2 gap-2">
                {Object.entries(invitation.permissions).map(([permission, hasPermission]) => (
                  <div key={permission} className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-sm text-slate-700 capitalize">
                      {permission.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      hasPermission
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {hasPermission ? 'Yes' : 'No'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Invitation expires: {new Date(invitation.expires_at).toLocaleDateString()}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <div className="flex">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-amber-800">Important</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Accepting this invitation will switch you from individual mode to organization mode.
                  You'll share resources with other organization members and follow organization permissions.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleDecline}
              disabled={declining || accepting}
              className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {declining && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-2 inline-block"></div>
              )}
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {accepting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Accept & Join Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}