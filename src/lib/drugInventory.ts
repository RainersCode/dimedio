import { supabase } from './supabase';
import type { 
  DrugCategory,
  UserDrugInventory,
  DrugInventoryFormData,
  DiagnosisDrugSuggestion,
  DrugUsageHistory,
  DrugInteraction
} from '@/types/database';

export class DrugInventoryService {
  // Check if user has access to drug inventory (premium feature)
  static async checkDrugInventoryAccess(): Promise<{ hasAccess: boolean; error: string | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { hasAccess: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase.rpc('user_has_drug_inventory_access', {
        target_user_id: user.id
      });

      if (error) {
        console.error('Error checking drug inventory access:', error);
        return { hasAccess: false, error: error.message };
      }

      return { hasAccess: data || false, error: null };
    } catch (error) {
      console.error('Drug inventory access check failed:', error);
      return { hasAccess: false, error: 'Access check failed' };
    }
  }

  // Get all drug categories
  static async getDrugCategories(): Promise<{ data: DrugCategory[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('drug_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching drug categories:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get user's drug inventory
  static async getUserDrugInventory(): Promise<{ data: UserDrugInventory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_drug_inventory')
      .select(`
        *,
        category:drug_categories(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('drug_name', { ascending: true });

    if (error) {
      console.error('Error fetching drug inventory:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Add drug to inventory
  static async addDrugToInventory(formData: DrugInventoryFormData): Promise<{ data: UserDrugInventory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Check access first
    const { hasAccess, error: accessError } = await this.checkDrugInventoryAccess();
    if (accessError || !hasAccess) {
      return { data: null, error: accessError || 'Insufficient credits for drug inventory access' };
    }

    // Clean form data - convert empty strings to undefined for optional fields
    const cleanFormData = {
      ...formData,
      category_id: formData.category_id && formData.category_id.trim() !== '' ? formData.category_id : undefined,
      drug_name_lv: formData.drug_name_lv && formData.drug_name_lv.trim() !== '' ? formData.drug_name_lv : undefined,
      generic_name: formData.generic_name && formData.generic_name.trim() !== '' ? formData.generic_name : undefined,
      brand_name: formData.brand_name && formData.brand_name.trim() !== '' ? formData.brand_name : undefined,
      dosage_form: formData.dosage_form && formData.dosage_form.trim() !== '' ? formData.dosage_form : undefined,
      strength: formData.strength && formData.strength.trim() !== '' ? formData.strength : undefined,
      active_ingredient: formData.active_ingredient && formData.active_ingredient.trim() !== '' ? formData.active_ingredient : undefined,
      dosage_adults: formData.dosage_adults && formData.dosage_adults.trim() !== '' ? formData.dosage_adults : undefined,
      dosage_children: formData.dosage_children && formData.dosage_children.trim() !== '' ? formData.dosage_children : undefined,
      supplier: formData.supplier && formData.supplier.trim() !== '' ? formData.supplier : undefined,
      batch_number: formData.batch_number && formData.batch_number.trim() !== '' ? formData.batch_number : undefined,
      expiry_date: formData.expiry_date && formData.expiry_date.trim() !== '' ? formData.expiry_date : undefined,
      notes: formData.notes && formData.notes.trim() !== '' ? formData.notes : undefined,
    };

    const drugData = {
      user_id: user.id,
      ...cleanFormData,
    };

    const { data, error } = await supabase
      .from('user_drug_inventory')
      .insert([drugData])
      .select(`
        *,
        category:drug_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error adding drug to inventory:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Update drug in inventory
  static async updateDrugInInventory(drugId: string, formData: Partial<DrugInventoryFormData>): Promise<{ data: UserDrugInventory | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_drug_inventory')
      .update(formData)
      .eq('id', drugId)
      .select(`
        *,
        category:drug_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error updating drug in inventory:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Delete drug from inventory (hard delete by default, soft delete if has history)
  static async deleteDrugFromInventory(drugId: string): Promise<{ error: string | null }> {
    try {
      // First check if this drug has been used in diagnoses or has usage history
      const { data: hasHistory, error: historyError } = await supabase
        .from('diagnosis_drug_suggestions')
        .select('id')
        .eq('drug_id', drugId)
        .limit(1);

      if (historyError) {
        console.error('Error checking drug history:', historyError);
        return { error: historyError.message };
      }

      // Also check drug usage history
      const { data: hasUsage, error: usageError } = await supabase
        .from('drug_usage_history')
        .select('id')
        .eq('drug_id', drugId)
        .limit(1);

      if (usageError) {
        console.error('Error checking drug usage:', usageError);
        return { error: usageError.message };
      }

      // If drug has history, use soft delete to preserve data integrity
      if ((hasHistory && hasHistory.length > 0) || (hasUsage && hasUsage.length > 0)) {
        const { error } = await supabase
          .from('user_drug_inventory')
          .update({ is_active: false })
          .eq('id', drugId);

        if (error) {
          console.error('Error soft deleting drug:', error);
          return { error: error.message };
        }
      } else {
        // If no history, hard delete to save space
        const { error } = await supabase
          .from('user_drug_inventory')
          .delete()
          .eq('id', drugId);

        if (error) {
          console.error('Error hard deleting drug:', error);
          return { error: error.message };
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Error in deleteDrugFromInventory:', error);
      return { error: 'Failed to delete drug' };
    }
  }

  // Delete all drugs from user's inventory (hard delete unused, soft delete used)
  static async deleteAllDrugsFromInventory(): Promise<{ error: string | null; deletedCount?: number }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    try {
      // Get all active drugs for this user
      const { data: userDrugs, error: drugsError } = await supabase
        .from('user_drug_inventory')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (drugsError) {
        console.error('Error fetching user drugs:', drugsError);
        return { error: drugsError.message };
      }

      if (!userDrugs || userDrugs.length === 0) {
        return { error: null, deletedCount: 0 };
      }

      const drugIds = userDrugs.map(drug => drug.id);

      // Check which drugs have history (diagnosis suggestions or usage)
      const { data: drugsWithHistory, error: historyError } = await supabase
        .from('diagnosis_drug_suggestions')
        .select('drug_id')
        .in('drug_id', drugIds);

      if (historyError) {
        console.error('Error checking drug history:', historyError);
        return { error: historyError.message };
      }

      const { data: drugsWithUsage, error: usageError } = await supabase
        .from('drug_usage_history')
        .select('drug_id')
        .in('drug_id', drugIds);

      if (usageError) {
        console.error('Error checking drug usage:', usageError);
        return { error: usageError.message };
      }

      // Get IDs of drugs that have history
      const drugsWithHistoryIds = new Set([
        ...(drugsWithHistory || []).map(d => d.drug_id),
        ...(drugsWithUsage || []).map(d => d.drug_id)
      ]);

      const drugsToHardDelete = drugIds.filter(id => !drugsWithHistoryIds.has(id));
      const drugsToSoftDelete = drugIds.filter(id => drugsWithHistoryIds.has(id));

      let totalDeleted = 0;

      // Hard delete drugs without history
      if (drugsToHardDelete.length > 0) {
        const { error: hardDeleteError } = await supabase
          .from('user_drug_inventory')
          .delete()
          .in('id', drugsToHardDelete);

        if (hardDeleteError) {
          console.error('Error hard deleting drugs:', hardDeleteError);
          return { error: hardDeleteError.message };
        }
        totalDeleted += drugsToHardDelete.length;
      }

      // Soft delete drugs with history
      if (drugsToSoftDelete.length > 0) {
        const { error: softDeleteError } = await supabase
          .from('user_drug_inventory')
          .update({ is_active: false })
          .in('id', drugsToSoftDelete);

        if (softDeleteError) {
          console.error('Error soft deleting drugs:', softDeleteError);
          return { error: softDeleteError.message };
        }
        totalDeleted += drugsToSoftDelete.length;
      }

      return { error: null, deletedCount: totalDeleted };
    } catch (error) {
      console.error('Error in deleteAllDrugsFromInventory:', error);
      return { error: 'Failed to delete all drugs' };
    }
  }

  // Cleanup old inactive records (can be run periodically)
  static async cleanupOldInactiveRecords(daysOld: number = 90): Promise<{ error: string | null; cleanedCount?: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Get inactive drugs older than cutoff that have no recent history
      const { data: oldInactive, error: fetchError } = await supabase
        .from('user_drug_inventory')
        .select('id, updated_at')
        .eq('is_active', false)
        .lt('updated_at', cutoffDate.toISOString());

      if (fetchError) {
        console.error('Error fetching old inactive drugs:', fetchError);
        return { error: fetchError.message };
      }

      if (!oldInactive || oldInactive.length === 0) {
        return { error: null, cleanedCount: 0 };
      }

      const oldDrugIds = oldInactive.map(drug => drug.id);

      // Check if any of these old drugs have recent diagnosis or usage history
      const recentHistoryCutoff = new Date();
      recentHistoryCutoff.setDate(recentHistoryCutoff.getDate() - 30); // Keep if used in last 30 days

      const { data: recentHistory, error: historyError } = await supabase
        .from('diagnosis_drug_suggestions')
        .select('drug_id')
        .in('drug_id', oldDrugIds)
        .gte('created_at', recentHistoryCutoff.toISOString());

      if (historyError) {
        console.error('Error checking recent history:', historyError);
        return { error: historyError.message };
      }

      const recentHistoryIds = new Set((recentHistory || []).map(d => d.drug_id));
      const safeToDeleteIds = oldDrugIds.filter(id => !recentHistoryIds.has(id));

      if (safeToDeleteIds.length === 0) {
        return { error: null, cleanedCount: 0 };
      }

      // Hard delete old inactive records that are safe to remove
      const { error: deleteError } = await supabase
        .from('user_drug_inventory')
        .delete()
        .in('id', safeToDeleteIds);

      if (deleteError) {
        console.error('Error cleaning up old inactive records:', deleteError);
        return { error: deleteError.message };
      }

      return { error: null, cleanedCount: safeToDeleteIds.length };
    } catch (error) {
      console.error('Error in cleanupOldInactiveRecords:', error);
      return { error: 'Failed to cleanup old records' };
    }
  }

  // Search drugs by name or indication
  static async searchDrugs(query: string): Promise<{ data: UserDrugInventory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_drug_inventory')
      .select(`
        *,
        category:drug_categories(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or(`drug_name.ilike.%${query}%,generic_name.ilike.%${query}%,brand_name.ilike.%${query}%`)
      .order('drug_name', { ascending: true });

    if (error) {
      console.error('Error searching drugs:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get drugs suitable for a diagnosis
  static async getDrugsForDiagnosis(diagnosisText: string): Promise<{ data: UserDrugInventory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Search for drugs where indications contain keywords from diagnosis
    const keywords = diagnosisText.toLowerCase().split(' ').filter(word => word.length > 3);
    
    if (keywords.length === 0) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('user_drug_inventory')
      .select(`
        *,
        category:drug_categories(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('stock_quantity', 1) // Only suggest drugs in stock
      .order('drug_name', { ascending: true });

    if (error) {
      console.error('Error fetching drugs for diagnosis:', error);
      return { data: null, error: error.message };
    }

    // Filter drugs based on indications containing diagnosis keywords
    const relevantDrugs = data?.filter(drug => {
      if (!drug.indications || drug.indications.length === 0) return false;
      
      const indicationsText = drug.indications.join(' ').toLowerCase();
      return keywords.some(keyword => indicationsText.includes(keyword));
    }) || [];

    return { data: relevantDrugs, error: null };
  }

  // Add drug suggestion to diagnosis
  static async addDrugSuggestionToDiagnosis(
    diagnosisId: string, 
    drugId: string, 
    suggestionData: {
      suggested_dosage?: string;
      treatment_duration?: string;
      administration_notes?: string;
      priority_level?: number;
      manual_selection?: boolean;
    }
  ): Promise<{ data: DiagnosisDrugSuggestion | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const suggestionRecord = {
      diagnosis_id: diagnosisId,
      drug_id: drugId,
      user_id: user.id,
      suggested_by_ai: false,
      manual_selection: true,
      priority_level: 1,
      ...suggestionData,
    };

    const { data, error } = await supabase
      .from('diagnosis_drug_suggestions')
      .insert([suggestionRecord])
      .select(`
        *,
        drug:user_drug_inventory(*)
      `)
      .single();

    if (error) {
      console.error('Error adding drug suggestion:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get drug suggestions for a diagnosis
  static async getDrugSuggestionsForDiagnosis(diagnosisId: string): Promise<{ data: DiagnosisDrugSuggestion[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('diagnosis_drug_suggestions')
      .select(`
        *,
        drug:user_drug_inventory(
          *,
          category:drug_categories(*)
        )
      `)
      .eq('diagnosis_id', diagnosisId)
      .order('priority_level', { ascending: true });

    if (error) {
      console.error('Error fetching drug suggestions:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Record drug usage
  static async recordDrugUsage(
    drugId: string, 
    quantity: number, 
    diagnosisId?: string, 
    notes?: string
  ): Promise<{ data: DrugUsageHistory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const usageRecord = {
      user_id: user.id,
      drug_id: drugId,
      diagnosis_id: diagnosisId,
      quantity_dispensed: quantity,
      notes,
    };

    const { data, error } = await supabase
      .from('drug_usage_history')
      .insert([usageRecord])
      .select(`
        *,
        drug:user_drug_inventory(*)
      `)
      .single();

    if (error) {
      console.error('Error recording drug usage:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get drug usage history
  static async getDrugUsageHistory(limit = 50): Promise<{ data: DrugUsageHistory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('drug_usage_history')
      .select(`
        *,
        drug:user_drug_inventory(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching drug usage history:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Check for drug interactions
  static async checkDrugInteractions(drugIds: string[]): Promise<{ data: DrugInteraction[] | null; error: string | null }> {
    if (drugIds.length < 2) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('drug_interactions')
      .select('*')
      .or(`and(drug_id_1.in.(${drugIds.join(',')}),drug_id_2.in.(${drugIds.join(',')}))`)
      .order('severity_level', { ascending: false });

    if (error) {
      console.error('Error checking drug interactions:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }
}

// Helper functions for UI
export const formatDrugName = (drug: UserDrugInventory): string => {
  const parts = [drug.drug_name];
  if (drug.strength) parts.push(drug.strength);
  if (drug.dosage_form) parts.push(`(${drug.dosage_form})`);
  return parts.join(' ');
};

export const getDrugStockStatus = (drug: UserDrugInventory): 'in_stock' | 'low_stock' | 'out_of_stock' => {
  if (drug.stock_quantity === 0) return 'out_of_stock';
  if (drug.stock_quantity <= 10) return 'low_stock';
  return 'in_stock';
};

export const isNearExpiry = (expiryDate?: string): boolean => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(now.getMonth() + 3);
  
  return expiry < threeMonthsFromNow;
};