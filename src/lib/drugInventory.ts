import { supabase } from './supabase';
import { OrganizationService } from './organizationService';
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

  // Get user's drug inventory (supports both individual and organization modes)
  static async getUserDrugInventory(): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory)[] | null;
    error: string | null;
    mode?: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Check user mode
      const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
      if (modeError) {
        return { data: null, error: modeError };
      }

      if (modeInfo?.mode === 'organization' && modeInfo.organization) {
        // Use organization inventory
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.getOrganizationDrugInventory(modeInfo.organization.id);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory (existing logic)
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

        return { data, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error determining user mode:', error);
      // Fallback to individual mode
      const { data, error: fallbackError } = await supabase
        .from('user_drug_inventory')
        .select(`
          *,
          category:drug_categories(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('drug_name', { ascending: true });

      return { data, error: fallbackError, mode: 'individual' };
    }
  }

  // Add drug to inventory (dual-mode support)
  static async addDrugToInventory(formData: DrugInventoryFormData): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory) | null;
    error: string | null;
    mode?: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Check user mode
      const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
      if (modeError) {
        return { data: null, error: modeError };
      }

      if (modeInfo?.mode === 'organization' && modeInfo.organization) {
        // Use organization inventory
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.addDrugToOrganizationInventory(formData, modeInfo.organization.id);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory (existing logic)
        const result = await this.addDrugToIndividualInventory(formData);
        return { ...result, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error adding drug to inventory:', error);
      return { data: null, error: 'Failed to add drug to inventory' };
    }
  }

  // Add drug to individual inventory (original method)
  private static async addDrugToIndividualInventory(formData: DrugInventoryFormData): Promise<{ data: UserDrugInventory | null; error: string | null }> {
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

  // Delete drug from inventory (dual-mode support)
  static async deleteDrugFromInventory(drugId: string): Promise<{ error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    try {
      // Check user mode
      const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
      if (modeError) {
        return { error: modeError };
      }

      if (modeInfo?.mode === 'organization' && modeInfo.organization) {
        // Use organization inventory deletion
        return await OrganizationDrugInventoryService.deleteOrganizationDrug(drugId);
      } else {
        // Use individual inventory deletion (existing logic)
        return await this.deleteIndividualDrug(drugId);
      }
    } catch (error) {
      console.error('Error deleting drug from inventory:', error);
      return { error: 'Failed to delete drug' };
    }
  }

  // Delete drug from individual inventory (original method)
  private static async deleteIndividualDrug(drugId: string): Promise<{ error: string | null }> {
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

  // Get a single drug by ID
  static async getUserDrugById(drugId: string): Promise<{ data: UserDrugInventory | null; error: string | null }> {
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
      .eq('id', drugId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching drug by ID:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Search drugs by name or indication (dual-mode support)
  static async searchDrugs(query: string): Promise<{
    data: (UserDrugInventory | OrganizationDrugInventory)[] | null;
    error: string | null;
    mode?: 'individual' | 'organization';
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Check user mode
      const { data: modeInfo, error: modeError } = await OrganizationService.getUserModeInfo(user.id);
      if (modeError) {
        return { data: null, error: modeError };
      }

      if (modeInfo?.mode === 'organization' && modeInfo.organization) {
        // Use organization inventory search
        const { data: orgData, error: orgError } = await OrganizationDrugInventoryService.searchOrganizationDrugs(query, modeInfo.organization.id);
        return { data: orgData, error: orgError, mode: 'organization' };
      } else {
        // Use individual inventory search (existing logic)
        const result = await this.searchIndividualDrugs(query);
        return { ...result, mode: 'individual' };
      }
    } catch (error) {
      console.error('Error searching drugs:', error);
      return { data: null, error: 'Failed to search drugs' };
    }
  }

  // Search individual drugs (original method)
  private static async searchIndividualDrugs(query: string): Promise<{ data: UserDrugInventory[] | null; error: string | null }> {
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

  // Get drugs suitable for a diagnosis with improved matching
  static async getDrugsForDiagnosis(diagnosisText: string, symptoms?: string[], complaint?: string): Promise<{ data: UserDrugInventory[] | null; error: string | null }> {
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
      .gt('stock_quantity', 0) // Only drugs with stock
      .order('drug_name', { ascending: true });

    if (error) {
      console.error('Error fetching drugs for diagnosis:', error);
      return { data: null, error: error.message };
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Enhanced matching algorithm
    const drugsWithScore = data.map(drug => {
      let relevanceScore = 0;
      
      // Combine all text sources for matching
      const allText = [
        diagnosisText || '',
        complaint || '',
        ...(symptoms || [])
      ].join(' ').toLowerCase();
      
      // Extract meaningful keywords (medical terms)
      const keywords = allText
        .split(/[\s,;.()]+/)
        .filter(word => word.length > 3)
        .filter(word => !/^(the|and|for|with|from|this|that|have|been|very|some|such|will|can|may|one|two|three)$/.test(word));

      if (keywords.length === 0) return { drug, score: 0 };

      // Check indications (primary matching)
      if (drug.indications && drug.indications.length > 0) {
        const indicationsText = drug.indications.join(' ').toLowerCase();
        keywords.forEach(keyword => {
          if (indicationsText.includes(keyword)) {
            relevanceScore += 5; // High score for indication match
          }
        });
      }

      // Check drug name and generic name for symptom-based matching
      const drugNames = [
        drug.drug_name?.toLowerCase() || '',
        drug.generic_name?.toLowerCase() || '',
        drug.brand_name?.toLowerCase() || ''
      ].join(' ');

      // Common medical condition to drug name mappings
      const conditionMappings = {
        'pain': ['paracetamol', 'ibuprofen', 'aspirin', 'analgesic', 'nsaid', 'acetaminophen'],
        'fever': ['paracetamol', 'ibuprofen', 'aspirin', 'antipyretic', 'acetaminophen'],
        'inflammation': ['ibuprofen', 'diclofenac', 'nsaid', 'inflammatory', 'cortison'],
        'infection': ['antibiotic', 'amoxicillin', 'azithromycin', 'penicillin', 'doxycycline'],
        'allergy': ['antihistamine', 'loratadine', 'cetirizine', 'allergic', 'chlorphenamine'],
        'cough': ['dextromethorphan', 'codeine', 'antitussive', 'expectorant', 'bromhexine'],
        'cold': ['pseudoephedrine', 'decongestant', 'cold', 'flu', 'phenylephrine'],
        'headache': ['paracetamol', 'ibuprofen', 'aspirin', 'migraine', 'sumatriptan'],
        'nausea': ['ondansetron', 'metoclopramide', 'antiemetic', 'dramamine'],
        'diarrhea': ['loperamide', 'antidiarrheal', 'bismuth', 'smecta'],
        'constipation': ['laxative', 'lactulose', 'docusate', 'bisacodyl'],
        'hypertension': ['amlodipine', 'lisinopril', 'metoprolol', 'inhibitor', 'pressure'],
        'diabetes': ['metformin', 'insulin', 'glibenclamide', 'antidiabetic', 'glucose'],
        'asthma': ['salbutamol', 'inhaler', 'bronchodilator', 'corticosteroid', 'ventolin'],
        'gastritis': ['omeprazole', 'ranitidine', 'antacid', 'ppi', 'stomach'],
        'anxiety': ['diazepam', 'lorazepam', 'anxiolytic', 'benzodiazepine'],
        'depression': ['sertraline', 'fluoxetine', 'antidepressant', 'ssri'],
        'ulcer': ['omeprazole', 'ranitidine', 'antacid', 'lansoprazole'],
        'arthritis': ['ibuprofen', 'diclofenac', 'nsaid', 'inflammatory'],
        'insomnia': ['melatonin', 'zolpidem', 'sedative', 'hypnotic'],
        'vitamin': ['vitamin', 'supplement', 'deficiency', 'multivitamin']
      };

      // Check for condition-based matching
      Object.entries(conditionMappings).forEach(([condition, drugTypes]) => {
        if (keywords.some(keyword => 
          keyword.includes(condition) || 
          condition.includes(keyword) ||
          allText.includes(condition)
        )) {
          drugTypes.forEach(drugType => {
            if (drugNames.includes(drugType)) {
              relevanceScore += 3; // Medium score for condition-drug mapping
            }
          });
        }
      });

      // Check active ingredient matching
      if (drug.active_ingredient) {
        const activeIngredient = drug.active_ingredient.toLowerCase();
        keywords.forEach(keyword => {
          if (activeIngredient.includes(keyword) || keyword.includes(activeIngredient)) {
            relevanceScore += 2; // Lower score for active ingredient match
          }
        });
      }

      // Check therapeutic class matching
      if (drug.therapeutic_class) {
        const therapeuticClass = drug.therapeutic_class.toLowerCase();
        keywords.forEach(keyword => {
          if (therapeuticClass.includes(keyword)) {
            relevanceScore += 2;
          }
        });
      }

      // Prioritize drugs with good stock levels
      if (drug.stock_quantity && drug.stock_quantity > 10) {
        relevanceScore += 1; // Bonus for good stock levels
      }

      // Check expiry date - deprioritize soon-to-expire drugs
      if (drug.expiry_date) {
        const expiryDate = new Date(drug.expiry_date);
        const now = new Date();
        const monthsUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
        
        if (monthsUntilExpiry < 3) {
          relevanceScore -= 2; // Penalize soon-to-expire drugs
        } else if (monthsUntilExpiry > 12) {
          relevanceScore += 0.5; // Slight bonus for fresh drugs
        }
      }

      return { drug, score: relevanceScore };
    });

    // Filter out drugs with no relevance and sort by score
    const relevantDrugs = drugsWithScore
      .filter(item => item.score > 0)
      .sort((a, b) => {
        // First sort by relevance score
        if (a.score !== b.score) return b.score - a.score;
        
        // Then by stock quantity
        const aStock = a.drug.stock_quantity || 0;
        const bStock = b.drug.stock_quantity || 0;
        if (aStock !== bStock) return bStock - aStock;
        
        // Finally by expiry date (latest first)
        const aExpiry = a.drug.expiry_date ? new Date(a.drug.expiry_date).getTime() : 0;
        const bExpiry = b.drug.expiry_date ? new Date(b.drug.expiry_date).getTime() : 0;
        return bExpiry - aExpiry;
      })
      .map(item => item.drug);

    // Return top 15 most relevant drugs to provide good choices
    return { data: relevantDrugs.slice(0, 15), error: null };
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