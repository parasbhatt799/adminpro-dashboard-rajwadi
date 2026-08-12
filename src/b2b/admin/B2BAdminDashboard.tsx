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
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    
    // Fetch total earnings
    try {
      const { data: logsData } = await supabase
        .from('b2b_api_logs')
        .select('charge_deducted, request_payload, response_payload, status_code')
        .eq('endpoint', '/api/b2b/pay-bill');
      
      const apiSum = (logsData || []).reduce((acc, log) => {
        const req = log.request_payload || {};
        const res = log.response_payload || {};
        const isSuccess = log.status_code === 200 && (
          res?.payment_status === 'success' || 
          res?.finalStatus === 'success' || 
          res?.responseCode === '000' || 
          res?.billPayResponse?.responseCode === '000' ||
          res?.ExtBillPayResponse?.responseCode === '000'
        );
        
        if (!isSuccess) return acc;
        
        const chargeVal = Number(
          (log as any).charge_deducted ?? 
          req?.chargeDeducted ?? 
          req?.chargePerBill ?? 
          req?.charge ?? 
          (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ?? 
          10
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

          {/* Global Settings Card */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-sm">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-1">Global Charge Per Bill</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-orange-700">₹</span>
              <input
                type="number"
                value={globalCharge}
                onChange={(e) => setGlobalCharge(e.target.value)}
                step="0.01"
                className="w-full bg-white border border-orange-200 text-orange-900 rounded-lg px-3 py-2 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleSaveGlobalCharge}
                disabled={savingCharge}
                className="bg-orange-600 hover:bg-orange-700 text-white p-2.5 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {savingCharge ? <LoadingSpinner size="sm" /> : <Save className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-orange-600/80">Default deduction applied if an agent has no custom charge set.</p>
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
