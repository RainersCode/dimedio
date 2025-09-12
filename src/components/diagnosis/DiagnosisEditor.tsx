'use client';

import { useState } from 'react';
import { Diagnosis } from '@/types/database';
import { DatabaseService } from '@/lib/database';

interface DiagnosisEditorProps {
  diagnosis: Diagnosis;
  onSave: (updatedDiagnosis: Diagnosis) => void;
  onCancel: () => void;
}

export default function DiagnosisEditor({ diagnosis, onSave, onCancel }: DiagnosisEditorProps) {
  const [editedDiagnosis, setEditedDiagnosis] = useState<Diagnosis>({ ...diagnosis });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorName, setEditorName] = useState('');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const { data, error: updateError } = await DatabaseService.updateDiagnosisManually(
        diagnosis.id,
        editedDiagnosis,
        undefined, // Let the service get the user email
        'Patient History Edit',
        editorName
      );

      if (updateError) {
        setError(updateError);
      } else if (data) {
        onSave(data);
      } else {
        setError('No data returned from update');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save diagnosis');
    } finally {
      setSaving(false);
    }
  };

  const handleArrayFieldChange = (field: keyof Diagnosis, value: string) => {
    const items = value.split('\n').filter(item => item.trim().length > 0);
    setEditedDiagnosis(prev => ({
      ...prev,
      [field]: items
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Diagnosis</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Editor Name - Required Field */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Your Name (Required) *
            </label>
            <input
              type="text"
              value={editorName}
              onChange={(e) => setEditorName(e.target.value)}
              placeholder="Enter your full name to identify this edit"
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-blue-600 mt-1">
              This name will be recorded in the audit trail to track who made this edit.
            </p>
          </div>

          {/* Primary Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Diagnosis
            </label>
            <input
              type="text"
              value={editedDiagnosis.primary_diagnosis || ''}
              onChange={(e) => setEditedDiagnosis(prev => ({
                ...prev,
                primary_diagnosis: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Patient Complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient Complaint
            </label>
            <textarea
              value={editedDiagnosis.complaint || ''}
              onChange={(e) => setEditedDiagnosis(prev => ({
                ...prev,
                complaint: e.target.value
              }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms (one per line)
            </label>
            <textarea
              value={Array.isArray(editedDiagnosis.symptoms) 
                ? editedDiagnosis.symptoms.join('\n') 
                : (editedDiagnosis.symptoms || '')
              }
              onChange={(e) => handleArrayFieldChange('symptoms', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each symptom on a new line"
            />
          </div>

          {/* Differential Diagnoses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Differential Diagnoses (one per line)
            </label>
            <textarea
              value={editedDiagnosis.differential_diagnoses?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('differential_diagnoses', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each differential diagnosis on a new line"
            />
          </div>

          {/* Treatment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Treatment (one per line)
            </label>
            <textarea
              value={editedDiagnosis.treatment?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('treatment', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each treatment on a new line"
            />
          </div>

          {/* Recommended Actions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommended Actions (one per line)
            </label>
            <textarea
              value={editedDiagnosis.recommended_actions?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('recommended_actions', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter each recommended action on a new line"
            />
          </div>


          {/* Vital Signs Section */}
          <div className="border-t pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Vital Signs</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editedDiagnosis.temperature || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    temperature: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  value={editedDiagnosis.heart_rate || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    heart_rate: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pain Scale (0-10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={editedDiagnosis.pain_scale || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    pain_scale: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Medical History Section */}
          <div className="border-t pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Medical History</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allergies
                </label>
                <textarea
                  value={editedDiagnosis.allergies || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    allergies: e.target.value || undefined
                  }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Medications
                </label>
                <textarea
                  value={editedDiagnosis.current_medications || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    current_medications: e.target.value || undefined
                  }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chronic Conditions
                </label>
                <textarea
                  value={editedDiagnosis.chronic_conditions || ''}
                  onChange={(e) => setEditedDiagnosis(prev => ({
                    ...prev,
                    chronic_conditions: e.target.value || undefined
                  }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editorName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}