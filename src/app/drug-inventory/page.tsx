'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/layout/Navigation';
import DrugInventoryPage from '@/components/drugInventory/DrugInventoryPage';
import { DrugInventorySkeleton } from '@/components/ui/PageSkeletons';
import { useState, useEffect } from 'react';

export default function DrugInventoryRoute() {
  const { user, loading } = useSupabaseAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthPrompt(true);
    }
  }, [user, loading]);

  if (loading || !user) {
    return <DrugInventorySkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <DrugInventoryPage />\\
    </div>
  );
}