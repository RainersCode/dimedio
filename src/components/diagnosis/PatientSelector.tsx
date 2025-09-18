'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import { ModeAwarePatientService } from '@/lib/modeAwarePatientService';
import { calculateAge, formatAge } from '@/lib/ageCalculation';
import type { PatientProfile } from '@/types/database';
import type { OrganizationPatient } from '@/types/organization';

interface PatientSelectorProps {
  selectedPatient: PatientData | null;
  onPatientSelect: (patient: PatientData | null) => void;
  onError: (error: string) => void;
}

interface PatientData {
  id: string;
  patient_name: string;
  patient_surname: string;
  patient_id: string;
  patient_gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  allergies?: string;
  chronic_conditions?: string;
  insurance_info?: string;
}

type SelectionMode = 'search' | 'new' | 'anonymous';

export default function PatientSelector({ selectedPatient, onPatientSelect, onError }: PatientSelectorProps) {
  const { activeMode, organizationId } = useMultiOrgUserMode();
  const [mode, setMode] = useState<SelectionMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(PatientProfile | OrganizationPatient)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingAllPatients, setIsLoadingAllPatients] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [newPatientData, setNewPatientData] = useState({
    patient_name: '',
    patient_surname: '',
    patient_id: '',
    patient_gender: '',
    date_of_birth: '',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    allergies: '',
    chronic_conditions: '',
    insurance_info: ''
  });

  // Search for patients when query changes
  useEffect(() => {
    if (searchQuery.length >= 2 && mode === 'search') {
      searchPatients();
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery, mode]);

  const searchPatients = async () => {
    if (searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const { data, error } = await ModeAwarePatientService.searchPatients(
        searchQuery,
        activeMode,
        organizationId
      );

      if (error) {
        onError(error);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
        setShowResults(true);
      }
    } catch (error) {
      onError('Failed to search patients');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadAllPatients = async () => {
    setIsLoadingAllPatients(true);
    try {
      // Use getPatients to get all patients instead of search
      const { data, error } = await ModeAwarePatientService.getPatients(
        activeMode,
        organizationId
      );

      if (error) {
        onError(error);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
        setShowResults(true);
        // Clear search query to show we're showing all patients
        setSearchQuery('');
      }
    } catch (error) {
      onError('Failed to load patients');
      setSearchResults([]);
    } finally {
      setIsLoadingAllPatients(false);
    }
  };

  const selectPatient = (patient: PatientProfile | OrganizationPatient) => {
    const patientData: PatientData = {
      id: patient.id,
      patient_name: patient.patient_name || '',
      patient_surname: patient.patient_surname || '',
      patient_id: patient.patient_id || '',
      patient_gender: (patient as any).patient_gender || undefined,
      date_of_birth: patient.date_of_birth || undefined,
      phone: patient.phone || undefined,
      email: patient.email || undefined,
      address: patient.address || undefined,
      emergency_contact: patient.emergency_contact || undefined,
      allergies: Array.isArray(patient.allergies)
        ? (patient.allergies as string[]).join(', ')
        : (patient.allergies as string) || undefined,
      chronic_conditions: patient.chronic_conditions || undefined,
      insurance_info: patient.insurance_info || undefined
    };

    onPatientSelect(patientData);
    setSearchQuery(`${patient.patient_name} ${patient.patient_surname} (ID: ${patient.patient_id})`);
    setShowResults(false);
    setMode('search');
  };

  const createNewPatient = async () => {
    if (!newPatientData.patient_name || !newPatientData.patient_surname || !newPatientData.patient_id) {
      onError('Patient name and ID are required');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await ModeAwarePatientService.createPatient(
        newPatientData,
        activeMode,
        organizationId
      );

      if (error) {
        onError(error);
      } else if (data) {
        // Select the newly created patient
        selectPatient(data);
        // Reset form
        setNewPatientData({
          patient_name: '',
          patient_surname: '',
          patient_id: '',
          patient_gender: '',
          date_of_birth: '',
          phone: '',
          email: '',
          address: '',
          emergency_contact: '',
          allergies: '',
          chronic_conditions: '',
          insurance_info: ''
        });
      }
    } catch (error) {
      onError('Failed to create patient');
    } finally {
      setIsCreating(false);
    }
  };

  const continueAnonymous = () => {
    onPatientSelect(null);
    setSearchQuery('');
    setShowResults(false);
    setMode('search');
  };

  const clearSelection = () => {
    onPatientSelect(null);
    setSearchQuery('');
    setShowResults(false);
    setMode('search');
  };

  return (
    <div className="space-y-4">
      {/* Mode Selection Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-900">Patient Information</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('search')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              mode === 'search'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Search Patient
          </button>
          <button
            onClick={() => setMode('new')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              mode === 'new'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Add New
          </button>
          <button
            onClick={() => setMode('anonymous')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              mode === 'anonymous'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Anonymous
          </button>
        </div>
      </div>

      {/* Current Selection Display */}
      {selectedPatient && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-emerald-900">
                {selectedPatient.patient_name} {selectedPatient.patient_surname}
              </h4>
              <p className="text-sm text-emerald-700">ID: {selectedPatient.patient_id}</p>
              {selectedPatient.date_of_birth && (
                <div className="text-sm text-emerald-700">
                  <span>DOB: {selectedPatient.date_of_birth}</span>
                  {calculateAge(selectedPatient.date_of_birth) !== null && (
                    <span className="ml-2 font-medium">
                      ({formatAge(calculateAge(selectedPatient.date_of_birth)!)})
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={clearSelection}
              className="text-emerald-600 hover:text-emerald-800 p-1"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Search Mode */}
      {mode === 'search' && !selectedPatient && (
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients by name or ID..."
            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />

          {/* Dropdown Arrow Button */}
          <button
            type="button"
            onClick={loadAllPatients}
            disabled={isLoadingAllPatients || isSearching}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
            title="Show all patients"
          >
            {isLoadingAllPatients ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {(isSearching && !isLoadingAllPatients) && (
            <div className="absolute right-12 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
            </div>
          )}

          {/* Search Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.length > 10 && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-sm text-slate-600">
                  {searchResults.length} patients found {searchQuery ? `for "${searchQuery}"` : '(all patients)'}
                </div>
              )}
              {searchResults.map((patient: any) => (
                <button
                  key={patient.id}
                  onClick={() => selectPatient(patient)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {patient.patient_name} {patient.patient_surname}
                      </div>
                      <div className="text-sm text-slate-600">ID: {patient.patient_id}</div>
                      {patient.date_of_birth && (
                        <div className="text-sm text-slate-500">
                          <span>DOB: {patient.date_of_birth}</span>
                          {calculateAge(patient.date_of_birth) !== null && (
                            <span className="ml-2 font-medium text-slate-600">
                              ({formatAge(calculateAge(patient.date_of_birth)!)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {patient.diagnosis_count !== undefined && (
                      <div className="text-right ml-3">
                        <div className="text-xs text-slate-500">
                          {patient.diagnosis_count} visit{patient.diagnosis_count !== 1 ? 's' : ''}
                        </div>
                        {patient.last_diagnosis && patient.last_diagnosis !== 'No diagnosis' && (
                          <div className="text-xs text-slate-400 max-w-24 truncate">
                            {patient.last_diagnosis}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showResults && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-4">
              <p className="text-slate-600 text-center">No patients found</p>
            </div>
          )}
        </div>
      )}

      {/* New Patient Mode */}
      {mode === 'new' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-medium text-blue-900 mb-4">Add New Patient</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">First Name *</label>
              <input
                type="text"
                value={newPatientData.patient_name}
                onChange={(e) => setNewPatientData({ ...newPatientData, patient_name: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Last Name *</label>
              <input
                type="text"
                value={newPatientData.patient_surname}
                onChange={(e) => setNewPatientData({ ...newPatientData, patient_surname: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Patient ID *</label>
              <input
                type="text"
                value={newPatientData.patient_id}
                onChange={(e) => setNewPatientData({ ...newPatientData, patient_id: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Unique medical record number"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Gender</label>
              <select
                value={newPatientData.patient_gender}
                onChange={(e) => setNewPatientData({ ...newPatientData, patient_gender: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Date of Birth</label>
              <input
                type="date"
                value={newPatientData.date_of_birth}
                onChange={(e) => setNewPatientData({ ...newPatientData, date_of_birth: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Phone</label>
              <input
                type="tel"
                value={newPatientData.phone}
                onChange={(e) => setNewPatientData({ ...newPatientData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Email</label>
              <input
                type="email"
                value={newPatientData.email}
                onChange={(e) => setNewPatientData({ ...newPatientData, email: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-blue-800 mb-1">Address</label>
              <input
                type="text"
                value={newPatientData.address}
                onChange={(e) => setNewPatientData({ ...newPatientData, address: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={createNewPatient}
              disabled={isCreating || !newPatientData.patient_name || !newPatientData.patient_surname || !newPatientData.patient_id}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isCreating && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Add Patient
            </button>
            <button
              onClick={() => setMode('search')}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Anonymous Mode */}
      {mode === 'anonymous' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h4 className="font-medium text-amber-900 mb-2">Anonymous Diagnosis</h4>
          <p className="text-amber-700 mb-4">
            Continue without patient identification. Patient data will not be saved to records.
          </p>
          <button
            onClick={continueAnonymous}
            className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            Continue Anonymous
          </button>
        </div>
      )}
    </div>
  );
}