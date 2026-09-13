import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Wallet, 
  Settings2, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Lock,
  Building2,
  Phone,
  User,
  Hash,
  IndianRupee,
  HelpCircle,
  Key,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  X,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface IndiaTekSubmission {
  id: string;
  user_id?: string;
  account_number: string;
  ifsc_code: string;
  amount: number;
  beneficiary_name: string;
  customer_mobile: string;
  partner_reference: string;
  transaction_id?: string;
  status: string;
  charges?: number;
  created_at: string;
  response_payload?: any;
}

const ERROR_CODES = [
  { code: '400', status: 'VALIDATION_ERROR', desc: 'The request payload is invalid or missing required fields.' },
  { code: '401', status: 'UNAUTHORIZED', desc: 'Invalid or missing API credentials in headers.' },
  { code: '403', status: 'IP_NOT_WHITELISTED', desc: 'Your request originated from an IP address that is not whitelisted.' },
  { code: '402', status: 'INSUFFICIENT_FUNDS', desc: 'Your wallet balance is lower than the transaction amount.' },
  { code: '403', status: 'SERVICE_UNAVAILABLE', desc: 'The requested service is not activated for your account.' },
  { code: '404', status: 'NOT_FOUND', desc: 'The requested transaction or resource was not found.' },
  { code: '429', status: 'RATE_LIMIT_EXCEEDED', desc: 'You have exceeded your API rate limit (default 300 requests per minute).' },
  { code: '409', status: 'DUPLICATE_TRANSACTION', desc: 'The client_ref_id has already been processed.' },
  { code: '500', status: 'INTERNAL_ERROR', desc: 'An error occurred on our servers. Try again later.' },
  { code: '503', status: 'PROVIDER_DOWNTIME', desc: 'The upstream operator/provider is currently down.' }
];

