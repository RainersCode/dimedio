'use client';

import React from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';

export default function ModeDemo() {
  const { activeMode, membershipStatus, organization } = useMultiOrgUserMode();

  return (
    <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-dashed border-blue-200 rounded-xl p-4 mb-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">🎯 Mode Switch Demo</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">

          {/* Current Mode Display */}
          <div className={`px-4 py-2 rounded-xl font-medium ${
            activeMode === 'organization'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {activeMode === 'organization' ? '🏢 Organization Mode' : '👤 Individual Mode'}
          </div>

          {/* Arrow */}
          <div className="text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>

          {/* Data Source Indicator */}
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-slate-700 font-medium">
            {activeMode === 'organization' && organization
              ? `📊 ${organization.name} Data`
              : '📊 Personal Data'
            }
          </div>
        </div>

        {/* Status Message */}
        <p className="text-sm text-slate-600 mt-3">
          {membershipStatus === 'multi_organization'
            ? '✨ Switch organizations and modes above to see data change in real-time!'
            : '💡 Join an organization to see team collaboration features!'
          }
        </p>
      </div>
    </div>
  );
}