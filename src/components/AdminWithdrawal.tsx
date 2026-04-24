import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  History, 
  Loader2, 
  AlertCircle,
  TrendingDown,
  Calendar,
  MessageSquare,
  IndianRupee,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface WithdrawalRecord {
  id: string;
  amount: number;
  remark: string;
  created_at: string;
}

export default function AdminWithdrawal() {
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Lifetime Service Charges with joins for fallback calculation
      const [qrRes, billRes, payoutRes, withdrawalRes] = await Promise.all([
        supabase.from('payment_submissions')
          .select(`
            charges, 
            amount, 
            admin_share,
            user:user_id(
              distributor_id,
              admin_base_qr_charge,
              distributor:distributor_id(admin_base_qr_charge, role)
            )
          `)
          .eq('status', 'approved'),
        supabase.from('bill_submissions')
          .select(`charges, admin_share`)
          .eq('status', 'approved'),
        supabase.from('payout_submissions').select('charge_amount').eq('status', 'approved'),
        supabase.from('admin_withdrawals').select('*').order('created_at', { ascending: false })
      ]);
      
      if (qrRes.error) throw qrRes.error;
      if (billRes.error) throw billRes.error;
      if (withdrawalRes.error) throw withdrawalRes.error;

      // Calculate QR Charges (with split logic)
      const totalQrCharges = (qrRes.data || []).reduce((acc, curr: any) => {
        // 1. If we have a stored share (frozen data), use it directly
        if (curr.admin_share !== null && curr.admin_share !== undefined) {
          return acc + Number(curr.admin_share);
        }
        // 2. Fallback: Split profit if distributor exists
        let adminShare = Number(curr.charges) || 0;
        const user = curr.user;
        if (user?.distributor_id && user?.distributor && user.distributor.role === 'distributor') {
          const adminBasePercentage = Number(user.distributor.admin_base_qr_charge) || 0;
          adminShare = (Number(curr.amount) * adminBasePercentage) / 100;
        }
        return acc + adminShare;
      }, 0);

      // Calculate Bill Charges (Always full for admin)
      const totalBillCharges = (billRes.data || []).reduce((acc, curr: any) => {
        if (curr.admin_share !== null && curr.admin_share !== undefined) {
          return acc + Number(curr.admin_share);
        }
        return acc + (Number(curr.charges) || 0);
      }, 0);

      const totalPayoutCharges = (payoutRes.data || []).reduce((acc, r) => acc + (Number(r.charge_amount) || 0), 0);
      const totalWithdrawals = (withdrawalRes.data || []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

      const calculatedBalance = totalQrCharges + totalBillCharges + totalPayoutCharges - totalWithdrawals;
      setBalance(calculatedBalance);
      setHistory(withdrawalRes.data || []);

    } catch (err) {
      console.error('Error fetching withdrawal data:', err);
      setError('Failed to load balance and history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const withdrawalAmount = Number(amount);

    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    if (withdrawalAmount > balance) {
      setError('Insufficient balance for this withdrawal.');
      return;
    }

    setProcessing(true);
    try {
      // 1. Update Admin Balance in qr_settings
      const { error: updateError } = await supabase
        .from('qr_settings')
        .update({ admin_balance: balance - withdrawalAmount })
        .eq('id', 1);

      if (updateError) throw updateError;

      // 2. Record in admin_withdrawals
      const { error: insertError } = await supabase
        .from('admin_withdrawals')
        .insert([{
          amount: withdrawalAmount,
          remark: remark || 'No remark provided'
        }]);

      if (insertError) throw insertError;

      // 3. Success!
      setSuccess(true);
      setAmount('');
      setRemark('');
      await fetchData(); // Refresh balance and history

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setError(err.message || 'An error occurred while processing the withdrawal.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Withdrawal Balance</h2>
          <p className="text-slate-500 mt-1">Manage and track withdrawals from your total service charges.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Balance & Form */}
        <div className="lg:col-span-1 space-y-6">
          {/* Balance Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2rem] shadow-xl shadow-indigo-200 relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 text-indigo-100 mb-6">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest opacity-80">All Time Balance</span>
              </div>
              <div className="flex items-baseline gap-2 text-white">
                <span className="text-4xl font-bold">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-widest mt-6">
                Total Service Charge Collected
              </p>
            </div>
            
            {/* Background Decoration */}
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
          </motion.div>

          {/* Withdrawal Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingDown size={20} className="text-rose-500" />
              Make a Withdrawal
            </h3>

            <form onSubmit={handleWithdrawal} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Withdrawal Amount</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number" 
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Remark / Purpose</label>
                <div className="relative">
                  <MessageSquare className="absolute left-4 top-4 text-slate-400" size={18} />
                  <textarea 
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter reason for withdrawal..."
                    rows={3}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100"
                >
                  <CheckCircle2 size={16} />
                  Withdrawal processed successfully!
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={processing || !amount || Number(amount) <= 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {processing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <ArrowUpRight size={20} />
                    Confirm Withdrawal
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Right Side: History Table */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Withdrawal History</h3>
                  <p className="text-xs text-slate-500 font-medium">Recent transactions from your admin wallet.</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-50 sticky top-0 z-10">
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date & Time</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />
                        <p className="text-sm text-slate-500 font-medium">Fetching history...</p>
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                          <History size={32} />
                        </div>
                        <p className="text-slate-500 font-medium">No withdrawal records found.</p>
                      </td>
                    </tr>
                  ) : (
                    history.map((record, index) => (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        key={record.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                              <Calendar size={14} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900">
                                {format(new Date(record.created_at), 'dd MMM yyyy')}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {format(new Date(record.created_at), 'hh:mm a')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-md font-bold text-rose-600">
                              -₹{Number(record.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="flex items-center gap-1 text-[9px] font-black text-rose-400 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-full mt-1">
                              Debited
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-xs">{record.remark}</p>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
