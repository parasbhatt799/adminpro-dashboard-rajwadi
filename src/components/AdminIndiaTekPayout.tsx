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
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'settings' | 'errors'>('send');
  
  // Wallet Balance State
  const [balance, setBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    username: '',
    api_secret: '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC',
    is_active: true,
    charge_amount: 0
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Send Payout Form State
  const [formData, setFormData] = useState({
    account_number: '',
    ifsc_code: '',
    amount: '',
    beneficiary_name: '',
    customer_mobile: '',
    partner_reference: ''
  });
  const [sendingPayout, setSendingPayout] = useState(false);
  const [payoutResult, setPayoutResult] = useState<any>(null);

  // History State
  const [submissions, setSubmissions] = useState<IndiaTekSubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Message State
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchBalance();
    fetchHistory();
  }, []);

  const generateRef = () => {
    const ref = `ITP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData(prev => ({ ...prev, partner_reference: ref }));
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/indiatek-payout/settings');
      const data = await res.json();
      if (data?.success && data?.data) {
        setSettings({
          username: data.data.username || '',
          api_secret: data.data.api_secret || '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC',
          is_active: data.data.is_active !== false,
          charge_amount: Number(data.data.charge_amount || 0)
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
      const res = await fetch('/api/indiatek-payout/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data?.success) {
        setMessage({ type: 'success', text: 'IndiaTek Payout settings saved successfully!' });
        fetchBalance();
      } else {
        setMessage({ type: 'error', text: data?.message || 'Failed to save settings' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error saving settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingPayout(true);
    setPayoutResult(null);
    setMessage(null);

    const ref = formData.partner_reference || `ITP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const res = await fetch('/api/indiatek-payout/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          amount: formData.amount,
          beneficiary_name: formData.beneficiary_name,
          customer_mobile: formData.customer_mobile,
          partner_reference: ref
        })
      });
      const data = await res.json();
      setPayoutResult(data);

      if (data?.success) {
        setMessage({ type: 'success', text: `Payout initiated! Ref: ${ref}` });
        setFormData({ account_number: '', ifsc_code: '', amount: '', beneficiary_name: '', customer_mobile: '', partner_reference: '' });
        fetchBalance();
        fetchHistory();
      } else {
        setMessage({ type: 'error', text: data?.message || 'Payout failed. Please check parameters.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Network error initiating payout' });
    } finally {
      setSendingPayout(false);
    }
  };

  const handleCheckLiveStatus = async (partnerRef: string) => {
    setCheckingStatusId(partnerRef);
    try {
      const res = await fetch(`/api/indiatek-payout/status/${partnerRef}`);
      const data = await res.json();
      fetchHistory();
    } catch (err) {
      console.error('Error checking live status:', err);
    } finally {
      setCheckingStatusId(null);
    }
  };

  const filteredHistory = submissions.filter(sub => {
    const q = searchQuery.toLowerCase();
    return (
      sub.partner_reference?.toLowerCase().includes(q) ||
      sub.transaction_id?.toLowerCase().includes(q) ||
      sub.account_number?.toLowerCase().includes(q) ||
      sub.beneficiary_name?.toLowerCase().includes(q) ||
      sub.customer_mobile?.toLowerCase().includes(q) ||
      sub.status?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-gray-100">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/20 backdrop-blur-md rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 border border-blue-400/20 rounded-xl text-blue-400">
              <Send className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                IndiaTek Payout
              </h1>
              <p className="text-sm text-gray-400">KingWallet by IndiaTek Payout Integration & Management</p>
            </div>
          </div>
        </div>

        {/* Balance Card & Status */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl px-5 py-3 flex items-center gap-4">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium">IndiaTek Live Balance</div>
              <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                {fetchingBalance ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                ) : balance !== null ? (
                  `₹ ${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                ) : (
                  <span className="text-sm text-gray-400">Click refresh</span>
                )}
              </div>
            </div>
            <button
              onClick={fetchBalance}
              disabled={fetchingBalance}
              title="Refresh Balance"
              className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${fetchingBalance ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            settings.is_active 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${settings.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {settings.is_active ? 'Service Active' : 'Service Disabled'}
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
            className={`p-4 rounded-xl border flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white text-sm font-bold px-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'send'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <Send className="w-4 h-4" /> Send Payout
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" /> Payout History ({submissions.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <Settings2 className="w-4 h-4" /> API Credentials
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'errors'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <HelpCircle className="w-4 h-4" /> Error Codes
        </button>
      </div>

      {/* TAB 1: SEND PAYOUT FORM */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" /> Initiate IndiaTek Payout
            </h2>

            <form onSubmit={handleSendPayout} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Beneficiary Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={formData.beneficiary_name}
                      onChange={e => setFormData({ ...formData, beneficiary_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Customer Mobile *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={formData.customer_mobile}
                      onChange={e => setFormData({ ...formData, customer_mobile: e.target.value.replace(/\D/g, '') })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Account Number *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                    <input
                      type="text"
                      required
                      placeholder="Bank Account Number"
                      value={formData.account_number}
                      onChange={e => setFormData({ ...formData, account_number: e.target.value.trim() })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    IFSC Code *
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC0001234"
                      value={formData.ifsc_code}
                      onChange={e => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase().trim() })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 uppercase font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Transfer Amount (INR) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Amount in ₹"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-400">
                      Partner Reference ID (Order ID)
                    </label>
                    <button
                      type="button"
                      onClick={generateRef}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Generate Auto
                    </button>
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Auto generated if left blank"
                      value={formData.partner_reference}
                      onChange={e => setFormData({ ...formData, partner_reference: e.target.value.trim() })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={sendingPayout}
                className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingPayout ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> Processing Payout...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" /> Execute IndiaTek Payout Now
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Panel Result Box */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Transaction Result
            </h3>

            {payoutResult ? (
              <div className="space-y-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    payoutResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {payoutResult.status || (payoutResult.success ? 'SUCCESS' : 'FAILED')}
                  </span>
                </div>
                {payoutResult.partner_reference && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Partner Ref:</span>
                    <span className="font-mono text-gray-200">{payoutResult.partner_reference}</span>
                  </div>
                )}
                {payoutResult.transaction_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Txn ID:</span>
                    <span className="font-mono text-emerald-400">{payoutResult.transaction_id}</span>
                  </div>
                )}
                <div className="text-xs text-gray-300 pt-2 border-t border-gray-700/50">
                  <span className="font-semibold">Message:</span> {payoutResult.message || JSON.stringify(payoutResult)}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 text-xs space-y-2">
                <Send className="w-8 h-8 mx-auto opacity-30 text-blue-400" />
                <p>Fill out the form and submit to initiate IndiaTek Payout.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PAYOUT HISTORY & STATUS */}
      {activeTab === 'history' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" /> Payout Submissions History
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                placeholder="Search Ref, Txn ID, Account..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-800/80 text-gray-400 font-semibold border-b border-gray-800">
                <tr>
                  <th className="p-3">Date/Time</th>
                  <th className="p-3">Partner Reference</th>
                  <th className="p-3">Beneficiary Details</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Txn ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" /> Loading history...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No IndiaTek payout transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(sub => (
                    <tr key={sub.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-3 text-gray-400 whitespace-nowrap">
                        {new Date(sub.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-mono font-semibold text-blue-300 whitespace-nowrap">
                        {sub.partner_reference}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-200">{sub.beneficiary_name}</div>
                        <div className="text-gray-400 font-mono">{sub.account_number} ({sub.ifsc_code})</div>
                        <div className="text-gray-500 text-[10px]">Mob: {sub.customer_mobile}</div>
                      </td>
                      <td className="p-3 font-bold text-emerald-400 whitespace-nowrap">
                        ₹ {Number(sub.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-mono text-gray-400 whitespace-nowrap">
                        {sub.transaction_id || '-'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          sub.status === 'SUCCESS' || sub.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : sub.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleCheckLiveStatus(sub.partner_reference)}
                          disabled={checkingStatusId === sub.partner_reference}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-semibold border border-gray-700 transition-colors inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingStatusId === sub.partner_reference ? 'animate-spin' : ''}`} />
                          Check Live
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: API CREDENTIALS & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-400" /> KingWallet by IndiaTek Credentials
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Username (Registered Mobile Number) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={settings.username}
                  onChange={e => setSettings({ ...settings, username: e.target.value.trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                X-API-SECRET Header Key *
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="API Secret Key"
                  value={settings.api_secret}
                  onChange={e => setSettings({ ...settings, api_secret: e.target.value.trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Service Active Status
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                <input
                  type="checkbox"
                  checked={settings.is_active}
                  onChange={e => setSettings({ ...settings, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
                />
                <span className="text-xs font-medium text-gray-200">Enable IndiaTek Payout API Service</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              Save IndiaTek Credentials
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: ERROR CODES REFERENCE */}
      {activeTab === 'errors' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-400" /> Standard API Error Codes Reference
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-800/80 text-gray-400 font-semibold border-b border-gray-800">
                <tr>
                  <th className="p-3">HTTP Code</th>
                  <th className="p-3">Error Status</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-mono">
                {ERROR_CODES.map((err, i) => (
                  <tr key={i} className="hover:bg-gray-800/30">
                    <td className="p-3 text-amber-400 font-bold">{err.code}</td>
                    <td className="p-3 text-rose-400 font-bold">{err.status}</td>
                    <td className="p-3 text-gray-300 font-sans">{err.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
