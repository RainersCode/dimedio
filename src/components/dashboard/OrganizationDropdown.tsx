'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import { OrganizationService } from '@/lib/organizationService';
import CreateOrganizationModal from '@/components/organization/CreateOrganizationModal';
import JoinOrganizationModal from '@/components/organization/JoinOrganizationModal';

interface OrganizationDropdownProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export default function OrganizationDropdown({ onError, onSuccess }: OrganizationDropdownProps) {
  const router = useRouter();
  const {
    activeMode,
    membershipStatus,
    organization,
    member,
    refreshModeInfo
  } = useMultiOrgUserMode();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap like mt-2
        right: window.innerWidth - rect.right, // right-aligned
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking the dropdown itself
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }

      // Don't close if clicking the button (let button handle its own toggle)
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }

      // Close if clicking anywhere else
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleCreateOrganization = async (name: string, description?: string) => {
    setLoading(true);
    try {
      const { data, error } = await OrganizationService.createOrganization(name, description);
      if (error) {
        onError?.(error);
      } else {
        onSuccess?.(`Organization "${name}" created successfully!`);
        setShowCreateModal(false);
        setIsOpen(false);
        await refreshModeInfo();
      }
    } catch (err) {
      onError?.('Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!confirm('Are you sure you want to leave this organization? You will lose access to all shared data.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await OrganizationService.leaveOrganization();
      if (error) {
        onError?.(error);
      } else {
        onSuccess?.('Successfully left organization');
        setIsOpen(false);
        await refreshModeInfo();
      }
    } catch (err) {
      onError?.('Failed to leave organization');
    } finally {
      setLoading(false);
    }
  };

  const handleManageOrganization = () => {
    setIsOpen(false);
    router.push('/organization');
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          disabled={loading}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
          </svg>
          <span className="hidden sm:inline">Organization</span>
          <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {loading && (
            <div className="animate-spin rounded-full h-3 w-3 border border-current border-b-transparent"></div>
          )}
        </button>

      </div>

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
            onSuccess?.('Successfully joined organization!');
            setShowJoinModal(false);
            await refreshModeInfo();
          }}
          onError={(error) => onError?.(error)}
        />
      )}

      {/* Dropdown Menu Portal */}
      {isOpen && mounted && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-[9999]"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
        >
          {/* Organization Status */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${
                membershipStatus === 'multi_organization' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}></div>
              <div className="flex-1 min-w-0">
                {membershipStatus === 'multi_organization' && organization ? (
                  <>
                    <p className="text-sm font-medium text-slate-900 truncate">{organization.name}</p>
                    <p className="text-xs text-slate-600">
                      {member?.role === 'admin' ? 'Administrator' : 'Member'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-900">Individual Practice</p>
                    <p className="text-xs text-slate-600">Not in an organization</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {membershipStatus === 'multi_organization' && activeMode === 'organization' ? (
              <>
                {/* Organization Member Actions */}
                <button
                  onClick={handleManageOrganization}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Manage Organization
                </button>

                {member?.permissions?.manage_members && (
                  <button
                    onClick={handleManageOrganization}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    Manage Members
                  </button>
                )}

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  onClick={handleLeaveOrganization}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Leave Organization
                </button>
              </>
            ) : membershipStatus === 'multi_organization' && activeMode === 'individual' ? (
              <>
                {/* Individual Mode but Has Organization Membership */}
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Organization
                </button>

                <button
                  onClick={() => {
                    setShowJoinModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Join Organization
                </button>
              </>
            ) : (
              <>
                {/* Pure Individual User Actions */}
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Organization
                </button>

                <button
                  onClick={() => {
                    setShowJoinModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Join Organization
                </button>
              </>
            )}
          </div>

          {/* Current Mode Indicator */}
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <div className={`w-1.5 h-1.5 rounded-full ${
                activeMode === 'organization' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}></div>
              <span>Currently in {activeMode === 'organization' ? 'Organization' : 'Individual'} mode</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}