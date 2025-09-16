'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Navigation from '@/components/layout/Navigation';
import DiagnosisForm from '@/components/diagnosis/DiagnosisForm';
import OrganizationModeSelector from '@/components/shared/OrganizationModeSelector';
import { useState, useEffect } from 'react';
import { DiagnosisSkeleton } from '@/components/ui/PageSkeletons';

export default function DiagnosePage() {
  const { user, loading } = useSupabaseAuth();
  const { t } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthPrompt(true);
    }
  }, [user, loading]);

  // Only show skeleton on initial page load, not during mode switches
  if (loading || (!user && !loading)) {
    return <DiagnosisSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-slate-900 mb-2">AI-Powered Medical Diagnosis</h1>
          <p className="text-slate-600">
            Get AI-assisted diagnosis with treatment recommendations and drug suggestions from your inventory.
          </p>
        </div>

        {/* Organization Selector */}
        <OrganizationModeSelector
          title="Diagnosis Context"
          description="Choose which context to create this diagnosis in"
          individualLabel="Personal Practice"
          individualDescription="Your personal diagnosis records"
          organizationDescription="Organization diagnosis"
          onError={setError}
          className="mb-6"
        />

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <DiagnosisForm />
      </div>
    </div>
  );
}
