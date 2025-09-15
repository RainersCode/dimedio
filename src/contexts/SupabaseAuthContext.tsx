'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, AuthResponse } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resendVerification: () => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ? mapSupabaseUser(session.user) : null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setUser(session?.user ? mapSupabaseUser(session.user) : null);
          // Only set loading to false if we're not in the initial loading state
          if (!loading) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loading]);

  const mapSupabaseUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
    emailVerified: supabaseUser.email_confirmed_at ? true : false,
  });

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Invalid email or password' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Please verify your email before signing in', needsVerification: true };
      }
      return { success: false, error: error.message };
    }

    // Check if email is verified
    if (data.user && !data.user.email_confirmed_at) {
      return { success: true, needsVerification: true };
    }

    return { success: true };
  };

  const signUp = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    // Enhanced validation
    if (name.trim().length < 2) {
      return { success: false, error: 'Name must be at least 2 characters' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    // Stronger password validation
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    if (!/[A-Z]/.test(password)) {
      return { success: false, error: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { success: false, error: 'Password must contain at least one lowercase letter' };
    }

    if (!/\d/.test(password)) {
      return { success: false, error: 'Password must contain at least one number' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        return { success: false, error: 'An account with this email already exists' };
      }
      return { success: false, error: error.message };
    }

    // Supabase sends verification email automatically
    return { 
      success: true, 
      needsVerification: true 
    };
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const resendVerification = async (): Promise<AuthResponse> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      signOut, 
      resendVerification 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}