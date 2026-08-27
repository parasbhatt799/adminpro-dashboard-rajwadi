import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Activity, Settings, Save, Wallet } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function B2BAdminDashboard() {
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [developerEarnings, setDeveloperEarnings] = useState<number>(0);
  const [ownerEarnings, setOwnerEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [savingCharge, setSavingCharge] = useState(false);
  const [activeAgentsCount, setActiveAgentsCount] = useState(0);
  const [totalAgentsBalance, setTotalAgentsBalance] = useState<number>(0);
  const [globalCharge, setGlobalCharge] = useState<string>('0');
  const [globalMaxLimit, setGlobalMaxLimit] = useState<string>('100000');
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
          .select('charge_deducted, developer_charge, owner_charge, request_payload, response_payload, status_code, endpoint')
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
      
      let totalSum = 0;
      let devSum = 0;
      let ownerSum = 0;

      allLogs.forEach((log) => {
        const req = log.request_payload || {};
        const res = log.response_payload || {};
        const bpr = res?.ExtBillPayResponse || res?.billPayResponse || res;
        const txnRefId = bpr?.txnRefId || res?.txnRefId;
        const hasCC01 = !!(txnRefId && String(txnRefId).toUpperCase().startsWith('CC01'));
        const responseCode = bpr?.responseCode || res?.responseCode;
        const responseReason = (bpr?.responseReason || res?.responseReason || '').toLowerCase();

        const isSuccess = 
          res?.payment_status === 'success' || 
          res?.finalStatus === 'success' || 
          res?.status === 'success' ||
          responseCode === '000' || 
          responseCode === '0000' ||
          responseReason === 'successful' ||
          (hasCC01 && log.status_code === 200 && res?.payment_status !== 'failed');
        
        if (!isSuccess) return;
        
        const chargeVal = Number(
          log.charge_deducted ?? 
          req?.chargeDeducted ?? 
          req?.chargePerBill ?? 
          req?.charge ?? 
          (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ?? 
          0
        );

        let dVal = Number(log.developer_charge ?? req?.developerCharge ?? req?.developer_charge ?? 0);
        let oVal = Number(log.owner_charge ?? req?.ownerCharge ?? req?.owner_charge ?? (chargeVal - dVal));

        totalSum += chargeVal;
        devSum += dVal;
        ownerSum += oVal;
      });
      
      // Fetch total withdrawals to compute net earnings
      const { data: wData } = await supabase
        .from('b2b_revenue_withdrawals')
        .select('role, amount');

      let devW = 0;
      let ownerW = 0;
      if (wData) {
        wData.forEach((w: any) => {
          const amt = Number(w.amount || 0);
          if (w.role === 'developer') devW += amt;
          if (w.role === 'owner') ownerW += amt;
        });
      }
      
      setTotalEarnings(totalSum - (devW + ownerW));
      setDeveloperEarnings(devSum - devW);
      setOwnerEarnings(ownerSum - ownerW);

      // Fetch active agents count & sum of all agent wallet balances
      const { data: agentsData } = await supabase
        .from('b2b_api_credentials')
        .select('wallet_balance, is_active');
        
      if (agentsData) {
        let activeCount = 0;
        let totalBal = 0;
        agentsData.forEach((ag: any) => {
          if (ag.is_active) activeCount++;
          totalBal += parseFloat(ag.wallet_balance?.toString() || '0');
        });
        setActiveAgentsCount(activeCount);
        setTotalAgentsBalance(totalBal);
      }

      // Fetch global charge and max limit
      const { data: settingsData } = await supabase
        .from('b2b_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setGlobalCharge(settingsData.global_charge_per_bill?.toString() || '0');
        setGlobalMaxLimit(settingsData.max_bill_payment_limit?.toString() || '100000');
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
      const chargeVal = parseFloat(globalCharge) || 0;
      const limitVal = parseFloat(globalMaxLimit) || 100000;

      if (globalChargeId) {
        await supabase
          .from('b2b_settings')
          .update({ 
            global_charge_per_bill: chargeVal,
            max_bill_payment_limit: limitVal
          })
          .eq('id', globalChargeId);
      } else {
        const { data } = await supabase
          .from('b2b_settings')
          .insert({ 
            global_charge_per_bill: chargeVal,
            max_bill_payment_limit: limitVal
          })
          .select('id')
          .single();
        if (data) setGlobalChargeId(data.id);
      }
      alert('Global settings updated successfully!');
    } catch (e) {
      console.error('Failed to update global settings', e);
      alert('Error updating global settings');
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
        
        {/* Header Total Agents Balance Badge */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3.5 shadow-xl backdrop-blur-md">
          <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-400/30 text-emerald-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider">All B2B Agents Wallet Balance</p>
            <p className="text-2xl font-black text-emerald-400">₹{totalAgentsBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Earnings Card */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/10 p-3.5 rounded-full text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Total API Revenue</p>
                <p className="text-2xl font-bold text-emerald-300">₹{totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Developer Earnings Card */}
          <div className="bg-blue-950/30 border border-blue-500/20 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/10 p-3.5 rounded-full text-blue-400 border border-blue-500/20">
                <Activity className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Developer Share Total</p>
                <p className="text-2xl font-bold text-blue-300">₹{developerEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Owner Earnings Card */}
          <div className="bg-purple-950/30 border border-purple-500/20 rounded-2xl px-6 py-6 flex flex-col justify-center gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="bg-purple-500/10 p-3.5 rounded-full text-purple-400 border border-purple-500/20">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">Owner Share Total</p>
                <p className="text-2xl font-bold text-purple-300">₹{ownerEarnings.toFixed(2)}</p>
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
            <div className="flex items-center gap-4 mb-1">
              <div className="bg-amber-500/10 p-3 rounded-full text-amber-400 border border-amber-500/20">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-400 uppercase tracking-wider">B2B Global Settings</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-amber-300 font-semibold block mb-1">Global Base Charge Per Bill (₹)</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-amber-400">₹</span>
                  <input
                    type="number"
                    value={globalCharge}
                    onChange={(e) => setGlobalCharge(e.target.value)}
                    step="0.01"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-amber-300 font-semibold block mb-1">Max Single Bill Payment Limit (₹)</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-amber-400">₹</span>
                  <input
                    type="number"
                    value={globalMaxLimit}
                    onChange={(e) => setGlobalMaxLimit(e.target.value)}
                    step="1000"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveGlobalCharge}
                disabled={savingCharge}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2 px-4 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {savingCharge ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                <span>Save B2B Settings</span>
              </button>
            </div>
            <p className="text-[11px] text-amber-400/80">Every ₹50,000 block doubles the charge multiplier (1x, 2x, 3x...). Transactions above max limit are rejected.</p>
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
