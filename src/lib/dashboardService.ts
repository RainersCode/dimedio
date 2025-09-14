import { supabase } from './supabase';
import { ModeAwareDrugInventoryService } from './modeAwareDrugInventoryService';
import { ModeAwarePatientService } from './modeAwarePatientService';
import { ModeAwareDiagnosisService } from './modeAwareDiagnosisService';
import type { UserWorkingMode } from '@/contexts/UserModeContext';

export interface DashboardStats {
  // Core metrics
  totalPatients: number;
  totalDiagnoses: number;
  totalDrugs: number;
  recentDiagnoses: number; // Last 7 days

  // Drug inventory insights
  lowStockDrugs: number;
  expiredDrugs: number;
  totalDrugValue: number;

  // Patient insights
  newPatientsThisMonth: number;
  averagePatientAge: number;
  genderDistribution: { male: number; female: number; other: number };

  // Diagnosis insights
  diagnosesThisMonth: number;
  topDiagnoses: Array<{ diagnosis: string; count: number }>;
  urgentCases: number;

  // Mode-specific data
  mode: 'individual' | 'organization';
  organizationName?: string;
  userRole?: string;
}

export interface DashboardActivity {
  id: string;
  type: 'diagnosis' | 'patient' | 'inventory' | 'organization';
  title: string;
  description: string;
  timestamp: string;
  urgency?: 'low' | 'medium' | 'high';
  icon: string;
}

