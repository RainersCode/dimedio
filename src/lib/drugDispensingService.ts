import { supabase } from './supabase';
import type { DrugUsageHistory, UserDrugInventory } from '@/types/database';

export interface DrugDispensingRecord extends DrugUsageHistory {
  drug_name?: string;
  dosage_form?: string;
  strength?: string;
  patient_name?: string;
  primary_diagnosis?: string;
}

export interface DispensingStats {
  total_dispensed: number;
  unique_drugs: number;
  unique_patients: number;
  total_value: number;
  top_drugs: Array<{
    drug_name: string;
    total_quantity: number;
    total_dispensings: number;
  }>;
  recent_activity: DrugDispensingRecord[];
}

export class DrugDispensingService {
  // Record drug dispensing when diagnosis is made
  static async recordDispensing(
    drugId: string,
    diagnosisId: string,
    quantityDispensed: number,
    patientInfo: {
      patient_name?: string;
      patient_age?: number;
      patient_gender?: string;
      primary_diagnosis?: string;
    },
    notes?: string
  ): Promise<{ data: DrugUsageHistory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const dispensingData = {
      user_id: user.id,
      drug_id: drugId,
      diagnosis_id: diagnosisId,
      quantity_dispensed: quantityDispensed,
      patient_info: patientInfo,
      notes: notes || null,
      dispensed_date: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('drug_usage_history')
      .insert([dispensingData])
      .select()
      .single();

    if (error) {
      console.error('Error recording drug dispensing:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Record multiple drug dispensings for a diagnosis
  static async recordMultipleDispensings(
    dispensings: Array<{
      drugId: string | null;
      drugName?: string;
      quantity: number;
      notes?: string;
    }>,
    diagnosisId: string,
    patientInfo: {
      patient_name?: string;
      patient_age?: number;
      patient_gender?: string;
      primary_diagnosis?: string;
    }
  ): Promise<{ data: DrugUsageHistory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // First, create placeholder drugs for any that don't have drugId
    const processedDispensings = [];
    
    for (const dispensing of dispensings) {
      let drugId = dispensing.drugId;
      
      // If no drug ID, create a placeholder drug entry in inventory
      if (!drugId && dispensing.drugName) {
        console.log('Creating placeholder drug entry for:', dispensing.drugName);
        try {
          const { data: placeholderDrug, error: placeholderError } = await supabase
            .from('user_drug_inventory')
            .insert({
              user_id: user.id,
              drug_name: dispensing.drugName,
              generic_name: dispensing.drugName,
              dosage_form: 'Unknown',
              strength: 'Unknown',
              stock_quantity: 0,
              unit_price: 0,
              is_active: true,
              notes: 'Auto-created from diagnosis - not in original inventory'
            })
            .select()
            .single();
            
          if (!placeholderError && placeholderDrug) {
            drugId = placeholderDrug.id;
            console.log('Created placeholder drug with ID:', drugId);
          } else {
            console.error('Failed to create placeholder drug:', placeholderError);
            continue; // Skip this drug if we can't create placeholder
          }
        } catch (err) {
          console.error('Error creating placeholder drug:', err);
          continue;
        }
      }
      
      if (drugId) {
        processedDispensings.push({
          user_id: user.id,
          drug_id: drugId,
          diagnosis_id: diagnosisId,
          quantity_dispensed: dispensing.quantity,
          patient_info: {
            ...patientInfo,
            drug_name: dispensing.drugName // Store drug name in patient_info for display
          },
          notes: dispensing.notes || null,
          dispensed_date: new Date().toISOString(),
        });
      }
    }

    // Check for duplicates if diagnosisId is provided (do this even if no new drugs to record)
    if (diagnosisId) {
      console.log('🔍 Checking for existing dispensing records for diagnosis:', diagnosisId);
      const { data: existingRecords, error: checkError } = await supabase
        .from('drug_usage_history')
        .select('id, drug_id')
        .eq('user_id', user.id)
        .eq('diagnosis_id', diagnosisId);

      if (!checkError && existingRecords && existingRecords.length > 0) {
        console.warn('⚠️ Found existing dispensing records for this diagnosis:', existingRecords.length, 'records');
        console.log('🗑️ Deleting all existing records to replace with current diagnosis state...');
        
        // Delete all existing dispensing records for this diagnosis
        const { error: deleteError } = await supabase
          .from('drug_usage_history')
          .delete()
          .eq('user_id', user.id)
          .eq('diagnosis_id', diagnosisId);

        if (deleteError) {
          console.error('❌ Error deleting existing dispensing records:', deleteError);
          return { data: null, error: 'Failed to delete existing records: ' + deleteError.message };
        }
        
        console.log('✅ Successfully deleted existing dispensing records');
      }
    }

    // Only insert if we have records to insert
    if (processedDispensings.length > 0) {
      const { data, error } = await supabase
        .from('drug_usage_history')
        .insert(processedDispensings)
        .select();

      if (error) {
        console.error('Error recording multiple drug dispensings:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } else {
      // No new records to insert, but deletion was successful
      console.log('✅ No new dispensing records to insert (deletion only)');
      return { data: [], error: null };
    }
  }

  // Get dispensing history with drug and patient details
  static async getDispensingHistory(
    limit = 50, 
    offset = 0,
    filters?: {
      drugId?: string;
      patientName?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ data: DrugDispensingRecord[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    let query = supabase
      .from('drug_usage_history')
      .select(`
        *,
        user_drug_inventory(
          drug_name,
          dosage_form,
          strength,
          unit_price
        ),
        diagnoses(
          patient_name,
          primary_diagnosis
        )
      `)
      .eq('user_id', user.id)
      .order('dispensed_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters?.drugId) {
      query = query.eq('drug_id', filters.drugId);
    }
    
    if (filters?.dateFrom) {
      query = query.gte('dispensed_date', filters.dateFrom);
    }
    
    if (filters?.dateTo) {
      query = query.lte('dispensed_date', filters.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching dispensing history with joins:', error);
      
      // Fallback: try a simple query without joins
      console.log('Trying fallback query without joins...');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('drug_usage_history')
        .select('*')
        .eq('user_id', user.id)
        .order('dispensed_date', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        return { data: null, error: fallbackError.message };
      }
      
      // Process fallback data without joins
      const processedFallbackData = fallbackData?.map(record => ({
        ...record,
        drug_name: record.patient_info?.drug_name || 'Unknown Drug',
        dosage_form: null,
        strength: null,
        unit_price: null,
        patient_name: record.patient_info?.patient_name || 'Unknown Patient',
        primary_diagnosis: record.patient_info?.primary_diagnosis || 'No diagnosis',
      })) || [];

      return { data: processedFallbackData, error: null };
    }

    // Process the data to flatten the structure
    const processedData = data?.map(record => ({
      ...record,
      drug_name: record.user_drug_inventory?.drug_name || record.patient_info?.drug_name || 'Unknown Drug',
      dosage_form: record.user_drug_inventory?.dosage_form,
      strength: record.user_drug_inventory?.strength,
      unit_price: record.user_drug_inventory?.unit_price,
      patient_name: record.diagnoses?.patient_name || record.patient_info?.patient_name,
      primary_diagnosis: record.diagnoses?.primary_diagnosis || record.patient_info?.primary_diagnosis,
    })) || [];

    // Filter by patient name if specified (since it's in JSONB)
    let filteredData = processedData;
    if (filters?.patientName) {
      filteredData = processedData.filter(record => 
        record.patient_name?.toLowerCase().includes(filters.patientName!.toLowerCase())
      );
    }

    return { data: filteredData, error: null };
  }

  // Get dispensing statistics and analytics
  static async getDispensingStats(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ data: DispensingStats | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Get dispensing history with drug details
      let baseQuery = supabase
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
      const totalDispensed = history.reduce((sum, record) => sum + record.quantity_dispensed, 0);
      
      const uniqueDrugs = new Set(history.map(record => record.drug_id)).size;
      
      const uniquePatients = new Set(
        history.map(record => 
          record.diagnoses?.patient_name || record.patient_info?.patient_name
        ).filter(Boolean)
      ).size;
      
      const totalValue = history.reduce((sum, record) => {
        const unitPrice = record.user_drug_inventory?.unit_price || 0;
        return sum + (unitPrice * record.quantity_dispensed);
      }, 0);

      // Calculate top drugs
      const drugUsage = new Map();
      history.forEach(record => {
        const drugName = record.user_drug_inventory?.drug_name || 'Unknown';
        const existing = drugUsage.get(drugName) || { total_quantity: 0, total_dispensings: 0 };
        drugUsage.set(drugName, {
          drug_name: drugName,
          total_quantity: existing.total_quantity + record.quantity_dispensed,
          total_dispensings: existing.total_dispensings + 1
        });
      });

      const topDrugs = Array.from(drugUsage.values())
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 5);

      // Get recent activity (last 10 records)
      const recentActivity = history
        .sort((a, b) => new Date(b.dispensed_date).getTime() - new Date(a.dispensed_date).getTime())
        .slice(0, 10)
        .map(record => ({
          ...record,
          drug_name: record.user_drug_inventory?.drug_name,
          patient_name: record.diagnoses?.patient_name || record.patient_info?.patient_name,
          primary_diagnosis: record.diagnoses?.primary_diagnosis || record.patient_info?.primary_diagnosis,
        }));

      return {
        data: {
          total_dispensed: totalDispensed,
          unique_drugs: uniqueDrugs,
          unique_patients: uniquePatients,
          total_value: Math.round(totalValue * 100) / 100, // Round to 2 decimal places
          top_drugs: topDrugs,
          recent_activity: recentActivity
        },
        error: null
      };
    } catch (error) {
      console.error('Error calculating dispensing stats:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to calculate statistics' 
      };
    }
  }

  // Get low stock drugs that have been dispensed recently
  static async getLowStockAlerts(): Promise<{ data: UserDrugInventory[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_drug_inventory')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('stock_quantity', 10) // Alert when stock is 10 or less
      .order('stock_quantity', { ascending: true });

    if (error) {
      console.error('Error fetching low stock alerts:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get dispensing summary for a specific time period
  static async getDispensingSummary(
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{ data: any | null; error: string | null }> {
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

    return this.getDispensingStats(dateFrom.toISOString(), now.toISOString());
  }

  // Remove duplicate dispensing records for the current user
  static async removeDuplicateDispensings(): Promise<{ success: boolean; duplicatesRemoved: number; error: string | null }> {
    console.log('🔍 Starting duplicate removal process...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, duplicatesRemoved: 0, error: 'User not authenticated' };
    }

    try {
      // Get all dispensing records grouped by diagnosis and drug
      const { data: allRecords, error: fetchError } = await supabase
        .from('drug_usage_history')
        .select('*')
        .eq('user_id', user.id)
        .order('dispensed_date', { ascending: true }); // Keep the earliest record

      if (fetchError) {
        return { success: false, duplicatesRemoved: 0, error: fetchError.message };
      }

      if (!allRecords || allRecords.length === 0) {
        return { success: true, duplicatesRemoved: 0, error: null };
      }

      // Group records by diagnosis_id + drug_id to find duplicates
      const recordGroups = new Map();
      
      allRecords.forEach(record => {
        const key = `${record.diagnosis_id || 'null'}_${record.drug_id || 'null'}`;
        if (!recordGroups.has(key)) {
          recordGroups.set(key, []);
        }
        recordGroups.get(key).push(record);
      });

      // Find duplicate groups (more than 1 record per key)
      const duplicatesToDelete = [];
      let duplicatesFound = 0;

      recordGroups.forEach((records, key) => {
        if (records.length > 1) {
          console.log(`🔍 Found ${records.length} duplicates for key: ${key}`);
          duplicatesFound += records.length - 1; // Count all but the first (which we keep)
          
          // Keep the first record, delete the rest
          const toDelete = records.slice(1);
          duplicatesToDelete.push(...toDelete.map(r => r.id));
        }
      });

      if (duplicatesToDelete.length === 0) {
        console.log('✅ No duplicates found');
        return { success: true, duplicatesRemoved: 0, error: null };
      }

      console.log(`🗑️ Removing ${duplicatesToDelete.length} duplicate records...`);

      // Delete the duplicate records
      const { error: deleteError } = await supabase
        .from('drug_usage_history')
        .delete()
        .in('id', duplicatesToDelete);

      if (deleteError) {
        console.error('❌ Error deleting duplicates:', deleteError);
        return { success: false, duplicatesRemoved: 0, error: deleteError.message };
      }

      console.log(`✅ Successfully removed ${duplicatesToDelete.length} duplicate records`);
      return { success: true, duplicatesRemoved: duplicatesToDelete.length, error: null };

    } catch (error) {
      console.error('❌ Exception in removeDuplicateDispensings:', error);
      return { 
        success: false, 
        duplicatesRemoved: 0,
        error: error instanceof Error ? error.message : 'Failed to remove duplicates' 
      };
    }
  }

  // Delete all dispensing history for the current user
  static async clearAllDispensingHistory(): Promise<{ success: boolean; error: string | null }> {
    console.log('🗑️ Starting clearAllDispensingHistory...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ User not authenticated:', authError);
      return { success: false, error: 'User not authenticated' };
    }

    console.log('✅ User authenticated:', user.id);

    try {
      // First check how many records exist
      const { count, error: countError } = await supabase
        .from('drug_usage_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) {
        console.error('❌ Error counting records:', countError);
      } else {
        console.log('📊 Records to delete:', count);
      }

      const { data, error } = await supabase
        .from('drug_usage_history')
        .delete()
        .eq('user_id', user.id)
        .select(); // Add select to see what was deleted

      console.log('🔍 Delete operation result:', { data, error });

      if (error) {
        console.error('❌ Error clearing dispensing history:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Successfully cleared dispensing history. Deleted records:', data?.length || 0);
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ Exception in clearAllDispensingHistory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear dispensing history' 
      };
    }
  }

  // Delete a specific dispensing record
  static async deleteDispensingRecord(recordId: string): Promise<{ success: boolean; error: string | null }> {
    console.log('🗑️ Starting deleteDispensingRecord for ID:', recordId);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ User not authenticated:', authError);
      return { success: false, error: 'User not authenticated' };
    }

    console.log('✅ User authenticated:', user.id);

    try {
      // First check if the record exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('drug_usage_history')
        .select('*')
        .eq('id', recordId)
        .eq('user_id', user.id)
        .single();

      if (checkError) {
        console.error('❌ Error checking record existence:', checkError);
        return { success: false, error: 'Record not found or access denied' };
      }

      console.log('📋 Record to delete found:', existingRecord);

      const { data, error } = await supabase
        .from('drug_usage_history')
        .delete()
        .eq('id', recordId)
        .eq('user_id', user.id)
        .select(); // Add select to see what was deleted

      console.log('🔍 Delete operation result:', { data, error });

      if (error) {
        console.error('❌ Error deleting dispensing record:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Successfully deleted dispensing record. Deleted:', data?.length || 0, 'records');
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ Exception in deleteDispensingRecord:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete dispensing record' 
      };
    }
  }

  // Test method to check database permissions
  static async testDatabasePermissions(): Promise<{ results: any; error: string | null }> {
    console.log('🧪 Testing database permissions...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { results: null, error: 'User not authenticated' };
    }

    const results = {
      user_id: user.id,
      canSelect: false,
      canInsert: false,
      canUpdate: false,
      canDelete: false,
      recordCount: 0,
      sampleRecord: null,
      errors: []
    };

    try {
      // Test SELECT
      const { data: selectData, error: selectError } = await supabase
        .from('drug_usage_history')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);
      
      if (selectError) {
        results.errors.push(`SELECT error: ${selectError.message}`);
      } else {
        results.canSelect = true;
        results.sampleRecord = selectData?.[0] || null;
      }

      // Count records
      const { count, error: countError } = await supabase
        .from('drug_usage_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (!countError) {
        results.recordCount = count || 0;
      }

      console.log('🔍 Database permission test results:', results);
      return { results, error: null };
    } catch (error) {
      console.error('❌ Error testing database permissions:', error);
      return { results, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Debug method to create a test dispensing record
  static async createTestDispensingRecord(): Promise<{ data: DrugUsageHistory | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Get the first drug from inventory for testing
    const { data: firstDrug, error: drugError } = await supabase
      .from('user_drug_inventory')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (drugError || !firstDrug) {
      return { data: null, error: 'No drugs found in inventory for testing' };
    }

    // Create a test dispensing record
    const testRecord = {
      user_id: user.id,
      drug_id: firstDrug.id,
      diagnosis_id: null, // Test without diagnosis
      quantity_dispensed: 1,
      patient_info: {
        patient_name: 'Test Patient',
        primary_diagnosis: 'Test Diagnosis'
      },
      notes: 'Test dispensing record',
      dispensed_date: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('drug_usage_history')
      .insert([testRecord])
      .select()
      .single();

    if (error) {
      console.error('Error creating test dispensing record:', error);
      return { data: null, error: error.message };
    }

    console.log('Created test dispensing record:', data);
    return { data, error: null };
  }
}