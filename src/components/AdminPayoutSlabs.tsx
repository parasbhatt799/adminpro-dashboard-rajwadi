import React, { useState, useEffect } from 'react';
import {
  Layers,
  Power,
  Key,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  HelpCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Receipt,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

interface PayoutSlab {
  id: string;
  min_amount: number;
  max_amount: number;
  charge_type: 'flat' | 'percentage';
  charge_value: number;
  is_active: boolean;
}

interface NixasoftSettings {
  is_active: boolean;
  api_token: string;
  auth_token: string;
  min_payout: number;
  max_payout: number;
  notice: string;
  slabs: PayoutSlab[];
}

export default function AdminPayoutSlabs() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<NixasoftSettings>({
    is_active: true,
    api_token: 'fba1b6568695f15ab0a3fc2efbf29f53',
    auth_token: '',
    min_payout: 100,
    max_payout: 200000,
    notice: 'Instant 24x7 IMPS / NEFT Bank Payout',
    slabs: []
  });

  const [showApiToken, setShowApiToken] = useState(false);

  // Slab modal
  const [isSlabModalOpen, setIsSlabModalOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<PayoutSlab | null>(null);
  const [slabForm, setSlabForm] = useState({
    min_amount: '',
    max_amount: '',
    charge_type: 'flat' as 'flat' | 'percentage',
    charge_value: '',
    is_active: true
  });
  const [savingSlab, setSavingSlab] = useState(false);

  // Test Calculator
  const [calcAmount, setCalcAmount] = useState('5000');

  // Recent Transactions
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/nixasoft-payout/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err: any) {
      console.error('Error fetching Nixasoft settings:', err);
      showToast('error', 'Failed to load payout settings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Recent Transactions
  const fetchRecentTxns = async () => {
    try {
      setLoadingTxns(true);
      const { data, error } = await supabase
        .from('payout_submissions')
        .select('*, users_profiles(name, firm_name, mobile_number)')
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      setRecentTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching recent payouts:', err);
    } finally {
      setLoadingTxns(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchRecentTxns();
  }, []);

  // Save Settings & Toggle
  const handleSaveSettings = async (overrideActive?: boolean) => {
    try {
      setSavingSettings(true);
      const payload = {
        ...settings,
        is_active: overrideActive !== undefined ? overrideActive : settings.is_active
      };

      const res = await fetch('/api/nixasoft-payout/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSettings(data.settings);
        showToast('success', overrideActive !== undefined 
          ? `Payout service turned ${overrideActive ? 'ON' : 'OFF'} successfully` 
          : 'Settings saved successfully');
      } else {
        showToast('error', data.message || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle Master Switch
  const handleToggleMasterService = async () => {
    const nextState = !settings.is_active;
    setSettings(prev => ({ ...prev, is_active: nextState }));
    await handleSaveSettings(nextState);
  };

  // Open Modal to Add Slab
  const handleOpenAddSlab = () => {
    setEditingSlab(null);
    setSlabForm({
      min_amount: '',
      max_amount: '',
      charge_type: 'flat',
      charge_value: '',
      is_active: true
    });
    setIsSlabModalOpen(true);
  };

  // Open Modal to Edit Slab
  const handleOpenEditSlab = (slab: PayoutSlab) => {
    setEditingSlab(slab);
    setSlabForm({
      min_amount: String(slab.min_amount),
      max_amount: String(slab.max_amount),
      charge_type: slab.charge_type,
      charge_value: String(slab.charge_value),
      is_active: slab.is_active
    });
    setIsSlabModalOpen(true);
  };

  // Save Slab (Add or Edit)
  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slabForm.min_amount || !slabForm.max_amount || !slabForm.charge_value) {
      showToast('warning', 'Please fill in all slab fields');
      return;
    }

    const min = Number(slabForm.min_amount);
    const max = Number(slabForm.max_amount);
    const val = Number(slabForm.charge_value);

    if (min >= max) {
      showToast('warning', 'Maximum amount must be greater than minimum amount');
      return;
    }

    try {
      setSavingSlab(true);
      const url = editingSlab 
        ? `/api/nixasoft-payout/admin/slabs/${editingSlab.id}` 
        : '/api/nixasoft-payout/admin/slabs';
      const method = editingSlab ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_amount: min,
          max_amount: max,
          charge_type: slabForm.charge_type,
          charge_value: val,
          is_active: slabForm.is_active
        })
      });

      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, slabs: data.slabs }));
        setIsSlabModalOpen(false);
        showToast('success', editingSlab ? 'Slab updated successfully' : 'New slab added successfully');
      } else {
        showToast('error', data.message || 'Failed to save slab');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving slab');
    } finally {
      setSavingSlab(false);
    }
  };

  // Delete Slab
  const handleDeleteSlab = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payout charge slab?')) return;

    try {
      const res = await fetch(`/api/nixasoft-payout/admin/slabs/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, slabs: data.slabs }));
        showToast('success', 'Slab deleted successfully');
      } else {
        showToast('error', data.message || 'Failed to delete slab');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting slab');
    }
  };

  // Toggle Single Slab Status
  const handleToggleSlabStatus = async (slab: PayoutSlab) => {
    try {
      const res = await fetch(`/api/nixasoft-payout/admin/slabs/${slab.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !slab.is_active })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, slabs: data.slabs }));
        showToast('success', `Slab ${!slab.is_active ? 'activated' : 'deactivated'}`);
      }
    } catch (err: any) {
      showToast('error', 'Error updating slab status');
    }
  };

  // Live Status Check for Payout Transaction
  const handleCheckStatus = async (txn: any) => {
    const reqId = txn.txn_id || txn.transaction_id;
    if (!reqId) {
      showToast('warning', 'No request ID available for status check');
      return;
    }

    try {
      setCheckingStatusId(txn.id);
      const res = await fetch('/api/nixasoft-payout/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: reqId, payoutId: txn.id })
      });
      const data = await res.json();

      if (data.success && data.apiStatus) {
        showToast('info', `Status: ${data.apiStatus.statuscode} - ${data.apiStatus.message}`);
        fetchRecentTxns();
      } else {
        showToast('error', 'Could not fetch status from Nixasoft');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to query status');
    } finally {
      setCheckingStatusId(null);
    }
  };

  // Live Calculator Evaluation
  const testAmount = Number(calcAmount) || 0;
  const activeSlabs = (settings.slabs || []).filter(s => s.is_active);
  const matchedSlab = activeSlabs.find(s => testAmount >= s.min_amount && testAmount <= s.max_amount);
  const calcCharge = matchedSlab 
    ? (matchedSlab.charge_type === 'percentage' 
        ? (testAmount * matchedSlab.charge_value) / 100 
        : matchedSlab.charge_value)
    : 25;
  const calcTotal = testAmount + calcCharge;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading Payout Configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Title & Master Control Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-indigo-500/20">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-400">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Payout Slabs & Service Settings
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Nixasoft Instant 24x7 Payout API, dynamic charge slabs, and master service toggle
              </p>
            </div>
          </div>
        </div>

        {/* Master ON/OFF Switch */}
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10">
          <div className="text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
              Payout Service Status
            </span>
            <span className={`text-sm font-black flex items-center gap-1.5 justify-end ${
              settings.is_active ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${settings.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {settings.is_active ? 'SERVICE ACTIVE (ON)' : 'SERVICE DISABLED (OFF)'}
            </span>
          </div>

          <button
            onClick={handleToggleMasterService}
            disabled={savingSettings}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none shadow-inner ${
              settings.is_active ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                settings.is_active ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Info Notice about Tester Access */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 font-medium leading-relaxed">
          <span className="font-bold">Service Visibility Rule:</span> When the Payout Service is{' '}
          <span className="font-black text-rose-600">OFF</span>, the Instant Payout menu is completely hidden from all normal users. 
          However, users marked as <span className="font-black text-indigo-700">Tester Users (is_tester: true)</span> can still see and test the payout service at any time.
        </div>
      </div>

      {/* Grid: Credentials & Slabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: API Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-lg">API Configuration</h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                Nixasoft Fintech
              </span>
            </div>

            <div className="space-y-4">
              {/* API Token */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nixasoft API Token
                </label>
                <div className="relative">
                  <input
                    type={showApiToken ? 'text' : 'password'}
                    value={settings.api_token}
                    onChange={e => setSettings({ ...settings, api_token: e.target.value })}
                    className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    placeholder="Enter Nixasoft API Token"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiToken(!showApiToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showApiToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Basic Auth Token (optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Authorization Header (Optional for Status Report)
                </label>
                <input
                  type="text"
                  value={settings.auth_token}
                  onChange={e => setSettings({ ...settings, auth_token: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="Basic <AUTH_TOKEN>"
                />
              </div>

              {/* Min & Max Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Min Payout (₹)
                  </label>
                  <input
                    type="number"
                    value={settings.min_payout}
                    onChange={e => setSettings({ ...settings, min_payout: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Max Payout (₹)
                  </label>
                  <input
                    type="number"
                    value={settings.max_payout}
                    onChange={e => setSettings({ ...settings, max_payout: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    placeholder="200000"
                  />
                </div>
              </div>

              {/* User Notice */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  User Notice Banner
                </label>
                <input
                  type="text"
                  value={settings.notice}
                  onChange={e => setSettings({ ...settings, notice: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="e.g. Instant 24x7 IMPS Payout Available"
                />
              </div>

              {/* Webhook Endpoint Display */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Callback Webhook URL (For Nixasoft Dashboard)
                </span>
                <span className="text-xs font-mono font-medium text-slate-700 select-all break-all">
                  {window.location.origin}/api/nixasoft-payout/callback
                </span>
              </div>

              <button
                onClick={() => handleSaveSettings()}
                disabled={savingSettings}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save API Settings
              </button>
            </div>
          </div>

          {/* Live Slab Calculator Widget */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-violet-50/70 rounded-3xl p-6 border border-indigo-100/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Fee Simulator / Slab Tester</h3>
            </div>
            <p className="text-xs text-slate-500">
              Type an amount to verify which slab applies and the exact amount deducted from the user's wallet.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Test Amount (₹)
                </label>
                <input
                  type="number"
                  value={calcAmount}
                  onChange={e => setCalcAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="5000"
                />
              </div>

              <div className="p-4 bg-white rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Transfer Amount:</span>
                  <span className="font-bold text-slate-900">₹{testAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Matched Slab:</span>
                  <span className="font-bold text-indigo-600">
                    {matchedSlab 
                      ? `₹${matchedSlab.min_amount.toLocaleString()} - ₹${matchedSlab.max_amount.toLocaleString()}` 
                      : 'Default / Out of range'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-rose-600">
                  <span>Payout Fee:</span>
                  <span className="font-black">+ ₹{calcCharge.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Wallet Debit:</span>
                  <span className="text-indigo-600">₹{calcTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Slabs List & Manager (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  Dynamic Charge Slabs
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                    {settings.slabs?.length || 0} Slabs
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure tier-based fees (e.g. ₹100-50,000 = ₹25, ₹50,001-1,00,000 = ₹50)
                </p>
              </div>

              <button
                onClick={handleOpenAddSlab}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-100 transition-all"
              >
                <Plus size={16} />
                Add New Slab
              </button>
            </div>

            {/* Slabs Table / Cards */}
            {(!settings.slabs || settings.slabs.length === 0) ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No Payout Slabs Configured</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click the "Add New Slab" button above to create tier-based payout charges.
                </p>
                <button
                  onClick={handleOpenAddSlab}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Create First Slab
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 px-3">Range (From - To)</th>
                      <th className="pb-3 px-3">Charge Type</th>
                      <th className="pb-3 px-3">Charge Amount</th>
                      <th className="pb-3 px-3 text-center">Status</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {settings.slabs.map((slab, idx) => (
                      <tr key={slab.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-3 font-bold text-slate-900">
                          <span className="text-indigo-600">₹{slab.min_amount.toLocaleString()}</span>
                          <span className="text-slate-400 mx-1.5">→</span>
                          <span>₹{slab.max_amount.toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                            slab.charge_type === 'percentage'
                              ? 'bg-purple-50 text-purple-700 border border-purple-100'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            {slab.charge_type === 'percentage' ? 'Percentage (%)' : 'Flat Fee (₹)'}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-black text-rose-600">
                          {slab.charge_type === 'percentage' ? `${slab.charge_value}%` : `₹${slab.charge_value}`}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <button
                            onClick={() => handleToggleSlabStatus(slab)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-all ${
                              slab.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {slab.is_active ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-4 px-3 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditSlab(slab)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Slab"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteSlab(slab.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Slab"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Payout Submissions with Live Status Check */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  Recent Payout Transactions
                </h3>
                <p className="text-xs text-slate-500">Real-time status check with Nixasoft API</p>
              </div>
              <button
                onClick={fetchRecentTxns}
                disabled={loadingTxns}
                className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors"
                title="Refresh Transactions"
              >
                <RefreshCw size={16} className={loadingTxns ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingTxns ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading payouts...</div>
            ) : recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No recent payout transactions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                      <th className="pb-2">User / Firm</th>
                      <th className="pb-2">Beneficiary Bank</th>
                      <th className="pb-2">Amount + Fee</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-900">
                          {tx.users_profiles?.firm_name || tx.users_profiles?.name || tx.user_id}
                          <span className="block text-[10px] font-mono text-slate-400">{tx.txn_id || tx.id.slice(0, 8)}</span>
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-700">{tx.bank_name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{tx.account_number}</span>
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-900">₹{Number(tx.amount).toLocaleString()}</span>
                          <span className="block text-[10px] text-rose-500">+₹{Number(tx.charge_amount || 0).toLocaleString()} fee</span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            tx.status === 'approved' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : tx.status === 'rejected' || tx.status === 'failed'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {tx.status}
                          </span>
                          {tx.utr_number && (
                            <span className="block text-[9px] font-mono text-slate-500 mt-0.5">UTR: {tx.utr_number}</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleCheckStatus(tx)}
                            disabled={checkingStatusId === tx.id}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                          >
                            {checkingStatusId === tx.id ? <Loader2 size={12} className="animate-spin inline" /> : 'Check Status'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Slab Modal */}
      <AnimatePresence>
        {isSlabModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingSlab ? 'Edit Payout Slab' : 'Add New Payout Slab'}
                </h3>
                <button
                  onClick={() => setIsSlabModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSlab} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Min Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={slabForm.min_amount}
                      onChange={e => setSlabForm({ ...slabForm, min_amount: e.target.value })}
                      placeholder="100"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Max Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={slabForm.max_amount}
                      onChange={e => setSlabForm({ ...slabForm, max_amount: e.target.value })}
                      placeholder="50000"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Charge Type
                    </label>
                    <select
                      value={slabForm.charge_type}
                      onChange={e => setSlabForm({ ...slabForm, charge_type: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    >
                      <option value="flat">Flat Fee (₹)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Charge Value {slabForm.charge_type === 'flat' ? '(₹)' : '(%)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={slabForm.charge_value}
                      onChange={e => setSlabForm({ ...slabForm, charge_value: e.target.value })}
                      placeholder={slabForm.charge_type === 'flat' ? '25' : '1.5'}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="slab_active_chk"
                    checked={slabForm.is_active}
                    onChange={e => setSlabForm({ ...slabForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="slab_active_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Enable this slab immediately
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSlabModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSlab}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingSlab ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editingSlab ? 'Update Slab' : 'Create Slab'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
