import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  History, 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  IndianRupee,
  Building2,
  User,
  Hash,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function DistributorWithdrawal({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolder: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('distributor_withdrawals')
        .select('*')
        .eq('distributor_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setWithdrawals(data || []);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('commission_balance, name')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchWithdrawals()]);
      setLoading(false);
    };
    init();

    // Real-time subscription
    const channel = supabase
      .channel('distributor_withdrawals_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'distributor_withdrawals',
        filter: `distributor_id=eq.${userId}`
      }, () => {
        fetchWithdrawals();
        fetchProfile();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const withdrawAmount = Number(amount);
    if (withdrawAmount < 5000) {
      setError('Minimum withdrawal amount is ₹5,000');
      return;
    }

    if (withdrawAmount > profile.commission_balance) {
      setError('Insufficient balance in Commission Wallet');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('distributor_withdrawals')
        .insert([{
          distributor_id: userId,
          amount: withdrawAmount,
          bank_details: bankDetails,
          status: 'pending'
        }]);

      if (error) throw error;

      setSuccess('Withdrawal request submitted successfully!');
      setAmount('');
      setShowForm(false);
      fetchWithdrawals();
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setError(err.message || 'Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-slate-500 font-medium">Loading withdrawal system...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/user/dashboard" className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Commission Withdrawal</h2>
            <p className="text-slate-500 mt-1">Manage your earnings and request payouts.</p>
          </div>
        </div>
        <div className="bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Commission Wallet</p>
            <p className="text-xl font-black text-slate-900 leading-none">₹{(profile?.commission_balance || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Withdrawal Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-8">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Send size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">New Request</h3>
              </div>

              {!showForm ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
                    <p className="text-sm text-slate-500 font-medium">Ready to withdraw your earnings?</p>
                    <p className="text-xs text-slate-400 mt-1">Minimum withdrawal is ₹5,000</p>
                  </div>
                  <button 
                    onClick={() => setShowForm(true)}
                    disabled={(profile?.commission_balance || 0) < 5000}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                  >
                    Withdraw Commission
                  </button>
                  {(profile?.commission_balance || 0) < 5000 && (
                    <p className="text-[10px] text-rose-500 font-bold text-center uppercase tracking-wider">
                      Balance below minimum required (₹5,000)
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Withdraw Amount</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required
                        type="number"
                        min="5000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Min ₹5,000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Bank Details</p>
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          required
                          type="text"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})}
                          placeholder="Bank Name"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          required
                          type="text"
                          value={bankDetails.accountHolder}
                          onChange={(e) => setBankDetails({...bankDetails, accountHolder: e.target.value})}
                          placeholder="Account Holder Name"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          required
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                          placeholder="Account Number"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          required
                          type="text"
                          value={bankDetails.ifscCode}
                          onChange={(e) => setBankDetails({...bankDetails, ifscCode: e.target.value})}
                          placeholder="IFSC Code"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                      Submit Request
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-600 shadow-sm">
                  <History size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Withdrawal History</h3>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{withdrawals.length} Requests</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Amount</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bank Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {withdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <History size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-500 font-bold">No withdrawals yet</p>
                        <p className="text-slate-400 text-sm mt-1">Your payout requests will appear here.</p>
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold text-slate-900">{new Date(req.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-lg font-black text-slate-900 flex items-center justify-center gap-1">
                            <IndianRupee size={16} className="text-slate-400" />
                            {req.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                            req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {req.status === 'pending' && <Clock size={12} />}
                            {req.status === 'approved' && <CheckCircle2 size={12} />}
                            {req.status === 'rejected' && <XCircle size={12} />}
                            {req.status}
                          </span>
                          {req.remark && (
                            <p className="text-[10px] text-slate-400 font-medium mt-1 italic">"{req.remark}"</p>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-xs font-bold text-slate-900">{req.bank_details?.bankName}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-tighter">
                              {req.bank_details?.accountNumber.slice(0, 4)}...{req.bank_details?.accountNumber.slice(-4)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-50 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-500/20 backdrop-blur-xl"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold">Request Submitted!</p>
              <p className="text-xs text-emerald-100">Your withdrawal is being reviewed.</p>
            </div>
            <button onClick={() => setSuccess('')} className="ml-4 text-emerald-200 hover:text-white transition-colors">
              <XCircle size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
