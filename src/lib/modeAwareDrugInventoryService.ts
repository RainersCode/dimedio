import { supabase } from './supabase';
import { OrganizationDrugInventoryService } from './organizationDrugInventoryService';
import type {
  DrugCategory,
  UserDrugInventory,
  DrugInventoryFormData,
  DiagnosisDrugSuggestion,
  DrugUsageHistory,
  DrugInteraction
} from '@/types/database';
import type { OrganizationDrugInventory } from '@/types/organization';
import type { UserWorkingMode } from '@/contexts/MultiOrgUserModeContext';

export class ModeAwareDrugInventoryService {
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

  // Get drug inventory based on active mode
  static async getDrugInventory(
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory)[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    console.log('ModeAwareDrugInventoryService.getDrugInventory called with:', {
      activeMode,
      organizationId,
      organizationIdType: typeof organizationId,
      organizationIdTruthy: !!organizationId
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        console.log('Using organization inventory for orgId:', organizationId);
        // Use organization inventory
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.getOrganizationDrugInventory(organizationId);
        console.log('Organization inventory result:', { data: orgData?.length || 0, error: orgError });
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        console.log('Using individual inventory because:', {
          activeMode,
          organizationId,
          condition: `activeMode !== 'organization' OR !organizationId`
        });
        // Use individual inventory
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
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error fetching drug inventory:', error);
      return { data: null, error: 'Failed to fetch drug inventory', mode: 'individual' };
    }
  }

  // Add drug to inventory based on active mode
  static async addDrug(
    drugData: DrugInventoryFormData,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory) | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization drug inventory service
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.addDrug({
          ...drugData,
          organization_id: organizationId
        });
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory
        // Sanitize the drug data to handle undefined values
        const sanitizedData = {
          user_id: user.id,
          drug_name: drugData.drug_name,
          drug_name_lv: drugData.drug_name_lv || null,
          generic_name: drugData.generic_name || null,
          brand_name: drugData.brand_name || null,
          category_id: (drugData.category_id && drugData.category_id.trim() !== '') ? drugData.category_id : null,
          dosage_form: drugData.dosage_form || null,
          strength: drugData.strength || null,
          active_ingredient: drugData.active_ingredient || null,
          indications: drugData.indications || [],
          contraindications: drugData.contraindications || [],
          dosage_adults: drugData.dosage_adults || null,
          dosage_children: drugData.dosage_children || null,
          stock_quantity: drugData.stock_quantity || 0,
          unit_price: drugData.unit_price || null,
          supplier: drugData.supplier || null,
          batch_number: drugData.batch_number || null,
          expiry_date: drugData.expiry_date || null,
          is_prescription_only: drugData.is_prescription_only || false,
          notes: drugData.notes || null,
          is_active: true
        };

        const { data, error } = await supabase
          .from('user_drug_inventory')
          .insert([sanitizedData])
          .select(`
            *,
            category:drug_categories(*)
          `)
          .single();

        if (error) {
          console.error('Error adding drug to inventory:', error);
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error adding drug:', error);
      return { data: null, error: 'Failed to add drug', mode: 'individual' };
    }
  }

  // Update drug in inventory based on active mode
  static async updateDrug(
    drugId: string,
    drugData: Partial<DrugInventoryFormData>,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory) | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization drug inventory service
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.updateDrug(drugId, drugData);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory
        const { data, error } = await supabase
          .from('user_drug_inventory')
          .update({
            ...drugData,
            updated_at: new Date().toISOString()
          })
          .eq('id', drugId)
          .eq('user_id', user.id)
          .select(`
            *,
            category:drug_categories(*)
          `)
          .single();

