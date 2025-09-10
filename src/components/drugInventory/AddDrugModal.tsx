'use client';

import { useState } from 'react';
import { DrugInventoryService } from '@/lib/drugInventory';
import type { DrugCategory, DrugInventoryFormData } from '@/types/database';

interface AddDrugModalProps {
  categories: DrugCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDrugModal({ categories, onClose, onSuccess }: AddDrugModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<DrugInventoryFormData>({
    drug_name: '',
    drug_name_lv: '',
    generic_name: '',
    brand_name: '',
    category_id: '',
    dosage_form: '',
    strength: '',
    active_ingredient: '',
    indications: [],
    contraindications: [],
    dosage_adults: '',
    dosage_children: '',
    stock_quantity: 0,
    unit_price: undefined,
    supplier: '',
    batch_number: '',
    expiry_date: '',
    is_prescription_only: false,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic validation
    if (!formData.drug_name.trim()) {
      setError('Drug name is required');
      setLoading(false);
      return;
    }

    try {
      const { error } = await DrugInventoryService.addDrugToInventory(formData);
      
      if (error) {
        setError(error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Failed to add drug to inventory');
    }

    setLoading(false);
  };

  const handleIndicationsChange = (value: string) => {
    const indications = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setFormData(prev => ({ ...prev, indications }));
  };

  const handleContraindicationsChange = (value: string) => {
    const contraindications = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setFormData(prev => ({ ...prev, contraindications }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Add New Drug</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Basic Information</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Drug Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.drug_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, drug_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Paracetamol"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Drug Name (Latvian)</label>
                <input
                  type="text"
                  value={formData.drug_name_lv || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, drug_name_lv: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Paracetamols"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Generic Name</label>
                <input
                  type="text"
                  value={formData.generic_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, generic_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Acetaminophen"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Brand Name</label>
                <input
                  type="text"
                  value={formData.brand_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Tylenol"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dosage Form</label>
                <select
                  value={formData.dosage_form || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dosage_form: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select form</option>
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="syrup">Syrup</option>
                  <option value="injection">Injection</option>
                  <option value="cream">Cream</option>
                  <option value="ointment">Ointment</option>
                  <option value="drops">Drops</option>
                  <option value="spray">Spray</option>
                  <option value="powder">Powder</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Strength</label>
                <input
                  type="text"
                  value={formData.strength || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, strength: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., 500mg, 10mg/ml"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Active Ingredient</label>
                <input
                  type="text"
                  value={formData.active_ingredient || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, active_ingredient: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Paracetamol"
                />
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Medical Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Indications</label>
              <textarea
                rows={3}
                value={formData.indications?.join(', ') || ''}
                onChange={(e) => handleIndicationsChange(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                placeholder="Separate multiple indications with commas (e.g., fever, pain, headache)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contraindications</label>
              <textarea
                rows={3}
                value={formData.contraindications?.join(', ') || ''}
                onChange={(e) => handleContraindicationsChange(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                placeholder="Separate multiple contraindications with commas"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dosage (Adults)</label>
                <input
                  type="text"
                  value={formData.dosage_adults || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dosage_adults: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., 1-2 tablets every 6 hours"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dosage (Children)</label>
                <input
                  type="text"
                  value={formData.dosage_children || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dosage_children: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., 10-15mg/kg every 6 hours"
                />
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Business Information</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Unit Price (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || undefined }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Batch Number</label>
                <input
                  type="text"
                  value={formData.batch_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, batch_number: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="prescription_only"
                  checked={formData.is_prescription_only || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_prescription_only: e.target.checked }))}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                />
                <label htmlFor="prescription_only" className="ml-2 text-sm text-slate-700">
                  Prescription Only Medicine
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                placeholder="Additional notes about this drug"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Add Drug
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}