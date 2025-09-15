'use client';

import Navigation from '@/components/layout/Navigation';
import { ModeAwareDrugDispensingService } from '@/lib/modeAwareDrugDispensingService';
import { DrugDispensingService, DrugDispensingRecord, DispensingStats } from '@/lib/drugDispensingService';
import { ModeAwarePatientService } from '@/lib/modeAwarePatientService';
import { PatientService } from '@/lib/patientService';
import { DatabaseService } from '@/lib/database';
import { DrugInventoryService } from '@/lib/drugInventory';
import { UserDrugInventory, PatientProfile } from '@/types/database';
import { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import DrugDispensingOrganizationSelector from '@/components/drugDispensing/OrganizationSelector';
import { supabase } from '@/lib/supabase';

export default function DrugDispensing() {
  const { user } = useSupabaseAuth();
  const { activeMode, organizationId, loading: modeLoading } = useMultiOrgUserMode();
  const [dispensingHistory, setDispensingHistory] = useState<DrugDispensingRecord[]>([]);
  const [stats, setStats] = useState<DispensingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletedItems, setDeletedItems] = useState<{[recordId: string]: {patientDeleted: boolean, diagnosisDeleted: boolean}}>({});
  const [inventoryData, setInventoryData] = useState<{[drugId: string]: number}>({});
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Separate search functionality for each filter type
  const [drugSearchTerm, setDrugSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [diagnosisSearchTerm, setDiagnosisSearchTerm] = useState('');
  
  // Dropdown suggestions for each search type
  const [drugSuggestionsFilter, setDrugSuggestionsFilter] = useState<string[]>([]);
  const [patientSuggestionsFilter, setPatientSuggestionsFilter] = useState<string[]>([]);
  const [diagnosisSuggestionsFilter, setDiagnosisSuggestionsFilter] = useState<string[]>([]);
  
  // Dropdown visibility states
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
  
  // Refs for dropdown containers to handle click outside
  const drugDropdownRef = useRef<HTMLDivElement>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);
  const diagnosisDropdownRef = useRef<HTMLDivElement>(null);

  // Refs for manual form dropdowns
  const manualDrugDropdownRef = useRef<HTMLDivElement>(null);
  const manualPatientDropdownRef = useRef<HTMLDivElement>(null);
  
  // Manual dispensing form
  const [showManualForm, setShowManualForm] = useState(false);
  const [drugSearch, setDrugSearch] = useState('');
  const [drugSuggestions, setDrugSuggestions] = useState<UserDrugInventory[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<UserDrugInventory | null>(null);
  const [showDrugDropdownManual, setShowDrugDropdownManual] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<PatientProfile[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [showPatientDropdownManual, setShowPatientDropdownManual] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [addingDispensing, setAddingDispensing] = useState(false);

  // Cache for performance optimization
  const [cachedDrugs, setCachedDrugs] = useState<UserDrugInventory[] | null>(null);
  const [cachedPatients, setCachedPatients] = useState<PatientProfile[] | null>(null);
  const [cachedDispensingHistory, setCachedDispensingHistory] = useState<DrugDispensingRecord[] | null>(null);
  const [lastFetchParams, setLastFetchParams] = useState<string>('');
  const [loadingDropdown, setLoadingDropdown] = useState(false);

  useEffect(() => {
    if (user && !modeLoading && activeMode !== undefined) {
      console.log('🔄 Fetching data with context:', {
        user: !!user,
        activeMode,
        organizationId,
        modeLoading,
        contextReady: !modeLoading && activeMode !== undefined
      });
      fetchData();
    } else {
      console.log('⏳ Waiting for context to be ready:', {
        user: !!user,
        modeLoading,
        activeMode,
        organizationId
      });
    }
  }, [user, selectedPeriod, activeMode, organizationId, modeLoading]);
  
  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target) return;

      if (drugDropdownRef.current && !drugDropdownRef.current.contains(target)) {
        setShowDrugDropdown(false);
      }
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(target)) {
        setShowPatientDropdown(false);
      }
      if (diagnosisDropdownRef.current && !diagnosisDropdownRef.current.contains(target)) {
        setShowDiagnosisDropdown(false);
      }
      // Manual form dropdowns
      if (manualDrugDropdownRef.current && !manualDrugDropdownRef.current.contains(target)) {
        setShowDrugDropdownManual(false);
        setDrugSuggestions([]);
      }
      if (manualPatientDropdownRef.current && !manualPatientDropdownRef.current.contains(target)) {
        setShowPatientDropdownManual(false);
        setPatientSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchInventoryData = async () => {
    try {
      const { data: inventory, error } = await DrugInventoryService.getUserDrugInventory();
      if (error) {
        console.warn('Could not fetch inventory data:', error);
        return;
      }

      // Create a mapping of drug_id to stock_quantity
      const inventoryMap: {[drugId: string]: number} = {};
      if (inventory) {
        inventory.forEach(item => {
          inventoryMap[item.id] = item.stock_quantity || 0;
        });
      }
      setInventoryData(inventoryMap);
    } catch (err) {
      console.warn('Error fetching inventory data:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Ensure we have proper mode context before fetching
      if (activeMode === undefined || modeLoading) {
        console.warn('⚠️ Context not ready, skipping fetch:', { activeMode, modeLoading });
        setLoading(false);
        return;
      }

      // Create cache key for current fetch parameters
      const cacheKey = `${activeMode}-${organizationId}-${selectedPeriod}`;

      // Use cached data if available and parameters haven't changed
      if (cachedDispensingHistory && lastFetchParams === cacheKey) {
        console.log('📋 Using cached dispensing history');
        setDispensingHistory(cachedDispensingHistory);
        setLoading(false);
        return;
      }

      // Fetch dispensing history using mode-aware service
      console.log('🔍 Fetching dispensing history with mode:', { activeMode, organizationId, userExists: !!user });
      const { data: history, error: historyError } = await ModeAwareDrugDispensingService.getDispensingHistory(
        activeMode,
        organizationId,
        50 // Reduced from 100 for faster initial load
      );

      console.log('🔍 Service response:', {
        historyError,
        historyLength: history?.length,
        historyExists: !!history,
        isArray: Array.isArray(history)
      });

      if (historyError) {
        console.error('❌ Error fetching dispensing history:', historyError);
        throw new Error(historyError);
      }

      console.log('✅ Dispensing history fetched:', history?.length, 'records');
      if (history && history.length > 0) {
        console.log('📋 First record sample:', {
          id: history[0].id,
          drug_name: history[0].drug_name,
          patient_name: history[0].patient_name,
          dispensed_date: history[0].dispensed_date
        });
      } else {
        console.log('⚠️ No dispensing records found');
      }

      const historyData = history || [];
      setDispensingHistory(historyData);

      // Cache the results
      setCachedDispensingHistory(historyData);
      setLastFetchParams(cacheKey);

      // Fetch statistics using mode-aware service
      const { data: statsData, error: statsError } = await ModeAwareDrugDispensingService.getDispensingSummary(
        activeMode,
        organizationId,
        selectedPeriod
      );
      if (statsError) {
        throw new Error(statsError);
      }
      setStats(statsData);

      // Run parallel operations for better performance
      const parallelOperations = [];

      // Check for deleted patients and diagnoses
      if (historyData.length > 0) {
        parallelOperations.push(checkForDeletedItems(historyData));
      }

      // Fetch inventory data in parallel
      parallelOperations.push(fetchInventoryData());

      // Wait for all parallel operations to complete
      await Promise.all(parallelOperations);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const checkForDeletedItems = async (records: DrugDispensingRecord[]) => {
    try {
      const deletedCheck: {[recordId: string]: {patientDeleted: boolean, diagnosisDeleted: boolean}} = {};
      
      // Get all existing patients once using mode-aware service
      let existingPatients: any[] = [];
      try {
        const { data: patients } = await ModeAwarePatientService.getPatients(activeMode, organizationId);
        existingPatients = patients || [];
      } catch (err) {
        console.warn('Error fetching patients for deletion check:', err);
      }

      for (const record of records) {
        deletedCheck[record.id] = {
          patientDeleted: false,
          diagnosisDeleted: false
        };

        // Check if patient still exists (for records with patient names)
        // Skip manual entries and inventory management records
        if (record.patient_name &&
            record.patient_name !== 'Unknown Patient' &&
            record.patient_name !== 'Anonymous Patient' &&
            record.patient_name !== 'No patient specified') {
          const patientExists = existingPatients.some(p => p.patient_name === record.patient_name);
          if (!patientExists) {
            deletedCheck[record.id].patientDeleted = true;
          }
        }

        // Check if diagnosis still exists (for records with diagnosis_id)
        if (record.diagnosis_id) {
          try {
            let diagnosisExists = false;

            if (activeMode === 'organization' && organizationId) {
              // Check organization diagnoses table
              const { data, error } = await supabase
                .from('organization_diagnoses')
                .select('id')
                .eq('id', record.diagnosis_id)
                .eq('organization_id', organizationId)
                .single();

              diagnosisExists = !error && !!data;
            } else {
              // Check individual diagnoses table
              const { data, error } = await supabase
                .from('diagnoses')
                .select('id')
                .eq('id', record.diagnosis_id)
                .single();

              diagnosisExists = !error && !!data;
            }

            if (!diagnosisExists) {
              deletedCheck[record.id].diagnosisDeleted = true;
            }
          } catch (err) {
            // If we can't fetch it, assume it's deleted
            deletedCheck[record.id].diagnosisDeleted = true;
          }
        }
      }

      setDeletedItems(deletedCheck);
    } catch (err) {
      console.warn('Error checking for deleted items:', err);
    }
  };

  const handleFilterChange = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      
      const { data: history, error } = await DrugDispensingService.getDispensingHistory(100, 0, filters);
      if (error) {
        throw new Error(error);
      }
      
      setDispensingHistory(history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply filters');
    } finally {
      setLoading(false);
    }
  };

  // Drug search functionality
  const searchDrugs = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setDrugSuggestions([]);
      setShowDrugDropdownManual(false);
      return;
    }

    try {
      const { data: inventory } = await DrugInventoryService.getUserDrugInventory();
      if (inventory) {
        const filtered = inventory.filter(drug =>
          drug.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          drug.generic_name?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
        setDrugSuggestions(filtered);
        setShowDrugDropdownManual(filtered.length > 0);
      }
    } catch (err) {
      console.error('Error searching drugs:', err);
    }
  };

  // Show all available drugs when dropdown arrow is clicked
  const showAllDrugs = async () => {
    try {
      setLoadingDropdown(true);

      // Use cached data if available
      if (cachedDrugs) {
        setDrugSuggestions(cachedDrugs);
        setShowDrugDropdownManual(true);
        setLoadingDropdown(false);
        return;
      }

      const { data: inventory } = await DrugInventoryService.getUserDrugInventory();
      if (inventory) {
        // Sort by drug name and cache for future use
        const sortedDrugs = inventory.sort((a, b) =>
          a.drug_name.toLowerCase().localeCompare(b.drug_name.toLowerCase())
        );
        setCachedDrugs(sortedDrugs);
        setDrugSuggestions(sortedDrugs);
        setShowDrugDropdownManual(true);
      }
    } catch (err) {
      console.error('Error loading all drugs:', err);
    } finally {
      setLoadingDropdown(false);
    }
  };

  // Patient search functionality
  const searchPatients = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setPatientSuggestions([]);
      setShowPatientDropdownManual(false);
      return;
    }

    try {
      const { data: patients } = await ModeAwarePatientService.getPatients(activeMode, organizationId);
      if (patients) {
        const filtered = patients.filter(patient =>
          patient.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          patient.patient_surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          patient.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
        setPatientSuggestions(filtered);
        setShowPatientDropdownManual(filtered.length > 0);
      }
    } catch (err) {
      console.error('Error searching patients:', err);
    }
  };

  // Show all available patients when dropdown arrow is clicked
  const showAllPatients = async () => {
    try {
      setLoadingDropdown(true);

      // Use cached data if available
      if (cachedPatients) {
        setPatientSuggestions(cachedPatients);
        setShowPatientDropdownManual(true);
        setLoadingDropdown(false);
        return;
      }

      const { data: patients } = await ModeAwarePatientService.getPatients(activeMode, organizationId);
      if (patients) {
        // Sort by patient name and cache for future use
        const sortedPatients = patients.sort((a, b) =>
          a.patient_name.toLowerCase().localeCompare(b.patient_name.toLowerCase())
        );
        setCachedPatients(sortedPatients);
        setPatientSuggestions(sortedPatients);
        setShowPatientDropdownManual(true);
      }
    } catch (err) {
      console.error('Error loading all patients:', err);
    } finally {
      setLoadingDropdown(false);
    }
  };

  // Drug search functionality with smart filtering
  const searchDrugsFilter = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 1) {
      setDrugSuggestionsFilter([]);
      setShowDrugDropdown(false);
      return;
    }

    const suggestions = new Set<string>();
    const searchLower = searchTerm.toLowerCase();

    // Filter records based on current patient selection
    const filteredRecords = patientSearchTerm 
      ? dispensingHistory.filter(record => 
          record.patient_name?.toLowerCase().includes(patientSearchTerm.toLowerCase())
        )
      : dispensingHistory;

    // Add matching drug names from filtered records
    filteredRecords.forEach(record => {
      if (record.drug_name && record.drug_name.toLowerCase().includes(searchLower)) {
        suggestions.add(record.drug_name);
      }
    });

    const suggestionArray = Array.from(suggestions).slice(0, 10);
    setDrugSuggestionsFilter(suggestionArray);
    setShowDrugDropdown(suggestionArray.length > 0);
  };

  const showAllDrugsFilter = () => {
    const allDrugs = new Set<string>();
    
    // Filter records based on current patient selection
    const filteredRecords = patientSearchTerm 
      ? dispensingHistory.filter(record => 
          record.patient_name?.toLowerCase().includes(patientSearchTerm.toLowerCase())
        )
      : dispensingHistory;
    
    filteredRecords.forEach(record => {
      if (record.drug_name) allDrugs.add(record.drug_name);
    });

    const sortedDrugs = Array.from(allDrugs)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .slice(0, 20);

    setDrugSuggestionsFilter(sortedDrugs);
    setShowDrugDropdown(true);
  };

  // Patient search functionality
  const searchPatientsFilter = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 1) {
      setPatientSuggestionsFilter([]);
      setShowPatientDropdown(false);
      return;
    }

    const suggestions = new Set<string>();
    const searchLower = searchTerm.toLowerCase();

    // Add matching patient names
    dispensingHistory.forEach(record => {
      if (record.patient_name && record.patient_name.toLowerCase().includes(searchLower)) {
        suggestions.add(record.patient_name);
      }
    });

    const suggestionArray = Array.from(suggestions).slice(0, 10);
    setPatientSuggestionsFilter(suggestionArray);
    setShowPatientDropdown(suggestionArray.length > 0);
  };

  const showAllPatientsFilter = () => {
    const allPatients = new Set<string>();
    dispensingHistory.forEach(record => {
      if (record.patient_name) allPatients.add(record.patient_name);
    });

    const sortedPatients = Array.from(allPatients)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .slice(0, 20);

    setPatientSuggestionsFilter(sortedPatients);
    setShowPatientDropdown(true);
  };

  // Diagnosis search functionality with smart filtering
  const searchDiagnosisFilter = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 1) {
      setDiagnosisSuggestionsFilter([]);
      setShowDiagnosisDropdown(false);
      return;
    }

    const suggestions = new Set<string>();
    const searchLower = searchTerm.toLowerCase();

    // Filter records based on current patient selection
    const filteredRecords = patientSearchTerm 
      ? dispensingHistory.filter(record => 
          record.patient_name?.toLowerCase().includes(patientSearchTerm.toLowerCase())
        )
      : dispensingHistory;

    // Add matching diagnoses from filtered records
    filteredRecords.forEach(record => {
      if (record.primary_diagnosis && record.primary_diagnosis.toLowerCase().includes(searchLower)) {
        suggestions.add(record.primary_diagnosis);
      }
    });

    const suggestionArray = Array.from(suggestions).slice(0, 10);
    setDiagnosisSuggestionsFilter(suggestionArray);
    setShowDiagnosisDropdown(suggestionArray.length > 0);
  };

  const showAllDiagnosisFilter = () => {
    const allDiagnoses = new Set<string>();
    
    // Filter records based on current patient selection
    const filteredRecords = patientSearchTerm 
      ? dispensingHistory.filter(record => 
          record.patient_name?.toLowerCase().includes(patientSearchTerm.toLowerCase())
        )
      : dispensingHistory;
    
    filteredRecords.forEach(record => {
      if (record.primary_diagnosis) allDiagnoses.add(record.primary_diagnosis);
    });

    const sortedDiagnoses = Array.from(allDiagnoses)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .slice(0, 20);

    setDiagnosisSuggestionsFilter(sortedDiagnoses);
    setShowDiagnosisDropdown(true);
  };

  // Handle manual dispensing submission
  const handleManualDispensing = async () => {
    if (!selectedDrug || quantity < 1) {
      setError('Please select a drug and enter quantity');
      return;
    }

    try {
      setAddingDispensing(true);
      setError('');

      // Use mode-aware dispensing service for manual entries
      const dispensingRecord = {
        drugId: selectedDrug.id,
        drugName: selectedDrug.drug_name,
        quantity: quantity,
        notes: notes || 'Manually added to dispensing history'
      };

      const { error } = await ModeAwareDrugDispensingService.recordDispensing(
        [dispensingRecord],
        null, // No diagnosis ID for manual entries
        {
          patient_name: selectedPatient?.patient_name || 'No patient specified',
          patient_age: selectedPatient?.patient_age,
          patient_gender: selectedPatient?.patient_gender,
          primary_diagnosis: selectedPatient ? 'Manual dispensing' : 'Inventory management'
        },
        activeMode,
        organizationId,
        true // Skip duplicate check for manual entries
      );

      if (error) {
        throw new Error(error);
      }

      // Reset form but keep it open
      setSelectedDrug(null);
      setSelectedPatient(null);
      setQuantity(1);
      setNotes('');
      setDrugSearch('');
      setPatientSearch('');
      setDrugSuggestions([]);
      setPatientSuggestions([]);

      // Clear any error messages
      setError('');

      // Show success message after a brief delay to ensure form reset is visible
      setTimeout(() => {
        setSuccessMessage('Manual dispensing added successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }, 100);

      // Clear cache and refresh data
      setCachedDrugs(null);
      setCachedPatients(null);
      setCachedDispensingHistory(null);
      setLastFetchParams('');
      await fetchData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add manual dispensing');
    } finally {
      setAddingDispensing(false);
    }
  };

  const filteredHistory = dispensingHistory.filter(record => {
    const matchesDrug = !drugSearchTerm || 
      record.drug_name?.toLowerCase().includes(drugSearchTerm.toLowerCase());
      
    const matchesPatient = !patientSearchTerm || 
      record.patient_name?.toLowerCase().includes(patientSearchTerm.toLowerCase());
      
    const matchesDiagnosis = !diagnosisSearchTerm || 
      record.primary_diagnosis?.toLowerCase().includes(diagnosisSearchTerm.toLowerCase());
    
    return matchesDrug && matchesPatient && matchesDiagnosis;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Please log in to view dispensing history.</p>
        </div>
      </div>
    );
  }

  // Show loading state while context is initializing
  if (modeLoading || activeMode === undefined) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-600">Loading user context...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Drug Dispensing History</h1>
            <p className="text-slate-600 mt-2">Track medications dispensed to patients and inventory usage</p>
          </div>
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {showManualForm ? 'Cancel' : 'Add Manual Dispensing'}
          </button>
        </div>

        {/* Organization/Individual Mode Selector */}
        <DrugDispensingOrganizationSelector
          onError={(error) => setError(error)}
          onSuccess={(message) => {
            setSuccessMessage(message);
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Manual Dispensing Form */}
        {showManualForm && (
          <div className="bg-white rounded-xl border border-slate-200 mb-8">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add Manual Dispensing</h2>
              <p className="text-sm text-slate-600 mt-1">Add drugs dispensed to patients or manage inventory (e.g., expired drugs, stock adjustments)</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Drug Search */}
                <div className="relative" ref={manualDrugDropdownRef}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Drug *</label>
                  <div className="relative flex">
                    <input
                      type="text"
                      placeholder="Search drug name..."
                      value={drugSearch}
                      onChange={(e) => {
                        setDrugSearch(e.target.value);
                        searchDrugs(e.target.value);
                      }}
                      onFocus={() => {
                        if (drugSearch && drugSearch.length >= 2) {
                          searchDrugs(drugSearch);
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (showDrugDropdownManual) {
                          setShowDrugDropdownManual(false);
                          setDrugSuggestions([]);
                        } else {
                          showAllDrugs();
                        }
                      }}
                      disabled={loadingDropdown}
                      className="px-3 py-2 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset disabled:opacity-50 disabled:cursor-not-allowed"
                      title={showDrugDropdownManual ? "Close dropdown" : "Show all drugs"}
                    >
                      {loadingDropdown ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : showDrugDropdownManual ? "▲" : "▼"}
                    </button>
                  </div>
                  {showDrugDropdownManual && drugSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {drugSuggestions.map((drug) => (
                        <div
                          key={drug.id}
                          onClick={() => {
                            setSelectedDrug(drug);
                            setDrugSearch('');
                            setDrugSuggestions([]);
                            setShowDrugDropdownManual(false);
                          }}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                        >
                          <div className="font-medium text-slate-900">{drug.drug_name}</div>
                          <div className="text-sm text-slate-600">
                            {drug.strength && `${drug.strength} • `}
                            {drug.dosage_form && `${drug.dosage_form} • `}
                            <span className={`font-medium ${drug.stock_quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              Stock: {drug.stock_quantity}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {drug.expiry_date && (
                              <span className={`mr-3 ${
                                new Date(drug.expiry_date) < new Date() ? 'text-red-600 font-medium' :
                                new Date(drug.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-amber-600 font-medium' :
                                'text-slate-500'
                              }`}>
                                Exp: {new Date(drug.expiry_date).toLocaleDateString()}
                              </span>
                            )}
                            {drug.generic_name && <span>Generic: {drug.generic_name}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedDrug && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-emerald-900">Selected: {selectedDrug.drug_name}</div>
                        <button
                          onClick={() => {
                            setSelectedDrug(null);
                            setDrugSearch('');
                          }}
                          className="ml-2 p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded transition-colors"
                          title="Clear selection"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Patient Search */}
                <div className="relative" ref={manualPatientDropdownRef}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Patient <span className="text-slate-500 font-normal">(optional)</span></label>
                  <div className="relative flex">
                    <input
                      type="text"
                      placeholder="Search patient name (optional)..."
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        searchPatients(e.target.value);
                      }}
                      onFocus={() => {
                        if (patientSearch && patientSearch.length >= 2) {
                          searchPatients(patientSearch);
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (showPatientDropdownManual) {
                          setShowPatientDropdownManual(false);
                          setPatientSuggestions([]);
                        } else {
                          showAllPatients();
                        }
                      }}
                      disabled={loadingDropdown}
                      className="px-3 py-2 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset disabled:opacity-50 disabled:cursor-not-allowed"
                      title={showPatientDropdownManual ? "Close dropdown" : "Show all patients"}
                    >
                      {loadingDropdown ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : showPatientDropdownManual ? "▲" : "▼"}
                    </button>
                  </div>
                  {showPatientDropdownManual && patientSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {patientSuggestions.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setPatientSearch('');
                            setPatientSuggestions([]);
                            setShowPatientDropdownManual(false);
                          }}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                        >
                          <div className="font-medium text-slate-900">
                            {patient.patient_name} {patient.patient_surname}
                          </div>
                          <div className="text-sm text-slate-600">
                            {patient.patient_id && `ID: ${patient.patient_id} • `}
                            {patient.patient_age && `Age: ${patient.patient_age} • `}
                            {patient.patient_gender}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-emerald-900">
                          Selected: {selectedPatient.patient_name} {selectedPatient.patient_surname}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPatient(null);
                            setPatientSearch('');
                          }}
                          className="ml-2 p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded transition-colors"
                          title="Clear selection"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-2">
                <button
                  onClick={handleManualDispensing}
                  disabled={!selectedDrug || quantity < 1 || addingDispensing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {addingDispensing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Dispensing'
                  )}
                </button>
                <button
                  onClick={() => setShowManualForm(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.415-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Total Dispensed</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total_dispensed}</p>
                  <p className="text-xs text-slate-500">units in {selectedPeriod}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Unique Patients</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.unique_patients}</p>
                  <p className="text-xs text-slate-500">treated in {selectedPeriod}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.415-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Unique Drugs</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.unique_drugs}</p>
                  <p className="text-xs text-slate-500">different medications</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Total Value</p>
                  <p className="text-2xl font-bold text-slate-900">€{stats.total_value.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">dispensed value</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 mb-8">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Filters & Search</h2>
            
            {/* Search Filters Row */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Search Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{minHeight: '80px'}}>
              {/* Drug Search */}
              <div className="relative mb-4 md:mb-0" ref={drugDropdownRef}>
                <label className="block text-sm font-medium text-slate-700 mb-2">Drug</label>
                <div className="relative flex">
                  <input 
                    type="text"
                    placeholder="Search drugs..."
                    value={drugSearchTerm}
                    onChange={(e) => {
                      setDrugSearchTerm(e.target.value);
                      searchDrugsFilter(e.target.value);
                    }}
                    onFocus={() => {
                      if (drugSearchTerm && drugSearchTerm.length >= 1) {
                        searchDrugsFilter(drugSearchTerm);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={showAllDrugsFilter}
                    className="px-3 py-2 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
                    title="Show all drugs"
                  >
                    ▼
                  </button>
                </div>
                {showDrugDropdown && drugSuggestionsFilter.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-300 rounded-b-lg shadow-lg max-h-40 overflow-y-auto mt-1">
                    {drugSuggestionsFilter.map((suggestion, index) => (
                      <div
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDrugSearchTerm(suggestion);
                          setDrugSuggestionsFilter([]);
                          setShowDrugDropdown(false);
                        }}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Search */}
              <div className="relative mb-4 md:mb-0" ref={patientDropdownRef}>
                <label className="block text-sm font-medium text-slate-700 mb-2">Patient</label>
                <div className="relative flex">
                  <input 
                    type="text"
                    placeholder="Search patients..."
                    value={patientSearchTerm}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setPatientSearchTerm(newValue);
                      searchPatientsFilter(newValue);
                      
                      // Clear drug and diagnosis when patient search changes
                      if (drugSearchTerm || diagnosisSearchTerm) {
                        setDrugSearchTerm('');
                        setDiagnosisSearchTerm('');
                        setDrugSuggestionsFilter([]);
                        setDiagnosisSuggestionsFilter([]);
                        setShowDrugDropdown(false);
                        setShowDiagnosisDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (patientSearchTerm && patientSearchTerm.length >= 1) {
                        searchPatientsFilter(patientSearchTerm);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={showAllPatientsFilter}
                    className="px-3 py-2 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
                    title="Show all patients"
                  >
                    ▼
                  </button>
                </div>
                {showPatientDropdown && patientSuggestionsFilter.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-300 rounded-b-lg shadow-lg max-h-40 overflow-y-auto mt-1">
                    {patientSuggestionsFilter.map((suggestion, index) => (
                      <div
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPatientSearchTerm(suggestion);
                          setPatientSuggestionsFilter([]);
                          setShowPatientDropdown(false);
                          // Clear and refresh drug/diagnosis suggestions when patient changes
                          setDrugSearchTerm('');
                          setDiagnosisSearchTerm('');
                          setDrugSuggestionsFilter([]);
                          setDiagnosisSuggestionsFilter([]);
                          setShowDrugDropdown(false);
                          setShowDiagnosisDropdown(false);
                        }}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Diagnosis Search */}
              <div className="relative mb-4 md:mb-0" ref={diagnosisDropdownRef}>
                <label className="block text-sm font-medium text-slate-700 mb-2">Diagnosis</label>
                <div className="relative flex">
                  <input 
                    type="text"
                    placeholder="Search diagnoses..."
                    value={diagnosisSearchTerm}
                    onChange={(e) => {
                      setDiagnosisSearchTerm(e.target.value);
                      searchDiagnosisFilter(e.target.value);
                    }}
                    onFocus={() => {
                      if (diagnosisSearchTerm && diagnosisSearchTerm.length >= 1) {
                        searchDiagnosisFilter(diagnosisSearchTerm);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={showAllDiagnosisFilter}
                    className="px-3 py-2 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
                    title="Show all diagnoses"
                  >
                    ▼
                  </button>
                </div>
                {showDiagnosisDropdown && diagnosisSuggestionsFilter.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-300 rounded-b-lg shadow-lg max-h-40 overflow-y-auto mt-1">
                    {diagnosisSuggestionsFilter.map((suggestion, index) => (
                      <div
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDiagnosisSearchTerm(suggestion);
                          setDiagnosisSuggestionsFilter([]);
                          setShowDiagnosisDropdown(false);
                        }}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>
            
            {/* Date Filters Row */}
            <div className="mb-0">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Date Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="mb-4 md:mb-0">
                <label className="block text-sm font-medium text-slate-700 mb-2">Period</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="quarter">Last Quarter</option>
                  <option value="year">Last Year</option>
                </select>
              </div>

              <div className="mb-4 md:mb-0">
                <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
                <input 
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4 md:mb-0">
                <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
                <input 
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button 
                onClick={handleFilterChange}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Apply Filters
              </button>
              <button 
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setDrugSearchTerm('');
                  setPatientSearchTerm('');
                  setDiagnosisSearchTerm('');
                  setDrugSuggestionsFilter([]);
                  setPatientSuggestionsFilter([]);
                  setDiagnosisSuggestionsFilter([]);
                  setShowDrugDropdown(false);
                  setShowPatientDropdown(false);
                  setShowDiagnosisDropdown(false);
                  fetchData();
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Top Drugs */}
        {stats && stats.top_drugs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Most Dispensed Drugs</h2>
                <button 
                  onClick={fetchData}
                  className="px-3 py-1 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {stats.top_drugs.map((drug, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{drug.drug_name}</h4>
                        <p className="text-sm text-slate-600">{drug.total_dispensings} dispensing{drug.total_dispensings !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{drug.total_quantity} units</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                <button 
                  onClick={fetchData}
                  className="px-3 py-1 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {stats.recent_activity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{activity.drug_name}</h4>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${deletedItems[activity.id]?.patientDeleted ? 'text-red-500 line-through' : 'text-slate-600'}`}>
                            {activity.patient_name || 'Unknown Patient'}
                          </p>
                          {deletedItems[activity.id]?.patientDeleted && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              Deleted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(activity.dispensed_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{activity.quantity_dispensed} units</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dispensing History Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Dispensing History</h2>
            <button 
              onClick={async () => {
                const confirmed = window.confirm(
                  '⚠️ Are you sure you want to delete ALL dispensing history records?\n\n' +
                  '⚠️ IMPORTANT: This will also REDUCE your current inventory by the total amounts of all dispensed drugs in this history.\n\n' +
                  'For example, if you dispensed 5 units of Drug A across multiple records, your inventory will be reduced by 5 units.\n\n' +
                  'This action cannot be undone and will permanently remove all your dispensing records from the database.'
                );
                
                if (confirmed) {
                  try {
                    setLoading(true);

                    // Clear cache BEFORE clearing data to prevent stale cache
                    console.log('🗑️ Clearing cache before delete operation...');
                    setCachedDispensingHistory(null);
                    setLastFetchParams('');
                    setCachedDrugs(null);
                    setCachedPatients(null);

                    // Use mode-aware clear operation
                    console.log('🗑️ Clearing dispensing history for mode:', { activeMode, organizationId });
                    let success = false;
                    let error = null;

                    if (activeMode === 'organization' && organizationId) {
                      // For organization mode, we need to clear organization_drug_usage_history
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        console.log('🗑️ Clearing organization dispensing history for org:', organizationId);
                        const { error: clearError, count } = await supabase
                          .from('organization_drug_usage_history')
                          .delete()
                          .eq('organization_id', organizationId);

                        console.log('📊 Organization clear result:', { clearError, count });

                        if (clearError) {
                          error = clearError.message;
                        } else {
                          success = true;
                        }
                      } else {
                        error = 'User not authenticated';
                      }
                    } else {
                      // For individual mode, use the existing service
                      const result = await DrugDispensingService.clearAllDispensingHistory();
                      success = result.success;
                      error = result.error;
                    }

                    if (success) {
                      // Clear local state
                      setDispensingHistory([]);
                      setStats(null);
                      setDrugSearchTerm('');
                      setPatientSearchTerm('');
                      setDiagnosisSearchTerm('');
                      setDateFrom('');
                      setDateTo('');
                      setSelectedPeriod('month');

                      // Force refresh data to show empty state (bypass cache)
                      console.log('🔄 Force refreshing data after clear...');
                      await fetchData();

                      alert('✅ All dispensing history has been cleared successfully.');
                    } else {
                      setError(error || 'Failed to clear dispensing history');
                      alert('❌ Failed to clear dispensing history: ' + (error || 'Unknown error'));
                    }
                  } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
                    setError(errorMsg);
                    alert('❌ Error clearing dispensing history: ' + errorMsg);
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H7a1 1 0 00-1 1v3m14 0H3" />
              </svg>
              Delete All History
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Drug</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Patient</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Diagnosis</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Quantity</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Available Stock</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Notes</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading dispensing history...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      {(drugSearchTerm || patientSearchTerm || diagnosisSearchTerm) ? 'No dispensing records match your search' : 'No dispensing records found'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {new Date(record.dispensed_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {record.drug_name || 'Unknown Drug'}
                        {record.strength && (
                          <p className="text-xs text-slate-500">{record.strength}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className={deletedItems[record.id]?.patientDeleted ? 'line-through text-red-500' : ''}>
                            {record.patient_name || 'Unknown Patient'}
                          </span>
                          {deletedItems[record.id]?.patientDeleted && (
                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              Patient Deleted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className={deletedItems[record.id]?.diagnosisDeleted ? 'line-through text-red-500' : ''}>
                            {record.primary_diagnosis || 'No diagnosis'}
                          </span>
                          {deletedItems[record.id]?.diagnosisDeleted && (
                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              Diagnosis Deleted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        <span className="font-medium">{record.quantity_dispensed}</span> units
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {record.drug_id && inventoryData[record.drug_id] !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${inventoryData[record.drug_id] === 0 ? 'text-red-600' : inventoryData[record.drug_id] < 10 ? 'text-orange-600' : 'text-green-600'}`}>
                              {inventoryData[record.drug_id]}
                            </span>
                            <span className="text-slate-400 text-xs">units</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Not in inventory</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {record.notes || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `⚠️ Are you sure you want to delete this dispensing record?\n\n` +
                              `Drug: ${record.drug_name || 'Unknown Drug'}\n` +
                              `Quantity: ${record.quantity_dispensed || 1} units\n` +
                              `Patient: ${record.patient_name || 'Unknown Patient'}\n` +
                              `Date: ${new Date(record.dispensed_date).toLocaleDateString()}\n\n` +
                              `⚠️ IMPORTANT: Deleting this record will also REDUCE your current inventory by ${record.quantity_dispensed || 1} units of ${record.drug_name || 'this drug'}.\n\n` +
                              `This action cannot be undone.`
                            );
                            
                            if (confirmed) {
                              try {
                                const { success, error } = await ModeAwareDrugDispensingService.deleteDispensing(
                                  record.id,
                                  activeMode,
                                  organizationId
                                );
                                
                                if (success) {
                                  // Remove the record from local state
                                  setDispensingHistory(prev => prev.filter(r => r.id !== record.id));
                                  // Refresh stats
                                  await fetchData();
                                } else {
                                  setError(error || 'Failed to delete record');
                                  alert('❌ Failed to delete record: ' + (error || 'Unknown error'));
                                }
                              } catch (err) {
                                const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
                                setError(errorMsg);
                                alert('❌ Error deleting record: ' + errorMsg);
                              }
                            }
                          }}
                          className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H7a1 1 0 00-1 1v3m14 0H3" />
                          </svg>
                        </button>
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
                Showing {filteredHistory.length} records
                {(drugSearchTerm || patientSearchTerm || diagnosisSearchTerm) && (
                  <span>
                    {' '}(filtered by:
                    {drugSearchTerm && ` Drug: "${drugSearchTerm}"`}
                    {patientSearchTerm && ` Patient: "${patientSearchTerm}"`}
                    {diagnosisSearchTerm && ` Diagnosis: "${diagnosisSearchTerm}"`}
                    )
                  </span>
                )}
              </p>
              <button 
                onClick={fetchData}
                className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}