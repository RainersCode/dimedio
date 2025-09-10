import Navigation from '@/components/layout/Navigation';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Medical Dashboard</h1>
          <p className="text-slate-600 mt-2">Overview of your practice and recent activities</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Today's Diagnoses</h3>
            <p className="text-3xl font-bold text-emerald-600">23</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Active Patients</h3>
            <p className="text-3xl font-bold text-blue-600">156</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Accuracy Rate</h3>
            <p className="text-3xl font-bold text-purple-600">94.2%</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Cases</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Patient #1234</p>
                  <p className="text-sm text-slate-600">Chest pain, shortness of breath</p>
                </div>
                <span className="text-sm text-emerald-600 font-medium">Diagnosed</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Patient #1235</p>
                  <p className="text-sm text-slate-600">Headache, dizziness</p>
                </div>
                <span className="text-sm text-blue-600 font-medium">In Progress</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                New Diagnosis
              </button>
              <button className="w-full p-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                View All Patients
              </button>
              <button className="w-full p-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                Export Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}