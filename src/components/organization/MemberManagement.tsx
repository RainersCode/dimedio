'use client';

import React, { useState, useEffect } from 'react';
import { OrganizationService } from '@/lib/organizationService';
import type { OrganizationMember } from '@/types/organization';

interface MemberManagementProps {
  organizationId: string;
  currentUserRole: 'admin' | 'member';
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

export default function MemberManagement({ organizationId, currentUserRole, onError, onSuccess }: MemberManagementProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [organizationId]);

  const loadMembers = async () => {
    setLoading(true);
    const { data, error } = await OrganizationService.getOrganizationMembers(organizationId);
    if (error) {
      onError(error);
    } else {
      setMembers(data || []);
    }
    setLoading(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || currentUserRole !== 'admin') return;

    setInviteLoading(true);
    const { data, error } = await OrganizationService.inviteUser(organizationId, inviteEmail.trim(), inviteRole);
    if (error) {
      onError(error);
    } else {
      onSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteForm(false);
    }
    setInviteLoading(false);
  };

  const handleTogglePermission = async (memberId: string, permission: string, currentValue: boolean) => {
    if (currentUserRole !== 'admin') return;

    const { data, error } = await OrganizationService.updateMemberPermissions(memberId, {
      [permission]: !currentValue
    });

    if (error) {
      onError(error);
    } else {
      onSuccess(`Permission updated successfully`);
      await loadMembers(); // Refresh members list
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (currentUserRole !== 'admin') return;

    if (!confirm(`Are you sure you want to remove ${memberName} from the organization?`)) {
      return;
    }

    const { error } = await OrganizationService.removeMember(memberId);
    if (error) {
      onError(error);
    } else {
      onSuccess(`Member removed successfully`);
      await loadMembers(); // Refresh members list
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading members...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-slate-900">Organization Members</h3>
        {currentUserRole === 'admin' && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && currentUserRole === 'admin' && (
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <form onSubmit={handleInviteUser} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter email address"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteLoading || !inviteEmail.trim()}
              className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {inviteLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Send Invite
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-4">
        {members.map((member) => (
          <div key={member.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">{(member as any).user?.email || 'Unknown User'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      member.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {member.role}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      member.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                </div>
              </div>
              {currentUserRole === 'admin' && member.role !== 'admin' && (
                <button
                  onClick={() => handleRemoveMember(member.id, (member as any).user?.email || 'Unknown User')}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Permissions Grid */}
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(member.permissions).map(([permission, hasPermission]) => (
                <div key={permission} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700 capitalize">
                    {permission.replace(/_/g, ' ')}
                  </span>
                  {currentUserRole === 'admin' && member.role !== 'admin' ? (
                    <button
                      onClick={() => handleTogglePermission(member.id, permission, hasPermission)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        hasPermission ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          hasPermission ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      hasPermission
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {hasPermission ? 'Yes' : 'No'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Joined {new Date(member.joined_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
          <p className="text-slate-600">
            {currentUserRole === 'admin'
              ? 'Start by inviting team members to join your organization.'
              : 'No other members in this organization yet.'
            }
          </p>
        </div>
      )}
    </div>
  );
}