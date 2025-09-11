'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { AdminService } from '@/lib/admin';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AuthModal from '@/components/auth/AuthModal';
import type { UserRole } from '@/types/database';

export default function Navigation() {
  const { t } = useLanguage();
  const { user, signOut } = useSupabaseAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      if (user) {
        try {
          const { isAdmin: adminStatus, role } = await AdminService.isCurrentUserAdmin();
          setIsAdmin(adminStatus);
          setUserRole(role);
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          setUserRole('user');
        }
      } else {
        setIsAdmin(false);
        setUserRole('user');
      }
    };

    // Add a small delay to prevent rapid state changes
    const timeoutId = setTimeout(checkUserRole, 100);
    return () => clearTimeout(timeoutId);
  }, [user]);

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="text-2xl font-bold text-emerald-600">
              Dimedio
            </div>
            <div className="hidden md:flex space-x-6">
              <a href="/" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                {t('home')}
              </a>
              <a href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                {t('dashboard')}
              </a>
              <a href="/diagnose" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                {t('diagnose')}
              </a>
              <a href="/patients" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                {t('patients')}
              </a>
              <a href="/history" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                {t('history')}
              </a>
              <a href="/drug-inventory" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5v3m6-3v3" />
                </svg>
                Drugs
              </a>
              <a href="/drug-dispensing" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Dispensing
              </a>
              <a href="/resources" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                {t('resources')}
              </a>
              {isAdmin && (
                <a href="/admin" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="text-sm">
                  <div className="text-slate-600">
                    Welcome, <span className="font-medium text-slate-900">{user.name}</span>
                  </div>
                  {!user.emailVerified && (
                    <div className="flex items-center text-xs text-amber-600 mt-1">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Please check your email to verify your account
                    </div>
                  )}
                </div>
                <button 
                  onClick={signOut}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setAuthModalMode('signin');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {t('login')}
                </button>
                <button 
                  onClick={() => {
                    setAuthModalMode('signup');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-6 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                >
                  {t('signUp')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </nav>
  );
}