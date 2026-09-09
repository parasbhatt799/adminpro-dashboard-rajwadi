import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ShieldCheck, 
  Loader2, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  IndianRupee, 
  Users, 
  Trash2, 
  Plus, 
  X, 
  Search, 
  RotateCcw, 
  Building2, 
  User, 
  Phone, 
  Wallet,
  Clock,
  ArrowLeft,
  FileText,
  Printer,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

interface UserIndiaTekPayoutProps {
  userId?: string;
}

interface Beneficiary {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  holder_name: string;
  phone?: string;
  is_verified: boolean;
  created_at?: string;
}

interface PayoutSubmission {
  id: string;
  user_id: string;
  account_number: string;
  ifsc_code: string;
  amount: number;
  beneficiary_name: string;
  customer_mobile: string;
  partner_reference: string;
  transaction_id?: string;
  status: string;
  charges: number;
  created_at: string;
  response_payload?: any;
}

export default function UserIndiaTekPayout({ userId: propUserId }: UserIndiaTekPayoutProps) {
  const [currentUserId, setCurrentUserId] = useState<string>(propUserId || '');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [verificationCharge, setVerificationCharge] = useState<number>(5);
  const [minPayout, setMinPayout] = useState<number>(10);
  const [maxPayout, setMaxPayout] = useState<number>(50000);
  const [transactions, setTransactions] = useState<PayoutSubmission[]>([]);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [checkingStatusRef, setCheckingStatusRef] = useState<string | null>(null);

  // Add Beneficiary Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    holderName: '',
    phone: ''
  });
  const [verifiedDetails, setVerifiedDetails] = useState<{
    verifiedName: string;
    txnId?: string;
  } | null>(null);

  // Transfer / Payment Modal State
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMobile, setPayoutMobile] = useState('');
  const [payoutResult, setPayoutResult] = useState<any>(null);

  // Receipt Modal State
  const [receiptTxn, setReceiptTxn] = useState<PayoutSubmission | null>(null);

  // Beneficiary Filters State
  const [filterHolderName, setFilterHolderName] = useState('');
  const [filterBankName, setFilterBankName] = useState('');
  const [filterIfscCode, setFilterIfscCode] = useState('');

  // Dynamic Bank List fetched from camlenio_banks table in Supabase
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [allBanksList, setAllBanksList] = useState<string[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<string[]>([]);

  // Resolve current user ID on mount
  useEffect(() => {
    const resolveUser = async () => {
      if (propUserId) {
        setCurrentUserId(propUserId);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      }
    };
    resolveUser();
    fetchBankList();
  }, [propUserId]);

  // Fetch bank dropdown options dynamically from camlenio_banks table
  const fetchBankList = async () => {
    try {
      const { data, error } = await supabase
        .from('camlenio_banks')
        .select('bank_name')
        .limit(2000);

      if (!error && data && data.length > 0) {
        const list = data
          .map((b: any) => b.bank_name)
          .filter(Boolean)
          .sort();
        setAllBanksList(list);
        setFilteredBanks(list);
      }
    } catch (err) {
      console.error('Error fetching camlenio banks:', err);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      fetchServiceSettings();
      fetchUserData();
      fetchBeneficiaries();
      fetchUserHistory();
    }
  }, [currentUserId]);

  const fetchServiceSettings = async () => {
    try {
      const res = await fetch('/api/indiatek-payout/settings');
      const data = await res.json();
      if (data?.success && data?.data) {
        setIsActive(data.data.is_active !== false);
        setChargeAmount(Number(data.data.charge_amount !== undefined ? data.data.charge_amount : 0));
        setVerificationCharge(Number(data.data.verification_charge !== undefined ? data.data.verification_charge : 5));
        setMinPayout(Number(data.data.min_payout !== undefined ? data.data.min_payout : 10));
        setMaxPayout(Number(data.data.max_payout !== undefined ? data.data.max_payout : 50000));
      } else {
        setIsActive(true);
      }
    } catch (err) {
      console.error('Error fetching IndiaTek settings:', err);
      setIsActive(true);
    }
  };

  const fetchUserData = async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', currentUserId)
        .single();

      if (!error && data) {
        setUserProfile(data);
        setWalletBalance(Number(data.wallet_balance || 0));
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBeneficiaries = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/indiatek-payout/beneficiaries/${currentUserId}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        setBeneficiaries(data.data);
      } else {
        // Fallback directly to Supabase client
        const { data: directData } = await supabase
          .from('payout_beneficiaries')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false });
        setBeneficiaries(directData || []);
      }
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
    }
  };

  const fetchUserHistory = async () => {
    if (!currentUserId) return;
    setRefreshingHistory(true);
    try {
      const res = await fetch(`/api/indiatek-payout/user-history/${currentUserId}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        setTransactions(data.data);
      } else {
        // Fallback directly to Supabase
        const { data: dbTxns } = await supabase
          .from('indiatek_payout_submissions')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50);
        setTransactions(dbTxns || []);
      }
    } catch (err) {
      console.error('Error fetching IndiaTek history:', err);
    } finally {
      setRefreshingHistory(false);
    }
  };

  // Step 1: Handle Bank Verification (Calling KingWallet API)
  const handleVerifyBankAccount = async () => {
    if (!addForm.accountNumber || !addForm.ifscCode) {
      setError('Please enter Bank Account Number and IFSC Code to verify.');
      return;
    }

    if (walletBalance < verificationCharge) {
      setError(`Insufficient main wallet balance for verification charge. (Required: ₹${verificationCharge.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)})`);
      return;
    }

    setVerifyingBank(true);
    setError(null);
    setSuccess(null);
    setVerifiedDetails(null);

    try {
      const res = await fetch('/api/indiatek-payout/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          accountNumber: addForm.accountNumber.trim(),
          account_number: addForm.accountNumber.trim(),
          ifsc: addForm.ifscCode.trim().toUpperCase(),
          ifsc_code: addForm.ifscCode.trim().toUpperCase(),
          bankName: addForm.bankName.trim()
        })
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.warn('Response was not JSON:', jsonErr);
      }

      if (res.ok && data?.success && data?.verified_name) {
        setVerifiedDetails({
          verifiedName: data.verified_name,
          txnId: data.txn_id
        });
        setAddForm(prev => ({
          ...prev,
          holderName: data.verified_name
        }));
        setSuccess(`Bank Account Verified Successfully! Account Holder: ${data.verified_name} (₹${verificationCharge} deducted from wallet)`);
        fetchUserData(); // Instantly refresh wallet balance in UI
      } else {
        const errorMsg = data?.message || data?.error || (res.status === 404 ? 'Server route not found. Please restart server/PM2 on live host.' : 'Bank account verification failed. Please check details or API credentials.');
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('Error verifying bank:', err);
      setError(err?.message || 'Error occurred during bank verification');
    } finally {
      setVerifyingBank(false);
    }
  };

  // Step 2: Handle Save Beneficiary
  const handleSaveBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedDetails?.verifiedName && !addForm.holderName) {
      setError('Please verify the bank account first before saving.');
      return;
    }

    if (!addForm.accountNumber || !addForm.ifscCode) {
      setError('Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/indiatek-payout/beneficiaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          bankName: addForm.bankName || 'Bank Account',
          accountNumber: addForm.accountNumber.trim(),
          ifscCode: addForm.ifscCode.trim().toUpperCase(),
          holderName: addForm.holderName.trim(),
          phone: addForm.phone.trim()
        })
      });

      const data = await res.json();

      if (data?.success) {
        setSuccess(`Verified beneficiary ${addForm.holderName} saved successfully!`);
        setIsAddModalOpen(false);
        setAddForm({ bankName: '', accountNumber: '', ifscCode: '', holderName: '', phone: '' });
        setVerifiedDetails(null);
        fetchBeneficiaries();
      } else {
        setError(data?.message || 'Failed to save beneficiary');
      }
    } catch (err: any) {
      console.error('Error saving beneficiary:', err);
      setError(err?.message || 'Failed to save beneficiary');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Handle Delete Beneficiary
  const handleDeleteBeneficiary = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove beneficiary "${name}"?`)) return;

    try {
      const res = await fetch(`/api/indiatek-payout/beneficiaries/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data?.success) {
        setSuccess(`Beneficiary "${name}" removed successfully.`);
        fetchBeneficiaries();
      } else {
        // Fallback direct delete
        await supabase.from('payout_beneficiaries').delete().eq('id', id);
        fetchBeneficiaries();
      }
    } catch (err) {
      console.error('Error deleting beneficiary:', err);
      setError('Failed to delete beneficiary');
    }
  };

  // Step 4: Handle Payout Transfer Submission
  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiary) return;

    const numAmount = Number(payoutAmount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid transfer amount.');
      return;
    }

    if (numAmount < minPayout) {
      setError(`Minimum payout allowed is ₹${minPayout}.`);
      return;
    }

    if (numAmount > maxPayout) {
      setError(`Maximum payout allowed is ₹${maxPayout}.`);
      return;
    }

    const totalRequired = numAmount + chargeAmount;
    if (walletBalance < totalRequired) {
      setError(`Insufficient wallet balance. Required: ₹${totalRequired.toFixed(2)} (Amount: ₹${numAmount} + Charge: ₹${chargeAmount})`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setPayoutResult(null);

    const partnerRef = `ITP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const res = await fetch('/api/indiatek-payout/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_number: selectedBeneficiary.account_number,
          accountNumber: selectedBeneficiary.account_number,
          ifsc: selectedBeneficiary.ifsc_code,
          ifsc_code: selectedBeneficiary.ifsc_code,
          bank_name: selectedBeneficiary.bank_name,
          amount: numAmount,
          beneficiary_name: selectedBeneficiary.holder_name,
          customer_mobile: payoutMobile || selectedBeneficiary.phone || userProfile?.phone || '9999999999',
          partner_reference: partnerRef,
          user_id: currentUserId
        })
      });

      const data = await res.json();
      setPayoutResult(data);

      if (data?.success) {
        setSuccess(`Payout of ₹${numAmount.toLocaleString('en-IN')} initiated successfully! Partner Ref: ${partnerRef}`);
        setSelectedBeneficiary(null);
        setPayoutAmount('');
        setPayoutMobile('');
        fetchUserData();
        fetchUserHistory();
      } else {
        setError(data?.message || 'Payout failed. Please check details or try again later.');
        fetchUserData();
      }
    } catch (err: any) {
      console.error('Error initiating payout:', err);
      setError(err?.message || 'Failed to initiate payout');
      fetchUserData();
    } finally {
      setSubmitting(false);
    }
  };

  // Step 5: Check Live Status of a transaction
  const handleCheckStatus = async (partnerRef: string) => {
    setCheckingStatusRef(partnerRef);
    try {
      const res = await fetch(`/api/indiatek-payout/status/${partnerRef}`);
      const data = await res.json();
      const newStatus = (data?.status || data?.data?.status || 'PENDING').toString().toUpperCase();
      setSuccess(`Status for ${partnerRef}: ${newStatus}`);
      fetchUserHistory();
      fetchUserData(); // Refresh balance if refunded
    } catch (err) {
      console.error('Error checking status:', err);
      setError('Failed to check live status from IndiaTek API');
    } finally {
      setCheckingStatusRef(null);
    }
  };

  // Filters logic
  const uniqueSavedBanks = Array.from(
    new Set(beneficiaries.map(b => b.bank_name).filter(Boolean))
  ).sort();

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const matchesHolder = !filterHolderName || b.holder_name?.toLowerCase().includes(filterHolderName.toLowerCase().trim());
    const matchesBank = !filterBankName || b.bank_name?.toLowerCase().includes(filterBankName.toLowerCase().trim());
    const matchesIfsc = !filterIfscCode || b.ifsc_code?.toLowerCase().includes(filterIfscCode.toLowerCase().trim());
    return matchesHolder && matchesBank && matchesIfsc;
  });

  const isFilterActive = Boolean(filterHolderName || filterBankName || filterIfscCode);

  const clearBeneficiaryFilters = () => {
    setFilterHolderName('');
    setFilterBankName('');
    setFilterIfscCode('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isActive === false) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 bg-white border border-slate-200 rounded-3xl shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900">UsePayout Service Disabled</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            The UsePayout service has been disabled by administrator. You cannot submit payout requests at this time.
          </p>
        </div>
        <Link
          to="/user/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 text-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Send className="w-6 h-6" />
            </span>
            UsePayout
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            Verify bank account & transfer funds instantly via UsePayout
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Wallet Balance Badge */}
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-md">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Wallet Balance</div>
              <div className="text-base font-black text-emerald-400 font-mono">
                ₹ {walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Add Account Button */}
          <button
            onClick={() => {
              setIsAddModalOpen(true);
              setVerifiedDetails(null);
              setError(null);
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 font-bold p-1">✕</button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-700 font-bold p-1">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beneficiaries Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Saved Beneficiaries</h2>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 shadow-2xs">
              {isFilterActive ? `${filteredBeneficiaries.length} of ${beneficiaries.length}` : beneficiaries.length} Accounts
            </span>
          </div>
          {isFilterActive && (
            <button
              onClick={clearBeneficiaryFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>

        {/* Filter Inputs Bar */}
        {beneficiaries.length > 0 && (
          <div className="p-4 bg-slate-50/60 border-b border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Person Name Filter */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Filter by Person Name..."
                  value={filterHolderName}
                  onChange={(e) => setFilterHolderName(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-800 placeholder-slate-400 transition-all font-medium"
                />
                {filterHolderName && (
                  <button
                    onClick={() => setFilterHolderName('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Bank Name Filter */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <select
                  value={filterBankName}
                  onChange={(e) => setFilterBankName(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-800 transition-all cursor-pointer font-medium"
                >
                  <option value="">All Banks ({uniqueSavedBanks.length})</option>
                  {uniqueSavedBanks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
                {filterBankName && (
                  <button
                    onClick={() => setFilterBankName('')}
                    className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* IFSC Code Filter */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Filter by IFSC Code..."
                  value={filterIfscCode}
                  onChange={(e) => setFilterIfscCode(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-800 placeholder-slate-400 transition-all uppercase font-medium font-mono"
                />
                {filterIfscCode && (
                  <button
                    onClick={() => setFilterIfscCode('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {beneficiaries.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-bold">No beneficiaries added yet.</p>
              <p className="text-sm text-slate-400 mt-1">Click "Add Account" to verify a bank account and transfer funds.</p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Account
              </button>
            </div>
          ) : filteredBeneficiaries.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No beneficiaries found matching your filter criteria.</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing or adjusting your search filters.</p>
              <button
                onClick={clearBeneficiaryFilters}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBeneficiaries.map((b) => (
                <div
                  key={b.id}
                  className="relative p-5 border border-emerald-200 bg-emerald-50/40 rounded-2xl transition-all group overflow-hidden hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                          {b.holder_name}
                        </h3>
                        <span className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {b.bank_name || 'Bank Account'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteBeneficiary(b.id, b.holder_name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors bg-white/60 shadow-2xs"
                        title="Remove Beneficiary"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 mb-5 bg-white/70 p-3 rounded-xl border border-emerald-100/60 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">A/C Number:</span>
                        <span className="font-bold text-slate-900">{b.account_number}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">IFSC Code:</span>
                        <span className="font-bold text-slate-900">{b.ifsc_code}</span>
                      </div>
                      {b.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-sans">Mobile:</span>
                          <span className="font-bold text-slate-900">{b.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase tracking-wider bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Verified
                    </div>
                    <button
                      onClick={() => {
                        setSelectedBeneficiary(b);
                        setPayoutMobile(b.phone || userProfile?.phone || '');
                        setPayoutAmount('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Recent UsePayout History</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-600">
              {transactions.length} Records
            </span>
          </div>
          <button
            onClick={fetchUserHistory}
            disabled={refreshingHistory}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${refreshingHistory ? 'animate-spin' : ''}`} />
            Refresh History
          </button>
        </div>

        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-500">No payout transactions found yet.</p>
              <p className="text-xs text-slate-400 mt-0.5">Your payouts processed via UsePayout will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Beneficiary Details</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Partner Ref / Txn ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn) => {
                  const statusUpper = (txn.status || 'PENDING').toUpperCase();
                  const isSuccess = statusUpper === 'SUCCESS';
                  const isPending = statusUpper === 'PENDING' || statusUpper === 'PROCESSING';

                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                        {new Date(txn.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>

                      {/* Beneficiary */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{txn.beneficiary_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {txn.account_number} • {txn.ifsc_code}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 font-mono text-sm">
                          ₹ {Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        {txn.charges > 0 && (
                          <div className="text-[10px] text-slate-400">
                            Charge: ₹{txn.charges}
                          </div>
                        )}
                      </td>

                      {/* Reference */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">
                        <div className="font-semibold text-indigo-700">{txn.partner_reference}</div>
                        {txn.transaction_id && (
                          <div className="text-[10px] text-slate-400">Txn: {txn.transaction_id}</div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSuccess ? 'bg-emerald-500' : isPending ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                            }`}
                          />
                          {statusUpper}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleCheckStatus(txn.partner_reference)}
                            disabled={checkingStatusRef === txn.partner_reference}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1"
                            title="Check Live Status"
                          >
                            <RotateCcw
                              className={`w-3.5 h-3.5 ${checkingStatusRef === txn.partner_reference ? 'animate-spin' : ''}`}
                            />
                            Status
                          </button>

                          <button
                            onClick={() => setReceiptTxn(txn)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                            title="View Full Receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD BENEFICIARY WITH MANDATORY BANK VERIFICATION */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">Add Account</h3>
                <p className="text-slate-500 text-xs mt-0.5">Verify bank account and save as beneficiary</p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setVerifiedDetails(null);
                  setError(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBeneficiary} className="p-6 space-y-4">
              {/* Bank Name */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bank Name (બેંકનું નામ) *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={addForm.bankName}
                    onFocus={() => setShowBankDropdown(true)}
                    onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddForm({ ...addForm, bankName: val });
                      setFilteredBanks(allBanksList.filter((b) => b.toLowerCase().includes(val.toLowerCase())));
                      setShowBankDropdown(true);
                    }}
                    placeholder="Search or Select Bank Name..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  {showBankDropdown && filteredBanks.length > 0 && (
                    <ul className="absolute z-30 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto text-sm">
                      {filteredBanks.map((bank, idx) => (
                        <li
                          key={idx}
                          className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0 font-medium text-xs flex items-center gap-2"
                          onMouseDown={() => {
                            setAddForm({ ...addForm, bankName: bank });
                            setShowBankDropdown(false);
                          }}
                        >
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{bank}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Account Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bank Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.accountNumber}
                  onChange={(e) => {
                    setAddForm({ ...addForm, accountNumber: e.target.value.replace(/\D/g, '') });
                    setVerifiedDetails(null); // Reset verification if account changes
                  }}
                  placeholder="Enter Bank Account Number"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* IFSC Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  IFSC Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={addForm.ifscCode}
                  onChange={(e) => {
                    setAddForm({ ...addForm, ifscCode: e.target.value.toUpperCase().trim() });
                    setVerifiedDetails(null); // Reset verification if IFSC changes
                  }}
                  placeholder="e.g. HDFC0001234"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mobile Number (મોબાઈલ નંબર)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    maxLength={10}
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="10-digit Mobile Number"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Verification Charge Note */}
              <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <span className="font-bold text-slate-800">Verification Note:</span> A verification charge of ₹{verificationCharge} will be deducted from your wallet when you click the Verify button for an unverified account.
                </span>
              </div>

              {/* BANK VERIFICATION BUTTON & RESULT */}
              <div className="pt-2">
                {!verifiedDetails ? (
                  <button
                    type="button"
                    onClick={handleVerifyBankAccount}
                    disabled={verifyingBank || !addForm.accountNumber || !addForm.ifscCode}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {verifyingBank ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying with Bank...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify Bank Account (Penny Drop)
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Bank Account Verified!
                      </div>
                      <span className="text-[10px] bg-emerald-200/60 text-emerald-900 font-bold px-2 py-0.5 rounded">
                        Penny Drop OK
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Beneficiary Name (ખાતાધારકનું નામ) *
                      </label>
                      <input
                        type="text"
                        required
                        value={addForm.holderName}
                        onChange={(e) => setAddForm({ ...addForm, holderName: e.target.value })}
                        placeholder="Account Holder Name"
                        className="w-full px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        API Response: <span className="font-semibold text-slate-800">{verifiedDetails.verifiedName}</span>
                      </p>
                    </div>

                    {verifiedDetails.txnId && (
                      <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-emerald-200/60">
                        Txn ID: {verifiedDetails.txnId}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SAVE BENEFICIARY BUTTON (Only enabled after verified) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !verifiedDetails}
                  className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Beneficiary...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" /> Save Verified Beneficiary
                    </>
                  )}
                </button>
                {!verifiedDetails && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg p-2 mt-2 text-center font-medium">
                    ⓘ Bank verification is required before saving the beneficiary.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: TRANSFER FUNDS / PAYOUT MODAL                   */}
      {/* ========================================================= */}
      {selectedBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">Transfer Funds</h3>
                <p className="text-slate-500 text-xs mt-0.5">Instant Payout via UsePayout</p>
              </div>
              <button
                onClick={() => setSelectedBeneficiary(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessPayout} className="p-6 space-y-4">
              {/* Beneficiary Details Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Beneficiary Details
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                </div>
                <div className="font-black text-slate-900 text-base">{selectedBeneficiary.holder_name}</div>
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="font-semibold">{selectedBeneficiary.bank_name}</span>
                </div>
                <div className="text-xs font-mono text-slate-600 font-semibold">
                  A/C: {selectedBeneficiary.account_number} • IFSC: {selectedBeneficiary.ifsc_code}
                </div>
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mobile Number (મોબાઈલ નંબર) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={payoutMobile}
                    onChange={(e) => setPayoutMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit Mobile Number"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Transfer Amount (₹) *
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Min: ₹{minPayout} • Max: ₹{maxPayout.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">
                    ₹
                  </div>
                  <input
                    type="number"
                    required
                    min={minPayout}
                    max={maxPayout}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-black text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    autoFocus
                  />
                </div>

                {/* Quick Amount Chips */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {[500, 1000, 2000, 5000].map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setPayoutAmount(chip.toString())}
                      className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200"
                    >
                      +₹{chip.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Charge & Total Calculation */}
              {payoutAmount && Number(payoutAmount) > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 font-medium">
                  <div className="flex justify-between text-slate-600">
                    <span>Transfer Amount:</span>
                    <span className="font-bold text-slate-900">₹{Number(payoutAmount).toFixed(2)}</span>
                  </div>
                  {chargeAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Service Charge:</span>
                      <span className="font-bold text-slate-900">₹{chargeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 text-sm">
                    <span>Total Wallet Deduction:</span>
                    <span className="text-indigo-600 font-black">
                      ₹{(Number(payoutAmount) + chargeAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Transfer */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !payoutAmount || Number(payoutAmount) <= 0}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" /> Proceed to Pay
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: VIEW RECEIPT MODAL                               */}
      {/* ========================================================= */}
      {receiptTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900">Payout Receipt</h3>
              </div>
              <button
                onClick={() => setReceiptTxn(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="text-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  Transaction Status
                </div>
                <div className="text-2xl font-black text-emerald-700 uppercase">
                  {receiptTxn.status}
                </div>
                <div className="text-3xl font-black text-slate-900 font-mono mt-2">
                  ₹ {Number(receiptTxn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase">Beneficiary Name</span>
                  <span className="font-extrabold text-slate-900">{receiptTxn.beneficiary_name}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase">Account Number</span>
                  <span className="font-mono font-bold text-slate-800">{receiptTxn.account_number}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase">IFSC Code</span>
                  <span className="font-mono font-bold text-slate-800">{receiptTxn.ifsc_code}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase">Partner Reference</span>
                  <span className="font-mono font-bold text-indigo-600">{receiptTxn.partner_reference}</span>
                </div>
                {receiptTxn.transaction_id && (
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-semibold uppercase">Txn ID / UTR</span>
                    <span className="font-mono font-bold text-slate-800">{receiptTxn.transaction_id}</span>
                  </div>
                )}
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase">Date & Time</span>
                  <span className="font-medium text-slate-700">
                    {new Date(receiptTxn.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => window.print()}
                  className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
