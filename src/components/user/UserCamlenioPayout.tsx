import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Loader2, Send, AlertCircle, CheckCircle2, IndianRupee, Users, Trash2 } from 'lucide-react';
import { sendAdminPushNotification } from '../../lib/notifications';

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

// We will load banks dynamically from the database instead of hardcoding
// POPULAR_BANKS list has been removed.

export default function UserCamlenioPayout({ userId }: UserCamlenioPayoutProps) {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Add new beneficiary form
  const [payoutForm, setPayoutForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: ''
  });

  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [allBanks, setAllBanks] = useState<string[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<string[]>([]);

  // Modal State
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchUserData();
    fetchBeneficiaries();
    fetchTransactions();
    fetchAllBanks();
  }, [userId]);

  const fetchAllBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('camlenio_banks')
        .select('bank_name')
        .order('bank_name', { ascending: true });
        
      if (!error && data) {
        const bankNames = Array.from(new Set(data.map(b => b.bank_name).filter(Boolean)));
        setAllBanks(bankNames);
        setFilteredBanks(bankNames);
      }
    } catch (err) {
      console.error('Error fetching banks:', err);
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

  const fetchTransactions = async () => {
    try {
      const { data } = await supabase
        .from('payout_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
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

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutForm.bankName || !payoutForm.accountNumber || !payoutForm.ifscCode) {
      setError('Please fill all fields to verify.');
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

    setVerifyingBank(true);
    setError(null);
    setSuccess(null);

    try {
      const verifyTxnId = `VFC${Date.now()}`;
      const response = await fetch('/api/payout/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          accountNumber: payoutForm.accountNumber,
          ifsc: payoutForm.ifscCode,
          transactionId: verifyTxnId,
          bankName: payoutForm.bankName
        })
      });
      const data = await response.json();
      
      if (data.success && data.data?.beneficiaryName) {
        // Save to Database
        const { error: insertError } = await supabase
          .from('payout_beneficiaries')
          .insert({
            user_id: userId,
            bank_name: payoutForm.bankName,
            account_number: payoutForm.accountNumber,
            ifsc_code: payoutForm.ifscCode,
            holder_name: data.data.beneficiaryName,
            is_verified: true
          });

        if (insertError) throw insertError;

        setSuccess(`Beneficiary ${data.data.beneficiaryName} verified and saved successfully!`);
        setPayoutForm({ bankName: '', accountNumber: '', ifscCode: '' });
        fetchBeneficiaries(); // Refresh list
        fetchTransactions(); // Update history
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify bank account');
    } finally {
      setVerifyingBank(false);
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

  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiary || !payoutAmount) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(payoutAmount);
    if (amountNum <= 0) {
      setError('Invalid amount.');
      setSubmitting(false);
      return;
    }

    const charge = 0; // Fetch from settings if dynamic
    const totalDeduction = amountNum + charge;

    if (walletBalance - totalDeduction < 250) {
      setError("Your balance is insufficient. You must maintain at least ₹250 in your wallet.");
      setSubmitting(false);
      return;
    }

    try {
      const localTxnId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const response = await fetch('/api/payout/process-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          amount: amountNum,
          bankName: selectedBeneficiary.bank_name,
          holderName: selectedBeneficiary.holder_name,
          accountNumber: selectedBeneficiary.account_number,
          ifscCode: selectedBeneficiary.ifsc_code,
          charge: charge,
          transactionId: localTxnId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Payout submission failed');
      }

      setWalletBalance(prev => prev - totalDeduction);
      setSuccess(`Payout of ₹${amountNum} to ${selectedBeneficiary.holder_name} is being processed!`);
      setSelectedBeneficiary(null);
      setPayoutAmount('');
      fetchTransactions();

      sendAdminPushNotification(
        'New Auto Payout 💰',
        `User requested an auto payout of ₹${amountNum}.`,
        '/payout-requests'
      );

    } catch (err: any) {
      console.error('Error submitting payout:', err);
      setError(err.message || 'Failed to submit payout.');
    } finally {
      setSubmitting(false);
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
          <h1 className="text-2xl font-bold text-slate-900">Camlenio Auto Payout</h1>
          <p className="text-slate-500">Add verified beneficiaries and transfer funds instantly</p>
        </div>
        <div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium shadow-sm flex items-center gap-2">
          <WalletIcon className="w-4 h-4 text-amber-400" />
          Balance: ₹{walletBalance.toFixed(2)}
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Add Beneficiary Form */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm h-fit">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Add Beneficiary</h2>
          </div>
          <form onSubmit={handleVerifyAndSave} className="p-4 space-y-4">
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
                  setFilteredBanks(allBanks.filter(b => b.toLowerCase().includes(val.toLowerCase())));
                  setShowBankDropdown(true);
                }}
                placeholder="e.g. State Bank of India"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                required
              />
              {showBankDropdown && filteredBanks.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto text-sm">
                  {filteredBanks.map((bank, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0"
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={verifyingBank}
              className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {verifyingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify & Save
            </button>
          </form>
        </div>

        {/* Beneficiaries List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">Saved Beneficiaries</h2>
          </div>
          
          <div className="p-4">
            {beneficiaries.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No beneficiaries added yet.</p>
                <p className="text-sm text-slate-400 mt-1">Verify and save an account to start transferring.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {beneficiaries.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{b.holder_name}</span>
                        {b.is_verified && <ShieldCheck className="w-4 h-4 text-green-500" />}
                      </div>
                      <span className="text-sm text-slate-500">{b.bank_name} • A/C: {b.account_number} • IFSC: {b.ifsc_code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedBeneficiary(b)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Pay
                      </button>
                      <button
                        onClick={() => handleDeleteBeneficiary(b.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Beneficiary"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-bold text-slate-700">Note:</span> A verification charge of ₹{settings?.camlenio_verification_charge || 5} will be deducted from your wallet to verify this bank account via Pennydrop.
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">Recent Payouts & Verifications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Charge</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {tx.bank_ref === 'VERIFICATION_CHARGE' ? 'A/C Verification' : 'Payout'}
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

      {/* Payment Modal */}
      {selectedBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Transfer Funds</h3>
              <p className="text-slate-500 text-sm mt-1">Sending to {selectedBeneficiary.holder_name}</p>
            </div>
            
            <form onSubmit={handleProcessPayout} className="p-6 space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Beneficiary Details</div>
                <div className="font-medium text-slate-900">{selectedBeneficiary.bank_name}</div>
                <div className="text-sm text-slate-600">{selectedBeneficiary.account_number}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Amount (₹)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-2xl"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBeneficiary(null)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !payoutAmount}
                  className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Send Money
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const WalletIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);
