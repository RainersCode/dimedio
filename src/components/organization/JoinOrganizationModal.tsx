'use client';

import React, { useState } from 'react';
import { OrganizationService } from '@/lib/organizationService';

interface JoinOrganizationModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function JoinOrganizationModal({ onClose, onSuccess, onError }: JoinOrganizationModalProps) {
  const [invitationLink, setInvitationLink] = useState('');
  const [loading, setLoading] = useState(false);

  const extractTokenFromLink = (link: string): string | null => {
    try {
      const url = new URL(link);
      const token = url.searchParams.get('token');
      return token;
    } catch {
      // If it's not a valid URL, assume the entire string is the token
      return link.trim();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationLink.trim()) return;

    const token = extractTokenFromLink(invitationLink);
    if (!token) {
      onError('Invalid invitation link or token');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await OrganizationService.acceptInvitation(token);
      if (error) {
        onError(error);
      } else {
        onSuccess();
      }
    } catch (error) {
      onError('Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Join Organization</h3>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              Enter your invitation link or token to join an existing organization.
              You'll gain access to shared resources and be able to collaborate with team members.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Invitation Link or Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={invitationLink}
                  onChange={(e) => setInvitationLink(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Paste invitation link or enter token"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  You should have received this from an organization administrator
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
              <div className="flex">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-amber-800">Important</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Joining an organization will switch you from individual mode to organization mode.
                    You'll share resources with other members and follow organization permissions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 px-6 py-4 bg-slate-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !invitationLink.trim()}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Join Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}