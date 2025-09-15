import { supabase } from './supabase';
import { DrugDispensingService } from './drugDispensingService';
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
          const { error: updateError } = await supabase
            .from('organization_drug_inventory')
            .update({
              stock_quantity: supabase.sql`stock_quantity - ${record.quantity}`
            })
            .eq('id', record.drugId)
            .eq('organization_id', organizationId);

          if (updateError) {
            console.error('Error updating organization drug inventory:', updateError);
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
          return { data: null, error: error.message };
        }

        const enrichedData = data?.map(record => ({
          ...record,
          drug_name: record.organization_drug_inventory?.drug_name,
          patient_name: record.patient_info?.patient_name
        }));

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
}