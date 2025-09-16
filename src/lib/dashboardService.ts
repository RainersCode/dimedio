import { supabase } from './supabase';
import { ModeAwareDrugInventoryService } from './modeAwareDrugInventoryService';
import { ModeAwarePatientService } from './modeAwarePatientService';
import { ModeAwareDiagnosisService } from './modeAwareDiagnosisService';
import type { UserWorkingMode } from '@/contexts/MultiOrgUserModeContext';

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

  // Get organization-specific dashboard stats using mode-aware services
  private static async getOrganizationStats(organizationId: string, userId: string): Promise<DashboardStats> {
    try {
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

      // Use mode-aware services instead of direct database queries
      const [
        patientsResult,
        diagnosesResult,
        inventoryResult
      ] = await Promise.all([
        ModeAwarePatientService.getPatients('organization', organizationId),
        ModeAwareDiagnosisService.getDiagnoses('organization', organizationId),
        ModeAwareDrugInventoryService.getDrugInventory('organization', organizationId)
      ]);

      // Use the data from mode-aware services
      const patients = patientsResult.data || [];
      const diagnoses = diagnosesResult.data || [];
      const drugs = inventoryResult.data || [];

      // Calculate time-based metrics
      const now = new Date();
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const recentDiagnoses = diagnoses.filter(d => new Date(d.created_at) >= lastWeek).length;
      const newPatientsThisMonth = patients.filter(p => new Date(p.created_at) >= thisMonth).length;
      const diagnosesThisMonth = diagnoses.filter(d => new Date(d.created_at) >= thisMonth).length;

      // Calculate derived metrics
      const lowStockDrugs = drugs.filter(drug => drug.quantity < 10).length;
      const expiredDrugs = drugs.filter(drug => drug.expiry_date && new Date(drug.expiry_date) < now).length;
      const totalDrugValue = drugs.reduce((sum, drug) => {
        const quantity = Number(drug.quantity) || 0;
        const unitPrice = Number(drug.unit_price) || 0;
        const value = quantity * unitPrice;
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      // Gender distribution - use correct patient field names
      const genderDistribution = patients.reduce(
        (acc, patient) => {
          const gender = patient.patient_gender?.toLowerCase() || 'other';
          if (gender === 'male') acc.male++;
          else if (gender === 'female') acc.female++;
          else acc.other++;
          return acc;
        },
        { male: 0, female: 0, other: 0 }
      );

      // Average age calculation - use correct patient field names
      const patientsWithAge = patients.filter(p => p.patient_age || p.date_of_birth);
      const averagePatientAge = patientsWithAge.length > 0
        ? patientsWithAge.reduce((sum, p) => {
            if (p.patient_age) return sum + p.patient_age;
            if (p.date_of_birth) {
              const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
              return sum + age;
            }
            return sum + 30; // Default fallback
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

      return {
        totalPatients: patients.length,
        totalDiagnoses: diagnoses.length,
        totalDrugs: drugs.length,
        recentDiagnoses,
        lowStockDrugs,
        expiredDrugs,
        totalDrugValue,
        newPatientsThisMonth,
        averagePatientAge: Math.round(averagePatientAge),
        genderDistribution,
        diagnosesThisMonth,
        topDiagnoses,
        urgentCases,
        mode: 'organization',
        organizationName: orgData?.name,
        userRole: memberData?.role
      };

    } catch (error) {
      console.error('Error fetching organization dashboard stats:', error);
      return {
        totalPatients: 0,
        totalDiagnoses: 0,
        totalDrugs: 0,
        recentDiagnoses: 0,
        lowStockDrugs: 0,
        expiredDrugs: 0,
        totalDrugValue: 0,
        newPatientsThisMonth: 0,
        averagePatientAge: 0,
        genderDistribution: { male: 0, female: 0, other: 0 },
        diagnosesThisMonth: 0,
        topDiagnoses: [],
        urgentCases: 0,
        mode: 'organization',
        organizationName: 'Unknown Organization',
        userRole: 'member'
      };
    }
  }

  // Get individual user dashboard stats using mode-aware services
  private static async getIndividualStats(userId: string): Promise<DashboardStats> {
    try {
      // Use mode-aware services for reliable data fetching
      const [
        patientsResult,
        diagnosesResult,
        inventoryResult
      ] = await Promise.all([
        ModeAwarePatientService.getPatients('individual'),
        ModeAwareDiagnosisService.getDiagnoses('individual'),
        ModeAwareDrugInventoryService.getDrugInventory('individual')
      ]);

      // Use the data from mode-aware services
      const patients = patientsResult.data || [];
      const diagnoses = diagnosesResult.data || [];
      const drugs = inventoryResult.data || [];

      // Calculate time-based metrics
      const now = new Date();
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const recentDiagnoses = diagnoses.filter(d => new Date(d.created_at) >= lastWeek).length;
      const newPatientsThisMonth = patients.filter(p => new Date(p.created_at) >= thisMonth).length;
      const diagnosesThisMonth = diagnoses.filter(d => new Date(d.created_at) >= thisMonth).length;

      // Calculate derived metrics
      const lowStockDrugs = drugs.filter(drug => drug.quantity < 10).length;
      const expiredDrugs = drugs.filter(drug => drug.expiry_date && new Date(drug.expiry_date) < now).length;
      const totalDrugValue = drugs.reduce((sum, drug) => {
        const quantity = Number(drug.quantity) || 0;
        const unitPrice = Number(drug.unit_price) || 0;
        const value = quantity * unitPrice;
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      // Gender distribution
      const genderDistribution = patients.reduce(
        (acc, patient) => {
          const gender = patient.patient_gender?.toLowerCase() || 'other';
          if (gender === 'male') acc.male++;
          else if (gender === 'female') acc.female++;
          else acc.other++;
          return acc;
        },
        { male: 0, female: 0, other: 0 }
      );

      // Average age calculation
      const patientsWithAge = patients.filter(p => p.patient_age || p.date_of_birth);
      const averagePatientAge = patientsWithAge.length > 0
        ? patientsWithAge.reduce((sum, p) => {
            if (p.patient_age) return sum + p.patient_age;
            if (p.date_of_birth) {
              const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
              return sum + age;
            }
            return sum + 30;
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

      return {
        totalPatients: patients.length,
        totalDiagnoses: diagnoses.length,
        totalDrugs: drugs.length,
        recentDiagnoses,
        lowStockDrugs,
        expiredDrugs,
        totalDrugValue,
        newPatientsThisMonth,
        averagePatientAge: Math.round(averagePatientAge),
        genderDistribution,
        diagnosesThisMonth,
        topDiagnoses,
        urgentCases,
        mode: 'individual'
      };

    } catch (error) {
      console.error('Error fetching individual dashboard stats:', error);
      return {
        totalPatients: 0,
        totalDiagnoses: 0,
        totalDrugs: 0,
        recentDiagnoses: 0,
        lowStockDrugs: 0,
        expiredDrugs: 0,
        totalDrugValue: 0,
        newPatientsThisMonth: 0,
        averagePatientAge: 0,
        genderDistribution: { male: 0, female: 0, other: 0 },
        diagnosesThisMonth: 0,
        topDiagnoses: [],
        urgentCases: 0,
        mode: 'individual'
      };
    }
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