'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  signUp: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  signOut: () => void;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  getCurrentUserToken: () => string | null;
  manualVerifyForDemo: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const savedUser = localStorage.getItem('dimedio-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('dimedio-user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if user exists in localStorage
    const users = JSON.parse(localStorage.getItem('dimedio-users') || '[]');
    const existingUser = users.find((u: any) => u.email === email);

    if (!existingUser) {
      return { success: false, error: 'No account found with this email' };
    }

    // Simple password check (in real app, this would be hashed)
    if (existingUser.password !== password) {
      return { success: false, error: 'Incorrect password' };
    }

    const userData = {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      emailVerified: existingUser.emailVerified || false,
    };

    setUser(userData);
    localStorage.setItem('dimedio-user', JSON.stringify(userData));

    if (!existingUser.emailVerified) {
      return { success: true, needsVerification: true };
    }

    return { success: true };
  };

  const signUp = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> => {
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

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if user already exists
    const users = JSON.parse(localStorage.getItem('dimedio-users') || '[]');
    const existingUser = users.find((u: any) => u.email === email);

    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }

    // Create new user with email verification
    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.toLowerCase(),
      password: password, // In real app, this would be hashed
      emailVerified: false,
      verificationToken: Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem('dimedio-users', JSON.stringify(users));

    // Simulate sending verification email
    console.log('📧 Verification email sent to:', email);
    console.log('🔗 Verification link: http://localhost:3000/verify/' + newUser.verificationToken);

    // For demo purposes, we'll allow login but show unverified status
    const userData = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      emailVerified: false,
    };

    setUser(userData);
    localStorage.setItem('dimedio-user', JSON.stringify(userData));

    return { success: true, needsVerification: true };
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('dimedio-user');
  };

  const resendVerification = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const users = JSON.parse(localStorage.getItem('dimedio-users') || '[]');
    const user = users.find((u: any) => u.email === email);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email is already verified' };
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate new verification token
    user.verificationToken = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('dimedio-users', JSON.stringify(users));

    // Simulate sending verification email
    console.log('📧 Verification email resent to:', email);
    console.log('🔗 Verification link: http://localhost:3000/verify/' + user.verificationToken);

    return { success: true };
  };

  const getCurrentUserToken = (): string | null => {
    if (!user) return null;
    
    const users = JSON.parse(localStorage.getItem('dimedio-users') || '[]');
    const currentUser = users.find((u: any) => u.id === user.id);
    
    return currentUser?.verificationToken || null;
  };

  const manualVerifyForDemo = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email is already verified' };
    }

    // Update user in storage
    const users = JSON.parse(localStorage.getItem('dimedio-users') || '[]');
    const userToUpdate = users.find((u: any) => u.id === user.id);
    
    if (userToUpdate) {
      userToUpdate.emailVerified = true;
      userToUpdate.verificationToken = null;
      localStorage.setItem('dimedio-users', JSON.stringify(users));
      
      // Update current session
      const updatedUser = { ...user, emailVerified: true };
      setUser(updatedUser);
      localStorage.setItem('dimedio-user', JSON.stringify(updatedUser));
      
      return { success: true };
    }

    return { success: false, error: 'User not found' };
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resendVerification, getCurrentUserToken, manualVerifyForDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}