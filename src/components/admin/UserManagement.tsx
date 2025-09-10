'use client';

import { useState, useEffect } from 'react';
import { AdminService } from '@/lib/admin';
import type { AdminUser, UserRole } from '@/types/database';

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changingRole, setChangingRole] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await AdminService.getAllUsers();
    
    if (error) {
      setError(error);
    } else {
      setUsers(data || []);
    }
    
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole, reason?: string) => {
    setChangingRole(userId);
    setError('');
    setSuccess('');

    const { success: changeSuccess, error: changeError } = await AdminService.changeUserRole(
      userId, 
      newRole, 
      reason
    );

    if (changeSuccess) {
      setSuccess(`Role changed to ${newRole} successfully`);
      await loadUsers(); // Refresh the user list
    } else {
      setError(changeError || 'Failed to change role');
    }

    setChangingRole(null);
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
            <p className="text-slate-600 mt-1">Manage user roles and permissions</p>
          </div>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onRoleChange={handleRoleChange}
                  isChanging={changingRole === user.id}
                  getRoleColor={getRoleColor}
                  formatDate={formatDate}
                />
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No users found</h3>
            <p className="mt-1 text-sm text-slate-500">No users have been registered yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface UserRowProps {
  user: AdminUser;
  onRoleChange: (userId: string, newRole: UserRole, reason?: string) => void;
  isChanging: boolean;
  getRoleColor: (role: UserRole) => string;
  formatDate: (dateString: string) => string;
}

function UserRow({ user, onRoleChange, isChanging, getRoleColor, formatDate }: UserRowProps) {
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [reason, setReason] = useState('');

  const roles: { value: UserRole; label: string; description: string }[] = [
    { value: 'user', label: 'User', description: 'Regular user access' },
    { value: 'moderator', label: 'Moderator', description: 'Content moderation access' },
    { value: 'admin', label: 'Admin', description: 'Full admin access' },
    { value: 'super_admin', label: 'Super Admin', description: 'System administration' },
  ];

  const handleSubmit = () => {
    onRoleChange(user.id, selectedRole, reason || undefined);
    setShowRoleModal(false);
    setReason('');
  };

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 font-medium text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-slate-900">{user.name}</div>
              <div className="text-sm text-slate-500">{user.email}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
            {user.role.replace('_', ' ')}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className={`h-2 w-2 rounded-full mr-2 ${user.email_verified ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
            <span className="text-sm text-slate-500">
              {user.email_verified ? 'Verified' : 'Unverified'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
          {formatDate(user.created_at)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            onClick={() => setShowRoleModal(true)}
            disabled={isChanging}
            className="text-emerald-600 hover:text-emerald-900 disabled:opacity-50"
          >
            {isChanging ? 'Changing...' : 'Change Role'}
          </button>
        </td>
      </tr>

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowRoleModal(false)} />
          
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Change Role for {user.name}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    New Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Why are you changing this user's role?"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={selectedRole === user.role}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Change Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}