'use client';

import Navigation from '@/components/layout/Navigation';
import { PatientService } from '@/lib/patientService';
import { PatientProfile } from '@/types/database';
import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import Link from 'next/link';

export default function Patients() {
  const { user } = useSupabaseAuth();
  const [patients, setPatients] = useState<(PatientProfile & { diagnosis_count: number; last_diagnosis: string; last_diagnosis_severity: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingPatient, setDeletingPatient] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPatients();
    }
  }, [user]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await PatientService.getPatients();
      
      if (fetchError) {
        setError(fetchError);
      } else if (data) {
        setPatients(data);
      }
    } catch (err) {
      setError('Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    try {
      setDeletingPatient(patientId);
      const { error: deleteError } = await PatientService.deletePatient(patientId);
      
      if (deleteError) {
        setError('Failed to delete patient: ' + deleteError);
      } else {
        // Remove the patient from local state
        setPatients(prev => prev.filter(p => p.id !== patientId));
        setShowDeleteConfirm(null);
      }
    } catch (err) {
      setError('Failed to delete patient');
    } finally {
      setDeletingPatient(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'moderate': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Critical';
      case 'high': return 'High';
      case 'moderate': return 'Treatment';
      case 'low': return 'Resolved';
      default: return 'Unknown';
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (patient.id.startsWith('anonymous-') && 'anonymous'.includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && ['critical', 'high', 'moderate'].includes(patient.last_diagnosis_severity)) ||
      (statusFilter === 'completed' && patient.last_diagnosis_severity === 'low') ||
      (statusFilter === 'follow-up' && patient.last_diagnosis_severity === 'moderate');
    
    return matchesSearch && matchesStatus;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Please log in to view patients.</p>
        </div>
      </div>
    );
  }

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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Patients</option>
                <option value="active">Active Cases</option>
                <option value="completed">Completed Cases</option>
                <option value="follow-up">Follow-up Required</option>
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading patients...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      {searchTerm || statusFilter !== 'all' ? 'No patients match your filters' : 'No patients found. Diagnose a patient to see them here.'}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-900">
                        #{patient.patient_id || (patient.id.startsWith('anonymous-') ? 'ANON-' + patient.id.slice(0, 8) : patient.id.slice(0, 8))}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        <span className={patient.id.startsWith('anonymous-') ? 'text-amber-700 italic' : ''}>
                          {patient.patient_name}
                        </span>
                        {patient.id.startsWith('anonymous-') && (
                          <span className="ml-2 px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
                            Anonymous
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {patient.patient_age || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {patient.last_diagnosis || 'No diagnosis'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {patient.last_visit_date ? 
                          new Date(patient.last_visit_date).toLocaleDateString() : 
                          new Date(patient.created_at).toLocaleDateString()
                        }
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(patient.last_diagnosis_severity)}`}>
                          {getSeverityText(patient.last_diagnosis_severity)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <Link 
                            href={`/patients/${patient.id}`}
                            className="text-emerald-600 hover:text-emerald-800 font-medium"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => setShowDeleteConfirm(patient.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing {filteredPatients.length} of {patients.length} patients
                {searchTerm && ` (filtered by "${searchTerm}")`}
                {statusFilter !== 'all' && ` (${statusFilter} cases)`}
              </p>
              {filteredPatients.length > 0 && (
                <button 
                  onClick={fetchPatients}
                  className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white transition-colors"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-200 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-slate-900">Delete Patient</h3>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this patient? This action cannot be undone and will permanently remove all patient data and diagnosis history.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePatient(showDeleteConfirm)}
                disabled={deletingPatient === showDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {deletingPatient === showDeleteConfirm ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete Patient'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}