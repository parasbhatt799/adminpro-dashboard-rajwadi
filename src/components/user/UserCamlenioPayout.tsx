import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Loader2, Send, AlertCircle, CheckCircle2, IndianRupee } from 'lucide-react';
import { sendAdminPushNotification } from '../../lib/notifications';

interface UserCamlenioPayoutProps {
  userId: string;
}

export default function UserCamlenioPayout({ userId }: UserCamlenioPayoutProps) {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [payoutForm, setPayoutForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    holderName: '',
    amount: ''
  });

  useEffect(() => {
    fetchUserData();
  }, [userId]);

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

  const handleVerifyBank = async () => {
    if (!payoutForm.accountNumber || !payoutForm.ifscCode) {
      setError('Please enter Account Number and IFSC code to verify.');
      return;
    }
    setVerifyingBank(true);
    setError(null);
    try {
      const localTxnId = `VFC${Date.now()}`;
      const response = await fetch('/api/payout/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: payoutForm.accountNumber,
          ifsc: payoutForm.ifscCode,
          transactionId: localTxnId
        })
      });
      const data = await response.json();
      if (data.success && data.data?.beneficiaryName) {
        setPayoutForm(prev => ({ ...prev, holderName: data.data.beneficiaryName }));
        setBankVerified(true);
        setSuccess('Bank account verified successfully!');
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify bank account');
    } finally {
      setVerifyingBank(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutForm.bankName || !payoutForm.holderName || !payoutForm.accountNumber || !payoutForm.ifscCode || !payoutForm.amount) {
      setError('Please fill all fields for payout.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(payoutForm.amount);
    if (amountNum <= 0) {
      setError('Invalid amount.');
      setSubmitting(false);
      return;
    }

    const charge = 0; // Or fetch from settings if you have dynamic charges
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
          bankName: payoutForm.bankName,
          holderName: payoutForm.holderName,
          accountNumber: payoutForm.accountNumber,
          ifscCode: payoutForm.ifscCode,
          charge: charge,
          transactionId: localTxnId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Payout submission failed');
      }

      setWalletBalance(prev => prev - totalDeduction);
      setSuccess('Payout request submitted successfully and is being processed!');
      setPayoutForm({
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        holderName: '',
        amount: ''
      });
      setBankVerified(false);

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
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Camlenio Auto Payout</h1>
          <p className="text-slate-500">Transfer funds instantly to any bank account</p>
        </div>
        <div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium shadow-sm flex items-center gap-2">
          <WalletIcon className="w-4 h-4 text-amber-400" />
          Balance: ₹{walletBalance.toFixed(2)}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Instant Transfer</h2>
              <p className="text-sm text-slate-500">Verify account and transfer money via IMPS</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-start gap-3 border border-green-100">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={payoutForm.bankName}
                  onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                  placeholder="e.g. State Bank of India"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Account Number</label>
                <input
                  type="text"
                  value={payoutForm.accountNumber}
                  onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="Enter Account Number"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">IFSC Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={payoutForm.ifscCode}
                    onChange={(e) => setPayoutForm({ ...payoutForm, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="Enter IFSC Code"
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleVerifyBank}
                    disabled={verifyingBank || !payoutForm.accountNumber || !payoutForm.ifscCode}
                    className="px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    {verifyingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verify
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">A/c Holder Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={payoutForm.holderName}
                    onChange={(e) => setPayoutForm({ ...payoutForm, holderName: e.target.value })}
                    placeholder="Enter Holder Name"
                    className={`w-full px-4 py-3 bg-white border ${bankVerified ? 'border-green-500 bg-green-50' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all`}
                    required
                    readOnly={bankVerified}
                  />
                  {bankVerified && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-xs font-bold">Verified</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Transfer Amount (₹)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <input
                    type="number"
                    value={payoutForm.amount}
                    onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-xl"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Payout...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Transfer Now
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Temporary internal component icon to avoid adding new imports if missing
const WalletIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);
