import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Settings2, Save, IndianRupee, RefreshCw, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminCamlenioPayoutHistory() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    camlenio_is_enabled: true,
    camlenio_max_payout: 50000,
    camlenio_min_payout: 100,
    camlenio_payout_charge: 0,
    camlenio_verification_charge: 5
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('payout_settings')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (!settingsError && settingsData) {
        setSettings({
          camlenio_is_enabled: settingsData.camlenio_is_enabled ?? true,
          camlenio_max_payout: settingsData.camlenio_max_payout ?? 50000,
          camlenio_min_payout: settingsData.camlenio_min_payout ?? 100,
          camlenio_payout_charge: settingsData.camlenio_payout_charge ?? 0,
          camlenio_verification_charge: settingsData.camlenio_verification_charge ?? 5
        });
      }

      // Fetch payout and verification transactions
      // They are recorded in payout_submissions
      const { data: txData, error: txError } = await supabase
        .from('payout_submissions')
        .select('*, users_profiles(name, mobile_number)')
        .in('status', ['approved', 'pending', 'processing', 'rejected', 'refunded'])
        .order('created_at', { ascending: false });

      if (txError) throw txError;
      
      // Filter only camlenio related (which can be identified by the new charge or regular payout logic)
      // For now we'll just show all payout_submissions, or if you added a specific transaction_type, filter by that.
      setTransactions(txData || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setMessage({ type: 'error', text: 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('payout_settings')
        .upsert({
          id: 1,
          camlenio_is_enabled: settings.camlenio_is_enabled,
          camlenio_max_payout: settings.camlenio_max_payout,
          camlenio_min_payout: settings.camlenio_min_payout,
          camlenio_payout_charge: settings.camlenio_payout_charge,
          camlenio_verification_charge: settings.camlenio_verification_charge
        });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: `Failed to save settings: ${err?.message || JSON.stringify(err)}` });
    } finally {
      setSavingSettings(false);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncPendingStatuses = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/payout/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Sync complete! ${data.updatedCount || 0} transactions updated.` });
        fetchData();
      } else {
        throw new Error(data.message || 'Sync failed');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to sync statuses' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Camlenio AEPS Payouts</h1>
          <p className="text-slate-500">Manage settings and view all payout transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncPendingStatuses}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Live Status...' : 'Sync Processing Transactions'}
          </button>
          <button
            onClick={fetchData}
            className="p-2 bg-white text-slate-600 rounded-xl hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Settings Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">System Settings</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Toggle AEPS Payout */}
            <div className="flex flex-col space-y-2 justify-center">
              <label className="text-sm font-bold text-slate-700">AEPS Payout Status</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, camlenio_is_enabled: !settings.camlenio_is_enabled })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    settings.camlenio_is_enabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      settings.camlenio_is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`font-medium ${settings.camlenio_is_enabled ? 'text-green-600' : 'text-slate-500'}`}>
                  {settings.camlenio_is_enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>
            </div>

            {/* Max Payout Amount */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Max Payout Amount (₹)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_max_payout}
                  onChange={(e) => setSettings({ ...settings, camlenio_max_payout: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Min Payout Amount */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Min Payout Amount (₹)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_min_payout}
                  onChange={(e) => setSettings({ ...settings, camlenio_min_payout: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Verification Charge */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">A/c Verify Charge (₹)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_verification_charge}
                  onChange={(e) => setSettings({ ...settings, camlenio_verification_charge: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Payout Charge */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Payout Charge (₹)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_payout_charge}
                  onChange={(e) => setSettings({ ...settings, camlenio_payout_charge: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Send className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Payout & Verification History</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Type / Bank Ref</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Charge</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {format(new Date(tx.created_at), 'dd MMM yyyy')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {format(new Date(tx.created_at), 'hh:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{tx.users_profiles?.name}</div>
                      <div className="text-xs text-slate-500">{tx.users_profiles?.mobile_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {tx.bank_ref === 'VERIFICATION_CHARGE' ? 'A/C Verification' : 'Payout Transfer'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {tx.bank_ref !== 'VERIFICATION_CHARGE' ? (tx.bank_ref || tx.txn_id) : tx.txn_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      ₹{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-red-600 font-medium">
                      ₹{tx.charge_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        tx.status === 'approved' ? 'bg-green-100 text-green-700' :
                        tx.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        tx.status === 'refunded' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {tx.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
