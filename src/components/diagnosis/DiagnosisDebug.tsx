'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

export default function DiagnosisDebug() {
  const { user } = useSupabaseAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');

  const runDiagnostics = async () => {
    if (!user) {
      setDebugInfo('No user logged in');
      return;
    }

    let info = `=== DIAGNOSIS DEBUG INFO ===\n`;
    info += `User ID: ${user.id}\n`;
    info += `User Email: ${user.email}\n\n`;

    try {
      // Check if user_credits table exists
      info += `--- Checking user_credits table ---\n`;
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (creditsError) {
        info += `Credits Error: ${creditsError.message}\n`;
        info += `Error Code: ${creditsError.code}\n`;
        
        // Try to create credits
        info += `\n--- Attempting to create credits ---\n`;
        const { data: insertData, error: insertError } = await supabase
          .from('user_credits')
          .insert({
            user_id: user.id,
            credits: 0,
            free_credits: 3
          });

        if (insertError) {
          info += `Insert Error: ${insertError.message}\n`;
          info += `Insert Error Code: ${insertError.code}\n`;
        } else {
          info += `Credits created successfully!\n`;
        }
      } else {
        info += `Credits found: ${JSON.stringify(creditsData, null, 2)}\n`;
      }

      // Check user_roles table
      info += `\n--- Checking user_roles table ---\n`;
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        info += `Role Error: ${roleError.message}\n`;
        info += `Role Error Code: ${roleError.code}\n`;
      } else {
        info += `Role found: ${JSON.stringify(roleData, null, 2)}\n`;
      }

      // Check database permissions
      info += `\n--- Checking database permissions ---\n`;
      const { data: tablesData, error: tablesError } = await supabase
        .rpc('get_current_user_id');

      if (tablesError) {
        info += `RPC Error: ${tablesError.message}\n`;
      } else {
        info += `Current DB User: ${tablesData}\n`;
      }

    } catch (error) {
      info += `\n--- EXCEPTION ---\n`;
      info += `${error}\n`;
    }

    setDebugInfo(info);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-4">
      <h3 className="text-lg font-semibold mb-4">Diagnosis Debug Tool</h3>
      
      <button
        onClick={runDiagnostics}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-4"
      >
        Run Diagnostics
      </button>

      {debugInfo && (
        <div className="bg-gray-100 p-4 rounded font-mono text-sm whitespace-pre-wrap">
          {debugInfo}
        </div>
      )}
    </div>
  );
}