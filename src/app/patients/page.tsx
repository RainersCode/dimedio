import Navigation from '@/components/layout/Navigation';

export default function Patients() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Patient Management</h1>
            <p className="text-slate-600 mt-2">Manage patient records and diagnosis history</p>
          </div>
          <button className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
            Add New Patient
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                placeholder="Search patients..." 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                <option>All Patients</option>
                <option>Active Cases</option>
                <option>Completed Cases</option>
                <option>Follow-up Required</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Patient ID</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Age</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Last Diagnosis</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">#P001234</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">John Smith</td>
                  <td className="px-6 py-4 text-sm text-slate-600">45</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Acute Myocardial Infarction</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Dec 8, 2024</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      Critical
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-emerald-600 hover:text-emerald-800 font-medium">
                      View Details
                    </button>
                  </td>
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">#P001235</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">Sarah Johnson</td>
                  <td className="px-6 py-4 text-sm text-slate-600">32</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Tension Headache</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Dec 8, 2024</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                      Follow-up
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-emerald-600 hover:text-emerald-800 font-medium">
                      View Details
                    </button>
                  </td>
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">#P001236</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">Michael Brown</td>
                  <td className="px-6 py-4 text-sm text-slate-600">28</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Upper Respiratory Infection</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Dec 7, 2024</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Resolved
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-emerald-600 hover:text-emerald-800 font-medium">
                      View Details
                    </button>
                  </td>
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">#P001237</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">Emily Davis</td>
                  <td className="px-6 py-4 text-sm text-slate-600">41</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Gastroesophageal Reflux</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Dec 7, 2024</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Treatment
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-emerald-600 hover:text-emerald-800 font-medium">
                      View Details
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Showing 1-4 of 156 patients</p>
              <div className="flex space-x-2">
                <button className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white transition-colors">Previous</button>
                <button className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">1</button>
                <button className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white transition-colors">2</button>
                <button className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white transition-colors">3</button>
                <button className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white transition-colors">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}