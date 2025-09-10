'use client';

import { useState, useEffect } from 'react';
import { AdminService } from '@/lib/admin';
import type { RoleChangeHistory } from '@/types/database';

export default function RoleHistory() {
  const [history, setHistory] = useState<RoleChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const { data, error } = await AdminService.getRoleHistory();
    
    if (error) {
      setError(error);
    } else {
      setHistory(data || []);
    }
    
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleChangeColor = (oldRole: string, newRole: string) => {
    const roleHierarchy = { user: 1, moderator: 2, admin: 3, super_admin: 4 };
    const oldLevel = roleHierarchy[oldRole as keyof typeof roleHierarchy] || 0;
    const newLevel = roleHierarchy[newRole as keyof typeof roleHierarchy] || 0;
    
    if (newLevel > oldLevel) {
      return 'text-green-600'; // Promotion
    } else if (newLevel < oldLevel) {
      return 'text-red-600'; // Demotion
    }
    return 'text-slate-600'; // Same level or unknown
  };

  const getRoleChangeIcon = (oldRole: string, newRole: string) => {
    const roleHierarchy = { user: 1, moderator: 2, admin: 3, super_admin: 4 };
    const oldLevel = roleHierarchy[oldRole as keyof typeof roleHierarchy] || 0;
    const newLevel = roleHierarchy[newRole as keyof typeof roleHierarchy] || 0;
    
    if (newLevel > oldLevel) {
      return (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    } else if (newLevel < oldLevel) {
      return (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
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
            <h2 className="text-xl font-semibold text-slate-900">Role Change History</h2>
            <p className="text-slate-600 mt-1">Track all role modifications and assignments</p>
          </div>
          <button
            onClick={loadHistory}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* History Timeline */}
      <div className="bg-white rounded-lg shadow">
        {history.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No role changes found</h3>
            <p className="mt-1 text-sm text-slate-500">No role modifications have been made yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="flow-root">
              <ul className="divide-y divide-slate-200">
                {history.map((change, index) => (
                  <li key={change.id} className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                          {getRoleChangeIcon(change.old_role || '', change.new_role)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-slate-900">
                              User role changed
                            </p>
                            <div className={`flex items-center space-x-1 ${getRoleChangeColor(change.old_role || '', change.new_role)}`}>
                              <span className="text-xs font-medium">
                                {change.old_role || 'unknown'} → {change.new_role}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center text-xs text-slate-500">
                            {formatDate(change.created_at)}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                          <span>User ID: {change.user_id.slice(0, 8)}...</span>
                          {change.changed_by && (
                            <span>Changed by: {change.changed_by.slice(0, 8)}...</span>
                          )}
                        </div>

                        {change.reason && (
                          <div className="mt-2">
                            <p className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-1">
                              <span className="font-medium">Reason:</span> {change.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900">{history.length}</div>
              <div className="text-sm text-slate-500">Total Changes</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {history.filter(h => {
                  const roleHierarchy = { user: 1, moderator: 2, admin: 3, super_admin: 4 };
                  const oldLevel = roleHierarchy[(h.old_role || 'user') as keyof typeof roleHierarchy] || 0;
                  const newLevel = roleHierarchy[h.new_role as keyof typeof roleHierarchy] || 0;
                  return newLevel > oldLevel;
                }).length}
              </div>
              <div className="text-sm text-slate-500">Promotions</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {history.filter(h => {
                  const roleHierarchy = { user: 1, moderator: 2, admin: 3, super_admin: 4 };
                  const oldLevel = roleHierarchy[(h.old_role || 'user') as keyof typeof roleHierarchy] || 0;
                  const newLevel = roleHierarchy[h.new_role as keyof typeof roleHierarchy] || 0;
                  return newLevel < oldLevel;
                }).length}
              </div>
              <div className="text-sm text-slate-500">Demotions</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}