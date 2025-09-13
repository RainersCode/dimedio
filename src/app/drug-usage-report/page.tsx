'use client';

import Navigation from '@/components/layout/Navigation';
import { InventoryUsageService, InventoryUsageRecord } from '@/lib/inventoryUsageService';
import { DrugInventoryService } from '@/lib/drugInventory';
import { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

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
  const { user } = useSupabaseAuth();
  const [inventoryUsageHistory, setInventoryUsageHistory] = useState<InventoryUsageRecord[]>([]);
  const [drugSummaries, setDrugSummaries] = useState<DrugUsageSummary[]>([]);
  const [inventoryData, setInventoryData] = useState<{[drugId: string]: number}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
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

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

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

  const fetchInventoryData = async () => {
    try {
      const { data: inventory, error } = await DrugInventoryService.getUserDrugInventory();
      if (error) {
        console.warn('Could not fetch inventory data:', error);
        return;
      }
      
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

      // Fetch all inventory usage history (drugs removed from inventory)
      const { data: history, error: historyError } = await InventoryUsageService.getInventoryUsageHistory(1000);
      if (historyError) {
        throw new Error(historyError);
      }
      
      setInventoryUsageHistory(history || []);
      
      // Fetch inventory data
      await fetchInventoryData();
      
      // Process data into drug summaries
      if (history) {
        processDrugSummaries(history);
        
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

  const processDrugSummaries = (history: InventoryUsageRecord[]) => {
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
      
      // Track unique patients (from inventory usage records)
      const patientNames = new Set<string>();
      history
        .filter(r => r.drug_name === drugKey)
        .forEach(r => r.patient_name && patientNames.add(r.patient_name));
      summary.patients_count = patientNames.size;
      
      // Update date range
      if (new Date(record.removed_at) > new Date(summary.last_dispensed)) {
        summary.last_dispensed = record.removed_at;
      }
      if (new Date(record.removed_at) < new Date(summary.first_dispensed)) {
        summary.first_dispensed = record.removed_at;
      }
    });

    // Calculate averages and add current stock
    const summaries = Array.from(drugMap.values()).map(summary => ({
      ...summary,
      average_per_dispensing: summary.total_dispensings > 0 
        ? Math.round((summary.total_quantity / summary.total_dispensings) * 100) / 100 
        : 0,
      current_stock: summary.drug_id ? (inventoryData[summary.drug_id] || 0) : 0,
    }));

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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Please log in to view drug usage report.</p>
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
            <h1 className="text-3xl font-bold text-slate-900">Drug Usage Report</h1>
            <p className="text-slate-600 mt-2">Summary of drugs removed from inventory (when dispensing records are deleted)</p>
          </div>
        </div>

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

        {/* Results Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Drug Usage Summary ({filteredAndSortedSummaries.length} drugs)
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[150px]">Drug Name</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[120px]">Total Removed</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[100px]">Times Removed</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[100px]">Patients</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[100px]">Avg per Removal</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[100px]">Current Stock</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[100px]">First Removed</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-slate-900 min-w-[100px]">Last Removed</th>
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
                        Loading drug usage data...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : filteredAndSortedSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      {drugSearchTerm || dateFrom || dateTo ? 'No drugs match your filters' : 'No inventory usage data found. Data will appear when you delete dispensing records.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedSummaries.map((summary, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-sm font-medium text-slate-900 min-w-[150px]">
                        <div className="truncate" title={summary.drug_name}>
                          {summary.drug_name}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-900 min-w-[120px]">
                        <span className="font-semibold text-emerald-600">{summary.total_quantity}</span> units
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[100px]">
                        {summary.total_dispensings} times
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[100px]">
                        {summary.patients_count} patients
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[100px]">
                        {summary.average_per_dispensing} units
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[100px]">
                        <span className={`font-medium ${summary.current_stock === 0 ? 'text-red-600' : summary.current_stock < 10 ? 'text-orange-600' : 'text-green-600'}`}>
                          {summary.current_stock}
                        </span> units
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[100px]">
                        {new Date(summary.first_dispensed).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[100px]">
                        {new Date(summary.last_dispensed).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}