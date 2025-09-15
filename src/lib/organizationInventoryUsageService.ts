import { supabase } from './supabase';

export interface OrganizationInventoryUsageRecord {
  id: string;
  user_id: string;
  organization_id: string;
  drug_id?: string;
  drug_name: string;
  quantity_removed: number;
  removal_reason: 'dispensing_record_deleted' | 'bulk_deletion' | 'manual_adjustment';
  original_dispensing_record_id?: string;
  patient_name?: string;
  notes?: string;
  removed_at: string;
}

export class OrganizationInventoryUsageService {

  // Record when organization drugs are removed from inventory (when dispensing records are deleted)
  static async recordInventoryUsage(
    organizationId: string,
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
        organization_id: organizationId,
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
        .from('organization_inventory_usage_history')
        .insert([usageData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error recording organization inventory usage:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Successfully recorded organization inventory usage:', data);
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ Exception in recordInventoryUsage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record inventory usage'
      };
    }
  }

  // Get organization inventory usage history
  static async getInventoryUsageHistory(
    organizationId: string,
    limit = 100,
    filters?: {
      drugName?: string;
      dateFrom?: string;
      dateTo?: string;
      reason?: string;
    }
  ): Promise<{ data: OrganizationInventoryUsageRecord[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let query = supabase
        .from('organization_inventory_usage_history')
        .select('*')
        .eq('organization_id', organizationId)
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
        console.error('❌ Error fetching organization inventory usage history:', error);
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

  // Clear all organization inventory usage history
  static async clearAllInventoryUsage(organizationId: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('organization_inventory_usage_history')
        .delete()
        .eq('organization_id', organizationId);

      if (error) {
        console.error('❌ Error clearing organization inventory usage history:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Successfully cleared organization inventory usage history');
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