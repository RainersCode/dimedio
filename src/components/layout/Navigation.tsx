'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { AdminService } from '@/lib/admin';
import { UndispensedMedicationsService } from '@/lib/undispensedMedicationsService';
import { useUndispensedMedicationsRefresh } from '@/hooks/useUndispensedMedicationsRefresh';
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasUndispensedMeds, setHasUndispensedMeds] = useState(false);

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

  // Check for undispensed medications
  const checkUndispensedMeds = useCallback(async () => {
    if (user) {
      try {
        const { hasAnyUndispensed } = await UndispensedMedicationsService.getPatientsWithUndispensedMedications();
        setHasUndispensedMeds(hasAnyUndispensed);
      } catch (error) {
        console.error('Error checking undispensed medications:', error);
        setHasUndispensedMeds(false);
      }
    } else {
      setHasUndispensedMeds(false);
    }
  }, [user]);

  useEffect(() => {
    checkUndispensedMeds();
    
    // Re-check every 30 seconds when user is logged in
    let interval: NodeJS.Timeout;
    if (user) {
      interval = setInterval(checkUndispensedMeds, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkUndispensedMeds]);

  // Listen for refresh events
  useUndispensedMedicationsRefresh(checkUndispensedMeds);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="text-2xl font-bold text-emerald-600">
              Dimedio
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a 
                href="/" 
                className="text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
              >
                {t('home')}
              </a>

              <a 
                href="/dashboard" 
                className="text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
              >
                {t('dashboard')}
              </a>

              {/* Patient Care Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'patient-care' ? null : 'patient-care')}
                  className="flex items-center text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
                >
                  <div className="flex items-center">
                    Patient Care
                    {hasUndispensedMeds && (
                      <div className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Patients have undispensed medications"></div>
                    )}
                  </div>
                  <svg 
                    className={`w-4 h-4 ml-2 transition-transform duration-200 ${openDropdown === 'patient-care' ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'patient-care' && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white border border-slate-100 rounded-lg shadow-xl z-50">
                    <div className="py-2">
                      <a 
                        href="/diagnose" 
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors duration-200"
                        onClick={() => setOpenDropdown(null)}
                      >
                        {t('diagnose')}
                      </a>
                      <a 
                        href="/patients" 
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors duration-200"
                        onClick={() => setOpenDropdown(null)}
                      >
                        <div className="flex items-center">
                          {t('patients')}
                          {hasUndispensedMeds && (
                            <div className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Patients have undispensed medications"></div>
                          )}
                        </div>
                      </a>
                      <a 
                        href="/history" 
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors duration-200"
                        onClick={() => setOpenDropdown(null)}
                      >
                        {t('history')}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Pharmacy Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'pharmacy' ? null : 'pharmacy')}
                  className="flex items-center text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
                >
                  Pharmacy
                  <svg 
                    className={`w-4 h-4 ml-2 transition-transform duration-200 ${openDropdown === 'pharmacy' ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'pharmacy' && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white border border-slate-100 rounded-lg shadow-xl z-50">
                    <div className="py-2">
                      <a 
                        href="/drug-inventory" 
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors duration-200"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Drug Inventory
                      </a>
                      <a
                        href="/drug-dispensing"
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors duration-200"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Dispensing History
                      </a>
                      <a 
                        href="/drug-usage-report" 
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors duration-200"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Drug Usage Report
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <a 
                href="/resources" 
                className="text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
              >
                {t('resources')}
              </a>

              {isAdmin && (
                <a 
                  href="/admin" 
                  className="text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
                >
                  Admin
                </a>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-emerald-600 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-4">
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100">
          <div className="px-6 py-6 space-y-6">
            <a 
              href="/" 
              className="block text-base font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('home')}
            </a>
            <a 
              href="/dashboard" 
              className="block text-base font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('dashboard')}
            </a>
            
            {/* Patient Care Section */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Patient Care
              </div>
              <div className="space-y-3 pl-4">
                <a 
                  href="/diagnose" 
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('diagnose')}
                </a>
                <a 
                  href="/patients" 
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    {t('patients')}
                    {hasUndispensedMeds && (
                      <div className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Patients have undispensed medications"></div>
                    )}
                  </div>
                </a>
                <a 
                  href="/history" 
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('history')}
                </a>
              </div>
            </div>

            {/* Pharmacy Section */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pharmacy
              </div>
              <div className="space-y-3 pl-4">
                <a 
                  href="/drug-inventory" 
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Drug Inventory
                </a>
                <a
                  href="/drug-dispensing"
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dispensing History
                </a>
                <a
                  href="/organization"
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Organization
                </a>
                <a 
                  href="/drug-usage-report" 
                  className="block text-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Drug Usage Report
                </a>
              </div>
            </div>

            <a 
              href="/resources" 
              className="block text-base font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('resources')}
            </a>

            {isAdmin && (
              <a 
                href="/admin" 
                className="block text-base font-medium text-slate-700 hover:text-emerald-600 transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin
              </a>
            )}
          </div>
        </div>
      )}
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </nav>
  );
}