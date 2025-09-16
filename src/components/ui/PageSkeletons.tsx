'use client';

import React from 'react';
import Navigation from '@/components/layout/Navigation';
import {
  SkeletonPageHeader,
  SkeletonCard,
  SkeletonTable,
  SkeletonButton,
  SkeletonStats,
  Skeleton
} from './SkeletonLoader';

export function DrugDispensingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SkeletonPageHeader />

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <SkeletonButton className="w-full sm:w-auto" />
          <SkeletonButton className="w-full sm:w-auto" />
        </div>

        {/* Organization selector */}
        <SkeletonCard className="mb-6" />

        {/* Stats */}
        <SkeletonStats />

        {/* Table */}
        <SkeletonTable rows={8} cols={7} />
      </div>
    </div>
  );
}

export function PatientsSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SkeletonPageHeader />

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <SkeletonButton className="w-full sm:w-auto" />
          <SkeletonButton className="w-full sm:w-auto" />
        </div>

        {/* Organization selector */}
        <SkeletonCard className="mb-8" />

        {/* Search and filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Table */}
        <SkeletonTable rows={6} cols={7} />
      </div>
    </div>
  );
}

export function DiagnosisSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SkeletonPageHeader />

        {/* Organization selector */}
        <SkeletonCard className="mb-6" />

        {/* Diagnosis form */}
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="space-y-6">
            {/* Form sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-32 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>

            {/* Patient info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>

            {/* Submit button */}
            <div className="flex justify-end">
              <Skeleton className="h-12 w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DrugInventorySkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SkeletonPageHeader />

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <SkeletonButton className="w-full sm:w-auto" />
          <SkeletonButton className="w-full sm:w-auto" />
          <SkeletonButton className="w-full sm:w-auto" />
        </div>

        {/* Organization selector */}
        <SkeletonCard className="mb-6" />

        {/* Search and filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Table */}
        <SkeletonTable rows={10} cols={8} />
      </div>
    </div>
  );
}

export function DrugUsageReportSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SkeletonPageHeader />

        {/* Organization selector */}
        <SkeletonCard className="mb-6" />

        {/* Date filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <SkeletonButton />
          </div>
        </div>

        {/* Report stats */}
        <SkeletonStats />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>

        {/* Table */}
        <SkeletonTable rows={8} cols={6} />
      </div>
    </div>
  );
}