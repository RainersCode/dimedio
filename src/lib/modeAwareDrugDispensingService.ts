import { supabase } from './supabase';
import { DrugDispensingService, DispensingStats } from './drugDispensingService';
import { OrganizationInventoryUsageService } from './organizationInventoryUsageService';
import { InventoryUsageService } from './inventoryUsageService';
import type { UserWorkingMode } from '@/contexts/MultiOrgUserModeContext';
import type { DrugUsageHistory } from '@/types/database';
import type { OrganizationDrugUsageHistory } from '@/types/organization';

// Helper function to parse dispensing info from notes
function parseDispenseInfoFromNotes(notes: string, fallbackQuantity?: number): { packs: number, tablets: number, totalUnits: number } {
  if (!notes) {
    // If no notes, assume the fallback quantity represents individual units/tablets
    const tablets = fallbackQuantity || 0;
    return { packs: 0, tablets, totalUnits: tablets };
  }

  // Look for new format: "Dispensed: X pack + Y tablets" or "Dispensed: X packs + Y tablets"
  const multiUnitMatch = notes.match(/Dispensed:\s*(\d+)\s*pack(?:s)?\s*\+\s*(\d+)\s*(?:tablets?|ampules?)/i);
  if (multiUnitMatch) {
    const packs = parseInt(multiUnitMatch[1]) || 0;
    const tablets = parseInt(multiUnitMatch[2]) || 0;
    return { packs, tablets, totalUnits: packs + tablets };
  }

  // Look for single pack pattern: "Dispensed: X packs" or "Dispensed: X pack"
  const packsOnlyMatch = notes.match(/Dispensed:\s*(\d+)\s*pack(?:s)?(?:\s|\.)/i);
  if (packsOnlyMatch) {
    const packs = parseInt(packsOnlyMatch[1]) || 0;
    return { packs, tablets: 0, totalUnits: packs };
  }

  // Look for single tablets pattern: "Dispensed: X tablets" or "Dispensed: X ampules"
  const tabletsOnlyMatch = notes.match(/Dispensed:\s*(\d+)\s*(?:tablets?|ampules?)/i);
  if (tabletsOnlyMatch) {
    const tablets = parseInt(tabletsOnlyMatch[1]) || 0;
    return { packs: 0, tablets, totalUnits: tablets };
  }

  // Fallback to quantity_dispensed if available (treat as individual units)
  const tablets = fallbackQuantity || 0;
  return { packs: 0, tablets, totalUnits: tablets };
}

export interface ModeAwareDispensingRecord {
  drugId: string | null;
  drugName: string;
  quantity: number;
  notes?: string;
}

