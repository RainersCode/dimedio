'use client';

import Navigation from '@/components/layout/Navigation';
import { InventoryUsageService, InventoryUsageRecord } from '@/lib/inventoryUsageService';
import { OrganizationInventoryUsageService } from '@/lib/organizationInventoryUsageService';
import { DrugInventoryService } from '@/lib/drugInventory';
import { ModeAwareDrugDispensingService } from '@/lib/modeAwareDrugDispensingService';
import { ModeAwareDrugInventoryService } from '@/lib/modeAwareDrugInventoryService';
import { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import OrganizationModeSelector from '@/components/shared/OrganizationModeSelector';
import { DrugUsageReportSkeleton } from '@/components/ui/PageSkeletons';

interface DrugUsageSummary {
  drug_name: string;
  drug_id?: string;
  total_quantity: number;
  total_dispensings: number;
  patients_count: number;
  current_stock: number;
  average_per_dispensing: number;
  last_dispensed: string;
  first_dispensed: string;
}

export default function DrugUsageReport() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const {
    activeMode,
    membershipStatus,
    activeOrganization,
  } = useMultiOrgUserMode();

  const [inventoryUsageHistory, setInventoryUsageHistory] = useState<InventoryUsageRecord[]>([]);
  const [drugSummaries, setDrugSummaries] = useState<DrugUsageSummary[]>([]);
  const [inventoryData, setInventoryData] = useState<{[drugId: string]: number}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Filters similar to drug-dispensing page
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [drugSearchTerm, setDrugSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'total_quantity' | 'total_dispensings' | 'drug_name' | 'last_dispensed'>('total_quantity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Dropdown for drug search
  const [drugSuggestionsFilter, setDrugSuggestionsFilter] = useState<string[]>([]);
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  const drugDropdownRef = useRef<HTMLDivElement>(null);
  
  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeMode, activeOrganization?.organization_id]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drugDropdownRef.current && !drugDropdownRef.current.contains(event.target as Node)) {
        setShowDrugDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchInventoryData = async (): Promise<{[drugId: string]: number}> => {
    try {
      const { data: inventory, error } = await ModeAwareDrugInventoryService.getDrugInventory(
        activeMode,
        activeOrganization?.organization_id || null
      );
      if (error) {
        console.warn('Could not fetch inventory data:', error);
        return {};
      }

      const inventoryMap: {[drugId: string]: number} = {};
      if (inventory) {
        inventory.forEach(item => {
          inventoryMap[item.id] = item.stock_quantity || 0;
        });
      }
      setInventoryData(inventoryMap);
      return inventoryMap;
    } catch (err) {
      console.warn('Error fetching inventory data:', err);
      return {};
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      let history: any[] = [];

      if (activeMode === 'organization' && activeOrganization?.organization_id) {
        // In organization mode, show deleted dispensing records (usage history)
        const { data: orgUsageHistory, error: historyError } = await OrganizationInventoryUsageService.getInventoryUsageHistory(
          activeOrganization.organization_id,
          1000
        );
        if (historyError) {
          throw new Error(historyError);
        }

        // Transform organization usage records to match the expected format
        history = (orgUsageHistory || []).map(record => ({
          id: record.id,
          user_id: record.user_id,
          drug_id: record.drug_id,
          drug_name: record.drug_name,
          quantity_removed: record.quantity_removed,
          removal_reason: record.removal_reason,
          original_dispensing_record_id: record.original_dispensing_record_id,
          patient_name: record.patient_name,
          notes: record.notes,
          removed_at: record.removed_at
        }));
      } else {
        // In individual mode, show inventory usage history (deletions)
        const { data: usageHistory, error: historyError } = await InventoryUsageService.getInventoryUsageHistory(1000);
        if (historyError) {
          throw new Error(historyError);
        }
        history = usageHistory || [];
      }

      setInventoryUsageHistory(history);

      // Fetch inventory data and get the current inventory map
      const currentInventoryData = await fetchInventoryData();

      // Process data into drug summaries with current inventory data
      if (history) {
        processDrugSummaries(history, currentInventoryData);

        // Generate drug name suggestions for search dropdown
        const uniqueDrugNames = Array.from(new Set(history.map(record => record.drug_name).filter(Boolean)));
        setDrugSuggestionsFilter(uniqueDrugNames.sort());
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const processDrugSummaries = (history: InventoryUsageRecord[], currentInventoryData?: {[drugId: string]: number}) => {
    // Use the passed inventory data or fall back to the state
    const inventoryToUse = currentInventoryData || inventoryData;
    const drugMap = new Map<string, DrugUsageSummary>();

    history.forEach(record => {
      const drugKey = record.drug_name || 'Unknown Drug';
      
      if (!drugMap.has(drugKey)) {
        drugMap.set(drugKey, {
          drug_name: drugKey,
          drug_id: record.drug_id || undefined,
          total_quantity: 0,
          total_dispensings: 0,
          patients_count: 0,
          current_stock: 0,
          average_per_dispensing: 0,
          last_dispensed: record.removed_at,
          first_dispensed: record.removed_at,
        });
      }

      const summary = drugMap.get(drugKey)!;
      summary.total_quantity += record.quantity_removed || 0;
      summary.total_dispensings += 1;
      
      // Update date range
      if (new Date(record.removed_at) > new Date(summary.last_dispensed)) {
        summary.last_dispensed = record.removed_at;
      }
      if (new Date(record.removed_at) < new Date(summary.first_dispensed)) {
        summary.first_dispensed = record.removed_at;
      }
    });

    // Calculate patient counts for each drug
    const summaries = Array.from(drugMap.values()).map(summary => {
      // Parse patient names from both direct patient_name field and notes field
      const patientNames = new Set<string>();
      
      history
        .filter(r => r.drug_name === summary.drug_name)
        .forEach(r => {
          // Add from direct patient_name field
          if (r.patient_name && r.patient_name !== 'Unknown') {
            patientNames.add(r.patient_name);
          }
          
          // Parse from notes field for individual deletions
          if (r.notes && r.removal_reason === 'dispensing_record_deleted') {
            const patientMatch = r.notes.match(/Patient: ([^|]+)/);
            if (patientMatch) {
              const patientName = patientMatch[1].trim();
              if (patientName && patientName !== 'Unknown') {
                patientNames.add(patientName);
              }
            }
          }
        });

      return {
        ...summary,
        patients_count: patientNames.size,
        average_per_dispensing: summary.total_dispensings > 0 
          ? Math.round((summary.total_quantity / summary.total_dispensings) * 100) / 100 
          : 0,
        current_stock: summary.drug_id ? (inventoryToUse[summary.drug_id] || 0) : 0,
      };
    });

    setDrugSummaries(summaries);
  };

  // Apply filters and sorting
  const filteredAndSortedSummaries = drugSummaries
    .filter(summary => {
      // Date filter
      if (dateFrom && new Date(summary.last_dispensed) < new Date(dateFrom)) return false;
      if (dateTo && new Date(summary.first_dispensed) > new Date(dateTo)) return false;
      
      // Drug name filter
      if (drugSearchTerm && !summary.drug_name.toLowerCase().includes(drugSearchTerm.toLowerCase())) return false;
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'drug_name':
          comparison = a.drug_name.localeCompare(b.drug_name);
          break;
        case 'total_quantity':
          comparison = a.total_quantity - b.total_quantity;
          break;
        case 'total_dispensings':
          comparison = a.total_dispensings - b.total_dispensings;
          break;
        case 'last_dispensed':
          comparison = new Date(a.last_dispensed).getTime() - new Date(b.last_dispensed).getTime();
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDrugSearch = (value: string) => {
    setDrugSearchTerm(value);
    setShowDrugDropdown(value.length > 0);
  };

  const selectDrugFromDropdown = (drugName: string) => {
    setDrugSearchTerm(drugName);
    setShowDrugDropdown(false);
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDrugSearchTerm('');
  };

  const toggleCardExpansion = (drugName: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(drugName)) {
      newExpanded.delete(drugName);
    } else {
      newExpanded.add(drugName);
    }
    setExpandedCards(newExpanded);
  };

  const getUsageHistoryForDrug = (drugName: string) => {
    return inventoryUsageHistory
      .filter(record => record.drug_name === drugName)
      .sort((a, b) => new Date(b.removed_at).getTime() - new Date(a.removed_at).getTime());
  };

  // Only show skeleton on initial page load, not during mode switches
  if (authLoading || (!user && !authLoading)) {
    return <DrugUsageReportSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Drug Usage Report</h1>
            <p className="text-slate-600 mt-2">
              {activeMode === 'organization'
                ? 'Summary of drugs dispensed to patients (organization mode)'
                : 'Summary of drugs removed from inventory (when dispensing records are deleted)'
              }
            </p>
          </div>
        </div>

        {/* Organization/Individual Mode Selector */}
        <OrganizationModeSelector
          title="Drug Usage Report View"
          description="Switch between different usage reports to view individual practice or organization team drug usage analytics."
          individualLabel="Individual Usage Report"
          individualDescription="Your personal drug usage analytics"
          organizationDescription="Organization usage report"
          onError={(error) => setErrorMessage(error)}
          className="mb-6"
        />

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 mb-6 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Filters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-slate-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-slate-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Drug Search */}
            <div className="relative" ref={drugDropdownRef}>
              <label htmlFor="drugSearch" className="block text-sm font-medium text-slate-700 mb-2">
                Drug Name
              </label>
              <input
                type="text"
                id="drugSearch"
                value={drugSearchTerm}
                onChange={(e) => handleDrugSearch(e.target.value)}
                placeholder="Search drugs..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {showDrugDropdown && drugSuggestionsFilter.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {drugSuggestionsFilter
                    .filter(drug => drug.toLowerCase().includes(drugSearchTerm.toLowerCase()))
                    .slice(0, 10)
                    .map((drug, index) => (
                      <button
                        key={index}
                        onClick={() => selectDrugFromDropdown(drug)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none text-sm"
                      >
                        {drug}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Sorting */}
        <div className="bg-white rounded-xl border border-slate-200 mb-6 p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            >
              <option value="total_quantity">Total Quantity</option>
              <option value="total_dispensings">Number of Dispensings</option>
              <option value="drug_name">Drug Name</option>
              <option value="last_dispensed">Last Dispensed</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        {/* Results - Card Layout */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              {activeMode === 'organization' ? 'Drug Dispensing Summary' : 'Inventory Usage Summary'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {filteredAndSortedSummaries.length} drug{filteredAndSortedSummaries.length !== 1 ? 's' : ''}
              {activeMode === 'organization' ? ' dispensed to patients' : ' removed from inventory'}
            </p>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-slate-500">Loading drug usage data...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-500 mb-2">⚠️ Error loading data</div>
                <div className="text-sm text-slate-600">{error}</div>
              </div>
            ) : filteredAndSortedSummaries.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-2">📊</div>
                <div className="text-slate-600 mb-1">
                  {drugSearchTerm || dateFrom || dateTo ? 'No drugs match your filters' :
                   activeMode === 'organization' ? 'No dispensing data found' : 'No inventory usage data found'}
                </div>
                <div className="text-sm text-slate-500">
                  {!drugSearchTerm && !dateFrom && !dateTo ?
                   (activeMode === 'organization' ? 'Data will appear when you dispense drugs to patients.' : 'Data will appear when you delete dispensing records.') :
                   'Try adjusting your filters above.'}
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredAndSortedSummaries.map((summary, index) => {
                  const isExpanded = expandedCards.has(summary.drug_name);
                  const drugHistory = getUsageHistoryForDrug(summary.drug_name);
                  
                  return (
                    <div key={index} className="bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                      {/* Clickable Main Content */}
                      <div 
                        className="p-5 cursor-pointer"
                        onClick={() => toggleCardExpansion(summary.drug_name)}
                      >
                        {/* Drug Name Header */}
                        <div className="flex items-start justify-between mb-4 bg-slate-700 -mx-5 -mt-5 px-5 pt-5 pb-4 rounded-t-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-white">
                                {summary.drug_name}
                              </h3>
                              <button className="text-slate-300 hover:text-white transition-colors">
                                <svg 
                                  className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <div className="text-sm text-slate-300 mt-1">
                              {activeMode === 'organization' ? 'Last dispensed' : 'Last removed'}: {new Date(summary.last_dispensed).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm font-medium text-slate-300 mb-1">Current Stock</div>
                            <div className={`text-2xl font-bold ${
                              summary.current_stock === 0 
                                ? 'text-red-400' 
                                : summary.current_stock < 10 
                                ? 'text-orange-400' 
                                : 'text-green-400'
                            }`}>
                              {summary.current_stock}
                            </div>
                            <div className="text-sm text-slate-300">units available</div>
                          </div>
                        </div>

                        {/* Statistics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="bg-white rounded-md p-3 border border-slate-200">
                            <div className="text-sm font-medium text-slate-600 mb-1">
                              {activeMode === 'organization' ? 'Total Dispensed' : 'Total Removed'}
                            </div>
                            <div className="text-xl font-bold text-emerald-600">{summary.total_quantity}</div>
                            <div className="text-xs text-slate-500">units</div>
                          </div>

                          <div className="bg-white rounded-md p-3 border border-slate-200">
                            <div className="text-sm font-medium text-slate-600 mb-1">
                              {activeMode === 'organization' ? 'Dispensing Events' : 'Removal Events'}
                            </div>
                            <div className="text-xl font-bold text-blue-600">{summary.total_dispensings}</div>
                            <div className="text-xs text-slate-500">times</div>
                          </div>
                          
                          <div className="bg-white rounded-md p-3 border border-slate-200">
                            <div className="text-sm font-medium text-slate-600 mb-1">Patients Affected</div>
                            <div className="text-xl font-bold text-purple-600">{summary.patients_count}</div>
                            <div className="text-xs text-slate-500">patients</div>
                          </div>
                          
                          <div className="bg-white rounded-md p-3 border border-slate-200">
                            <div className="text-sm font-medium text-slate-600 mb-1">
                              {activeMode === 'organization' ? 'Avg per Dispensing' : 'Avg per Removal'}
                            </div>
                            <div className="text-xl font-bold text-slate-700">{summary.average_per_dispensing}</div>
                            <div className="text-xs text-slate-500">units</div>
                          </div>
                        </div>

                        {/* Timeline */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-slate-600">
                                {activeMode === 'organization' ? 'First dispensed:' : 'First removed:'}
                              </span>
                              <span className="ml-2 text-slate-900">
                                {new Date(summary.first_dispensed).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="text-slate-400">•</div>
                            <div>
                              <span className="font-medium text-slate-600">Period:</span>
                              <span className="ml-2 text-slate-900">
                                {Math.ceil((new Date(summary.last_dispensed).getTime() - new Date(summary.first_dispensed).getTime()) / (1000 * 60 * 60 * 24)) || 0} days
                              </span>
                            </div>
                          </div>
                          
                          {/* Click to expand hint */}
                          <div className="mt-3 text-center">
                            <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                              Click to {isExpanded ? 'hide' : 'view'} detailed
                              {activeMode === 'organization' ? ' dispensing' : ' usage'} history
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Usage History */}
                      {isExpanded && (
                        <div className="border-t border-slate-300 bg-white">
                          <div className="p-5">
                            <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {activeMode === 'organization' ? 'Dispensing History' : 'Usage History'} ({drugHistory.length} events)
                            </h4>
                            
                            {drugHistory.length === 0 ? (
                              <div className="text-center py-6 text-slate-500">
                                No detailed usage history available
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-60 overflow-y-auto">
                                {drugHistory.map((record, historyIndex) => {
                                  // Parse patient info from notes if available
                                  const parsePatientInfo = (notes: string) => {
                                    if (!notes) return null;
                                    const patientMatch = notes.match(/Patient: ([^|]+)/);
                                    const diagnosisMatch = notes.match(/Diagnosis: ([^|]+)/);
                                    const quantityMatch = notes.match(/Quantity: ([^|]+)/);
                                    
                                    return {
                                      patient: patientMatch ? patientMatch[1].trim() : null,
                                      diagnosis: diagnosisMatch ? diagnosisMatch[1].trim() : null,
                                      quantity: quantityMatch ? quantityMatch[1].trim() : null
                                    };
                                  };

                                  const patientInfo = record.notes ? parsePatientInfo(record.notes) : null;
                                  
                                  // Use patient name from either parsed data or direct field
                                  const finalPatientName = patientInfo?.patient || record.patient_name;
                                  const hasMeaningfulPatientData = finalPatientName && finalPatientName !== 'Unknown';
                                  const hasMeaningfulDiagnosis = patientInfo?.diagnosis && patientInfo.diagnosis !== 'Unknown';
                                  
                                  return (
                                    <div key={historyIndex} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                      {/* Header with quantity and action type */}
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className="text-base font-semibold text-slate-900">
                                            {record.quantity_removed} units
                                            {activeMode === 'organization' ? ' dispensed' : ' removed'}
                                          </div>
                                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            record.removal_reason === 'dispensing_record_dispensed'
                                              ? 'bg-green-100 text-green-700'
                                              : record.removal_reason === 'dispensing_record_deleted'
                                              ? 'bg-blue-100 text-blue-700'
                                              : record.removal_reason === 'bulk_deletion'
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-gray-100 text-gray-700'
                                          }`}>
                                            {record.removal_reason === 'dispensing_record_dispensed' ? 'Patient Dispensing' :
                                             record.removal_reason === 'dispensing_record_deleted' ? 'Individual Delete' :
                                             record.removal_reason === 'bulk_deletion' ? 'Bulk Delete' :
                                             'Manual Adjustment'}
                                          </div>
                                        </div>
                                        <div className="text-sm text-slate-500">
                                          {new Date(record.removed_at).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                      </div>


                                      {/* Patient details (if we have patient data) */}
                                      {(record.removal_reason === 'dispensing_record_deleted' || record.removal_reason === 'dispensing_record_dispensed') && hasMeaningfulPatientData && (
                                        <div className="bg-white rounded-md p-3 border border-slate-200 mb-2">
                                          <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Patient Information
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                            <div>
                                              <span className="font-medium text-slate-600">Name:</span>
                                              <span className="ml-2 text-slate-900">{finalPatientName}</span>
                                            </div>
                                            {hasMeaningfulDiagnosis && (
                                              <div>
                                                <span className="font-medium text-slate-600">Diagnosis:</span>
                                                <span className="ml-2 text-slate-900">{patientInfo.diagnosis}</span>
                                              </div>
                                            )}
                                            <div>
                                              <span className="font-medium text-slate-600">Dispensed:</span>
                                              <span className="ml-2 text-slate-900">
                                                {patientInfo?.quantity || `${record.quantity_removed} units`}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Full timestamp and additional notes */}
                                      <div className="text-xs text-slate-500 space-y-1">
                                        <div className="flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          Full date: {new Date(record.removed_at).toLocaleDateString('en-US', { 
                                            weekday: 'long',
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                        
                                        {/* Enhanced bulk deletion info */}
                                        {record.removal_reason === 'bulk_deletion' && record.notes && (
                                          <div className="mt-2 p-3 bg-slate-100 rounded-md border border-slate-200">
                                            <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                              Bulk Deletion Details
                                            </div>
                                            <div className="text-xs text-slate-600">
                                              {record.notes}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Show original notes if no structured data */}
                                        {(record.removal_reason === 'dispensing_record_deleted' || record.removal_reason === 'dispensing_record_dispensed') && !patientInfo && record.notes && (
                                          <div className="mt-2 p-2 bg-slate-100 rounded text-xs">
                                            <span className="font-medium">Note:</span> {record.notes}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}