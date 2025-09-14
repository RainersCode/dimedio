import Navigation from '@/components/layout/Navigation';
import DashboardPage from '@/components/dashboard/DashboardPage';

export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <DashboardPage />
    </div>
  );
}