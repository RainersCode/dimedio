'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/layout/Navigation';
import DashboardPage from '@/components/dashboard/DashboardPage';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export default function Dashboard() {
  const { user, loading: authLoading } = useSupabaseAuth();

  // Only show skeleton on initial page load, not during mode switches
  if (authLoading || (!user && !authLoading)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <DashboardPage />
    </div>
  );
}