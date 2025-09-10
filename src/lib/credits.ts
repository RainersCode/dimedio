import { supabase } from './supabase';

export interface UserCredits {
  id: string;
  user_id: string;
  credits: number;
  free_credits: number;
  total_used: number;
  daily_usage: number;
  last_used_at: string | null;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'purchase' | 'usage' | 'refund' | 'admin_grant';
  amount: number;
  description: string;
  created_at: string;
}

export class CreditsService {
  // Check if user can use diagnosis (has credits or is admin)
  static async canUseDiagnosis(): Promise<{ 
    canUse: boolean; 
    reason: string; 
    credits: number; 
    freeCredits: number;
    isAdmin: boolean;
  }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { 
          canUse: false, 
          reason: 'Please sign in to use diagnosis', 
          credits: 0, 
          freeCredits: 0, 
          isAdmin: false 
        };
      }

      // Check if user is admin (admins have unlimited access)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('Error checking user role:', roleError);
        // If no role found, user might be new - continue to check credits
      }

      const isAdmin = roleData && ['admin', 'super_admin'].includes(roleData.role);

      if (isAdmin) {
        return { 
          canUse: true, 
          reason: 'Admin access', 
          credits: 999, 
          freeCredits: 999, 
          isAdmin: true 
        };
      }

      // Get user credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (creditsError) {
        console.log('Credits error:', creditsError);
        
        // If user doesn't have credits record, create one
        if (creditsError.code === 'PGRST116' || creditsError.message?.includes('JSON object requested')) {
          console.log('Creating new credits for user:', user.id);
          const createResult = await this.createUserCredits(user.id);
          if (createResult) {
            return { 
              canUse: true, 
              reason: 'Free credits available', 
              credits: 0, 
              freeCredits: 3, 
              isAdmin: false 
            };
          }
        }
        
        console.error('Error fetching credits:', creditsError);
        return { 
          canUse: false, 
          reason: `Database error: ${creditsError.message || 'Unknown error'}`, 
          credits: 0, 
          freeCredits: 0, 
          isAdmin: false 
        };
      }

      const totalAvailable = creditsData.credits + creditsData.free_credits;
      
      // Check daily rate limit (max 10 per day for non-admins)
      const dailyLimit = 10;
      if (creditsData.daily_usage >= dailyLimit) {
        return { 
          canUse: false, 
          reason: `Daily limit reached (${dailyLimit} diagnoses per day)`, 
          credits: creditsData.credits, 
          freeCredits: creditsData.free_credits, 
          isAdmin: false 
        };
      }

      if (totalAvailable <= 0) {
        return { 
          canUse: false, 
          reason: 'No credits available. Please purchase credits to continue.', 
          credits: creditsData.credits, 
          freeCredits: creditsData.free_credits, 
          isAdmin: false 
        };
      }

      return { 
        canUse: true, 
        reason: 'Credits available', 
        credits: creditsData.credits, 
        freeCredits: creditsData.free_credits, 
        isAdmin: false 
      };
    } catch (error) {
      console.error('Error checking diagnosis availability:', error);
      return { 
        canUse: false, 
        reason: 'System error', 
        credits: 0, 
        freeCredits: 0, 
        isAdmin: false 
      };
    }
  }

  // Use one credit for diagnosis
  static async useCredit(): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if admin (admins don't consume credits)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = roleData && ['admin', 'super_admin'].includes(roleData.role);
      
      if (isAdmin) {
        return { success: true, error: null };
      }

      // Get current credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (creditsError) {
        return { success: false, error: 'Failed to check credits' };
      }

      // Calculate new values
      let newCredits = creditsData.credits;
      let newFreeCredits = creditsData.free_credits;
      
      // Use free credits first
      if (newFreeCredits > 0) {
        newFreeCredits -= 1;
      } else if (newCredits > 0) {
        newCredits -= 1;
      } else {
        return { success: false, error: 'Insufficient credits' };
      }

      // Update credits and usage
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          credits: newCredits,
          free_credits: newFreeCredits,
          total_used: creditsData.total_used + 1,
          daily_usage: creditsData.daily_usage + 1,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating credits:', updateError);
        return { success: false, error: 'Failed to update credits' };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error using credit:', error);
      return { success: false, error: 'System error' };
    }
  }

  // Get user credits information
  static async getUserCredits(): Promise<{ 
    data: UserCredits | null; 
    error: string | null; 
  }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { data: null, error: 'Not authenticated' };
      }

      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Create credits for user if doesn't exist
          await this.createUserCredits(user.id);
          return this.getUserCredits();
        }
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user credits:', error);
      return { data: null, error: 'Failed to fetch credits' };
    }
  }

  // Admin function to grant credits to user
  static async grantCredits(
    userId: string, 
    amount: number, 
    description: string = 'Admin granted credits'
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      // Check if current user is admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = roleData && ['admin', 'super_admin'].includes(roleData.role);
      
      if (!isAdmin) {
        return { success: false, error: 'Admin access required' };
      }

      // Get target user's current credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (creditsError) {
        return { success: false, error: 'User not found' };
      }

      // Update credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          credits: creditsData.credits + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        return { success: false, error: 'Failed to grant credits' };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error granting credits:', error);
      return { success: false, error: 'System error' };
    }
  }

  // Create initial credits for new user
  private static async createUserCredits(userId: string): Promise<boolean> {
    try {
      console.log('Attempting to create credits for user:', userId);
      
      const { data, error } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          credits: 0,
          free_credits: 3
        });

      if (error) {
        console.error('Error creating user credits:', error);
        return false;
      }

      console.log('Successfully created credits:', data);
      return true;
    } catch (error) {
      console.error('Exception creating user credits:', error);
      return false;
    }
  }

  // Get credit transactions for user
  static async getUserTransactions(): Promise<{ 
    data: CreditTransaction[] | null; 
    error: string | null; 
  }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return { data: null, error: 'Not authenticated' };
      }

      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return { data: null, error: 'Failed to fetch transactions' };
    }
  }
}