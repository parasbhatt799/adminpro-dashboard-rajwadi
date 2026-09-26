import React, { useState, useEffect } from 'react';
import {
  Send,
  Building2,
  CreditCard,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Printer,
  Download,
  MapPin,
  RefreshCw,
  Info,
  Check,
  Lock,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Link } from 'react-router-dom';

interface UserInstantPayoutProps {
  userId: string;
}

interface Beneficiary {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  holder_name: string;
  phone?: string;
  is_verified?: boolean;
}

interface SlabInfo {
  charge: number;
  slab: any;
  total_deduction: number;
}

export default function UserInstantPayout({ userId }: UserInstantPayoutProps) {
  const { showToast } = useToast();

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // User Profile
  const [userProfile, setUserProfile] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isTester, setIsTester] = useState(false);

  // Service Config
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [isAccessible, setIsAccessible] = useState(true);
  const [minPayout, setMinPayout] = useState(100);
  const [maxPayout, setMaxPayout] = useState(200000);
  const [notice, setNotice] = useState('');
  const [slabs, setSlabs] = useState<any[]>([]);

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingBeneficiary, setAddingBeneficiary] = useState(false);
  const [newBenForm, setNewBenForm] = useState({
    holder_name: '',
    bank_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    phone: ''
  });

  // Transfer Form
  const [amount, setAmount] = useState('');
  const [transferMode, setTransferMode] = useState<'IMPS' | 'NEFT' | 'RTGS'>('IMPS');
  const [tpin, setTpin] = useState('');
  const [showTpinModal, setShowTpinModal] = useState(false);

  // Live Slab Calculation
  const [slabInfo, setSlabInfo] = useState<SlabInfo>({
    charge: 25,
    slab: null,
    total_deduction: 0
  });

  // Geolocation
  const [coords, setCoords] = useState<{ latitude: string; longitude: string }>({
    latitude: '23.0225',
    longitude: '72.5714'
  });
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'ready' | 'fallback'>('detecting');

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Fetch initial profile & service config
  const fetchInitialData = async () => {
    try {
      setInitialLoading(true);

      // 1. Fetch user profile
      const { data: user, error: uErr } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (uErr) throw uErr;
      setUserProfile(user);
      setWalletBalance(Number(user?.wallet_balance || 0));
      setIsTester(Boolean(user?.is_tester));

      // 2. Fetch service config
      const res = await fetch(`/api/nixasoft-payout/config?userId=${userId}`);
      const configData = await res.json();

      if (configData.success) {
        setIsServiceActive(configData.is_active);
        setIsAccessible(configData.is_accessible);
        setMinPayout(configData.min_payout || 100);
        setMaxPayout(configData.max_payout || 200000);
        setNotice(configData.notice || '');
        setSlabs(configData.slabs || []);
      }

      // 3. Fetch beneficiaries
      await fetchBeneficiaries();

    } catch (err: any) {
      console.error('Error fetching initial data:', err);
      showToast('error', 'Failed to load payout details');
    } finally {
      setInitialLoading(false);
    }
  };

  // Fetch saved beneficiaries
  const fetchBeneficiaries = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_beneficiaries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBeneficiaries(data || []);

      if (data && data.length > 0 && !selectedBeneficiary) {
        setSelectedBeneficiary(data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching beneficiaries:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Auto-detect browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude.toFixed(6),
            longitude: pos.coords.longitude.toFixed(6)
          });
          setLocationStatus('ready');
        },
        () => {
          setLocationStatus('fallback');
        },
        { timeout: 8000 }
      );
    } else {
      setLocationStatus('fallback');
    }

    // Subscribe to wallet changes in realtime
    const profileSub = supabase
      .channel(`user_wallet_${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users_profiles', filter: `id=eq.${userId}` }, (payload) => {
        if (payload.new && 'wallet_balance' in payload.new) {
          setWalletBalance(Number(payload.new.wallet_balance));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileSub);
    };
  }, [userId]);

  // Recalculate slab fee live whenever amount changes
  useEffect(() => {
    const num = Number(amount);
    if (!num || isNaN(num) || num <= 0) {
      setSlabInfo({ charge: 0, slab: null, total_deduction: 0 });
      return;
    }

    // Match active slab
    const matched = slabs.find(s => num >= s.min_amount && num <= s.max_amount);
    let chg = 25;
    if (matched) {
      chg = matched.charge_type === 'percentage'
        ? Math.round(((num * matched.charge_value) / 100) * 100) / 100
        : matched.charge_value;
    } else if (slabs.length > 0) {
      const highest = slabs[slabs.length - 1];
      if (num > highest.max_amount) {
        chg = highest.charge_type === 'percentage'
          ? Math.round(((num * highest.charge_value) / 100) * 100) / 100
          : highest.charge_value;
      }
    }

    setSlabInfo({
      charge: chg,
      slab: matched,
      total_deduction: num + chg
    });
  }, [amount, slabs]);

  // Quick Amount Select
  const handleSelectQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  // Add Beneficiary
  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBenForm.account_number.trim() !== newBenForm.confirm_account_number.trim()) {
      showToast('warning', 'Bank account numbers do not match!');
      return;
    }

    try {
      setAddingBeneficiary(true);
      const { data, error } = await supabase
        .from('payout_beneficiaries')
        .insert([{
          user_id: userId,
          holder_name: newBenForm.holder_name.trim().toUpperCase(),
          bank_name: newBenForm.bank_name.trim(),
          account_number: newBenForm.account_number.trim(),
          ifsc_code: newBenForm.ifsc_code.trim().toUpperCase(),
          phone: newBenForm.phone.trim() || userProfile?.mobile_number || '',
          is_verified: true
        }])
        .select()
        .single();

      if (error) throw error;

      showToast('success', 'Beneficiary bank account saved successfully!');
      setIsAddModalOpen(false);
      setNewBenForm({
        holder_name: '',
        bank_name: '',
        account_number: '',
        confirm_account_number: '',
        ifsc_code: '',
        phone: ''
      });
      await fetchBeneficiaries();
      setSelectedBeneficiary(data);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save beneficiary');
    } finally {
      setAddingBeneficiary(false);
    }
  };

  // Delete Beneficiary
  const handleDeleteBeneficiary = async (e: React.MouseEvent, benId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this beneficiary bank account?')) return;

    try {
      const { error } = await supabase
        .from('payout_beneficiaries')
        .delete()
        .eq('id', benId)
        .eq('user_id', userId);

      if (error) throw error;
      showToast('success', 'Beneficiary removed');
      const updated = beneficiaries.filter(b => b.id !== benId);
      setBeneficiaries(updated);
      if (selectedBeneficiary?.id === benId) {
        setSelectedBeneficiary(updated[0] || null);
      }
    } catch (err: any) {
      showToast('error', 'Error removing beneficiary');
    }
  };

  // Submit Initiation Handler (Checks TPIN if needed)
  const handleInitiatePayout = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAccessible) {
      showToast('error', 'Payout service is temporarily offline for maintenance.');
      return;
    }

    if (!selectedBeneficiary) {
      showToast('warning', 'Please select or add a beneficiary bank account.');
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount < minPayout) {
      showToast('warning', `Minimum payout amount is ₹${minPayout.toLocaleString()}`);
      return;
    }

    if (numAmount > maxPayout) {
      showToast('warning', `Maximum payout amount is ₹${maxPayout.toLocaleString()}`);
      return;
    }

    const totalNeeded = slabInfo.total_deduction + 250;
    if (walletBalance < totalNeeded) {
      showToast('error', `Insufficient wallet balance! You must maintain at least ₹250 in your wallet. Required: ₹${totalNeeded.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`);
      return;
    }

    // Check if user has TPIN set
    if (userProfile?.tpin) {
      setTpin('');
      setShowTpinModal(true);
    } else {
      executePayout();
    }
  };

  // Execute Actual Payout
  const executePayout = async () => {
    if (!selectedBeneficiary) return;

    try {
      setSubmitting(true);
      setShowTpinModal(false);

      const payload = {
        userId,
        amount: Number(amount),
        bankName: selectedBeneficiary.bank_name,
        holderName: selectedBeneficiary.holder_name,
        accountNumber: selectedBeneficiary.account_number,
        ifscCode: selectedBeneficiary.ifsc_code,
        transferMode,
        mobileNumber: selectedBeneficiary.phone || userProfile?.mobile_number,
        emailId: userProfile?.email || 'user@rajwadi.in',
        latitude: coords.latitude,
        longitude: coords.longitude,
        tpin: tpin || undefined
      };

      const res = await fetch('/api/nixasoft-payout/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        showToast('success', data.message || 'Payout submitted successfully!');
        setReceiptData({
          ...data.data,
          status: data.status,
          message: data.message,
          transferMode,
          created_at: new Date().toISOString()
        });
        setIsReceiptOpen(true);
        setAmount('');
        // Refresh profile / balance
        fetchInitialData();
      } else {
        // Failed & Refunded
        showToast('error', data.message || 'Payout transaction failed.');
        if (data.data) {
          setReceiptData({
            ...data.data,
            status: 'failed',
            message: data.message,
            transferMode,
            created_at: new Date().toISOString(),
            isRefunded: true
          });
          setIsReceiptOpen(true);
        }
        fetchInitialData();
      }
    } catch (err: any) {
      console.error('Fatal payout error:', err);
      showToast('error', err.message || 'Network error occurred during payout execution.');
    } finally {
      setSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading Instant Payout Gateway...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-2xl border border-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-400 shadow-inner">
                <Send className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                  Instant Bank Payout
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    24x7 IMPS
                  </span>
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm">
                  Instant direct bank transfer to any beneficiary bank account in India
                </p>
              </div>
            </div>

            {/* Tester badge / Service status note */}
            {!isServiceActive && isTester && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl">
                <span>🧪 Tester Preview Active:</span> Master payout service is disabled, but unlocked for your tester account.
              </div>
            )}
          </div>

          {/* Wallet Balance Card */}
          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 flex items-center gap-4 shrink-0 shadow-lg">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                Available Wallet Balance
              </span>
              <span className="text-2xl font-black text-white">
                ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-slate-300/80 block mt-0.5">
                (₹250 mandatory reserve maintained)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Beneficiaries & Amount, Right Fee Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Beneficiary Selection Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Select Beneficiary Bank Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose a saved account or add a new verified beneficiary
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-indigo-200/60"
              >
                <Plus size={15} />
                Add Account
              </button>
            </div>

            {beneficiaries.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No Saved Bank Accounts</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Add your beneficiary bank details to initiate instant payouts anytime.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100"
                >
                  Add Bank Account Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {beneficiaries.map((ben) => {
                  const isSelected = selectedBeneficiary?.id === ben.id;
                  return (
                    <div
                      key={ben.id}
                      onClick={() => setSelectedBeneficiary(ben)}
                      className={`relative p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-500 shadow-md shadow-indigo-50'
                          : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-sm truncate">{ben.holder_name}</p>
                          <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-400" />
                            {ben.bank_name}
                          </p>
                          <p className="text-xs font-mono text-slate-500">
                            A/c: •••• {ben.account_number.slice(-4)}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            IFSC: {ben.ifsc_code}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteBeneficiary(e, ben.id)}
                        className="absolute bottom-2 right-2 p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remove Account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount & Transfer Mode Form */}
          <form onSubmit={handleInitiatePayout} className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-4">
              Payout Amount & Mode
            </h3>

            {/* Quick Amount Chips */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Quick Amount Select
              </label>
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 5000, 10000, 25000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectQuickAmount(val)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      Number(amount) === val
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    ₹{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                Transfer Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  required
                  min={minPayout}
                  max={maxPayout}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
                <span>Min: ₹{minPayout.toLocaleString()}</span>
                <span>Max: ₹{maxPayout.toLocaleString()}</span>
              </p>
            </div>

            {/* Transfer Mode Radio */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                Transfer Mode
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'IMPS', label: 'IMPS', desc: 'Instant 24x7' },
                  { id: 'NEFT', label: 'NEFT', desc: 'Batch Transfer' },
                  { id: 'RTGS', label: 'RTGS', desc: 'High Value' }
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setTransferMode(m.id as any)}
                    className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                      transferMode === m.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <p className="font-black text-sm">{m.label}</p>
                    <p className={`text-[10px] mt-0.5 ${transferMode === m.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Location Status Indicator */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className={locationStatus === 'ready' ? 'text-emerald-500' : 'text-slate-400'} />
                GPS Location: {locationStatus === 'ready' ? 'Verified' : 'Default Auto-Coord'}
              </span>
              <span className="font-mono text-[10px]">
                {coords.latitude}, {coords.longitude}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !amount || Number(amount) <= 0 || !selectedBeneficiary}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-200/80 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Bank Transfer...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Transfer ₹{Number(amount || 0).toLocaleString()} Now
                  <ArrowRight className="w-5 h-5 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Section: Live Fee Simulator & Slab Info (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Fee Breakdown Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Transfer Summary & Fee Breakdown
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Beneficiary:</span>
                <span className="font-bold text-slate-900 text-right">
                  {selectedBeneficiary ? selectedBeneficiary.holder_name : 'None selected'}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Bank & A/c:</span>
                <span className="font-medium text-slate-700 text-right">
                  {selectedBeneficiary ? `${selectedBeneficiary.bank_name} (••${selectedBeneficiary.account_number.slice(-4)})` : '-'}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Transfer Amount:</span>
                <span className="font-bold text-slate-900">
                  ₹{Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-rose-600">
                <span>Payout Slab Fee:</span>
                <span className="font-black">
                  + ₹{slabInfo.charge.toFixed(2)}
                </span>
              </div>

              {slabInfo.slab && (
                <div className="text-[11px] text-indigo-600 bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 font-medium">
                  Applied Slab: ₹{slabInfo.slab.min_amount.toLocaleString()} - ₹{slabInfo.slab.max_amount.toLocaleString()} ({slabInfo.slab.charge_type === 'percentage' ? `${slabInfo.slab.charge_value}%` : `₹${slabInfo.slab.charge_value} flat`})
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-black text-slate-900">
                <span>Total Wallet Debit:</span>
                <span className="text-indigo-600 text-lg">
                  ₹{slabInfo.total_deduction.toFixed(2)}
                </span>
              </div>

              <div className="pt-2 flex justify-between text-xs text-slate-500">
                <span>Estimated Wallet Balance After:</span>
                <span className={`font-bold ${walletBalance - slabInfo.total_deduction < 250 ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                  ₹{Math.max(0, walletBalance - slabInfo.total_deduction).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-500">
              <p className="font-bold text-slate-700 flex items-center gap-1.5">
                <Info size={14} className="text-indigo-600" />
                Accounting & Statements Guarantee
              </p>
              <p>
                Every payout immediately reflects in both your <strong>Statement Report</strong> and the <strong>Admin Ledger</strong>.
                In the rare event of a bank failure or rejection, the full amount including fees is instantly refunded to your wallet balance.
              </p>
            </div>
          </div>

          {/* Slabs Reference Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400">
              Active Charge Slabs (Nixasoft)
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              {slabs.map((s, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    ₹{s.min_amount.toLocaleString()} – ₹{s.max_amount.toLocaleString()}
                  </span>
                  <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                    {s.charge_type === 'percentage' ? `${s.charge_value}%` : `₹${s.charge_value}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center">
              <Link
                to="/user/payout-history"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View Past Payout History
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Add Beneficiary Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-lg">Add Beneficiary Bank Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddBeneficiary} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Beneficiary Name (As per Bank Record)
                  </label>
                  <input
                    type="text"
                    required
                    value={newBenForm.holder_name}
                    onChange={(e) => setNewBenForm({ ...newBenForm, holder_name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newBenForm.bank_name}
                      onChange={(e) => setNewBenForm({ ...newBenForm, bank_name: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={newBenForm.ifsc_code}
                      onChange={(e) => setNewBenForm({ ...newBenForm, ifsc_code: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Account Number
                    </label>
                    <input
                      type="password"
                      required
                      value={newBenForm.account_number}
                      onChange={(e) => setNewBenForm({ ...newBenForm, account_number: e.target.value })}
                      placeholder="Enter account number"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Confirm Account Number
                    </label>
                    <input
                      type="text"
                      required
                      value={newBenForm.confirm_account_number}
                      onChange={(e) => setNewBenForm({ ...newBenForm, confirm_account_number: e.target.value })}
                      placeholder="Re-enter account number"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Beneficiary Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={newBenForm.phone}
                    onChange={(e) => setNewBenForm({ ...newBenForm, phone: e.target.value })}
                    placeholder="10 digit mobile"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingBeneficiary}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {addingBeneficiary ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save Beneficiary
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TPIN Modal */}
      <AnimatePresence>
        {showTpinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 space-y-5 text-center"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Enter Transaction PIN (TPIN)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Authorize deduction of ₹{slabInfo.total_deduction.toFixed(2)} from your wallet
                </p>
              </div>

              <input
                type="password"
                maxLength={6}
                autoFocus
                value={tpin}
                onChange={(e) => setTpin(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-2xl font-black py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTpinModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executePayout}
                  disabled={!tpin || submitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Receipt Modal */}
      <AnimatePresence>
        {isReceiptOpen && receiptData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
            >
              {/* Receipt Header Status */}
              <div className="text-center space-y-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-lg ${
                  receiptData.status === 'approved'
                    ? 'bg-emerald-500 text-white shadow-emerald-200'
                    : receiptData.status === 'pending'
                    ? 'bg-amber-500 text-white shadow-amber-200'
                    : 'bg-rose-500 text-white shadow-rose-200'
                }`}>
                  {receiptData.status === 'approved' ? (
                    <CheckCircle2 size={30} />
                  ) : receiptData.status === 'pending' ? (
                    <Clock size={30} />
                  ) : (
                    <AlertCircle size={30} />
                  )}
                </div>
                <h3 className="font-black text-slate-900 text-xl">
                  {receiptData.status === 'approved'
                    ? 'Payout Successful!'
                    : receiptData.status === 'pending'
                    ? 'Payout Pending'
                    : 'Payout Failed & Refunded'}
                </h3>
                <p className="text-xs text-slate-500">
                  {receiptData.message || 'Transaction processed via Nixasoft'}
                </p>
              </div>

              {/* Amount Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Transferred Amount
                </span>
                <span className="text-3xl font-black text-slate-900">
                  ₹{Number(receiptData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  Fee: ₹{Number(receiptData.charge || 0).toFixed(2)} | Total Debited: ₹{Number(receiptData.total_deduction || 0).toFixed(2)}
                </span>
              </div>

              {/* Details List */}
              <div className="space-y-2.5 text-xs">
                {receiptData.utr && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Bank UTR Number:</span>
                    <span className="font-mono font-bold text-slate-900">{receiptData.utr}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Request ID:</span>
                  <span className="font-mono text-slate-700">{receiptData.requestId}</span>
                </div>
                {receiptData.beneficiaryName && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Beneficiary:</span>
                    <span className="font-bold text-slate-900">{receiptData.beneficiaryName}</span>
                  </div>
                )}
                {receiptData.bankName && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Bank Name:</span>
                    <span className="font-medium text-slate-800">{receiptData.bankName}</span>
                  </div>
                )}
                {receiptData.accountNumber && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Account:</span>
                    <span className="font-mono text-slate-800">•••• {String(receiptData.accountNumber).slice(-4)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Date & Time:</span>
                  <span className="text-slate-700">{new Date().toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer size={15} />
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
