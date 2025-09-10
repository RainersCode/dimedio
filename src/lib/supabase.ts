import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our auth responses
export interface AuthError {
  message: string;
  status?: number;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  needsVerification?: boolean;
}