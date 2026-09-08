import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Wallet, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Phone, 
  User, 
  Hash, 
  IndianRupee,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function UserIndiaTekPayout() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);

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
    fetchServiceStatus();
  }, []);

  const fetchServiceStatus = async () => {
    setCheckingActive(true);
    try {
      const res = await fetch('/api/indiatek-payout/settings');
      const data = await res.json();
      if (data?.success && data?.data) {
        setIsActive(data.data.is_active !== false);
      } else {
        setIsActive(true);
      }
    } catch (err) {
      console.error('Error fetching IndiaTek status:', err);
      setIsActive(true);
    } finally {
      setCheckingActive(false);
    }
  };

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
        setMessage({ type: 'success', text: `Payout initiated successfully! Partner Ref: ${ref}` });
        setFormData({ account_number: '', ifsc_code: '', amount: '', beneficiary_name: '', customer_mobile: '' });
        fetchUserProfile();
      } else {
        setMessage({ type: 'error', text: data?.message || 'Payout failed. Service may be disabled or parameters invalid.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error processing payout request' });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingActive) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
        <p className="text-xs font-bold uppercase tracking-wider">Checking IndiaTek Payout status...</p>
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
          <h2 className="text-xl font-black text-slate-900">IndiaTek Payout Service Disabled</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            The IndiaTek Payout service has been disabled by administrator. You cannot submit payout requests at this time.
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
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-800/40 rounded-3xl p-6 md:p-8 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3.5 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300 shadow-inner">
            <Send className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              IndiaTek Payout
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 font-medium">
              Instant Bank Account Payout & Money Transfer
            </p>
          </div>
        </div>

        {userProfile && (
          <div className="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl px-5 py-3 flex items-center gap-3.5 shadow-lg relative z-10">
            <div className="p-2.5 bg-emerald-400/20 text-emerald-300 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Your Balance</div>
              <div className="text-lg font-black text-emerald-300">
                ₹ {Number(userProfile.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alert Banner */}
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
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700 font-bold px-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form Container */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Send className="w-5 h-5 text-indigo-600" /> Initiate Instant Payout
        </h2>

        <form onSubmit={handleSubmitPayout} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Beneficiary Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={formData.beneficiary_name}
                  onChange={e => setFormData({ ...formData, beneficiary_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Customer Mobile *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={formData.customer_mobile}
                  onChange={e => setFormData({ ...formData, customer_mobile: e.target.value.replace(/\D/g, '') })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Bank Account Number *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Bank Account Number"
                  value={formData.account_number}
                  onChange={e => setFormData({ ...formData, account_number: e.target.value.trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                IFSC Code *
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC0001234"
                  value={formData.ifsc_code}
                  onChange={e => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase().trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Transfer Amount (INR) *
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="number"
                required
                min={1}
                placeholder="Amount in ₹"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
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

        {result && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Payout Result Status
            </div>
            <div className="flex justify-between font-mono text-slate-600">
              <span>Status: <strong className="text-slate-900">{result.status || 'PROCESSED'}</strong></span>
              <span>Ref: <strong className="text-indigo-600">{result.partner_reference}</strong></span>
            </div>
            {result.transaction_id && (
              <div className="font-mono text-slate-600">
                Txn ID: <strong className="text-emerald-600">{result.transaction_id}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
