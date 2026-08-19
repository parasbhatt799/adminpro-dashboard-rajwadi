import React, { useState, useEffect } from 'react';
import {
  Wallet, Send, User, Search, Lock, CheckCircle2, AlertCircle,
  Loader2, Building2, History, Eye, EyeOff, RotateCcw, ArrowRightLeft,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { LogoLoader } from '../shared/LoadingSpinner';

interface PartnerFundTransferProps {
  userId: string;
}

export default function PartnerFundTransfer({ userId }: PartnerFundTransferProps) {
  const toast = useToast();

  // Loading and profile states
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isServiceEnabled, setIsServiceEnabled] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [dsMinLimit, setDsMinLimit] = useState<number>(0);
  const [mdMinLimit, setMdMinLimit] = useState<number>(0);

  // Form states
  const [targetUserId, setTargetUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [tpin, setTpin] = useState('');
  const [showTpin, setShowTpin] = useState(false);

  // Recipient search & selection state
  const [partners, setPartners] = useState<any[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

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

  // Fetch logged in user details (using commission_balance)
  const fetchProfile = async () => {
    try {
      const { data, error: profileError } = await supabase
        .from('users_profiles')
        .select('commission_balance, tpin, name, firm_name, role')
        .eq('id', userId)
        .single();

      if (!profileError && data) {
        setUserProfile(data);
        setUserBalance(Number(data.commission_balance) || 0);
      }
    } catch (err) {
      console.error('Error fetching partner profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch managed partners (Distributors for SD, Users for Dist)
  const fetchPartners = async (role: string) => {
    setLoadingPartners(true);
    try {
      let query = supabase
        .from('users_profiles')
        .select('id, name, firm_name, mobile_number, role')
        .eq('status', 'Active');

      if (role === 'super_distributor') {
        query = query.eq('super_distributor_id', userId);
      } else {
        query = query.eq('distributor_id', userId);
      }

      const { data, error: fetchErr } = await query;
      if (!fetchErr && data) {
        setPartners(data);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  // Fetch transfer history
  const fetchTransferHistory = async () => {
    setLoadingHistory(true);
    try {
      const from = (historyPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, count, error: histError } = await supabase
        .from('fund_transfers')
        .select('*, sender:sender_id(name, firm_name, mobile_number), receiver:receiver_id(name, firm_name, mobile_number)', { count: 'exact' })
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(from, to);

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

  // Initial load logic
  useEffect(() => {
    if (userId) {
      const initialize = async () => {
        // Fetch Profile first to get the role
        try {
          const { data } = await supabase
            .from('users_profiles')
            .select('commission_balance, tpin, name, firm_name, role')
            .eq('id', userId)
            .single();

          if (data) {
            setUserProfile(data);
            setUserBalance(Number(data.commission_balance) || 0);
            // Fetch partners once we know the role
            await fetchPartners(data.role);
          }
        } catch (err) {
          console.error('Error initializing:', err);
        } finally {
          setLoadingProfile(false);
        }
      };

      initialize();
      fetchTransferHistory();

      // Check service enablement
      const fetchServiceStatus = async () => {
        try {
          const { data } = await supabase
            .from('qr_settings')
            .select('is_fund_transfer_enabled, ds_min_fund_transfer_limit, md_min_fund_transfer_limit')
            .eq('id', 1)
            .single();
          if (data) {
            setIsServiceEnabled(data.is_fund_transfer_enabled !== false);
            setDsMinLimit(Number(data.ds_min_fund_transfer_limit) || 0);
            setMdMinLimit(Number(data.md_min_fund_transfer_limit) || 0);
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
        .channel(`partner_profile_realtime_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users_profiles',
          filter: `id=eq.${userId}`
        }, (payload) => {
          if (payload.new) {
            setUserProfile(payload.new);
            setUserBalance(Number(payload.new.commission_balance) || 0);
          }
        })
        .subscribe();

      // Subscribe to real-time transfers
      const transferChannel = supabase
        .channel(`partner_transfers_realtime_${userId}`)
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

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(transferChannel);
      };
    }
  }, [userId, historyPage]);

  // Handle selection of partner from dropdown
  const handleSelectPartner = (partner: any) => {
    setSelectedPartner(partner);
    setTargetUserId(partner.id);
    setSearchQuery(`${partner.name} (${partner.id})`);
    setShowDropdown(false);
  };

  // Filter partners based on search query
  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.mobile_number.includes(searchQuery) ||
    (p.firm_name && p.firm_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle transaction submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount);

    if (!targetUserId) {
      setError('Please select a recipient.');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (userProfile?.role === 'super_distributor' && mdMinLimit > 0 && amountNum < mdMinLimit) {
      setError(`Minimum fund transfer limit for Master Distributor is ₹${mdMinLimit.toLocaleString()}.`);
      return;
    }

    if (userProfile?.role === 'distributor' && dsMinLimit > 0 && amountNum < dsMinLimit) {
      setError(`Minimum fund transfer limit for Distributor is ₹${dsMinLimit.toLocaleString()}.`);
      return;
    }

    if (userBalance < amountNum) {
      setError('Insufficient commission balance.');
      return;
    }

    if (!tpin || tpin.length !== 4 || !/^\d{4}$/.test(tpin)) {
      setError('Please enter your 4-digit Transaction PIN (TPIN).');
      return;
    }

    if (!userProfile?.tpin) {
      setError('Please set your TPIN first under Profile > TPIN.');
      return;
    }

    setSubmitting(true);

    try {
      // Execute partner atomic fund transfer RPC
      const { data, error: rpcError } = await supabase.rpc('partner_transfer_funds_atomic', {
        p_sender_id: userId,
        p_receiver_id: targetUserId,
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
          user_id: targetUserId,
          target_role: selectedPartner.role === 'distributor' ? 'distributor' : 'user',
          title: 'Fund Received',
          message: `You have received ₹${amountNum.toLocaleString()} from ${userProfile.firm_name || userProfile.name} (${userId}).`,
          link: selectedPartner.role === 'distributor' ? '/user/users-statement' : '/user/statement'
        }]);
      } catch (notifyErr) {
        console.error('Failed to notify recipient:', notifyErr);
      }

      setSuccess(`Successfully transferred ₹${amountNum.toLocaleString()} to ${selectedPartner.name}!`);
      toast.success('Funds Transferred Successfully');

      // Reset fields
      setAmount('');
      setTpin('');
      setRemarks('');
      setSelectedPartner(null);
      setTargetUserId('');
      setSearchQuery('');

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

  if (userProfile && userProfile.role !== 'distributor' && userProfile.role !== 'super_distributor') {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center bg-white rounded-3xl border border-slate-100 shadow-xl mt-10">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-inner">
          <AlertCircle size={40} />
        </div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Access Denied</h3>
        <p className="text-slate-500 text-sm font-semibold leading-relaxed mb-8">
          This page is only accessible for Distributors and Super Distributors.
        </p>
      </div>
    );
  }

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
          Fund Transfer service is currently deactivated by the administrator. Please contact our support team if you require assistance.
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

  const roleLabel = userProfile?.role === 'super_distributor' ? 'Distributor' : 'User';

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4 px-4">
      {/* Top Welcome & Summary Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Partner Fund Transfer</h2>
          <p className="text-slate-500 mt-1 font-medium">
            {userProfile?.role === 'super_distributor' 
              ? 'Transfer funds instantly from your Commission Wallet to your managed Distributors.' 
              : 'Transfer funds instantly from your Commission Wallet to your managed Users.'}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-100 shadow-sm">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Wallet size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Commission Wallet</span>
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
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Instant Transfer to {roleLabel}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Search Target Recipient */}
                <div className="group relative">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-indigo-500">
                    Select {roleLabel}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type="text"
                      autoComplete="new-password"
                      placeholder={`Search by name, ID or mobile...`}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedPartner(null);
                        setTargetUserId('');
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                    />
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>

                  {/* Dropdown container */}
                  <AnimatePresence>
                    {showDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 right-0 mt-2 max-h-60 bg-white border border-slate-100 shadow-xl rounded-2xl z-20 overflow-y-auto no-scrollbar py-2"
                        >
                          {loadingPartners ? (
                            <div className="p-4 text-center text-slate-400 text-xs">Loading partners...</div>
                          ) : filteredPartners.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs">No active {roleLabel.toLowerCase()}s found</div>
                          ) : (
                            filteredPartners.map((partner) => (
                              <button
                                key={partner.id}
                                type="button"
                                onClick={() => handleSelectPartner(partner)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-50 flex flex-col"
                              >
                                <span className="text-sm font-bold text-slate-800">{partner.name}</span>
                                {partner.firm_name && (
                                  <span className="text-xs text-slate-500 font-medium">Firm: {partner.firm_name}</span>
                                )}
                                <span className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {partner.id} | Mobile: {partner.mobile_number}</span>
                              </button>
                            ))
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Selected Recipient Box */}
                  <AnimatePresence mode="wait">
                    {selectedPartner && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-800 overflow-hidden"
                      >
                        <Building2 size={20} className="shrink-0 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-emerald-600 leading-none mb-1">Verify Recipient</p>
                          <p className="text-sm font-bold leading-tight text-slate-900">{selectedPartner.name}</p>
                          {selectedPartner.firm_name && (
                            <p className="text-xs font-bold text-slate-500 mt-0.5">Firm: {selectedPartner.firm_name}</p>
                          )}
                          <p className="text-xs font-mono font-medium text-slate-400 mt-1">ID: {selectedPartner.id}</p>
                        </div>
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                    />
                  </div>
                  {userProfile?.role === 'super_distributor' && mdMinLimit > 0 && (
                    <p className="text-[10px] font-bold text-blue-600 mt-1.5 ml-1">
                      * Min transfer limit for Master Distributor is ₹{mdMinLimit.toLocaleString()}
                    </p>
                  )}
                  {userProfile?.role === 'distributor' && dsMinLimit > 0 && (
                    <p className="text-[10px] font-bold text-emerald-600 mt-1.5 ml-1">
                      * Min transfer limit for Distributor is ₹{dsMinLimit.toLocaleString()}
                    </p>
                  )}
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
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
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
                  disabled={submitting || !selectedPartner}
                  className="w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:bg-indigo-600 shadow-xl shadow-indigo-500/10 cursor-pointer"
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
              ⚠️ Warning: Wallet transfer transactions are instant and irreversible. Double check the recipient details before sending.
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
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-750">
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
                            <p className="text-xs font-semibold text-slate-500 line-clamp-1">{tx.remarks || 'Partner Transfer'}</p>
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
