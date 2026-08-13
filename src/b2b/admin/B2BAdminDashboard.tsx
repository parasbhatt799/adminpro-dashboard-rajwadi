import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Activity, Settings, Save } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function B2BAdminDashboard() {
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [savingCharge, setSavingCharge] = useState(false);
  const [activeAgentsCount, setActiveAgentsCount] = useState(0);
  const [globalCharge, setGlobalCharge] = useState<string>('0');
  const [globalChargeId, setGlobalChargeId] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();

    // Enable Supabase Realtime for auto updating earnings on dashboard
    const channel = supabase
      .channel('b2b_admin_dashboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_api_logs' },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    
    // Fetch total earnings across all pay-bill logs with pagination
    try {
      let allLogs: any[] = [];
      let from = 0;
      let step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('b2b_api_logs')
          .select('charge_deducted, request_payload, response_payload, status_code, endpoint')
          .or("endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill")
          .range(from, from + step - 1);

        if (error) {
          console.error('Error fetching logs batch:', error);
          break;
        }

        if (data && data.length > 0) {
          allLogs = allLogs.concat(data);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }
      
      const apiSum = allLogs.reduce((acc, log) => {
        const req = log.request_payload || {};
        const res = log.response_payload || {};
        const isSuccess = log.status_code === 200 && (
          res?.payment_status === 'success' || 
          res?.finalStatus === 'success' || 
          res?.status === 'success' ||
          res?.responseCode === '000' || 
          res?.billPayResponse?.responseCode === '000' ||
          res?.ExtBillPayResponse?.responseCode === '000' ||
          res?.billPayResponse?.responseReason?.toLowerCase() === 'successful' ||
          res?.ExtBillPayResponse?.responseReason?.toLowerCase() === 'successful'
        );
        
        if (!isSuccess) return acc;
        
        const chargeVal = Number(
          log.charge_deducted ?? 
          req?.chargeDeducted ?? 
          req?.chargePerBill ?? 
          req?.charge ?? 
          (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ?? 
          0
        );
        return acc + chargeVal;
      }, 0);
      
      setTotalEarnings(apiSum);

      const { count } = await supabase
        .from('b2b_api_credentials')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
        
      setActiveAgentsCount(count || 0);

      // Fetch global charge
      const { data: settingsData } = await supabase
        .from('b2b_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setGlobalCharge(settingsData.global_charge_per_bill?.toString() || '0');
        setGlobalChargeId(settingsData.id);
      }

    } catch (e) {
      console.error('Failed to fetch stats', e);
    }

    setLoading(false);
  };

  const handleSaveGlobalCharge = async () => {
    setSavingCharge(true);
    try {
      if (globalChargeId) {
        await supabase
          .from('b2b_settings')
          .update({ global_charge_per_bill: parseFloat(globalCharge) })
          .eq('id', globalChargeId);
      } else {
        const { data } = await supabase
          .from('b2b_settings')
          .insert({ global_charge_per_bill: parseFloat(globalCharge) })
          .select('id')
          .single();
        if (data) setGlobalChargeId(data.id);
      }
      alert('Global charge updated successfully!');
    } catch (e) {
      console.error('Failed to update global charge', e);
      alert('Error updating global charge');
    }
    setSavingCharge(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">API Reseller Dashboard</h2>
          <p className="text-slate-400 mt-1">Overview of your B2B API integrations.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Earnings Card */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/10 p-4 rounded-full text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-1">Total API Earnings</p>
                <p className="text-3xl font-bold text-emerald-300">₹{totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          {/* Active Agents Card */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-500/10 p-4 rounded-full text-indigo-400 border border-indigo-500/20">
                <Activity className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-1">Active Agents</p>
                <p className="text-3xl font-bold text-indigo-300">{activeAgentsCount}</p>
              </div>
            </div>
          </div>

          {/* Global Settings Card */}
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-amber-500/10 p-3 rounded-full text-amber-400 border border-amber-500/20">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-1">Global Charge Per Bill</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-400">₹</span>
              <input
                type="number"
                value={globalCharge}
                onChange={(e) => setGlobalCharge(e.target.value)}
                step="0.01"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleSaveGlobalCharge}
                disabled={savingCharge}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 p-2.5 rounded-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {savingCharge ? <LoadingSpinner size="sm" /> : <Save className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-amber-400/80">Default deduction applied if an agent has no custom charge set.</p>
          </div>
        </div>
      )}
      
      {!loading && (
        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-xl">
          <div className="bg-indigo-500/10 text-indigo-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Agent API Settings have moved</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            You can now manage individual API configurations (API Keys, IP/Domain whitelisting, and BillAvenue Mapping) directly from the <strong className="text-white">B2B Agents</strong> list by clicking the Settings icon next to any agent.
          </p>
        </div>
      )}
    </div>
  );
}
