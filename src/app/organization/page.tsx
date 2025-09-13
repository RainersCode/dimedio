'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/layout/Navigation';
import OrganizationManager from '@/components/organization/OrganizationManager';
import { useState, useEffect } from 'react';

export default function OrganizationPage() {
  const { user, loading } = useSupabaseAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthPrompt(true);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (showAuthPrompt) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-2V9m0 0V7m0 2h2m-2 0H9m3-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Authentication Required</h2>
            <p className="text-slate-600 mb-6">
              You need to be signed in to manage organizations and collaborate with your team.
            </p>
            <a
              href="/auth"
              className="inline-block px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <OrganizationManager />
    </div>
  );
}