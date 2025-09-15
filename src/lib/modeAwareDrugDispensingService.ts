import { supabase } from './supabase';
import { DrugDispensingService } from './drugDispensingService';
import { OrganizationInventoryUsageService } from './organizationInventoryUsageService';
import type { UserWorkingMode } from '@/contexts/MultiOrgUserModeContext';
import type { DrugUsageHistory } from '@/types/database';
import type { OrganizationDrugUsageHistory } from '@/types/organization';

export interface ModeAwareDispensingRecord {
  drugId: string | null;
  drugName: string;
  quantity: number;
  notes?: string;
}

export class ModeAwareDrugDispensingService {
  // Record drug dispensing based on active mode
  static async recordDispensing(
    dispensingRecords: ModeAwareDispensingRecord[],
    diagnosisId: string,
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
    diagnosisId: string,
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

    // Check for duplicates if not skipping
    if (!skipDuplicateCheck) {
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

        // Update organization drug inventory stock
        try {
          // First get current stock quantity
          const { data: currentInventory, error: fetchError } = await supabase
            .from('organization_drug_inventory')
            .select('stock_quantity')
            .eq('id', record.drugId)
            .eq('organization_id', organizationId)
            .single();

          if (fetchError) {
            console.error('Error fetching current organization inventory:', fetchError);
          } else if (currentInventory) {
            const newQuantity = Math.max(0, currentInventory.stock_quantity - record.quantity);

            const { error: updateError } = await supabase
              .from('organization_drug_inventory')
              .update({
                stock_quantity: newQuantity
              })
              .eq('id', record.drugId)
              .eq('organization_id', organizationId);

            if (updateError) {
              console.error('Error updating organization drug inventory:', updateError);
            } else {
              console.log(`Updated organization inventory: ${currentInventory.stock_quantity} - ${record.quantity} = ${newQuantity}`);
            }
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
    })[] | null;
    error: string | null
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      if (activeMode === 'organization' && organizationId) {
        // Get organization dispensing history
        const { data, error } = await supabase
          .from('organization_drug_usage_history')
          .select(`
            *,
            organization_drug_inventory!inner(drug_name)
          `)
          .eq('organization_id', organizationId)
          .order('dispensed_date', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('❌ Error fetching organization dispensing history:', error);
          return { data: null, error: error.message };
        }

        console.log('📊 Raw organization dispensing data:', data?.length, 'records');
        console.log('📊 Organization dispensing record IDs:', data?.map(r => r.id));

        const enrichedData = data?.map(record => ({
          ...record,
          drug_name: record.organization_drug_inventory?.drug_name,
          patient_name: record.patient_info?.patient_name
        }));

        console.log('📊 Enriched organization dispensing data:', enrichedData?.length, 'records');
        return { data: enrichedData || [], error: null };
      } else {
        // Get individual dispensing history (existing logic)
        const { data, error } = await supabase
          .from('drug_usage_history')
          .select(`
            *,
            user_drug_inventory!inner(drug_name)
          `)
          .eq('user_id', user.id)
          .order('dispensed_date', { ascending: false })
          .limit(limit);

        if (error) {
          return { data: null, error: error.message };
        }

        const enrichedData = data?.map(record => ({
          ...record,
          drug_name: record.user_drug_inventory?.drug_name,
          patient_name: record.patient_info?.patient_name
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

        // Note: We do NOT restore inventory quantity when deleting dispensing records
        // because deletion represents actual drug consumption/usage
        // The inventory was already reduced when the drug was dispensed
        console.log('Drug deletion represents consumption - inventory remains reduced');

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

        // Note: We do NOT restore inventory quantity when deleting dispensing records
        // because deletion represents actual drug consumption/usage
        // The inventory was already reduced when the drug was dispensed
        console.log('Drug deletion represents consumption - inventory remains reduced');

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
}