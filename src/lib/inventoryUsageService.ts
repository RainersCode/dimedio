import { supabase } from './supabase';

export interface InventoryUsageRecord {
  id: string;
  user_id: string;
  drug_id?: string;
  drug_name: string;
  quantity_removed: number;
  removal_reason: 'dispensing_record_deleted' | 'bulk_deletion' | 'manual_adjustment';
  original_dispensing_record_id?: string;
  patient_name?: string;
  notes?: string;
  removed_at: string;
}

export interface InventoryUsageSummary {
  drug_name: string;
  drug_id?: string;
  total_quantity_removed: number;
  total_removals: number;
  current_stock: number;
  average_per_removal: number;
  last_removed: string;
  first_removed: string;
}

export class InventoryUsageService {
  
  // Record when drugs are removed from inventory (when dispensing records are deleted)
  static async recordInventoryUsage(
    drugId: string | null,
    drugName: string,
    quantityRemoved: number,
    reason: 'dispensing_record_deleted' | 'bulk_deletion' | 'manual_adjustment',
    originalDispensingRecordId?: string,
    patientName?: string,
    notes?: string
  ): Promise<{ success: boolean; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const usageData = {
        user_id: user.id,
        drug_id: drugId,
        drug_name: drugName,
        quantity_removed: quantityRemoved,
        removal_reason: reason,
        original_dispensing_record_id: originalDispensingRecordId,
        patient_name: patientName,
        notes: notes,
        removed_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('inventory_usage_history')
        .insert([usageData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error recording inventory usage:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Successfully recorded inventory usage:', data);
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ Exception in recordInventoryUsage:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to record inventory usage' 
      };
    }
  }

  // Get inventory usage history
  static async getInventoryUsageHistory(
    limit = 100,
    filters?: {
      drugName?: string;
      dateFrom?: string;
      dateTo?: string;
      reason?: string;
    }
  ): Promise<{ data: InventoryUsageRecord[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let query = supabase
        .from('inventory_usage_history')
        .select('*')
        .eq('user_id', user.id)
        .order('removed_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters?.drugName) {
        query = query.ilike('drug_name', `%${filters.drugName}%`);
      }
      
      if (filters?.dateFrom) {
        query = query.gte('removed_at', filters.dateFrom);
      }
      
      if (filters?.dateTo) {
        query = query.lte('removed_at', filters.dateTo);
      }
      
      if (filters?.reason) {
        query = query.eq('removal_reason', filters.reason);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching inventory usage history:', error);
        return { data: null, error: error.message };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('❌ Exception in getInventoryUsageHistory:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch inventory usage history' 
      };
    }
  }

  // Clear all inventory usage history
  static async clearAllInventoryUsage(): Promise<{ success: boolean; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('inventory_usage_history')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Error clearing inventory usage history:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Successfully cleared all inventory usage history');
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ Exception in clearAllInventoryUsage:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear inventory usage history' 
      };
    }
  }
}