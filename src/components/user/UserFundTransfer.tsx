import React, { useState, useEffect } from 'react';
import {
  Wallet, Send, User, Search, Lock, CheckCircle2, AlertCircle,
  Loader2, Building2, History, Eye, EyeOff, RotateCcw, ArrowRightLeft,
  ArrowRight, KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { LogoLoader } from '../shared/LoadingSpinner';

interface UserFundTransferProps {
  userId: string;
}

export default function UserFundTransfer({ userId }: UserFundTransferProps) {
  const toast = useToast();

  // Loading and profile states
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isServiceEnabled, setIsServiceEnabled] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Form states
  const [targetUserId, setTargetUserId] = useState('usepay_');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [tpin, setTpin] = useState('');
  const [showTpin, setShowTpin] = useState(false);

  // Recipient search state
  const [recipient, setRecipient] = useState<any>(null);
  const [searchingRecipient, setSearchingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Transaction execution states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Transfer history state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const itemsPerPage = 10;

  // Auto-clear banners
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 6000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Force 'usepay_' prefix helper
  const handleTargetUserIdChange = (val: string) => {
    const clean = val.toLowerCase();
    if (!clean.startsWith('usepay_')) {
      if (clean.length < 7) {
        setTargetUserId('usepay_');
      } else {
        setTargetUserId('usepay_' + clean.replace(/usepay_/g, ''));
      }
    } else {
      setTargetUserId(clean);
    }
  };

  // Fetch logged in user details
  const fetchProfile = async () => {
    try {
      const { data, error: profileError } = await supabase
        .from('users_profiles')
        .select('wallet_balance, tpin, name, firm_name')
        .eq('id', userId)
        .single();

      if (!profileError && data) {
        setUserProfile(data);
        setUserBalance(Number(data.wallet_balance) || 0);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch transfer history
  const fetchTransferHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('fund_transfers')
        .select('*, sender:sender_id(name, firm_name, mobile_number), receiver:receiver_id(name, firm_name, mobile_number)', { count: 'exact' })
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const from = (historyPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, count, error: histError } = await query.range(from, to);

      if (!histError) {
        setHistory(data || []);
        setTotalHistoryCount(count || 0);
      } else {
        console.error('Error fetching fund transfers:', histError);
      }
    } catch (err) {
      console.error('Error fetching transfer history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch profile, history, and service status on load
  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchTransferHistory();

      const fetchServiceStatus = async () => {
        try {
          const { data } = await supabase
            .from('qr_settings')
            .select('is_fund_transfer_enabled')
            .eq('id', 1)
            .single();
          if (data) {
            setIsServiceEnabled(data.is_fund_transfer_enabled !== false);
          }
        } catch (err) {
          console.error('Error fetching service status:', err);
        } finally {
          setLoadingSettings(false);
        }
      };
      fetchServiceStatus();

      // Subscribe to real-time wallet balance changes
      const profileChannel = supabase
        .channel(`profile_realtime_transfer_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users_profiles',
          filter: `id=eq.${userId}`
        }, (payload) => {
          if (payload.new) {
            setUserProfile(payload.new);
            setUserBalance(Number(payload.new.wallet_balance) || 0);
          }
        })
        .subscribe();

      // Subscribe to real-time fund transfer additions
      const transferChannel = supabase
        .channel(`transfers_realtime_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'fund_transfers'
        }, (payload) => {
          if (payload.new && (payload.new.sender_id === userId || payload.new.receiver_id === userId)) {
            fetchTransferHistory();
            fetchProfile();
          }
        })
        .subscribe();

      // Subscribe to real-time settings changes
      const settingsChannel = supabase
        .channel(`settings_realtime_transfer_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'qr_settings',
          filter: 'id=eq.1'
        }, (payload) => {
          if (payload.new && 'is_fund_transfer_enabled' in payload.new) {
            setIsServiceEnabled(payload.new.is_fund_transfer_enabled !== false);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(transferChannel);
        supabase.removeChannel(settingsChannel);
      };
    }
  }, [userId, historyPage]);

  // Recipient details auto-fetch with debounce/effect on targetUserId input
  useEffect(() => {
    if (!targetUserId.trim() || targetUserId.trim() === 'usepay_') {
      setRecipient(null);
      setRecipientError(null);
      return;
    }

    if (targetUserId.trim() === userId) {
      setRecipient(null);
      setRecipientError('Cannot transfer funds to yourself.');
      return;
    }

    const searchRecipient = async () => {
      setSearchingRecipient(true);
      setRecipientError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('users_profiles')
          .select('id, name, firm_name, status, mobile_number')
          .eq('id', targetUserId.trim())
          .single();

        if (fetchErr || !data) {
          setRecipient(null);
          setRecipientError('Recipient not found. Please verify the User ID.');
        } else if (data.status !== 'Active') {
          setRecipient(null);
          setRecipientError('Recipient account is not active.');
        } else {
          setRecipient(data);
          setRecipientError(null);
        }
      } catch (err) {
        console.error('Error searching recipient:', err);
        setRecipient(null);
        setRecipientError('Recipient lookup failed.');
      } finally {
        setSearchingRecipient(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      searchRecipient();
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounce);
  }, [targetUserId, userId]);

  // Handle transaction submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount);

    // Initial front-end validation
    if (!targetUserId.trim() || targetUserId.trim() === 'usepay_') {
      setError('Please enter a recipient User ID.');
      return;
    }

    if (targetUserId.trim() === userId) {
      setError('Cannot transfer funds to yourself.');
      return;
    }

    if (!recipient) {
      setError('Please enter a valid active recipient.');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    // Balance check: Sender must retain at least ₹250 after transaction
    if (userBalance - amountNum < 250) {
      setError('Insufficient balance. You must retain at least ₹250 in your wallet after transfer.');
      return;
    }

    if (!tpin || tpin.length !== 4 || !/^\d{4}$/.test(tpin)) {
      setError('Please enter your 4-digit Transaction PIN (TPIN).');
      return;
    }

    // Verify if sender has set TPIN
    if (!userProfile?.tpin) {
      setError('Please set your TPIN first under Profile > TPIN.');
      return;
    }

    setSubmitting(true);

    try {
      // Execute atomic fund transfer RPC
      const { data, error: rpcError } = await supabase.rpc('transfer_funds_atomic', {
        p_sender_id: userId,
        p_receiver_id: recipient.id,
        p_amount: amountNum,
        p_tpin: tpin
      });

      if (rpcError) throw rpcError;

      if (data && !data.success) {
        throw new Error(data.message || 'Transfer failed.');
      }

      // Add push notification for recipient
      try {
        await supabase.from('notifications').insert([{
          user_id: recipient.id,
          target_role: 'user',
          title: 'Fund Received',
          message: `You have received ₹${amountNum.toLocaleString()} from ${userProfile.firm_name || userProfile.name} (${userId}).`,
          link: '/user/statement'
        }]);
      } catch (notifyErr) {
        console.error('Failed to notify recipient:', notifyErr);
      }

      setSuccess(`Successfully transferred ₹${amountNum.toLocaleString()} to ${recipient.name || recipient.id}!`);
      toast.success('Funds Transferred Successfully');

      // Reset fields
      setTargetUserId('usepay_');
      setAmount('');
      setTpin('');
      setRemarks('');
      setRecipient(null);

      // Reload profile and history
      fetchProfile();
      fetchTransferHistory();

    } catch (err: any) {
      console.error('Transfer submission error:', err);
      setError(err.message || 'An unexpected error occurred during transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalHistoryCount / itemsPerPage);

  if (loadingProfile || loadingSettings) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <LogoLoader size="md" />
      </div>
    );
  }

  if (!isServiceEnabled) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center bg-white rounded-3xl border border-slate-100 shadow-xl mt-10">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-inner">
          <AlertCircle size={40} />
        </div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Service Temporarily Disabled</h3>
        <p className="text-slate-500 text-sm font-semibold leading-relaxed mb-8">
          User-to-User Fund Transfer service is currently deactivated by the administrator. Please contact our support team if you require assistance.
        </p>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4 px-4">
      {/* Top Welcome & Summary Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">User to User Fund Transfer</h2>
          <p className="text-slate-500 mt-1 font-medium">Transfer wallet funds to another user instantly and securely.</p>
        </div>

        <div className="flex items-center gap-3 bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-100 shadow-sm">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Wallet size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Available Balance</span>
            <span className="text-lg font-black text-slate-900 leading-none">₹{userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form Panel */}
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Send Funds</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Instant peer transfer</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Target User ID */}
                <div className="group">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-indigo-500">
                    Recipient User ID
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      required
                      type="text"
                      autoComplete="off"
                      placeholder="e.g. usepay_123"
                      value={targetUserId}
                      onChange={(e) => handleTargetUserIdChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                    />
                    {searchingRecipient && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="animate-spin text-indigo-500" size={18} />
                      </div>
                    )}
                  </div>

                  {/* Recipient Look-up info box */}
                  <AnimatePresence mode="wait">
                    {recipient && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-800 overflow-hidden"
                      >
                        <Building2 size={20} className="shrink-0 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-emerald-600 leading-none mb-1">Verify Recipient</p>
                          <p className="text-sm font-bold leading-tight text-slate-900">{recipient.name}</p>
                          {recipient.firm_name && (
                            <p className="text-xs font-bold text-slate-500 mt-0.5">Firm: {recipient.firm_name}</p>
                          )}
                          <p className="text-xs font-mono font-medium text-slate-400 mt-1">Mobile: {recipient.mobile_number}</p>
                        </div>
                      </motion.div>
                    )}
                    {recipientError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2.5 text-rose-600 overflow-hidden"
                      >
                        <AlertCircle size={18} className="shrink-0 text-rose-500" />
                        <p className="text-xs font-bold leading-tight">{recipientError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Amount to transfer */}
                <div className="group">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-indigo-500">
                    Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors font-bold text-sm">₹</span>
                    <input
                      required
                      type="number"
                      placeholder="0.00"
                      min="1"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Remarks (Optional) */}
                <div className="group">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-indigo-500">
                    Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter short description"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                  />
                </div>

                {/* TPIN */}
                <div className="group">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-emerald-500">
                    Transaction PIN (TPIN)
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input
                      required
                      type={showTpin ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••"
                      maxLength={4}
                      value={tpin}
                      onChange={(e) => setTpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono tracking-widest text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTpin(!showTpin)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showTpin ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Status/Validation Messages */}
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <AlertCircle size={18} className="shrink-0" />
                    <p className="text-xs font-bold leading-tight">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CheckCircle2 size={18} className="shrink-0" />
                    <p className="text-xs font-bold leading-tight">{success}</p>
                  </div>
                )}

                {/* Transfer Button */}
                <button
                  type="submit"
                  disabled={submitting || !recipient}
                  className="w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:bg-emerald-600 shadow-xl shadow-emerald-500/10 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Send size={16} />
                      Send Funds
                    </>
                  )}
                </button>
              </form>
            </div>
            
            <div className="mt-6 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-[10px] text-amber-700 font-bold leading-normal uppercase">
              ⚠️ Warning: Wallet transfer transactions are instant and irreversible. Double check the recipient details before sending. You must keep a minimum balance of ₹250.
            </div>
          </motion.div>
        </div>

        {/* Right Transfer History Panel */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-150 rounded-xl flex items-center justify-center text-slate-700">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Recent Transfers</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Transfer history</p>
                </div>
              </div>

              <button
                onClick={fetchTransferHistory}
                disabled={loadingHistory}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-slate-200 transition-all bg-white disabled:opacity-50"
                title="Refresh"
              >
                {loadingHistory ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
              </button>
            </div>

            <div className="overflow-x-auto flex-1 flex flex-col">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingHistory && history.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center">
                        <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-slate-400">
                        <ArrowRightLeft className="mx-auto mb-3 text-slate-200" size={40} />
                        <p className="text-xs font-bold uppercase tracking-wider">No transfers found</p>
                      </td>
                    </tr>
                  ) : (
                    history.map((tx) => {
                      const isSender = tx.sender_id === userId;
                      const userDetail = isSender ? tx.receiver : tx.sender;
                      const userLabel = isSender ? 'Sent to' : 'Received from';
                      const oppositeId = isSender ? tx.receiver_id : tx.sender_id;

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                isSender ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {isSender ? 'DR' : 'CR'}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{userLabel}</p>
                                <p className="text-sm font-bold text-slate-900 leading-tight">
                                  {userDetail?.firm_name || userDetail?.name || oppositeId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-xs font-semibold text-slate-500 line-clamp-1">{tx.remarks || 'Peer-to-Peer Transfer'}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                              {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`text-sm font-black flex items-center justify-center gap-0.5 ${
                              isSender ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {isSender ? '-' : '+'}₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 mt-auto">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Page {historyPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    disabled={historyPage === totalPages}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