export class DashboardService {
  // Get comprehensive dashboard statistics based on active mode
  static async getDashboardStats(
    activeMode: UserWorkingMode,
    organizationId?: string | null
  ): Promise<{
    data: DashboardStats | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let stats: DashboardStats;

      if (activeMode === 'organization' && organizationId) {
        stats = await this.getOrganizationStats(organizationId, user.id);
      } else {
        stats = await this.getIndividualStats(user.id);
      }

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return { data: null, error: 'Failed to fetch dashboard statistics' };
    }
  }

  // Get recent activities based on active mode
  static async getRecentActivities(
    activeMode: UserWorkingMode,
    organizationId?: string | null,
    limit = 10
  ): Promise<{
    data: DashboardActivity[] | null;
    error: string | null;
  }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      let activities: DashboardActivity[];

      if (activeMode === 'organization' && organizationId) {
        activities = await this.getOrganizationActivities(organizationId, limit);
      } else {
        activities = await this.getIndividualActivities(user.id, limit);
      }

      return { data: activities, error: null };
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return { data: null, error: 'Failed to fetch recent activities' };
    }
  }

  // Get organization-specific dashboard stats
  private static async getOrganizationStats(organizationId: string, userId: string): Promise<DashboardStats> {
    // Get organization info
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const { data: memberData } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single();

    // Parallel queries for all stats
    const [
      diagnosesQuery,
      patientsQuery,
      drugInventoryQuery,
      recentDiagnosesQuery,
      newPatientsQuery
    ] = await Promise.all([
      // Total diagnoses
      supabase
        .from('organization_diagnoses')
        .select('id, primary_diagnosis, urgency_level, created_at')
        .eq('organization_id', organizationId),

      // Total patients
      supabase
        .from('organization_patients')
        .select('id, gender, date_of_birth, created_at')
        .eq('organization_id', organizationId),

      // Drug inventory
      supabase
        .from('organization_drug_inventory')
        .select('id, quantity, unit_price, expiry_date')
        .eq('organization_id', organizationId)
        .eq('is_active', true),

      // Recent diagnoses (last 7 days)
      supabase
        .from('organization_diagnoses')
        .select('id')
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // New patients this month
      supabase
        .from('organization_patients')
        .select('id')
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    ]);

    // Process the data
    const diagnoses = diagnosesQuery.data || [];
    const patients = patientsQuery.data || [];
    const drugs = drugInventoryQuery.data || [];

    // Calculate derived metrics
    const now = new Date();
    const lowStockDrugs = drugs.filter(drug => drug.quantity < 10).length;
    const expiredDrugs = drugs.filter(drug => drug.expiry_date && new Date(drug.expiry_date) < now).length;
    const totalDrugValue = drugs.reduce((sum, drug) => sum + (drug.quantity * (drug.unit_price || 0)), 0);

    // Gender distribution
    const genderDistribution = patients.reduce(
      (acc, patient) => {
        const gender = patient.gender?.toLowerCase() || 'other';
        if (gender === 'male') acc.male++;
        else if (gender === 'female') acc.female++;
        else acc.other++;
        return acc;
      },
      { male: 0, female: 0, other: 0 }
    );

    // Average age calculation
    const patientsWithAge = patients.filter(p => p.date_of_birth);
    const averagePatientAge = patientsWithAge.length > 0
      ? patientsWithAge.reduce((sum, p) => {
          const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
          return sum + age;
        }, 0) / patientsWithAge.length
      : 0;

    // Top diagnoses
    const diagnosisCounts: { [key: string]: number } = {};
    diagnoses.forEach(d => {
      if (d.primary_diagnosis) {
        diagnosisCounts[d.primary_diagnosis] = (diagnosisCounts[d.primary_diagnosis] || 0) + 1;
      }
    });

    const topDiagnoses = Object.entries(diagnosisCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([diagnosis, count]) => ({ diagnosis, count }));

    // Urgent cases
    const urgentCases = diagnoses.filter(d => d.urgency_level === 'high' || d.urgency_level === 'urgent').length;

    // Diagnoses this month
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const diagnosesThisMonth = diagnoses.filter(d => new Date(d.created_at) >= thisMonth).length;

    return {
      totalPatients: patients.length,
      totalDiagnoses: diagnoses.length,
      totalDrugs: drugs.length,
      recentDiagnoses: recentDiagnosesQuery.data?.length || 0,
      lowStockDrugs,
      expiredDrugs,
      totalDrugValue,
      newPatientsThisMonth: newPatientsQuery.data?.length || 0,
      averagePatientAge: Math.round(averagePatientAge),
      genderDistribution,
      diagnosesThisMonth,
      topDiagnoses,
      urgentCases,
      mode: 'organization',
      organizationName: orgData?.name,
      userRole: memberData?.role
    };
  }

  // Get individual user dashboard stats
  private static async getIndividualStats(userId: string): Promise<DashboardStats> {
    // Parallel queries for all stats
    const [
      diagnosesQuery,
      patientsQuery,
      drugInventoryQuery,
      recentDiagnosesQuery,
      newPatientsQuery
    ] = await Promise.all([
      // Total diagnoses
      supabase
        .from('diagnoses')
        .select('id, primary_diagnosis, urgency_level, created_at')
        .eq('user_id', userId),

      // Total patients
      supabase
        .from('patients')
        .select('id, gender, date_of_birth, created_at')
        .eq('user_id', userId),

      // Drug inventory
      supabase
        .from('user_drug_inventory')
        .select('id, quantity, unit_price, expiry_date')
        .eq('user_id', userId)
        .eq('is_active', true),

      // Recent diagnoses (last 7 days)
      supabase
        .from('diagnoses')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // New patients this month
      supabase
        .from('patients')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    ]);

    // Process the data (same logic as organization but for individual tables)
    const diagnoses = diagnosesQuery.data || [];
    const patients = patientsQuery.data || [];
    const drugs = drugInventoryQuery.data || [];

    // Calculate derived metrics
    const now = new Date();
    const lowStockDrugs = drugs.filter(drug => drug.quantity < 10).length;
    const expiredDrugs = drugs.filter(drug => drug.expiry_date && new Date(drug.expiry_date) < now).length;
    const totalDrugValue = drugs.reduce((sum, drug) => sum + (drug.quantity * (drug.unit_price || 0)), 0);

    // Gender distribution
    const genderDistribution = patients.reduce(
      (acc, patient) => {
        const gender = patient.gender?.toLowerCase() || 'other';
        if (gender === 'male') acc.male++;
        else if (gender === 'female') acc.female++;
        else acc.other++;
        return acc;
      },
      { male: 0, female: 0, other: 0 }
    );

    // Average age calculation
    const patientsWithAge = patients.filter(p => p.date_of_birth);
    const averagePatientAge = patientsWithAge.length > 0
      ? patientsWithAge.reduce((sum, p) => {
          const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
          return sum + age;
        }, 0) / patientsWithAge.length
      : 0;

    // Top diagnoses
    const diagnosisCounts: { [key: string]: number } = {};
    diagnoses.forEach(d => {
      if (d.primary_diagnosis) {
        diagnosisCounts[d.primary_diagnosis] = (diagnosisCounts[d.primary_diagnosis] || 0) + 1;
      }
    });

    const topDiagnoses = Object.entries(diagnosisCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([diagnosis, count]) => ({ diagnosis, count }));

    // Urgent cases
    const urgentCases = diagnoses.filter(d => d.urgency_level === 'high' || d.urgency_level === 'urgent').length;

    // Diagnoses this month
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const diagnosesThisMonth = diagnoses.filter(d => new Date(d.created_at) >= thisMonth).length;

    return {
      totalPatients: patients.length,
      totalDiagnoses: diagnoses.length,
      totalDrugs: drugs.length,
      recentDiagnoses: recentDiagnosesQuery.data?.length || 0,
      lowStockDrugs,
      expiredDrugs,
      totalDrugValue,
      newPatientsThisMonth: newPatientsQuery.data?.length || 0,
      averagePatientAge: Math.round(averagePatientAge),
      genderDistribution,
      diagnosesThisMonth,
      topDiagnoses,
      urgentCases,
      mode: 'individual'
    };
  }

  // Get organization activities
  private static async getOrganizationActivities(organizationId: string, limit: number): Promise<DashboardActivity[]> {
    const { data: diagnoses } = await supabase
      .from('organization_diagnoses')
      .select('id, patient_name, primary_diagnosis, created_at, urgency_level')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (diagnoses || []).map(diagnosis => ({
      id: diagnosis.id,
      type: 'diagnosis' as const,
      title: `New diagnosis for ${diagnosis.patient_name}`,
      description: diagnosis.primary_diagnosis || 'Diagnosis completed',
      timestamp: diagnosis.created_at,
      urgency: diagnosis.urgency_level === 'high' ? 'high' : diagnosis.urgency_level === 'medium' ? 'medium' : 'low',
      icon: '🏥'
    }));
  }

  // Get individual activities
  private static async getIndividualActivities(userId: string, limit: number): Promise<DashboardActivity[]> {
    const { data: diagnoses } = await supabase
      .from('diagnoses')
      .select('id, patient_name, primary_diagnosis, created_at, urgency_level')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (diagnoses || []).map(diagnosis => ({
      id: diagnosis.id,
      type: 'diagnosis' as const,
      title: `Diagnosis completed for ${diagnosis.patient_name || 'patient'}`,
      description: diagnosis.primary_diagnosis || 'Diagnosis completed',
      timestamp: diagnosis.created_at,
      urgency: diagnosis.urgency_level === 'high' ? 'high' : diagnosis.urgency_level === 'medium' ? 'medium' : 'low',
      icon: '👤'
    }));
  }
}