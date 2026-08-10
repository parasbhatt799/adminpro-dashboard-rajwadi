import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Settings2, Save, IndianRupee, RefreshCw, Send, CheckCircle2, AlertCircle, Search, Calendar, X, RotateCcw, Clock, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const getTodayStr = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

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

  // Date & History Filters State (Defaulting to 'today')
  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom'>('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Auto reset to Page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, startDate, endDate, statusFilter, searchQuery, itemsPerPage]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (timeRange === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (timeRange === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === 'custom') {
      if (startDate) {
        start = new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        end = new Date(`${endDate}T23:59:59.999`);
      }
    }

    return transactions.filter(tx => {
      // 1. Date filter
      if (start || end) {
        const txDate = new Date(tx.created_at);
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const userName = (tx.users_profiles?.name || '').toLowerCase();
        const userMobile = (tx.users_profiles?.mobile_number || '').toLowerCase();
        const bankRef = (tx.bank_ref || '').toLowerCase();
        const txnId = (tx.txn_id || '').toLowerCase();
        const amountStr = (tx.amount || '').toString();

        const matches =
          userName.includes(q) ||
          userMobile.includes(q) ||
          bankRef.includes(q) ||
          txnId.includes(q) ||
          amountStr.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [transactions, timeRange, startDate, endDate, statusFilter, searchQuery]);

  // Metric Stats Calculation for active date & search scope
  const stats = useMemo(() => {
    let successCount = 0;
    let successAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let failedCount = 0;
    let failedAmount = 0;

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (timeRange === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (timeRange === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (timeRange === 'custom') {
      if (startDate) start = new Date(`${startDate}T00:00:00`);
      if (endDate) end = new Date(`${endDate}T23:59:59.999`);
    }

    const scopeList = transactions.filter(tx => {
      if (start || end) {
        const txDate = new Date(tx.created_at);
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const userName = (tx.users_profiles?.name || '').toLowerCase();
        const userMobile = (tx.users_profiles?.mobile_number || '').toLowerCase();
        const bankRef = (tx.bank_ref || '').toLowerCase();
        const txnId = (tx.txn_id || '').toLowerCase();
        const amountStr = (tx.amount || '').toString();

        const matches =
          userName.includes(q) ||
          userMobile.includes(q) ||
          bankRef.includes(q) ||
          txnId.includes(q) ||
          amountStr.includes(q);

        if (!matches) return false;
      }
      return true;
    });

    scopeList.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      const st = (tx.status || '').toLowerCase();
      if (st === 'approved' || st === 'success' || st === 'successful') {
        successCount++;
        successAmount += amt;
      } else if (st === 'pending' || st === 'processing') {
        pendingCount++;
        pendingAmount += amt;
      } else if (st === 'rejected' || st === 'failed' || st === 'refunded') {
        failedCount++;
        failedAmount += amt;
      }
    });

    return {
      success: { count: successCount, amount: successAmount },
      pending: { count: pendingCount, amount: pendingAmount },
      failed: { count: failedCount, amount: failedAmount },
      totalCount: scopeList.length
    };
  }, [transactions, timeRange, startDate, endDate, searchQuery]);

  // Pagination Calculations
  const totalPages = useMemo(() => {
    if (itemsPerPage >= filteredTransactions.length || itemsPerPage <= 0) return 1;
    return Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  }, [filteredTransactions.length, itemsPerPage]);

  const paginatedTransactions = useMemo(() => {
    if (itemsPerPage >= filteredTransactions.length) return filteredTransactions;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const clearFilters = () => {
    setTimeRange('today');
    setStartDate(getTodayStr());
    setEndDate(getTodayStr());
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

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

  const [checkingId, setCheckingId] = useState<string | null>(null);

  const handleCheckStatus = async (tx: any) => {
    const txnId = tx.bank_ref || tx.txn_id || tx.id;
    setCheckingId(tx.id);
    setMessage(null);
    try {
      const res = await fetch('/api/payout/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txn_id: txnId, payoutId: tx.id })
      });
      const data = await res.json();
      if (data.success) {
        const statusMsg = data.data?.status_message || data.data?.status || 'Status updated';
        setMessage({ type: 'success', text: `Status for ${txnId}: ${statusMsg}` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to check status' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error checking status: ${err.message}` });
    } finally {
      setCheckingId(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Camlenio AEPS Payouts</h1>
          <p className="text-slate-500">Manage settings and view all payout transactions</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* AEPS Payout Toggle Switch near Refresh Button */}
          <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700">AEPS Payout:</span>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, camlenio_is_enabled: !settings.camlenio_is_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                settings.camlenio_is_enabled ? 'bg-green-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.camlenio_is_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-extrabold ${settings.camlenio_is_enabled ? 'text-green-600' : 'text-slate-500'}`}>
              {settings.camlenio_is_enabled ? 'Active (ON)' : 'Disabled (OFF)'}
            </span>
          </div>

          <button
            onClick={fetchData}
            className="p-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-50 border border-slate-200 transition-colors shadow-xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Settings Panel - Compact 1-Line Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">System Settings</h2>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Settings
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Max Payout Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Max Payout Amount (₹)</label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_max_payout}
                  onChange={(e) => setSettings({ ...settings, camlenio_max_payout: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Min Payout Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Min Payout Amount (₹)</label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_min_payout}
                  onChange={(e) => setSettings({ ...settings, camlenio_min_payout: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Verification Charge */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">A/c Verify Charge (₹)</label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_verification_charge}
                  onChange={(e) => setSettings({ ...settings, camlenio_verification_charge: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Payout Charge */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Payout Charge (₹)</label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  value={settings.camlenio_payout_charge}
                  onChange={(e) => setSettings({ ...settings, camlenio_payout_charge: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Payout & Verification History</h2>
              <p className="text-xs text-slate-500 font-medium">
                Showing {filteredTransactions.length} of {transactions.length} records
              </p>
            </div>
          </div>
        </div>

        {/* Metric Summary Cards Box (Success / Pending / Failed) */}
        <div className="p-4 bg-slate-50/30 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* SUCCESS BOX */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/15 shadow-xs'
                : 'bg-emerald-50/30 border-emerald-100/80 hover:bg-emerald-50/60 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Success</span>
              <div className="p-1 bg-emerald-100/50 rounded-md text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-black text-emerald-950">
                ₹{stats.success.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100/60 text-emerald-800 border border-emerald-200/50 rounded-full">
                {stats.success.count} Txns
              </span>
            </div>
          </div>

          {/* PENDING BOX */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/15 shadow-xs'
                : 'bg-amber-50/30 border-amber-100/80 hover:bg-amber-50/60 hover:border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Total Pending</span>
              <div className="p-1 bg-amber-100/50 rounded-md text-amber-600">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-black text-amber-950">
                ₹{stats.pending.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 bg-amber-100/60 text-amber-800 border border-amber-200/50 rounded-full">
                {stats.pending.count} Txns
              </span>
            </div>
          </div>

          {/* FAILED BOX */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/15 shadow-xs'
                : 'bg-rose-50/30 border-rose-100/80 hover:bg-rose-50/60 hover:border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Total Failed / Rejected</span>
              <div className="p-1 bg-rose-100/50 rounded-md text-rose-600">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-black text-rose-950">
                ₹{stats.failed.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 bg-rose-100/60 text-rose-800 border border-rose-200/50 rounded-full">
                {stats.failed.count} Txns
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, mobile, ref, txn ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="rejected">Rejected</option>
            <option value="refunded">Refunded</option>
          </select>

          {/* Date Filter Dropdown Box */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="py-1 bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range Pickers */}
          {timeRange === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Start</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 outline-none bg-transparent leading-none cursor-pointer"
                />
              </div>
              <div className="w-px h-5 bg-slate-200 mx-1"></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">End</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 outline-none bg-transparent leading-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Reset Button */}
          {(timeRange !== 'all' || statusFilter !== 'all' || searchQuery !== '') && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
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
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
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
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleCheckStatus(tx)}
                        disabled={checkingId === tx.id}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {checkingId === tx.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Check Status
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Rows per page Selector */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span>Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={999999}>All</option>
            </select>
          </div>

          {/* Entries Info Text */}
          <div className="text-xs font-medium text-slate-500">
            {filteredTransactions.length === 0 ? (
              'Showing 0 entries'
            ) : (
              `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)} to ${Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of ${filteredTransactions.length} entries`
            )}
          </div>

          {/* Previous & Next Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
