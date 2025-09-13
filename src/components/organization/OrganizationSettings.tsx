'use client';

import React, { useState } from 'react';
import { OrganizationService } from '@/lib/organizationService';
import type { Organization } from '@/types/organization';

interface OrganizationSettingsProps {
  organization: Organization;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
  onOrganizationUpdated: () => void;
}

export default function OrganizationSettings({ organization, onError, onSuccess, onOrganizationUpdated }: OrganizationSettingsProps) {
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || '');
  const [settings, setSettings] = useState(organization.settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await OrganizationService.updateOrganization(organization.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      settings
    });

    if (error) {
      onError(error);
    } else {
      onSuccess('Organization settings updated successfully');
      onOrganizationUpdated();
    }

    setSaving(false);
  };

  const handleSettingChange = (key: keyof typeof settings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-slate-900 mb-6">Organization Settings</h3>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h4 className="text-md font-medium text-slate-900 mb-4">Basic Information</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter organization name"
                required
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Describe your organization"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-slate-500 mt-1">
                {description.length}/500 characters
              </p>
            </div>
          </div>
        </div>

        {/* Sharing Settings */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h4 className="text-md font-medium text-slate-900 mb-4">Sharing Settings</h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h5 className="text-sm font-medium text-slate-900">Shared Drug Inventory</h5>
                <p className="text-sm text-slate-600">
                  Allow members to access and manage a shared drug inventory
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSettingChange('shared_inventory', !settings.shared_inventory)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.shared_inventory ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.shared_inventory ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h5 className="text-sm font-medium text-slate-900">Shared Patient Data</h5>
                <p className="text-sm text-slate-600">
                  Allow members to access and manage shared patient profiles and diagnoses
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSettingChange('shared_patients', !settings.shared_patients)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.shared_patients ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.shared_patients ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Member Management Settings */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h4 className="text-md font-medium text-slate-900 mb-4">Member Management</h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h5 className="text-sm font-medium text-slate-900">Require Approval for New Members</h5>
                <p className="text-sm text-slate-600">
                  New members must be approved by an administrator before joining
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSettingChange('require_approval_for_members', !settings.require_approval_for_members)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.require_approval_for_members ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.require_approval_for_members ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Organization Information */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h4 className="text-md font-medium text-slate-900 mb-4">Organization Information</h4>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Organization ID:</span>
              <span className="text-slate-600 ml-2 font-mono text-xs">{organization.id}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Created:</span>
              <span className="text-slate-600 ml-2">{new Date(organization.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Last Updated:</span>
              <span className="text-slate-600 ml-2">{new Date(organization.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}