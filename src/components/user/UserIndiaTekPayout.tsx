import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Wallet, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Phone, 
  User, 
  Hash, 
  IndianRupee,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

export default function UserIndiaTekPayout() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    account_number: '',
    ifsc_code: '',
    amount: '',
    beneficiary_name: '',
    customer_mobile: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setMessage(null);

    const ref = `ITP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

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
          partner_reference: ref,
          user_id: userProfile?.id
        })
      });

      const data = await res.json();
      setResult(data);

      if (data?.success) {
        setMessage({ type: 'success', text: `Payout submitted successfully! Ref: ${ref}` });
        setFormData({ account_number: '', ifsc_code: '', amount: '', beneficiary_name: '', customer_mobile: '' });
        fetchUserProfile();
      } else {
        setMessage({ type: 'error', text: data?.message || 'Payout failed. Please try again.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error processing payout' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-gray-100">
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/20 backdrop-blur-md rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 border border-blue-400/20 rounded-xl text-blue-400">
            <Send className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              IndiaTek Payout
            </h1>
            <p className="text-sm text-gray-400">Instant Money Transfer to Bank Account</p>
          </div>
        </div>

        {userProfile && (
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-gray-400">Your Balance</div>
              <div className="text-base font-bold text-emerald-400">
                ₹ {Number(userProfile.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}
      </div>

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
            <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white font-bold px-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
        <form onSubmit={handleSubmitPayout} className="space-y-4">
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
                Bank Account Number *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="Account Number"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Processing Payout...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" /> Transfer Funds via IndiaTek Payout
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
