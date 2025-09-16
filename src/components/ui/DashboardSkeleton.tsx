'use client';

import React from 'react';
import Navigation from '@/components/layout/Navigation';
import { Skeleton, SkeletonCard } from './SkeletonLoader';

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Skeleton className="h-10 w-1/3 mb-4" />
          <Skeleton className="h-6 w-2/3" />
        </div>

        {/* Organization Selector */}
        <SkeletonCard className="mb-8" />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/80 backdrop-blur border border-white/20 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur border border-white/20 rounded-xl p-6 shadow-sm">
              <Skeleton className="h-6 w-32 mb-6" />
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border border-slate-100 rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/80 backdrop-blur border border-white/20 rounded-xl p-6 shadow-sm">
              <Skeleton className="h-6 w-24 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white/80 backdrop-blur border border-white/20 rounded-xl p-6 shadow-sm">
              <Skeleton className="h-6 w-20 mb-4" />
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}