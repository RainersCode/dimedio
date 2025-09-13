'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Navigation from '@/components/layout/Navigation';
import DiagnosisForm from '@/components/diagnosis/DiagnosisForm';
import { useState, useEffect } from 'react';

export default function DiagnosePage() {
  const { user, loading } = useSupabaseAuth();
  const { t } = useLanguage();
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <DiagnosisForm />
      </div>
    </div>
  );
}