// Helper function to update organization inventory with pack tracking
async function updateOrganizationInventoryWithPackTracking(
  drugId: string,
  organizationId: string,
  quantityChange: number,
  operation: 'add' | 'subtract'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current inventory
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('organization_drug_inventory')
      .select('stock_quantity, whole_packs_count, loose_units_count, units_per_pack, unit_type')
      .eq('id', drugId)
      .eq('organization_id', organizationId)
      .single();

    if (inventoryError) {
      return { success: false, error: `Could not find inventory record: ${inventoryError.message}` };
    }

    const currentStock = inventoryData.stock_quantity || 0;
    const currentWholePacks = inventoryData.whole_packs_count || 0;
    const currentLooseUnits = inventoryData.loose_units_count || 0;
    const unitsPerPack = inventoryData.units_per_pack || 1;

    // Calculate based on whether we have pack tracking data
    if (inventoryData.units_per_pack && (inventoryData.whole_packs_count !== null || inventoryData.loose_units_count !== null)) {
      // Use pack tracking logic
      let newWholePacks = currentWholePacks;
      let newLooseUnits = currentLooseUnits;

      if (operation === 'subtract') {
        const quantityToSubtract = Math.abs(quantityChange);
        let remainingToSubtract = quantityToSubtract;

        console.log(`🔢 Pack tracking calculation: Need to subtract ${quantityToSubtract} units`);
        console.log(`📦 Current inventory: ${newWholePacks} packs + ${newLooseUnits} loose units`);

        // First, subtract from loose units
        if (newLooseUnits >= remainingToSubtract) {
          newLooseUnits -= remainingToSubtract;
          remainingToSubtract = 0;
          console.log(`✅ Subtracted from loose units: ${newLooseUnits} remaining`);
        } else {
          remainingToSubtract -= newLooseUnits;
          newLooseUnits = 0;
          console.log(`📦 Used all loose units, still need ${remainingToSubtract} units`);

          // Then subtract from whole packs (opening them as needed)
          // Only open the minimum number of packs needed
          const packsToOpen = Math.ceil(remainingToSubtract / unitsPerPack);
          if (newWholePacks >= packsToOpen) {
            newWholePacks -= packsToOpen;
            // Calculate remaining loose units after taking what we need
            const totalUnitsFromOpenedPacks = packsToOpen * unitsPerPack;
            newLooseUnits = totalUnitsFromOpenedPacks - remainingToSubtract;
            console.log(`📦 Opened ${packsToOpen} packs (${totalUnitsFromOpenedPacks} units), used ${remainingToSubtract} units, ${newLooseUnits} loose units remaining`);

            // Reset remainingToSubtract to 0 since we've fulfilled the request
            remainingToSubtract = 0;
          } else {
            // Not enough inventory
            return { success: false, error: `Insufficient inventory. Need ${quantityToSubtract} units, have ${currentWholePacks * unitsPerPack + currentLooseUnits} units.` };
          }
        }
      }

      // Update with new pack counts and maintain stock_quantity for backward compatibility
      const newStockQuantity = newWholePacks; // stock_quantity represents whole packs
      const { error: updateError } = await supabase
        .from('organization_drug_inventory')
        .update({
          stock_quantity: newStockQuantity,
          whole_packs_count: newWholePacks,
          loose_units_count: newLooseUnits
        })
        .eq('id', drugId)
        .eq('organization_id', organizationId);

      if (updateError) {
        return { success: false, error: `Failed to update inventory: ${updateError.message}` };
      }

      console.log(`✅ Updated organization inventory: ${currentWholePacks} packs → ${newWholePacks} packs, ${currentLooseUnits} loose → ${newLooseUnits} loose`);
    } else {
      // Fallback to simple stock_quantity logic
      const newStock = operation === 'subtract'
        ? Math.max(0, currentStock - Math.abs(quantityChange))
        : currentStock + Math.abs(quantityChange);

      const { error: updateError } = await supabase
        .from('organization_drug_inventory')
        .update({ stock_quantity: newStock })
        .eq('id', drugId)
        .eq('organization_id', organizationId);

      if (updateError) {
        return { success: false, error: `Failed to update inventory: ${updateError.message}` };
      }

      console.log(`✅ Updated organization inventory (simple): ${currentStock} → ${newStock}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateOrganizationInventoryWithPackTracking:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export class ModeAwareDrugDispensingService {
  // Record drug dispensing based on active mode
  static async recordDispensing(
    dispensingRecords: ModeAwareDispensingRecord[],
    diagnosisId: string | null,
    patientInfo: {
      patient_name?: string;
      patient_age?: number;
      patient_gender?: string;
      primary_diagnosis?: string;
    },
    activeMode: UserWorkingMode,
    organizationId?: string | null,
    skipDuplicateCheck = false
  ): Promise<{ data: (DrugUsageHistory | OrganizationDrugUsageHistory)[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Use organization drug dispensing
        return await this.recordOrganizationDispensing(
          dispensingRecords,
          diagnosisId,
          patientInfo,
          organizationId,
          user.id,
          skipDuplicateCheck
        );
      } else {
        // Use individual drug dispensing (existing logic)
        const dispensings = dispensingRecords.map(record => ({
          drugId: record.drugId,
          drugName: record.drugName,
          quantity: record.quantity,
          notes: record.notes
        }));

        const { error } = await DrugDispensingService.recordMultipleDispensings(
          dispensings,
          diagnosisId,
          patientInfo,
          skipDuplicateCheck
        );

        if (error) {
          return { data: null, error };
        }

        // Fetch the recorded dispensings for return
        const { data, error: fetchError } = await supabase
          .from('drug_usage_history')
          .select('*')
          .eq('diagnosis_id', diagnosisId)
          .eq('user_id', user.id);

        return { data: data || [], error: fetchError?.message || null };
      }
    } catch (error) {
      console.error('Error in mode-aware drug dispensing:', error);
      return { data: null, error: 'Failed to record dispensing' };
    }
  }

  // Record organization drug dispensing
  private static async recordOrganizationDispensing(
    dispensingRecords: ModeAwareDispensingRecord[],
    diagnosisId: string | null,
    patientInfo: {
      patient_name?: string;
      patient_age?: number;
      patient_gender?: string;
      primary_diagnosis?: string;
    },
    organizationId: string,
    userId: string,
    skipDuplicateCheck: boolean
  ): Promise<{ data: OrganizationDrugUsageHistory[] | null; error: string | null }> {

    console.log('Recording organization drug dispensing:', {
      dispensingRecords,
      diagnosisId,
      organizationId,
      skipDuplicateCheck
    });

    // Check for duplicates if not skipping and we have a diagnosis_id
    if (!skipDuplicateCheck && diagnosisId) {
      const { data: existingRecords } = await supabase
        .from('organization_drug_usage_history')
        .select('id')
        .eq('diagnosis_id', diagnosisId)
        .eq('organization_id', organizationId);

      if (existingRecords && existingRecords.length > 0) {
        return { data: null, error: 'Dispensing records already exist for this diagnosis' };
      }
    }

    const dispensingData: Partial<OrganizationDrugUsageHistory>[] = [];

    for (const record of dispensingRecords) {
      // Only process if we have a valid drug ID (found in organization inventory)
      if (record.drugId) {
        dispensingData.push({
          organization_id: organizationId,
          drug_id: record.drugId,
          diagnosis_id: diagnosisId,
          user_id: userId,
          quantity_dispensed: record.quantity,
          dispensed_date: new Date().toISOString(),
          patient_info: patientInfo,
          notes: record.notes,
          is_write_off: false
        });

        // Update organization drug inventory using pack-aware tracking
        try {
          const updateResult = await updateOrganizationInventoryWithPackTracking(record.drugId, organizationId, record.quantity, 'subtract');

          if (!updateResult.success) {
            console.error('❌ Error updating organization inventory:', updateResult.error);
          }
        } catch (inventoryError) {
          console.error('Failed to update organization inventory:', inventoryError);
        }
      } else {
        console.warn('Skipping dispensing for drug not found in organization inventory:', record.drugName);
      }
    }

    if (dispensingData.length === 0) {
      return { data: null, error: 'No drugs found in organization inventory to dispense' };
    }

    const { data, error } = await supabase
      .from('organization_drug_usage_history')
      .insert(dispensingData)
      .select();

    if (error) {
      console.error('Error recording organization dispensing:', error);
      return { data: null, error: error.message };
    }

    console.log('Successfully recorded organization dispensing:', data);
    return { data: data || [], error: null };
  }

  // Get dispensing history based on mode
  static async getDispensingHistory(
    activeMode: UserWorkingMode,
    organizationId?: string | null,
    limit = 50
  ): Promise<{
    data: ((DrugUsageHistory | OrganizationDrugUsageHistory) & {
      drug_name?: string;
      patient_name?: string;
      primary_diagnosis?: string;
    })[] | null;
    error: string | null
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        console.log('🔍 Fetching organization dispensing history for org:', organizationId);

        // Get organization dispensing history with left join (to include records even without inventory match)
        const { data, error } = await supabase
          .from('organization_drug_usage_history')
          .select(`
            *,
            organization_drug_inventory(drug_name)
          `)
          .eq('organization_id', organizationId)
          .order('dispensed_date', { ascending: false })
          .limit(limit);

        console.log('📊 Organization query result:', { error, dataCount: data?.length });

        if (error) {
          console.error('❌ Error fetching organization dispensing history:', error);
          return { data: null, error: error.message };
        }

        console.log('📊 Raw organization dispensing data:', data?.length, 'records');
        console.log('📊 Organization dispensing record IDs:', data?.map(r => r.id));

        const enrichedData = data?.map(record => ({
          ...record,
          drug_name: record.organization_drug_inventory?.drug_name,
          patient_name: record.patient_info?.patient_name,
          primary_diagnosis: record.patient_info?.primary_diagnosis
        }));

        console.log('📊 Enriched organization dispensing data:', enrichedData?.length, 'records');
        return { data: enrichedData || [], error: null };
      } else {
        console.log('🔍 Fetching individual dispensing history for user:', user.id);

        // Get individual dispensing history with left join (to include records even without inventory match)
        const { data, error } = await supabase
          .from('drug_usage_history')
          .select(`
            *,
            user_drug_inventory(drug_name)
          `)
          .eq('user_id', user.id)
          .order('dispensed_date', { ascending: false })
          .limit(limit);

        console.log('📊 Individual query result:', { error, dataCount: data?.length });

        if (error) {
          return { data: null, error: error.message };
        }

        const enrichedData = data?.map(record => ({
          ...record,
          drug_name: record.user_drug_inventory?.drug_name,
          patient_name: record.patient_info?.patient_name,
          primary_diagnosis: record.patient_info?.primary_diagnosis
        }));

        return { data: enrichedData || [], error: null };
      }
    } catch (error) {
      console.error('Error fetching dispensing history:', error);
      return { data: null, error: 'Failed to fetch dispensing history' };
    }
  }

  // Delete dispensing record based on active mode
  static async deleteDispensing(
    recordId: string,
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    success: boolean;
    error: string | null;
    mode: 'individual' | 'organization';
  }> {
    console.log('🗑️ ModeAwareDrugDispensingService.deleteDispensing called with:', { recordId, activeMode, organizationId });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User not authenticated', mode: 'individual' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Delete organization dispensing record
        console.log('Deleting organization dispensing record:', recordId);

        // First check if the record exists
        const { data: existingRecord, error: checkError } = await supabase
          .from('organization_drug_usage_history')
          .select('*')
          .eq('id', recordId)
          .eq('organization_id', organizationId)
          .single();

        if (checkError) {
          console.error('❌ Error checking organization record existence:', checkError);
          if (checkError.code === 'PGRST116') {
            console.log('🔍 Record not found in organization_drug_usage_history table. Checking if it exists in individual table...');

            // Check if the record exists in individual table instead
            const { data: individualRecord, error: individualError } = await supabase
              .from('drug_usage_history')
              .select('*')
              .eq('id', recordId)
              .single();

            if (!individualError && individualRecord) {
              console.log('⚠️ Found record in individual table but trying to delete from organization table!', individualRecord);
              return { success: false, error: 'Record exists in individual table, not organization table. This indicates a data consistency issue.', mode: 'organization' };
            }

            return { success: false, error: 'Record not found in either table', mode: 'organization' };
          }
          return { success: false, error: checkError.message, mode: 'organization' };
        }

        console.log('✅ Found organization record to delete:', existingRecord);

        // Record this deletion in inventory usage history for tracking
        try {
          // Get drug name for the usage record
          const { data: drugData } = await supabase
            .from('organization_drug_inventory')
            .select('drug_name')
            .eq('id', existingRecord.drug_id)
            .eq('organization_id', organizationId)
            .single();

          const drugName = drugData?.drug_name || 'Unknown Drug';
          const notes = existingRecord.notes ?
            `Patient: ${existingRecord.patient_info?.patient_name || 'Unknown'} | Diagnosis: ${existingRecord.patient_info?.primary_diagnosis || 'Unknown'} | Quantity: ${existingRecord.quantity_dispensed} | Notes: ${existingRecord.notes}` :
            `Patient: ${existingRecord.patient_info?.patient_name || 'Unknown'} | Diagnosis: ${existingRecord.patient_info?.primary_diagnosis || 'Unknown'} | Quantity: ${existingRecord.quantity_dispensed}`;

          // Use the new service to record usage
          const { success, error: usageError } = await OrganizationInventoryUsageService.recordInventoryUsage(
            organizationId,
            existingRecord.drug_id,
            drugName,
            existingRecord.quantity_dispensed,
            'dispensing_record_deleted',
            existingRecord.id,
            existingRecord.patient_info?.patient_name || 'Unknown',
            notes
          );

          if (!success) {
            console.error('Error recording organization usage history:', usageError);
          } else {
            console.log('Successfully recorded organization usage history for deletion');
          }
        } catch (usageTrackingError) {
          console.error('Failed to record organization usage tracking:', usageTrackingError);
        }

        // Reduce inventory quantity when deleting dispensing records
        // This represents final consumption of the dispensed drugs
        if (existingRecord.drug_id) {
          try {
            console.log(`🔄 Reducing ${existingRecord.quantity_dispensed} units from organization inventory for drug ID: ${existingRecord.drug_id}`);

            // First get current available quantity
            const { data: currentInventory, error: fetchError } = await supabase
              .from('organization_drug_inventory')
              .select('available_quantity')
              .eq('id', existingRecord.drug_id)
              .eq('organization_id', organizationId)
              .single();

            if (fetchError) {
              console.error('❌ Error fetching current organization inventory:', fetchError);
            } else if (currentInventory) {
              const newQuantity = Math.max(0, currentInventory.available_quantity - existingRecord.quantity_dispensed);

              const { data: updateResult, error: updateError } = await supabase
                .from('organization_drug_inventory')
                .update({
                  available_quantity: newQuantity
                })
                .eq('id', existingRecord.drug_id)
                .eq('organization_id', organizationId)
                .select('drug_name, available_quantity');

              if (updateError) {
                console.error('❌ Error reducing organization inventory:', updateError);
              } else {
                console.log('✅ Successfully reduced organization inventory:', updateResult);
                console.log(`🔄 Organization inventory reduced: ${currentInventory.available_quantity} - ${existingRecord.quantity_dispensed} = ${newQuantity}`);
              }
            }
          } catch (inventoryError) {
            console.error('❌ Failed to reduce organization inventory:', inventoryError);
          }
        }

        // Delete the record
        const { data: deletedData, error: deleteError, count } = await supabase
          .from('organization_drug_usage_history')
          .delete()
          .eq('id', recordId)
          .eq('organization_id', organizationId)
          .select();

        if (deleteError) {
          console.error('❌ Error deleting organization dispensing record:', deleteError);
          return { success: false, error: deleteError.message, mode: 'organization' };
        }

        console.log('🔄 Delete operation completed. Affected rows:', deletedData?.length || 0);
        console.log('🔄 Deleted data:', deletedData);

        // Verify the record is actually gone
        const { data: verifyRecord, error: verifyError } = await supabase
          .from('organization_drug_usage_history')
          .select('id')
          .eq('id', recordId)
          .eq('organization_id', organizationId)
          .single();

        if (!verifyError && verifyRecord) {
          console.error('⚠️ CRITICAL: Record still exists after delete operation!', verifyRecord);
          return { success: false, error: 'Delete operation failed - record still exists. This may be a database permission or RLS policy issue.', mode: 'organization' };
        } else if (verifyError && verifyError.code === 'PGRST116') {
          console.log('✅ Verified: Record successfully deleted from database');
        } else if (verifyError) {
          console.warn('⚠️ Could not verify deletion due to error:', verifyError);
        }

        console.log('✅ Organization dispensing record deleted successfully');
        return { success: true, error: null, mode: 'organization' };
      } else {
        // Delete individual dispensing record
        console.log('Deleting individual dispensing record:', recordId);

        // First check if the record exists
        const { data: existingRecord, error: checkError } = await supabase
          .from('drug_usage_history')
          .select('*')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single();

        if (checkError) {
          console.error('❌ Error checking individual record existence:', checkError);
          if (checkError.code === 'PGRST116') {
            return { success: false, error: 'Record not found', mode: 'individual' };
          }
          return { success: false, error: checkError.message, mode: 'individual' };
        }

        console.log('✅ Found individual record to delete:', existingRecord);

        // Record this deletion in inventory usage history for tracking
        try {
          // Get drug name for the usage record
          const { data: drugData } = await supabase
            .from('user_drug_inventory')
            .select('drug_name')
            .eq('id', existingRecord.drug_id)
            .eq('user_id', user.id)
            .single();

          const drugName = drugData?.drug_name || 'Unknown Drug';
          const notes = existingRecord.notes ?
            `Patient: ${existingRecord.patient_info?.patient_name || 'Unknown'} | Diagnosis: ${existingRecord.patient_info?.primary_diagnosis || 'Unknown'} | Quantity: ${existingRecord.quantity_dispensed} | Notes: ${existingRecord.notes}` :
            `Patient: ${existingRecord.patient_info?.patient_name || 'Unknown'} | Diagnosis: ${existingRecord.patient_info?.primary_diagnosis || 'Unknown'} | Quantity: ${existingRecord.quantity_dispensed}`;

          // Use the InventoryUsageService to record usage
          const { success, error: usageError } = await InventoryUsageService.recordInventoryUsage(
            existingRecord.drug_id,
            drugName,
            existingRecord.quantity_dispensed,
            'dispensing_record_deleted',
            existingRecord.id,
            existingRecord.patient_info?.patient_name || 'Unknown',
            notes
          );

          if (!success) {
            console.error('Error recording individual usage history:', usageError);
          } else {
            console.log('Successfully recorded individual usage history for deletion');
          }
        } catch (usageTrackingError) {
          console.error('Failed to record individual usage tracking:', usageTrackingError);
        }

        // Reduce inventory quantity when deleting dispensing records
        // This represents final consumption of the dispensed drugs
        if (existingRecord.drug_id) {
          try {
            console.log(`🔄 Reducing ${existingRecord.quantity_dispensed} units from individual inventory for drug ID: ${existingRecord.drug_id}`);

            // First get current available quantity
            const { data: currentInventory, error: fetchError } = await supabase
              .from('user_drug_inventory')
              .select('available_quantity')
              .eq('id', existingRecord.drug_id)
              .eq('user_id', user.id)
              .single();

            if (fetchError) {
              console.error('❌ Error fetching current individual inventory:', fetchError);
            } else if (currentInventory) {
              const newQuantity = Math.max(0, currentInventory.available_quantity - existingRecord.quantity_dispensed);

              const { data: updateResult, error: updateError } = await supabase
                .from('user_drug_inventory')
                .update({
                  available_quantity: newQuantity
                })
                .eq('id', existingRecord.drug_id)
                .eq('user_id', user.id)
                .select('drug_name, available_quantity');

              if (updateError) {
                console.error('❌ Error reducing individual inventory:', updateError);
              } else {
                console.log('✅ Successfully reduced individual inventory:', updateResult);
                console.log(`🔄 Individual inventory reduced: ${currentInventory.available_quantity} - ${existingRecord.quantity_dispensed} = ${newQuantity}`);
              }
            }
          } catch (inventoryError) {
            console.error('❌ Failed to reduce individual inventory:', inventoryError);
          }
        }

        // Delete the record
        const { data: deletedData, error: deleteError } = await supabase
          .from('drug_usage_history')
          .delete()
          .eq('id', recordId)
          .eq('user_id', user.id)
          .select();

        if (deleteError) {
          console.error('❌ Error deleting individual dispensing record:', deleteError);
          return { success: false, error: deleteError.message, mode: 'individual' };
        }

        console.log('🔄 Delete operation completed. Affected rows:', deletedData?.length || 0);
        console.log('🔄 Deleted data:', deletedData);

        // Verify the record is actually gone
        const { data: verifyRecord, error: verifyError } = await supabase
          .from('drug_usage_history')
          .select('id')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single();

        if (!verifyError && verifyRecord) {
          console.error('⚠️ CRITICAL: Record still exists after delete operation!', verifyRecord);
          return { success: false, error: 'Delete operation failed - record still exists. This may be a database permission or RLS policy issue.', mode: 'individual' };
        } else if (verifyError && verifyError.code === 'PGRST116') {
          console.log('✅ Verified: Record successfully deleted from database');
        } else if (verifyError) {
          console.warn('⚠️ Could not verify deletion due to error:', verifyError);
        }

        console.log('✅ Individual dispensing record deleted successfully');
        return { success: true, error: null, mode: 'individual' };
      }
    } catch (error) {
      console.error('❌ Exception in deleteDispensing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete dispensing record',
        mode: 'individual'
      };
    }
  }

  // Get dispensing statistics for a specific time period (mode-aware)
  static async getDispensingSummary(
    activeMode: UserWorkingMode,
    organizationId: string | null,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{ data: DispensingStats | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Calculate date range based on period
    const now = new Date();
    let dateFrom: Date;

    switch (period) {
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'quarter':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'year':
        dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
    }

    return this.getDispensingStats(
      activeMode,
      organizationId,
      dateFrom.toISOString(),
      now.toISOString()
    );
  }

  // Get dispensing statistics (mode-aware)
  static async getDispensingStats(
    activeMode: UserWorkingMode,
    organizationId: string | null,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ data: DispensingStats | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let baseQuery;

      if (activeMode === 'organization' && organizationId) {
        // Organization mode - query organization_drug_usage_history
        baseQuery = supabase
          .from('organization_drug_usage_history')
          .select(`
            *,
            organization_drug_inventory!inner(
              drug_name,
              unit_price
            ),
            organization_diagnoses(
              patient_name,
              primary_diagnosis
            )
          `)
          .eq('organization_id', organizationId);
      } else {
        // Individual mode - query drug_usage_history
        baseQuery = supabase
          .from('drug_usage_history')
          .select(`
            *,
            user_drug_inventory!inner(
              drug_name,
              unit_price
            ),
            diagnoses(
              patient_name,
              primary_diagnosis
            )
          `)
          .eq('user_id', user.id);
      }

      if (dateFrom) {
        baseQuery = baseQuery.gte('dispensed_date', dateFrom);
      }
      if (dateTo) {
        baseQuery = baseQuery.lte('dispensed_date', dateTo);
      }

      const { data: history, error: historyError } = await baseQuery;

      if (historyError) {
        throw historyError;
      }

      if (!history || history.length === 0) {
        return {
          data: {
            total_dispensed: 0,
            unique_drugs: 0,
            unique_patients: 0,
            total_value: 0,
            top_drugs: [],
            recent_activity: []
          },
          error: null
        };
      }

      // Calculate statistics
      const totalDispensed = history.reduce((sum, record) => sum + (record.quantity_dispensed || 0), 0);

      // Get unique drugs
      const uniqueDrugs = new Set();
      history.forEach(record => {
        const drugName = activeMode === 'organization'
          ? record.organization_drug_inventory?.drug_name
          : record.user_drug_inventory?.drug_name;
        if (drugName) uniqueDrugs.add(drugName);
      });

      // Get unique patients
      const uniquePatients = new Set();
      history.forEach(record => {
        const patientName = activeMode === 'organization'
          ? record.organization_diagnoses?.patient_name
          : record.diagnoses?.patient_name;
        if (patientName && patientName !== 'No patient specified') {
          uniquePatients.add(patientName);
        }
      });

      // Calculate total value
      const totalValue = history.reduce((sum, record) => {
        const unitPrice = activeMode === 'organization'
          ? record.organization_drug_inventory?.unit_price
          : record.user_drug_inventory?.unit_price;
        const quantity = record.quantity_dispensed || 0;
        return sum + ((unitPrice || 0) * quantity);
      }, 0);

      // Calculate top drugs
      const drugStats = new Map();
      history.forEach(record => {
        const drugName = activeMode === 'organization'
          ? record.organization_drug_inventory?.drug_name
          : record.user_drug_inventory?.drug_name;

        if (drugName) {
          if (!drugStats.has(drugName)) {
            drugStats.set(drugName, { total_packs: 0, total_tablets: 0, total_dispensings: 0 });
          }
          const stats = drugStats.get(drugName);

          // Parse the actual dispensed amounts from notes
          const dispensed = parseDispenseInfoFromNotes(record.notes || '', record.quantity_dispensed);
          stats.total_packs += dispensed.packs;
          stats.total_tablets += dispensed.tablets;
          stats.total_dispensings += 1;
        }
      });

      const topDrugs = Array.from(drugStats.entries())
        .map(([drug_name, stats]) => ({
          drug_name,
          total_packs: stats.total_packs,
          total_tablets: stats.total_tablets,
          total_quantity: stats.total_packs + stats.total_tablets, // For backward compatibility and sorting
          total_dispensings: stats.total_dispensings
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 5);

      // Recent activity (last 5 records)
      const recentActivity = history
        .sort((a, b) => new Date(b.dispensed_date).getTime() - new Date(a.dispensed_date).getTime())
        .slice(0, 5)
        .map(record => ({
          id: record.id,
          drug_name: activeMode === 'organization'
            ? record.organization_drug_inventory?.drug_name
            : record.user_drug_inventory?.drug_name,
          patient_name: activeMode === 'organization'
            ? record.organization_diagnoses?.patient_name
            : record.diagnoses?.patient_name,
          quantity_dispensed: record.quantity_dispensed,
          dispensed_date: record.dispensed_date,
          primary_diagnosis: activeMode === 'organization'
            ? record.organization_diagnoses?.primary_diagnosis
            : record.diagnoses?.primary_diagnosis
        }));

      return {
        data: {
          total_dispensed: totalDispensed,
          unique_drugs: uniqueDrugs.size,
          unique_patients: uniquePatients.size,
          total_value: totalValue,
          top_drugs: topDrugs,
          recent_activity: recentActivity
        },
        error: null
      };

    } catch (error) {
      console.error('Error calculating dispensing stats:', error);
      return { data: null, error: error.message };
    }
  }
}