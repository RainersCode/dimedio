'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/layout/Navigation';
import DrugInventoryPage from '@/components/drugInventory/DrugInventoryPage';
import { useState, useEffect } from 'react';

export default function DrugInventoryRoute() {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <DrugInventoryPage />
    </div>
  );
}