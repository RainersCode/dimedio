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

    const drugData = {
      user_id: user.id,
      ...formData,
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

  // Delete drug from inventory (soft delete)
  static async deleteDrugFromInventory(drugId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('user_drug_inventory')
      .update({ is_active: false })
      .eq('id', drugId);

    if (error) {
      console.error('Error deleting drug from inventory:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  // Delete all drugs from user's inventory (soft delete)
  static async deleteAllDrugsFromInventory(): Promise<{ error: string | null; deletedCount?: number }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    // First get count of active drugs for confirmation
    const { count, error: countError } = await supabase
      .from('user_drug_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (countError) {
      console.error('Error counting drugs:', countError);
      return { error: countError.message };
    }

    // Soft delete all active drugs for this user
    const { error } = await supabase
      .from('user_drug_inventory')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error deleting all drugs from inventory:', error);
      return { error: error.message };
    }

    return { error: null, deletedCount: count || 0 };
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