'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMultiOrgUserMode } from '@/contexts/MultiOrgUserModeContext';
import { ModeAwareDrugInventoryService } from '@/lib/modeAwareDrugInventoryService';
import { formatDrugName, getDrugStockStatus, isNearExpiry, formatPackDisplay, getPackStockStatus } from '@/lib/drugInventory';
import { DrugInventoryExportService } from '@/lib/drugInventoryExport';
import { useOrganizationPermissions } from '@/hooks/useOrganizationPermissions';
import { ManageInventoryGuard, WriteOffGuard } from '@/components/organization/PermissionGuard';
import UserModeIndicator from '@/components/organization/UserModeIndicator';
import OrganizationModeSelector from '@/components/shared/OrganizationModeSelector';
import type { UserDrugInventory, DrugCategory } from '@/types/database';
import type { OrganizationDrugInventory } from '@/types/organization';
import AddDrugModal from './AddDrugModal';
import EditDrugModal from './EditDrugModal';
import ImportDrugsModal from './ImportDrugsModal';

export default function DrugInventoryPage() {
  const { t } = useLanguage();
  const { activeMode, organizationId } = useMultiOrgUserMode();
  const permissions = useOrganizationPermissions();
  const [drugs, setDrugs] = useState<(UserDrugInventory | OrganizationDrugInventory)[]>([]);
  const [categories, setCategories] = useState<DrugCategory[]>([]);
  const [currentMode, setCurrentMode] = useState<'individual' | 'organization'>('individual');
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>(''); // '', 'low_stock', 'out_of_stock'
  const [expiryFilter, setExpiryFilter] = useState<string>(''); // '', 'near_expiry', 'expired'
  const [drugNameFilter, setDrugNameFilter] = useState<string>('');
  const [priceMinFilter, setPriceMinFilter] = useState<string>('');
  const [priceMaxFilter, setPriceMaxFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState<UserDrugInventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [drugsPerPage] = useState(30);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('DrugInventoryPage - Mode/Org changed:', {
      activeMode,
      organizationId,
      hasAccess
    });
  }, [activeMode, organizationId, hasAccess]);

  // Reload data when active mode changes
  useEffect(() => {
    if (hasAccess) {
      const reloadData = async () => {
        console.log('Loading data with:', { activeMode, organizationId });

        const [drugsResult, categoriesResult] = await Promise.all([
          ModeAwareDrugInventoryService.getDrugInventory(activeMode, organizationId),
          ModeAwareDrugInventoryService.getDrugCategories(),
        ]);

        console.log('Drugs result:', drugsResult);

        if (drugsResult.error) {
          setError(drugsResult.error);
        } else {
          setDrugs(drugsResult.data || []);
          setCurrentMode(drugsResult.mode);
        }

        if (categoriesResult.error) {
          setError(categoriesResult.error);
        } else {
          setCategories(categoriesResult.data || []);
        }
      };

      reloadData();
    }
  }, [activeMode, organizationId, hasAccess]);

  const checkAccess = async () => {
    const { hasAccess: accessGranted, error } = await ModeAwareDrugInventoryService.checkDrugInventoryAccess();
    if (error) {
      setError(error);
    }
    setHasAccess(accessGranted);
    setLoading(false);
  };

  const loadData = useCallback(async () => {
    console.log('Loading data with:', { activeMode, organizationId });

    const [drugsResult, categoriesResult] = await Promise.all([
      ModeAwareDrugInventoryService.getDrugInventory(activeMode, organizationId),
      ModeAwareDrugInventoryService.getDrugCategories(),
    ]);

    console.log('Drugs result:', drugsResult);

    if (drugsResult.error) {
      setError(drugsResult.error);
    } else {
      setDrugs(drugsResult.data || []);
      setCurrentMode(drugsResult.mode);
    }

    if (categoriesResult.error) {
      setError(categoriesResult.error);
    } else {
      setCategories(categoriesResult.data || []);
    }
  }, [activeMode, organizationId]);


  const handleDeleteDrug = async (drugId: string) => {
    if (!confirm('Are you sure you want to remove this drug from your inventory?')) {
      return;
    }

    const { error } = await ModeAwareDrugInventoryService.deleteDrug(
      drugId,
      activeMode,
      organizationId
    );
    if (error) {
      setError(error);
    } else {
      // Remove the deleted drug from the current state instead of reloading all data
      setDrugs(prevDrugs => prevDrugs.filter(drug => drug.id !== drugId));
    }
  };

  const handleDrugAdded = async () => {
    setShowAddModal(false);
    await loadData();
  };

  const handleDrugUpdated = async () => {
    setEditingDrug(null);
    await loadData();
  };

  const handleImportSuccess = async (importedCount: number) => {
    setShowImportModal(false);
    setSuccessMessage(`Successfully imported ${importedCount} drugs!`);
    await loadData();

    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Export functions
  const exportToJson = () => {
    const exportData = drugs.map(drug => ({
      name: drug.drug_name,
      generic_name: drug.generic_name,
      brand_name: drug.brand_name,
      category: drug.category?.name,
      dosage: drug.dosage_adults,
      form: drug.dosage_form,
      strength: drug.strength,
      active_ingredient: drug.active_ingredient,
      supplier: drug.supplier,
      price: drug.unit_price,
      stock_quantity: drug.stock_quantity,
      prescription_required: drug.is_prescription_only,
      description: drug.notes
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drug-inventory-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    DrugInventoryExportService.exportToExcel(drugs);
  };

  const exportToPDF = () => {
    DrugInventoryExportService.exportToPDF(drugs);
  };

  const exportToWord = () => {
    DrugInventoryExportService.exportToWord(drugs);
  };

  // Delete all drugs function
  const handleDeleteAll = async () => {
    if (drugs.length === 0) {
      setError('No drugs to delete');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const { error, deletedCount } = await ModeAwareDrugInventoryService.deleteAllDrugs(activeMode, organizationId);
      
      if (error) {
        setError(error);
      } else {
        setSuccessMessage(`Successfully deleted ${deletedCount} drugs from your inventory!`);
        setShowDeleteAllModal(false);

        // Since all drugs are deleted, just clear the state
        setDrugs([]);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError('Failed to delete drugs');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDrugs = drugs.filter(drug => {
    // Drug name filter (column filter)
    if (drugNameFilter && !drug.drug_name?.toLowerCase().includes(drugNameFilter.toLowerCase()) &&
        !drug.generic_name?.toLowerCase().includes(drugNameFilter.toLowerCase()) &&
        !drug.brand_name?.toLowerCase().includes(drugNameFilter.toLowerCase())) {
      return false;
    }

    // Category filter
    if (selectedCategory && drug.category_id !== selectedCategory) {
      return false;
    }

    // Stock filter (updated to use pack-aware status)
    if (stockFilter) {
      const stockStatus = getPackStockStatus(drug);
      if (stockFilter === 'low_stock' && stockStatus !== 'low_stock') {
        return false;
      }
      if (stockFilter === 'out_of_stock' && stockStatus !== 'out_of_stock') {
        return false;
      }
      if (stockFilter === 'low_or_out' && stockStatus !== 'low_stock' && stockStatus !== 'out_of_stock') {
        return false;
      }
    }

    // Expiry filter
    if (expiryFilter) {
      const nearExpiry = isNearExpiry(drug.expiry_date);
      const isExpired = drug.expiry_date && new Date(drug.expiry_date) < new Date();

      if (expiryFilter === 'near_expiry' && !nearExpiry) {
        return false;
      }
      if (expiryFilter === 'expired' && !isExpired) {
        return false;
      }
      if (expiryFilter === 'near_or_expired' && !nearExpiry && !isExpired) {
        return false;
      }
    }

    // Price filter
    if (priceMinFilter || priceMaxFilter) {
      const price = drug.unit_price || 0;
      const minPrice = priceMinFilter ? parseFloat(priceMinFilter) : 0;
      const maxPrice = priceMaxFilter ? parseFloat(priceMaxFilter) : Infinity;

      if (price < minPrice || price > maxPrice) {
        return false;
      }
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredDrugs.length / drugsPerPage);
  const startIndex = (currentPage - 1) * drugsPerPage;
  const endIndex = startIndex + drugsPerPage;
  const paginatedDrugs = filteredDrugs.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleStockFilterChange = (stockFilter: string) => {
    setStockFilter(stockFilter);
    setCurrentPage(1);
  };

  const handleExpiryFilterChange = (expiryFilter: string) => {
    setExpiryFilter(expiryFilter);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedCategory('');
    setStockFilter('');
    setExpiryFilter('');
    setDrugNameFilter('');
    setPriceMinFilter('');
    setPriceMaxFilter('');
    setCurrentPage(1);
    loadData(); // Reset to original data
  };


  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-2V9m0 0V7m0 2h2m-2 0H9m3-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Premium Feature</h2>
            <p className="text-slate-600 mb-6">
              Drug inventory management is a premium feature. You need credits to access this functionality.
            </p>
            <a 
              href="/credits" 
              className="inline-block px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Get Credits
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6">
            <h1 className="text-3xl font-light text-slate-900 mb-2">Drug Inventory Management</h1>
            <p className="text-slate-600">
              {permissions.userMode === 'organization'
                ? 'Manage your organization\'s shared drug inventory and integrate with diagnosis suggestions'
                : 'Manage your clinic\'s drug inventory and integrate with diagnosis suggestions'
              }
            </p>
          </div>

          <OrganizationModeSelector
            title="Drug Inventory View"
            description="Switch between different drug inventories to manage medications for individual practice or organization teams."
            individualLabel="Individual Inventory"
            individualDescription="Your personal drug inventory"
            organizationDescription="Organization inventory"
            onError={setError}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Success Alert */}
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

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-end">
            <div className="flex gap-2">
              <ManageInventoryGuard fallback={null} showError={false}>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import
                </button>
              </ManageInventoryGuard>
              <div className="flex gap-1">
                <button
                  onClick={exportToJson}
                  className="px-3 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  JSON
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-3 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="px-3 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF
                </button>
                <button
                  onClick={exportToWord}
                  className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Word
                </button>
              </div>
              <ManageInventoryGuard fallback={null} showError={false}>
                {drugs.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllModal(true)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete All
                  </button>
                )}
              </ManageInventoryGuard>
              <ManageInventoryGuard fallback={null} showError={false}>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Add Drug
                </button>
              </ManageInventoryGuard>
            </div>
          </div>
        </div>

        {/* Active Filters Indicator */}
        {(drugNameFilter || selectedCategory || stockFilter || expiryFilter || priceMinFilter || priceMaxFilter) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                </svg>
                <span className="text-sm font-medium text-blue-900">Active Filters:</span>
                <div className="flex flex-wrap gap-1">
                  {drugNameFilter && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Name: "{drugNameFilter}"
                    </span>
                  )}
                  {selectedCategory && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Category: {categories.find(c => c.id === selectedCategory)?.name}
                    </span>
                  )}
                  {stockFilter && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Stock: {stockFilter === 'low_or_out' ? 'Low/Out' : stockFilter === 'low_stock' ? 'Low' : 'Out'}
                    </span>
                  )}
                  {expiryFilter && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Expiry: {expiryFilter === 'near_or_expired' ? 'Near/Expired' : expiryFilter === 'near_expiry' ? 'Near' : 'Expired'}
                    </span>
                  )}
                  {(priceMinFilter || priceMaxFilter) && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Price: €{priceMinFilter || '0'} - €{priceMaxFilter || '∞'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={clearAllFilters}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Drug List */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {filteredDrugs.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No drugs in inventory</h3>
              <p className="text-slate-600 mb-4">Start by adding drugs to your inventory</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Add Your First Drug
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  {/* Column Headers */}
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Drug</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Expiry</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                  {/* Filter Row */}
                  <tr className="bg-slate-25">
                    <th className="px-6 py-2">
                      <input
                        type="text"
                        placeholder="Filter by name..."
                        value={drugNameFilter}
                        onChange={(e) => {
                          setDrugNameFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </th>
                    <th className="px-6 py-2">
                      <select
                        value={selectedCategory}
                        onChange={(e) => {
                          handleCategoryChange(e.target.value);
                        }}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">All Categories</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th className="px-6 py-2">
                      <select
                        value={stockFilter}
                        onChange={(e) => {
                          handleStockFilterChange(e.target.value);
                        }}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">All Stock</option>
                        <option value="low_or_out">Low/Out</option>
                        <option value="low_stock">Low Only</option>
                        <option value="out_of_stock">Out Only</option>
                      </select>
                    </th>
                    <th className="px-6 py-2">
                      <select
                        value={expiryFilter}
                        onChange={(e) => {
                          handleExpiryFilterChange(e.target.value);
                        }}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">All Expiry</option>
                        <option value="near_or_expired">Near/Expired</option>
                        <option value="near_expiry">Near Only</option>
                        <option value="expired">Expired Only</option>
                      </select>
                    </th>
                    <th className="px-6 py-2">
                      <div className="flex gap-1">
                        <input
                          type="number"
                          placeholder="Min €"
                          value={priceMinFilter}
                          onChange={(e) => {
                            setPriceMinFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                          step="0.01"
                          min="0"
                        />
                        <input
                          type="number"
                          placeholder="Max €"
                          value={priceMaxFilter}
                          onChange={(e) => {
                            setPriceMaxFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </th>
                    <th className="px-6 py-2 text-right">
                      <button
                        onClick={clearAllFilters}
                        className="text-xs px-2 py-1 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
                        title="Clear all filters"
                      >
                        Clear
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {paginatedDrugs.map((drug) => {
                    const stockStatus = getPackStockStatus(drug);
                    const nearExpiry = isNearExpiry(drug.expiry_date);

                    return (
                      <tr key={drug.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-slate-900">{formatDrugName(drug)}</div>
                            {drug.generic_name && (
                              <div className="text-sm text-slate-500">{drug.generic_name}</div>
                            )}
                            {drug.is_prescription_only && (
                              <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded mt-1">
                                Prescription Only
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {drug.category?.name || 'Uncategorized'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* Enhanced stock display with pack tracking */}
                          {drug.units_per_pack && (drug.whole_packs_count !== undefined || drug.loose_units_count !== undefined) ? (
                            <div className={`text-sm ${
                              stockStatus === 'out_of_stock' ? 'text-red-600' :
                              stockStatus === 'low_stock' ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              <div className="font-medium">
                                {formatPackDisplay(
                                  drug.whole_packs_count || 0,
                                  drug.loose_units_count || 0,
                                  drug.units_per_pack,
                                  drug.unit_type || 'unit'
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {drug.whole_packs_count || 0} packs + {drug.loose_units_count || 0} loose
                              </div>
                            </div>
                          ) : (
                            <div className={`text-sm font-medium ${
                              stockStatus === 'out_of_stock' ? 'text-red-600' :
                              stockStatus === 'low_stock' ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {drug.stock_quantity || 0} units
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {drug.expiry_date ? (
                            <div className={`text-sm ${nearExpiry ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                              {new Date(drug.expiry_date).toLocaleDateString()}
                              {nearExpiry && <div className="text-xs text-red-500">Near expiry</div>}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {drug.unit_price ? `€${drug.unit_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => setEditingDrug(drug)}
                            className="text-emerald-600 hover:text-emerald-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDrug(drug.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredDrugs.length > 0 && totalPages > 1 && (
          <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              {/* Mobile pagination */}
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIndex, filteredDrugs.length)}</span> of{' '}
                  <span className="font-medium">{filteredDrugs.length}</span> drugs
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  {/* Previous button */}
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page numbers */}
                  {[...Array(Math.min(totalPages, 7))].map((_, index) => {
                    let pageNumber;
                    if (totalPages <= 7) {
                      pageNumber = index + 1;
                    } else {
                      if (currentPage <= 4) {
                        pageNumber = index + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNumber = totalPages - 6 + index;
                      } else {
                        pageNumber = currentPage - 3 + index;
                      }
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNumber
                            ? 'z-10 bg-emerald-50 border-emerald-500 text-emerald-600'
                            : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  {/* Next button */}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <button 
            onClick={clearAllFilters}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:bg-slate-50 transition-colors text-left w-full"
            title="Click to show all drugs"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-slate-900">{drugs.length}</h3>
                <p className="text-sm text-slate-600">Total Drugs</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => handleStockFilterChange('low_or_out')}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:bg-amber-50 transition-colors text-left w-full"
            title="Click to filter low/out of stock drugs"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {drugs.filter(drug => getPackStockStatus(drug) === 'low_stock' || getPackStockStatus(drug) === 'out_of_stock').length}
                </h3>
                <p className="text-sm text-slate-600">Low/Out of Stock</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => handleExpiryFilterChange('near_or_expired')}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:bg-red-50 transition-colors text-left w-full"
            title="Click to filter near expiry/expired drugs"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {drugs.filter(drug => isNearExpiry(drug.expiry_date)).length}
                </h3>
                <p className="text-sm text-slate-600">Near Expiry</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddDrugModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleDrugAdded}
        />
      )}

      {showImportModal && (
        <ImportDrugsModal
          categories={categories}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
          activeMode={activeMode}
          organizationId={organizationId}
        />
      )}

      {editingDrug && (
        <EditDrugModal
          drug={editingDrug}
          categories={categories}
          onClose={() => setEditingDrug(null)}
          onSuccess={handleDrugUpdated}
        />
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Delete All Drugs</h3>
              </div>
              
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to delete all {drugs.length} drugs from your inventory? This action cannot be undone.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteAllModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {isDeleting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}