'use client';

import Navigation from '@/components/layout/Navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { sampleComplaints } from '@/data/sampleComplaints';
import { useState } from 'react';

export default function Home() {
  const { t, language } = useLanguage();
  const [selectedComplaint, setSelectedComplaint] = useState('');
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-blue-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-light text-slate-900 mb-6 leading-tight">
                {t('aiPowered')}
                <br />
                <span className="font-semibold text-emerald-600">{t('medicalDiagnosis')}</span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                {t('heroDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="/diagnose" className="px-8 py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-lg text-center">
                  {t('startDiagnosing')}
                </a>
                <a href="/dashboard" className="px-8 py-4 border-2 border-slate-300 text-slate-700 text-lg font-semibold rounded-lg hover:bg-white hover:border-emerald-300 transition-colors text-center">
                  {t('viewDashboard')}
                </a>
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80" 
                alt="Doctor using tablet for diagnosis"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl border border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-slate-700">{t('aiAnalysisActive')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-slate-900 mb-4">{t('howItWorks')}</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {t('howItWorksDescription')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center group">
              <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3">{t('enterComplaint')}</h3>
              <p className="text-slate-600">{t('enterComplaintDescription')}</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3">{t('aiAnalysis')}</h3>
              <p className="text-slate-600">{t('aiAnalysisDescription')}</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3">{t('getResults')}</h3>
              <p className="text-slate-600">{t('getResultsDescription')}</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <h3 className="text-3xl font-semibold text-slate-900 mb-6">{t('tryItNow')}</h3>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('patientComplaint')}</label>
                    <textarea 
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none" 
                      rows={4}
                      placeholder={t('complaintPlaceholder')}
                      value={selectedComplaint}
                      onChange={(e) => setSelectedComplaint(e.target.value)}
                    ></textarea>
                  </div>
                  <a href="/diagnose" className="block w-full px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors text-center">
                    {t('analyzeSymptoms')}
                  </a>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">{t('sampleComplaints')}</h4>
                  <div className="space-y-3">
                    {sampleComplaints[language as keyof typeof sampleComplaints]?.map((complaint) => (
                      <button
                        key={complaint.id}
                        onClick={() => setSelectedComplaint(complaint.complaint)}
                        className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
                      >
                        <div className="text-sm font-medium text-slate-900 mb-1">{complaint.title}</div>
                        <div className="text-xs text-slate-600 line-clamp-2">{complaint.complaint}</div>
                        <div className="text-xs text-emerald-600 mt-2 group-hover:text-emerald-700">{t('clickToUse')}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <img 
                  src="https://images.unsplash.com/photo-1551601651-bc60f254d532?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80" 
                  alt="Medical consultation"
                  className="rounded-xl shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-slate-900 mb-4">{t('designedFor')}</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {t('featuresDescription')}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-4">{t('hipaaCompliant')}</h3>
              <p className="text-slate-600 mb-4">{t('hipaaDescription')}</p>
              <a href="#" className="text-emerald-600 font-medium hover:text-emerald-700">{t('learnSecurity')}</a>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-blue-100 rounded-xl mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-4">{t('instantResults')}</h3>
              <p className="text-slate-600 mb-4">{t('instantResultsDescription')}</p>
              <a href="#" className="text-emerald-600 font-medium hover:text-emerald-700">{t('viewPerformance')}</a>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-purple-100 rounded-xl mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-4">{t('clinicallyValidated')}</h3>
              <p className="text-slate-600 mb-4">{t('clinicallyValidatedDescription')}</p>
              <a href="#" className="text-emerald-600 font-medium hover:text-emerald-700">{t('readResearch')}</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-emerald-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-light text-white mb-6">
            {t('readyToTransform')}
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            {t('ctaDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/diagnose" className="px-8 py-4 bg-white text-emerald-600 text-lg font-semibold rounded-lg hover:bg-emerald-50 transition-colors shadow-lg text-center">
              {t('startFreeTrial')}
            </a>
            <a href="/dashboard" className="px-8 py-4 border-2 border-white text-white text-lg font-semibold rounded-lg hover:bg-white hover:text-emerald-600 transition-colors text-center">
              {t('viewDashboard')}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold text-emerald-400 mb-4">Dimedio</div>
              <p className="text-slate-400">{t('aiPoweredPlatform')}</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('product')}</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('dashboard')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('diagnose')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('patientManagement')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('analytics')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('resources')}</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('documentation')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('research')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('caseStudies')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('support')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('company')}</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('about')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('careers')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('privacy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('terms')}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400">
            <p>{t('allRights')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
