import { supabase } from './supabase';
import { OrganizationService } from './organizationService';
import type { OrganizationDrugInventory } from '@/types/organization';
import type { DrugInventoryFormData } from '@/types/database';

export class OrganizationDrugInventoryService {
  // =====================================================
  // INVENTORY MANAGEMENT
  // =====================================================

  static async getOrganizationDrugInventory(organizationId?: string): Promise<{
    data: OrganizationDrugInventory[] | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      // If no organizationId provided, get user's organization
      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      const { data, error } = await supabase
        .from('organization_drug_inventory')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('is_active', true)
        .order('drug_name', { ascending: true });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching organization drug inventory:', error);
      return { data: null, error: 'Failed to fetch drug inventory' };
    }
  }

  static async addDrugToOrganizationInventory(
    drugData: DrugInventoryFormData,
    organizationId?: string
  ): Promise<{ data: OrganizationDrugInventory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      // If no organizationId provided, get user's organization
      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      // Check if user has permission to manage inventory
      const { data: canManage, error: permError } = await OrganizationService.hasPermission(user.id, 'manage_inventory');
      if (permError) {
        return { data: null, error: permError };
      }

      if (!canManage) {
        return { data: null, error: 'You do not have permission to manage inventory' };
      }

      const { data, error } = await supabase
        .from('organization_drug_inventory')
        .insert([{
          organization_id: targetOrgId,
          ...drugData,
          created_by: user.id,
          updated_by: user.id
        }])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error adding drug to organization inventory:', error);
      return { data: null, error: 'Failed to add drug to inventory' };
    }
  }

  static async updateOrganizationDrug(
    drugId: string,
    updates: Partial<DrugInventoryFormData>
  ): Promise<{ data: OrganizationDrugInventory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Check if user has permission to manage inventory
      const { data: canManage, error: permError } = await OrganizationService.hasPermission(user.id, 'manage_inventory');
      if (permError) {
        return { data: null, error: permError };
      }

      if (!canManage) {
        return { data: null, error: 'You do not have permission to manage inventory' };
      }

      const { data, error } = await supabase
        .from('organization_drug_inventory')
        .update({
          ...updates,
          updated_by: user.id
        })
        .eq('id', drugId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error updating organization drug:', error);
      return { data: null, error: 'Failed to update drug' };
    }
  }

  static async deleteOrganizationDrug(drugId: string): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    try {
      // Check if user has permission to manage inventory
      const { data: canManage, error: permError } = await OrganizationService.hasPermission(user.id, 'manage_inventory');
      if (permError) {
        return { error: permError };
      }

      if (!canManage) {
        return { error: 'You do not have permission to manage inventory' };
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('organization_drug_inventory')
        .update({
          is_active: false,
          updated_by: user.id
        })
        .eq('id', drugId);

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      console.error('Error deleting organization drug:', error);
      return { error: 'Failed to delete drug' };
    }
  }

  static async searchOrganizationDrugs(
    searchQuery: string,
    organizationId?: string
  ): Promise<{ data: OrganizationDrugInventory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      const { data, error } = await supabase
        .from('organization_drug_inventory')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('is_active', true)
        .or(
          `drug_name.ilike.%${searchQuery}%,generic_name.ilike.%${searchQuery}%,brand_name.ilike.%${searchQuery}%,active_ingredient.ilike.%${searchQuery}%`
        )
        .order('drug_name', { ascending: true });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error searching organization drugs:', error);
      return { data: null, error: 'Failed to search drugs' };
    }
  }

  // =====================================================
  // STOCK MANAGEMENT
  // =====================================================

  static async updateDrugStock(
    drugId: string,
    quantityChange: number,
    reason?: string
  ): Promise<{ data: OrganizationDrugInventory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // First get current stock
      const { data: currentDrug, error: fetchError } = await supabase
        .from('organization_drug_inventory')
        .select('stock_quantity, organization_id')
        .eq('id', drugId)
        .single();

      if (fetchError) {
        return { data: null, error: fetchError.message };
      }

      const newQuantity = currentDrug.stock_quantity + quantityChange;

      if (newQuantity < 0) {
        return { data: null, error: 'Insufficient stock quantity' };
      }

      // Update stock
      const { data, error } = await supabase
        .from('organization_drug_inventory')
        .update({
          stock_quantity: newQuantity,
          updated_by: user.id
        })
        .eq('id', drugId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      // Record usage if it's a decrease
      if (quantityChange < 0) {
        await supabase
          .from('organization_drug_usage_history')
          .insert([{
            organization_id: currentDrug.organization_id,
            drug_id: drugId,
            user_id: user.id,
            quantity_dispensed: Math.abs(quantityChange),
            notes: reason,
            is_write_off: reason ? true : false,
            write_off_reason: reason,
            write_off_by: reason ? user.id : null,
            write_off_date: reason ? new Date().toISOString() : null
          }]);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error updating drug stock:', error);
      return { data: null, error: 'Failed to update stock' };
    }
  }

  static async writeOffDrug(
    drugId: string,
    quantity: number,
    reason: string
  ): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    try {
      // Check permission to write off drugs
      const { data: canWriteOff, error: permError } = await OrganizationService.canWriteOffDrugs(user.id);
      if (permError) {
        return { error: permError };
      }

      if (!canWriteOff) {
        return { error: 'You do not have permission to write off drugs' };
      }

      // Use updateDrugStock with negative quantity
      const { error: stockError } = await this.updateDrugStock(drugId, -quantity, reason);
      if (stockError) {
        return { error: stockError };
      }

      return { error: null };
    } catch (error) {
      console.error('Error writing off drug:', error);
      return { error: 'Failed to write off drug' };
    }
  }

  // =====================================================
  // REPORTING AND ANALYTICS
  // =====================================================

  static async getOrganizationUsageHistory(
    organizationId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    data: any[] | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      let query = supabase
        .from('organization_drug_usage_history')
        .select(`
          *,
          drug:organization_drug_inventory(*),
          diagnosis:organization_diagnoses(id, patient_name, primary_diagnosis)
        `)
        .eq('organization_id', targetOrgId)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching organization usage history:', error);
      return { data: null, error: 'Failed to fetch usage history' };
    }
  }

  static async getLowStockDrugs(
    threshold: number = 10,
    organizationId?: string
  ): Promise<{ data: OrganizationDrugInventory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let targetOrgId = organizationId;

      if (!targetOrgId) {
        const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
        if (modeError) {
          return { data: null, error: modeError };
        }

        if (modeInfo?.mode !== 'organization' || !modeInfo.organization) {
          return { data: null, error: 'User is not in organization mode' };
        }

        targetOrgId = modeInfo.organization.id;
      }

      const { data, error } = await supabase
        .from('organization_drug_inventory')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('is_active', true)
        .lte('stock_quantity', threshold)
        .order('stock_quantity', { ascending: true });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching low stock drugs:', error);
      return { data: null, error: 'Failed to fetch low stock drugs' };
    }
  }
}