        if (error) {
          console.error('Error updating drug in inventory:', error);
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error updating drug:', error);
      return { data: null, error: 'Failed to update drug', mode: 'individual' };
    }
  }

  // Delete drug from inventory based on active mode
  static async deleteDrug(
    drugId: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{ error: string | null; mode: 'individual' | 'organization' }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization drug inventory service
        const { error: orgError } = await OrganizationDrugInventoryService.deleteDrug(drugId);
        return { error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory
        const { error } = await supabase
          .from('user_drug_inventory')
          .update({ is_active: false })
          .eq('id', drugId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting drug from inventory:', error);
          return { error: error.message, mode: 'individual' };
        }

        return { error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error deleting drug:', error);
      return { error: 'Failed to delete drug', mode: 'individual' };
    }
  }

  // Search drugs by query based on active mode
  static async searchDrugs(
    query: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory)[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    if (!query.trim()) {
      return { data: [], error: null, mode: activeMode === 'organization' ? 'organization' : 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization inventory search
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.searchOrganizationDrugs(query, organizationId);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory search
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
          return { data: null, error: error.message, mode: 'individual' };
        }

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error searching drugs:', error);
      return { data: null, error: 'Failed to search drugs', mode: 'individual' };
    }
  }

  // Get drug suggestions for diagnosis based on active mode
  static async getDrugSuggestionsForSymptoms(
    symptoms: string[],
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: DiagnosisDrugSuggestion[] | null;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      // Get inventory based on active mode
      const { data: inventory, error: inventoryError, mode } = await this.getDrugInventory(activeMode, organizationId);

      if (inventoryError || !inventory) {
        return { data: null, error: inventoryError || 'No inventory found', mode: 'individual' };
      }

      // Simple matching logic - in production, you'd want more sophisticated AI matching
      const suggestions: DiagnosisDrugSuggestion[] = inventory
        .filter((drug: any) => {
          // Check if any symptom keywords match drug indications
          return symptoms.some(symptom =>
            drug.indications?.toLowerCase().includes(symptom.toLowerCase()) ||
            drug.drug_name?.toLowerCase().includes(symptom.toLowerCase())
          );
        })
        .map((drug: any) => ({
          drug_id: drug.id,
          drug_name: drug.drug_name,
          generic_name: drug.generic_name,
          strength: drug.strength,
          dosage_form: drug.dosage_form,
          available_quantity: drug.quantity,
          recommended_dosage: drug.default_dosage || 'As prescribed',
          indications: drug.indications,
          contraindications: drug.contraindications,
          side_effects: drug.side_effects,
          confidence_score: 0.8, // Simple static score for now
          stock_status: drug.quantity > 0 ? 'in_stock' : 'out_of_stock' as const
        }));

      return { data: suggestions, error: null, mode };
    } catch (error) {
      console.error('Error getting drug suggestions:', error);
      return { data: null, error: 'Failed to get drug suggestions', mode: 'individual' };
    }
  }

  // Delete all drugs from inventory based on active mode
  static async deleteAllDrugs(
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    error: string | null;
    deletedCount: number;
    mode: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated', deletedCount: 0, mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Delete all organization drugs
        // First get the count
        const { count } = await supabase
          .from('organization_drug_inventory')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true);

        const drugCount = count || 0;

        if (drugCount === 0) {
          return { error: null, deletedCount: 0, mode: 'organization' };
        }

        // Soft delete all drugs in organization inventory
        const { error } = await supabase
          .from('organization_drug_inventory')
          .update({
            is_active: false,
            updated_by: user.id
          })
          .eq('organization_id', organizationId)
          .eq('is_active', true);

        if (error) {
          console.error('Error deleting all organization drugs:', error);
          return { error: error.message, deletedCount: 0, mode: 'organization' };
        }

        return { error: null, deletedCount: drugCount, mode: 'organization' };
      } else {
        // Delete all individual user drugs
        // First get the count
        const { count } = await supabase
          .from('user_drug_inventory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true);

        const drugCount = count || 0;

        if (drugCount === 0) {
          return { error: null, deletedCount: 0, mode: 'individual' };
        }

        // Soft delete all drugs in user inventory
        const { error } = await supabase
          .from('user_drug_inventory')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) {
          console.error('Error deleting all user drugs:', error);
          return { error: error.message, deletedCount: 0, mode: 'individual' };
        }

        return { error: null, deletedCount: drugCount, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error deleting all drugs:', error);
      return { error: 'Failed to delete all drugs', deletedCount: 0, mode: 'individual' };
    }
  }
}