export default function AdminIndiaTekPayout() {
  const [activeTab, setActiveTab] = useState<'history' | 'settings' | 'errors'>('history');
  
  // Wallet Balance State
  const [balance, setBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    username: '',
    api_secret: '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC',
    is_active: true,
    charge_amount: 0,
    verification_charge: 5,
    min_payout: 10,
    max_payout: 50000
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // History State
  const [submissions, setSubmissions] = useState<IndiaTekSubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Message State
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchBalance();
    fetchHistory();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/indiatek-payout/settings');
      const data = await res.json();
      if (data?.success && data?.data) {
        setSettings({
          username: data.data.username || '',
          api_secret: data.data.api_secret || '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC',
          is_active: data.data.is_active !== false,
          charge_amount: Number(data.data.charge_amount !== undefined ? data.data.charge_amount : 0),
          verification_charge: Number(data.data.verification_charge !== undefined ? data.data.verification_charge : 5),
          min_payout: Number(data.data.min_payout !== undefined ? data.data.min_payout : 10),
          max_payout: Number(data.data.max_payout !== undefined ? data.data.max_payout : 50000)
        });
      }
    } catch (err) {
      console.error('Error fetching IndiaTek settings:', err);
    }
  };

  const fetchBalance = async () => {
    setFetchingBalance(true);
    try {
      const res = await fetch('/api/indiatek-payout/balance');
      const data = await res.json();
      if (data?.status === 'SUCCESS' && data?.data?.balance !== undefined) {
        setBalance(Number(data.data.balance));
      } else if (data?.balance !== undefined) {
        setBalance(Number(data.balance));
      } else {
        console.warn('Balance format:', data);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setFetchingBalance(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/indiatek-payout/history');
      const data = await res.json();
      if (data?.success && Array.isArray(data?.data)) {
        setSubmissions(data.data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setMessage(null);
    try {
      // 1. Save directly to Supabase table
      const { error: dbErr } = await supabase
        .from('indiatek_payout_settings')
        .upsert({
          id: 1,
          username: settings.username.trim(),
          api_secret: settings.api_secret.trim(),
          is_active: settings.is_active,
          charge_amount: Number(settings.charge_amount || 0),
          verification_charge: Number(settings.verification_charge !== undefined ? settings.verification_charge : 5),
          min_payout: Number(settings.min_payout !== undefined ? settings.min_payout : 10),
          max_payout: Number(settings.max_payout !== undefined ? settings.max_payout : 50000),
          updated_at: new Date().toISOString()
        });

      // 2. Call backend route
      try {
        await fetch('/api/indiatek-payout/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
      } catch (backendErr) {
        console.warn('Backend sync warning:', backendErr);
      }

      if (!dbErr) {
        setMessage({ type: 'success', text: 'UsePayout credentials saved successfully!' });
        fetchBalance();
      } else {
        setMessage({ type: 'error', text: dbErr.message || 'Failed to save settings' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error saving settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCheckLiveStatus = async (partnerRef?: string, txnId?: string) => {
    const queryId = String(partnerRef || txnId || '').trim();
    if (!queryId) return;

    setCheckingStatusId(queryId);
    try {
      const res = await fetch(`/api/indiatek-payout/status/${encodeURIComponent(queryId)}`);
      const data = await res.json();
      fetchHistory();
      const st = data?.status || data?.data?.status || 'Fetched';
      setMessage({ type: 'success', text: `Status for ${queryId}: ${st}` });
    } catch (err) {
      console.error('Error checking live status:', err);
      setMessage({ type: 'error', text: 'Failed to fetch status from IndiaTek API' });
    } finally {
      setCheckingStatusId(null);
    }
  };

  // Refund State
  const [refundModalSub, setRefundModalSub] = useState<IndiaTekSubmission | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refundReason, setRefundReason] = useState('Bank payout not received by customer');

  const handleOpenRefundModal = (sub: IndiaTekSubmission) => {
    setRefundModalSub(sub);
    setRefundReason('Bank payout not received by customer');
  };

  const handleConfirmRefund = async () => {
    if (!refundModalSub) return;
    setRefunding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/payout/admin-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId: refundModalSub.partner_reference || refundModalSub.transaction_id || refundModalSub.id,
          txn_id: refundModalSub.partner_reference || refundModalSub.transaction_id,
          reason: refundReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: `✅ ${data.message || 'Payout refunded successfully!'} (Amount + Charge credited to user wallet)`
        });
        setRefundModalSub(null);
        fetchHistory();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to refund payout' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Refund error: ${err.message}` });
    } finally {
      setRefunding(false);
    }
  };

  const filteredHistory = submissions.filter(sub => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      sub.partner_reference?.toLowerCase().includes(q) ||
      sub.transaction_id?.toLowerCase().includes(q) ||
      sub.account_number?.toLowerCase().includes(q) ||
      sub.beneficiary_name?.toLowerCase().includes(q) ||
      sub.customer_mobile?.toLowerCase().includes(q) ||
      sub.status?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || sub.status?.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-800/40 rounded-3xl p-6 md:p-8 shadow-xl text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300 shadow-inner">
            <Send className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                UsePayout
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
                Instant Payout Provider
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              Manage UsePayout Gateway, API Credentials & Live Transactions
            </p>
          </div>
        </div>

        {/* Live Balance Widget & Status Badge */}
        <div className="flex items-center gap-4 flex-wrap relative z-10">
          <div className="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl px-6 py-3.5 flex items-center gap-4 shadow-lg">
            <div className="p-2.5 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-indigo-200 font-semibold tracking-wide uppercase">UsePayout API Balance</div>
              <div className="text-xl font-black text-emerald-300 flex items-center gap-2">
                {fetchingBalance ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />
                ) : balance !== null ? (
                  `₹ ${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                ) : (
                  <span className="text-sm text-slate-300">Click Refresh</span>
                )}
              </div>
            </div>
            <button
              onClick={fetchBalance}
              disabled={fetchingBalance}
              title="Refresh Live Balance"
              className="p-2 hover:bg-white/20 rounded-xl transition-all text-slate-200 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${fetchingBalance ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-lg ${
            settings.is_active 
              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' 
              : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${settings.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {settings.is_active ? 'Service Active' : 'Disabled'}
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
              <span className="text-sm font-semibold">{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" /> Payout Transactions ({submissions.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Settings2 className="w-4 h-4" /> API Credentials & Settings
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'errors'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <HelpCircle className="w-4 h-4" /> Error Codes Reference
        </button>
      </div>

      {/* TAB 1: PAYOUT TRANSACTIONS HISTORY & LIVE STATUS */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" /> UsePayout History
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time status tracking for all UsePayout transactions</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="SUCCESS">SUCCESS / APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED / ERROR</option>
              </select>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Ref, Txn ID, Account..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Date / Time</th>
                  <th className="p-3.5">Partner Reference</th>
                  <th className="p-3.5">Beneficiary Details</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Txn ID</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" /> Loading transactions...
                    </td>
                  </tr>
                ) : paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No UsePayout transactions found.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-500 whitespace-nowrap font-medium">
                        {new Date(sub.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        {sub.partner_reference}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{sub.beneficiary_name}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{sub.account_number} ({sub.ifsc_code})</div>
                        <div className="text-slate-400 text-[10px]">Mob: {sub.customer_mobile}</div>
                      </td>
                      <td className="p-3.5 font-black text-emerald-600 text-sm whitespace-nowrap">
                        ₹ {Number(sub.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {sub.transaction_id || '-'}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full font-extrabold text-[10px] tracking-wide inline-flex items-center gap-1 ${
                          sub.status === 'SUCCESS' || sub.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {sub.status === 'SUCCESS' || sub.status === 'APPROVED' ? <CheckCircle2 className="w-3 h-3" /> : sub.status === 'PENDING' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {sub.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCheckLiveStatus(sub.partner_reference, sub.transaction_id)}
                            disabled={checkingStatusId === (sub.partner_reference || sub.transaction_id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-indigo-700 hover:text-indigo-900 rounded-xl text-xs font-bold border border-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${checkingStatusId === (sub.partner_reference || sub.transaction_id) ? 'animate-spin' : ''}`} />
                            Check Status
                          </button>

                          {!['FAILED', 'REJECTED', 'REFUNDED'].includes((sub.status || '').toUpperCase()) ? (
                            <button
                              onClick={() => handleOpenRefundModal(sub)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              title="Refund payout to user wallet"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Refund
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-200 select-none inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-slate-400" />
                              Refunded
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-500 font-semibold">
              <div>Page {currentPage} of {totalPages} ({filteredHistory.length} items)</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: API CREDENTIALS & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 max-w-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-indigo-600" /> UsePayout Credentials
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure your registered mobile username and API secret headers for UsePayout API.
            </p>
          </div>

          {/* IP Whitelist Info Banner */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">KingWallet Server IP Whitelist Required</div>
              <p>
                KingWallet strictly allows API calls from whitelisted server IPs. Your live server IP is:{' '}
                <code className="px-2 py-0.5 bg-white border border-indigo-200 rounded font-mono font-bold text-indigo-700">
                  143.244.140.126
                </code>
              </p>
              <p className="text-slate-500">
                Please log in to <strong className="text-slate-700">app.kingwallet.in &rarr; API Keys</strong> and add this IP to your whitelist.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Username (Registered Mobile Number) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={settings.username}
                  onChange={e => setSettings({ ...settings, username: e.target.value.trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                X-API-SECRET Header Key *
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="API Secret Key"
                  value={settings.api_secret}
                  onChange={e => setSettings({ ...settings, api_secret: e.target.value.trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                />
              </div>
            </div>

            {/* Dynamic Charges & Limits Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-indigo-600" /> Payout Service Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.charge_amount}
                  onChange={e => setSettings({ ...settings, charge_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-400">Dynamic fee deducted from user wallet per payout</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-indigo-600" /> A/C Verification Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.verification_charge}
                  onChange={e => setSettings({ ...settings, verification_charge: parseFloat(e.target.value) || 0 })}
                  placeholder="5.00"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-400">Fee deducted when user verifies a new bank account</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-500" /> Min Payout Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.min_payout}
                  onChange={e => setSettings({ ...settings, min_payout: parseFloat(e.target.value) || 0 })}
                  placeholder="10"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-400">Minimum allowed amount per transaction</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-500" /> Max Payout Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.max_payout}
                  onChange={e => setSettings({ ...settings, max_payout: parseFloat(e.target.value) || 0 })}
                  placeholder="50000"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-400">Maximum allowed amount per transaction</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Service Status
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.is_active}
                  onChange={e => setSettings({ ...settings, is_active: e.target.checked })}
                  className="w-5 h-5 rounded bg-white border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">Enable UsePayout API Service</div>
                  <div className="text-xs text-slate-500">Allow merchants/users to execute instant payouts via UsePayout API</div>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Settings2 className="w-5 h-5" />}
              Save UsePayout Credentials
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: ERROR CODES REFERENCE */}
      {activeTab === 'errors' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" /> Standard API Error Codes Reference
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">UsePayout API HTTP response error codes documentation</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5">HTTP Code</th>
                  <th className="p-3.5">Error Status</th>
                  <th className="p-3.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono">
                {ERROR_CODES.map((err, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3.5 text-amber-600 font-bold text-sm">{err.code}</td>
                    <td className="p-3.5 text-rose-600 font-bold text-sm">{err.status}</td>
                    <td className="p-3.5 text-slate-700 font-sans text-xs">{err.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundModalSub && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => !refunding && setRefundModalSub(null)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative border border-slate-200 space-y-5"
          >
            <button
              onClick={() => !refunding && setRefundModalSub(null)}
              disabled={refunding}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer disabled:opacity-40"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">Refund UsePayout Transaction</h3>
                <p className="text-xs text-slate-500 font-medium font-mono">
                  Ref: {refundModalSub.partner_reference || refundModalSub.transaction_id || refundModalSub.id}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Are you sure you want to refund this payout? The status will be marked as <strong className="font-bold text-rose-700">FAILED</strong> and the entire amount (<strong className="font-bold">Transfer Amount + Service Charge</strong>) will be credited back to the user's wallet immediately.
              </p>
            </div>

            {/* Breakdown Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Beneficiary Details:</span>
                <span className="font-bold text-slate-900 font-mono text-right">
                  {refundModalSub.beneficiary_name}
                  <span className="block text-[11px] text-slate-500 font-normal">
                    {refundModalSub.account_number} ({refundModalSub.ifsc_code})
                  </span>
                </span>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Transfer Amount:</span>
                <span className="font-bold text-slate-900">
                  ₹{Number(refundModalSub.amount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Service Charge:</span>
                <span className="font-bold text-rose-600">
                  + ₹{Number(refundModalSub.charges || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-bold">
                <span className="text-slate-900">Total Refund to User Wallet:</span>
                <span className="text-emerald-700 font-black text-base">
                  ₹{(Number(refundModalSub.amount || 0) + Number(refundModalSub.charges || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Reason Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Refund Reason (રિફંડનું કારણ)
              </label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Bank payout not received by customer"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRefundModalSub(null)}
                disabled={refunding}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={refunding}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {refunding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Refunding...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Confirm & Refund ₹{(Number(refundModalSub.amount || 0) + Number(refundModalSub.charges || 0)).toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
