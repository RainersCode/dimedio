'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { OrganizationService } from '@/lib/organizationService';

interface JoinOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function JoinOrganizationModal({ isOpen, onClose, onSuccess, onError }: JoinOrganizationModalProps) {
  const [invitationLink, setInvitationLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted (client-side)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setInvitationLink('');
      setLoading(false);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
      onError?.('Invalid invitation link or token');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await OrganizationService.acceptInvitation(token);
      if (error) {
        onError?.(error);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      onError?.('Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[10001] overflow-y-auto"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <div
            className="w-full max-w-md sm:max-w-lg lg:max-w-xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Join Organization</h3>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={loading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 mb-6">
              Enter an invitation link or token to join an organization. You'll get access to shared resources
              and be able to collaborate with other members.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Invitation Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Invitation Link or Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={invitationLink}
                  onChange={(e) => setInvitationLink(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Paste invitation link or enter token"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-2">
                  You can paste the full invitation link or just the token from the email
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  disabled={loading || !invitationLink.trim()}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Joining...
                    </>
                  ) : (
                    'Join Organization'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );

  // Use createPortal to render the modal at the document root level
  return createPortal(modalContent, document.body);
}