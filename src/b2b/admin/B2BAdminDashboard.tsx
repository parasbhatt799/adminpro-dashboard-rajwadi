import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Activity } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function B2BAdminDashboard() {
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeAgentsCount, setActiveAgentsCount] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    
    // Fetch total earnings
    try {
      const { data: logsData } = await supabase
        .from('b2b_api_logs')
        .select('charge_deducted')
        .eq('status_code', 200);
      
      const sum = (logsData || []).reduce((acc, log) => acc + (parseFloat(log.charge_deducted || '0')), 0);
      setTotalEarnings(sum);

      const { count } = await supabase
        .from('b2b_api_credentials')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
        
      setActiveAgentsCount(count || 0);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">API Reseller Dashboard</h2>
          <p className="text-gray-500 mt-1">Overview of your B2B API integrations.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Earnings Card */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-1">Total API Earnings</p>
                <p className="text-3xl font-bold text-emerald-700">₹{totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          {/* Active Agents Card */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-4 rounded-full text-indigo-600">
                <Activity className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-1">Active Agents</p>
                <p className="text-3xl font-bold text-indigo-700">{activeAgentsCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!loading && (
        <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Agent API Settings have moved</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            You can now manage individual API configurations (API Keys, IP/Domain whitelisting, and BillAvenue Mapping) directly from the <strong>B2B Agents</strong> list by clicking the Settings icon next to any agent.
          </p>
        </div>
      )}
    </div>
  );
}
