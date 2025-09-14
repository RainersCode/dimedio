'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
}

export default function CreateOrganizationModal({ isOpen, onClose, onSubmit }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted (client-side)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
      // Don't close here - let the parent handle it after success
    } catch (error) {
      console.error('Error creating organization:', error);
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
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Create Organization</h3>
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
              Create a new organization to collaborate with your team. You'll become the organization administrator
              and can invite other users to join.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  placeholder="Enter organization name"
                  required
                  maxLength={255}
                  disabled={loading}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors resize-none"
                  placeholder="Brief description of your organization"
                  rows={3}
                  maxLength={500}
                  disabled={loading}
                />
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
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  disabled={loading || !name.trim()}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Organization'
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