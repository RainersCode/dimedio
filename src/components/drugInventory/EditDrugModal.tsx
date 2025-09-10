'use client';

import { useState } from 'react';
import { DrugInventoryService } from '@/lib/drugInventory';
import type { UserDrugInventory, DrugCategory } from '@/types/database';

interface EditDrugModalProps {
  drug: UserDrugInventory;
  categories: DrugCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditDrugModal({ drug, categories, onClose, onSuccess }: EditDrugModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    drug_name: drug.drug_name,
    drug_name_lv: drug.drug_name_lv || '',
    generic_name: drug.generic_name || '',
    brand_name: drug.brand_name || '',
    category_id: drug.category_id || '',
    dosage_form: drug.dosage_form || '',
    strength: drug.strength || '',
    active_ingredient: drug.active_ingredient || '',
    indications: drug.indications || [],
    contraindications: drug.contraindications || [],
    dosage_adults: drug.dosage_adults || '',
    dosage_children: drug.dosage_children || '',
    stock_quantity: drug.stock_quantity,
    unit_price: drug.unit_price,
    supplier: drug.supplier || '',
    batch_number: drug.batch_number || '',
    expiry_date: drug.expiry_date || '',
    is_prescription_only: drug.is_prescription_only,
    notes: drug.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.drug_name.trim()) {
      setError('Drug name is required');
      setLoading(false);
      return;
    }

    try {
      const { error } = await DrugInventoryService.updateDrugInInventory(drug.id, formData);
      
      if (error) {
        setError(error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Failed to update drug');
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
            <h2 className="text-2xl font-semibold text-slate-900">Edit Drug</h2>
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
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

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
              />
            </div>

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
              <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Indications</label>
            <textarea
              rows={3}
              value={formData.indications.join(', ')}
              onChange={(e) => handleIndicationsChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Separate multiple indications with commas"
            />
          </div>

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
              Update Drug
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}