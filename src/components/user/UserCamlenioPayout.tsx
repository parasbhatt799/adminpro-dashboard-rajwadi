import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Loader2, Send, AlertCircle, CheckCircle2, IndianRupee, Users, Trash2, Plus, Eye, EyeOff, AlertTriangle, X } from 'lucide-react';
import { sendAdminPushNotification } from '../../lib/notifications';
import { motion, AnimatePresence } from 'framer-motion';

interface UserCamlenioPayoutProps {
  userId: string;
}

interface Beneficiary {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  holder_name: string;
  is_verified: boolean;
}

interface ReceiptData {
  reference: string;
  amount: number;
  charge: number;
  status: string;
  accountNumber: string;
  holderName: string;
  bankName: string;
  isError?: boolean;
  errorMessage?: string;
}

// Removed POPULAR_BANKS as we now fetch dynamically from database
export default function UserCamlenioPayout({ userId }: UserCamlenioPayoutProps) {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Add new beneficiary form
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    holderName: ''
  });

  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [allBanksList, setAllBanksList] = useState<string[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<string[]>([]);

  // Modal State
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');

  // T-PIN State
  const [showTpinModal, setShowTpinModal] = useState(false);
  const [tpinInput, setTpinInput] = useState('');
  const [showTpinDigits, setShowTpinDigits] = useState(false);
  const [tpinError, setTpinError] = useState<string | null>(null);
  const [tpinLoading, setTpinLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchUserData();
    fetchBeneficiaries();
    fetchCamlenioBanks();
  }, [userId]);

  const fetchCamlenioBanks = async () => {
    try {
      const { data, error } = await supabase.from('camlenio_banks').select('bank_name').limit(2000);
      if (!error && data && data.length > 0) {
        const bankNames = data.map(b => b.bank_name).sort();
        setAllBanksList(bankNames);
        setFilteredBanks(bankNames);
      }
    } catch (err) {
      console.error('Error fetching camlenio banks:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('payout_settings').select('*').eq('id', 1).single();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };



  const fetchUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('wallet_balance')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setWalletBalance(Number(data.wallet_balance) || 0);
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBeneficiaries = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_beneficiaries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBeneficiaries(data || []);
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
    }
  };

  const handleSaveBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutForm.bankName || !payoutForm.accountNumber || !payoutForm.ifscCode || !payoutForm.holderName) {
      setError('Please fill all fields to save.');
      return;
    }

    // Check if already exists locally
    const exists = beneficiaries.some(
      b => b.account_number === payoutForm.accountNumber && b.ifsc_code === payoutForm.ifscCode
    );
    if (exists) {
      setError('This beneficiary already exists in your list.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase
        .from('payout_beneficiaries')
        .insert({
          user_id: userId,
          bank_name: payoutForm.bankName,
          account_number: payoutForm.accountNumber,
          ifsc_code: payoutForm.ifscCode,
          holder_name: payoutForm.holderName,
          is_verified: false
        });

      if (insertError) throw insertError;

      setSuccess(`Beneficiary account added successfully!`);
      setPayoutForm({ bankName: '', accountNumber: '', ifscCode: '', holderName: '' });
      setIsAddModalOpen(false);
      fetchBeneficiaries(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to save bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyBeneficiary = async (b: Beneficiary) => {
    setVerifyingBank(true);
    setVerifyingId(b.id);
    setError(null);
    setSuccess(null);

    try {
      const verifyTxnId = `VFC${Date.now()}`;
      const response = await fetch('/api/payout/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          accountNumber: b.account_number,
          ifsc: b.ifsc_code,
          transactionId: verifyTxnId,
          bankName: b.bank_name,
          holderName: b.holder_name
        })
      });
      const data = await response.json();

      if (data.success && data.data?.beneficiaryName) {
        // Update to Database
        const { error: updateError } = await supabase
          .from('payout_beneficiaries')
          .update({
            holder_name: data.data.beneficiaryName,
            is_verified: true
          })
          .eq('id', b.id);

        if (updateError) throw updateError;

        setSuccess(`Beneficiary verified successfully as ${data.data.beneficiaryName}!`);
        fetchBeneficiaries();
        fetchTransactions();
        fetchUserData();
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify bank account');
    } finally {
      setVerifyingBank(false);
      setVerifyingId(null);
    }
  };

  const handleDeleteBeneficiary = async (id: string) => {
    if (!confirm('Are you sure you want to delete this beneficiary?')) return;
    try {
      const { error } = await supabase.from('payout_beneficiaries').delete().eq('id', id);
      if (error) throw error;
      fetchBeneficiaries();
    } catch (err) {
      console.error('Error deleting beneficiary:', err);
    }
  };

  const handleProcessPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiary || !payoutAmount) return;

    const amountNum = parseFloat(payoutAmount);
    if (amountNum <= 0) {
      setError('Invalid amount.');
      return;
    }

    const charge = 0; // Fetch from settings if dynamic
    const totalDeduction = amountNum + charge;

    if (walletBalance - totalDeduction < 250) {
      setError("Your balance is insufficient. You must maintain at least ₹250 in your wallet.");
      return;
    }

    try {
      const { data: userProfile, error: profileErr } = await supabase
        .from('users_profiles')
        .select('tpin')
        .eq('id', userId)
        .single();

      if (profileErr) throw profileErr;

      if (!userProfile.tpin) {
        setError("You have not set up a TPIN. Please set up a TPIN in your profile settings before making a payout.");
        return;
      }

      setTpinInput('');
      setTpinError(null);
      setShowTpinModal(true);
    } catch (err: any) {
      setError("Error checking TPIN setup.");
    }
  };

  const handleTpinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tpinInput.length !== 4) {
      setTpinError('TPIN must be exactly 4 digits');
      return;
    }

    setTpinLoading(true);
    setTpinError(null);

    try {
      // Verify TPIN
      const { data: userProfile, error: profileErr } = await supabase
        .from('users_profiles')
        .select('tpin, tpin_attempts, tpin_locked_until')
        .eq('id', userId)
        .single();

      if (profileErr) throw profileErr;

      // Check lock
      if (userProfile.tpin_locked_until && new Date(userProfile.tpin_locked_until) > new Date()) {
        const unlockTime = new Date(userProfile.tpin_locked_until).toLocaleTimeString();
        setTpinError(`Account locked due to too many incorrect attempts. Try again after ${unlockTime}`);
        setTpinLoading(false);
        return;
      }

      if (userProfile.tpin !== tpinInput) {
        const attempts = (userProfile.tpin_attempts || 0) + 1;
        if (attempts >= 3) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + 10);

          await supabase
            .from('users_profiles')
            .update({ tpin_attempts: attempts, tpin_locked_until: lockUntil.toISOString() })
            .eq('id', userId);

          setShowTpinModal(false);
          setError('Too many incorrect TPIN attempts. Account locked for 10 minutes.');
        } else {
          await supabase
            .from('users_profiles')
            .update({ tpin_attempts: attempts })
            .eq('id', userId);
          setTpinError(`Incorrect TPIN. ${3 - attempts} attempts remaining.`);
        }
        setTpinLoading(false);
        return;
      }

      // Reset attempts on success
      await supabase
        .from('users_profiles')
        .update({ tpin_attempts: 0, tpin_locked_until: null })
        .eq('id', userId);

      await executePayout();

    } catch (err: any) {
      setTpinError(err.message || 'TPIN verification failed.');
    } finally {
      setTpinLoading(false);
    }
  };

  const executePayout = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(payoutAmount);
    const charge = 0; // Fetch from settings if dynamic
    const totalDeduction = amountNum + charge;

    try {
      const localTxnId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const response = await fetch('/api/payout/process-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          amount: amountNum,
          bankName: selectedBeneficiary!.bank_name,
          holderName: selectedBeneficiary!.holder_name,
          accountNumber: selectedBeneficiary!.account_number,
          ifscCode: selectedBeneficiary!.ifsc_code,
          charge: charge,
          transactionId: localTxnId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Payout submission failed');
      }

      setWalletBalance(prev => prev - totalDeduction);
      
      setReceiptData({
        reference: result.reference || localTxnId,
        amount: amountNum,
        charge: result.charge || charge,
        status: result.status || 'processing',
        accountNumber: selectedBeneficiary!.account_number,
        holderName: selectedBeneficiary!.holder_name,
        bankName: selectedBeneficiary!.bank_name,
        isError: false
      });
      
      setSelectedBeneficiary(null);
      setPayoutAmount('');
      setShowTpinModal(false);

      sendAdminPushNotification(
        'New Auto Payout 💰',
        `User requested an auto payout of ₹${amountNum}.`,
        '/payout-requests'
      );

    } catch (err: any) {
      console.error('Error submitting payout:', err);
      const errorMsg = err.message || 'Failed to submit payout.';
      setReceiptData({
        reference: 'N/A',
        amount: amountNum,
        charge: charge,
        status: 'failed',
        accountNumber: selectedBeneficiary?.account_number || '',
        holderName: selectedBeneficiary?.holder_name || '',
        bankName: selectedBeneficiary?.bank_name || '',
        isError: true,
        errorMessage: errorMsg
      });
      setShowTpinModal(false);
    } finally {
      setSubmitting(false);
      fetchUserData(); // Ensure balance is updated (e.g. if refunded or deducted)
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bank Payout</h1>
          <p className="text-slate-500">Add verified beneficiaries and transfer funds instantly</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium shadow-sm flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Account
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-start gap-3 border border-green-100">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Beneficiaries Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Saved Beneficiaries</h2>
          <span className="text-xs font-medium px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-500">
            {beneficiaries.length} Accounts
          </span>
        </div>

        <div className="p-6">
          {beneficiaries.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No beneficiaries added yet.</p>
              <p className="text-sm text-slate-400 mt-1">Click "Add Account" to start transferring.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {beneficiaries.map((b) => (
                <div
                  key={b.id}
                  className={`relative p-5 border rounded-2xl transition-all group overflow-hidden ${b.is_verified
                      ? 'border-emerald-200 bg-emerald-50 hover:shadow-md'
                      : 'border-yellow-200 bg-yellow-50 hover:shadow-md'
                    }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {b.holder_name}
                      </h3>
                      <span className="text-xs font-medium text-slate-500 mt-0.5">{b.bank_name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteBeneficiary(b.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors bg-white/50"
                      title="Remove Beneficiary"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1 mb-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">A/C Number:</span>
                      <span className="font-bold text-slate-800">{b.account_number}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">IFSC Code:</span>
                      <span className="font-bold text-slate-800">{b.ifsc_code}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-black/5 flex items-center justify-between">
                    {b.is_verified ? (
                      <>
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase tracking-wider bg-emerald-100/50 px-2.5 py-1 rounded-md">
                          <ShieldCheck className="w-4 h-4" />
                          Verified
                        </div>
                        <button
                          onClick={() => setSelectedBeneficiary(b)}
                          className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Pay
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-yellow-600 font-bold text-xs uppercase tracking-wider bg-yellow-100/50 px-2.5 py-1 rounded-md">
                          <AlertCircle className="w-4 h-4" />
                          Unverified
                        </div>
                        <button
                          onClick={() => handleVerifyBeneficiary(b)}
                          disabled={verifyingBank && verifyingId === b.id}
                          className="px-4 py-2 bg-white border-2 border-yellow-300 text-yellow-700 text-sm font-bold rounded-xl hover:bg-yellow-100 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          {verifyingBank && verifyingId === b.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                          Verify
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-6 bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span><span className="font-bold text-slate-700">Verification Note:</span> A verification charge of ₹{settings?.camlenio_verification_charge || 5} will be deducted from your wallet when you click the Verify button for an unverified account.</span>
          </p>
        </div>
      </div>


      {/* Add Beneficiary Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Add Account</h3>
                <p className="text-slate-500 text-sm mt-1">Save a new beneficiary account</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveBeneficiary} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Beneficiary Name</label>
                <input
                  type="text"
                  value={payoutForm.holderName}
                  onChange={(e) => setPayoutForm({ ...payoutForm, holderName: e.target.value })}
                  placeholder="Enter Account Holder Name"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                  required
                />
              </div>
              <div className="space-y-2 relative">
                <label className="text-sm font-bold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={payoutForm.bankName}
                  onFocus={() => setShowBankDropdown(true)}
                  onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPayoutForm({ ...payoutForm, bankName: val });
                    setFilteredBanks(allBanksList.filter(b => b.toLowerCase().includes(val.toLowerCase())));
                    setShowBankDropdown(true);
                  }}
                  placeholder="e.g. State Bank of India"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                  required
                />
                {showBankDropdown && filteredBanks.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto text-sm">
                    {filteredBanks.map((bank, idx) => (
                      <li
                        key={idx}
                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0 font-medium"
                        onClick={() => {
                          setPayoutForm({ ...payoutForm, bankName: bank });
                          setShowBankDropdown(false);
                        }}
                      >
                        {bank}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Account Number</label>
                <input
                  type="text"
                  value={payoutForm.accountNumber}
                  onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="Enter Account Number"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">IFSC Code</label>
                <input
                  type="text"
                  value={payoutForm.ifscCode}
                  onChange={(e) => setPayoutForm({ ...payoutForm, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="Enter IFSC Code"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {selectedBeneficiary && !showTpinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Transfer Funds</h3>
                <p className="text-slate-500 text-sm mt-1">Sending to {selectedBeneficiary.holder_name}</p>
              </div>
              <button onClick={() => setSelectedBeneficiary(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleProcessPayoutSubmit} className="p-6 space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Beneficiary Details</div>
                <div className="font-bold text-slate-900 text-lg">{selectedBeneficiary.bank_name}</div>
                <div className="text-sm font-medium text-slate-600 font-mono tracking-wide">{selectedBeneficiary.account_number}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Amount (₹)</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-14 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-3xl text-slate-900"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!payoutAmount}
                  className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20"
                >
                  Proceed to Pay
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TPIN MODAL DIALOG */}
      <AnimatePresence>
        {showTpinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTpinModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600">
                      <ShieldCheck size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Security Check</h3>
                    <p className="text-slate-500 text-sm mt-1">Enter your 4-digit TPIN to authorize ₹{payoutAmount} transfer.</p>
                  </div>
                  <button onClick={() => setShowTpinModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleTpinSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      type={showTpinDigits ? 'text' : 'password'}
                      maxLength={4}
                      autoFocus
                      required
                      value={tpinInput}
                      onChange={(e) => setTpinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[1.5em] text-2xl font-black py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner text-slate-900"
                      placeholder="    "
                    />
                    <button
                      type="button"
                      onClick={() => setShowTpinDigits(!showTpinDigits)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors bg-white p-1 rounded-md border border-slate-100 shadow-sm"
                    >
                      {showTpinDigits ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {tpinError && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-2 text-[11px] text-rose-600 font-bold uppercase tracking-wide">
                      <AlertTriangle size={14} className="shrink-0" />
                      {tpinError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={tpinLoading || submitting}
                    className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-slate-900/20 mt-6 flex justify-center items-center gap-2"
                  >
                    {tpinLoading || submitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                    ) : 'Authorize Payment'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {receiptData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border-2 border-slate-100"
            >
              {/* Header */}
              <div className={`p-4 flex justify-between items-center ${receiptData.isError ? 'bg-red-600' : 'bg-green-600'} text-white`}>
                <h3 className="text-lg font-bold w-full text-center tracking-wide">
                  {receiptData.isError ? 'Payout Failed' : 'Payout Completed'}
                </h3>
                <button onClick={() => setReceiptData(null)} className="absolute right-4 text-white/80 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Status Icon */}
              <div className="flex justify-center pt-8 pb-4 relative">
                <div className="absolute inset-x-0 bottom-0 border-b border-slate-200"></div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center relative z-10 ${receiptData.isError ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]'} text-white`}>
                  {receiptData.isError ? <X size={40} strokeWidth={3} /> : <CheckCircle2 size={40} strokeWidth={3} />}
                </div>
              </div>

              {/* Receipt Details */}
              <div className="px-6 py-6 space-y-3 bg-white text-sm">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Reference Id:</span>
                  <span className="text-slate-700 text-right font-medium break-all">{receiptData.reference}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Amount:</span>
                  <span className="text-slate-700 text-right font-medium">₹{receiptData.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Charges:</span>
                  <span className="text-slate-700 text-right font-medium">₹{receiptData.charge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Status:</span>
                  <span className={`text-right font-bold uppercase ${receiptData.status === 'approved' ? 'text-green-600' : receiptData.status === 'processing' ? 'text-amber-500' : 'text-red-600'}`}>
                    {receiptData.status}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Mode:</span>
                  <span className="text-slate-700 text-right font-medium">IMPS</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Account Number:</span>
                  <span className="text-slate-700 text-right font-medium">{receiptData.accountNumber}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Account Name:</span>
                  <span className="text-slate-700 text-right font-medium">{receiptData.holderName}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Bank Name:</span>
                  <span className="text-slate-700 text-right font-medium">{receiptData.bankName}</span>
                </div>
                {receiptData.isError && receiptData.errorMessage && (
                   <div className="flex flex-col gap-1 pt-2 border-t border-slate-100 mt-2">
                     <span className="text-red-500 font-bold">Error Reason:</span>
                     <span className="text-slate-700 text-xs">{receiptData.errorMessage}</span>
                   </div>
                )}
                
                <div className="text-center text-[11px] font-medium text-slate-400 mt-6 pt-4">
                  © Copyright 2022-24 UsePay | All Rights Reserved.
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="p-4 bg-slate-50 flex justify-center gap-3 border-t border-slate-100">
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-white text-slate-700 border border-slate-300 font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                >
                  Print
                </button>
                <button 
                  onClick={() => setReceiptData(null)}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                >
                  Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
