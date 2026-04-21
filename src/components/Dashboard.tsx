import { 
  Wallet, 
  TrendingUp, 
  Clock,
  Loader2,
  CreditCard,
  QrCode,
  Calendar,
  Filter,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Phone,
  IndianRupee,
  Search,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfYesterday, 
  endOfYesterday, 
  format,
  parseISO
} from 'date-fns';

type TimeRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export default function Dashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customDates, setCustomDates] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [showFilter, setShowFilter] = useState(false);
  const [refundedRequests, setRefundedRequests] = useState<any[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionRowId, setRejectionRowId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // 0. Date Logic
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      const now = new Date();

      switch (timeRange) {
        case 'today':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'yesterday':
          startDate = startOfYesterday();
          endDate = endOfYesterday();
          break;
        case '7days':
          startDate = startOfDay(subDays(now, 7));
          endDate = endOfDay(now);
          break;
        case '30days':
          startDate = startOfDay(subDays(now, 30));
          endDate = endOfDay(now);
          break;
        case 'custom':
          startDate = startOfDay(parseISO(customDates.start));
          endDate = endOfDay(parseISO(customDates.end));
          break;
        case 'all':
        default:
          startDate = null;
          endDate = null;
      }

      // 1. Admin Wallet Balance (Always Lifetime)
      const { data: qrSettingsData } = await supabase
        .from('qr_settings')
        .select('admin_balance')
        .eq('id', 1)
        .single();
      
      const adminWalletBalance = Number(qrSettingsData?.admin_balance) || 0;

      // 2. Total Users Wallet Balance (Always Lifetime)
      const { data: usersData, error: usersError } = await supabase
        .from('users_profiles')
        .select('wallet_balance');
      
      if (usersError) throw usersError;
      const totalWalletBalance = usersData?.reduce((acc, user) => acc + (Number(user.wallet_balance) || 0), 0) || 0;

      // 3. Transactions (Filtered by Date)
      let billQuery = supabase.from('bill_submissions').select('amount, charges').eq('status', 'approved');
      let qrQuery = supabase.from('payment_submissions').select('amount, charges').eq('status', 'approved');
      let pendingKycQuery = supabase.from('kyc_submissions').select('count', { count: 'exact', head: true }).eq('status', 'pending');
      let pendingBillQuery = supabase.from('bill_submissions').select('count', { count: 'exact', head: true }).eq('status', 'pending');
      let pendingQrQuery = supabase.from('payment_submissions').select('count', { count: 'exact', head: true }).eq('status', 'pending');
      let activeUsersQuery = supabase.from('users_profiles').select('count', { count: 'exact', head: true }).eq('kyc_status', 'verified');

      if (startDate && endDate) {
        billQuery = billQuery.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
        qrQuery = qrQuery.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
      }

      const [billRes, qrRes, kycRes, pendingBillRes, pendingQrRes, activeUsersRes, withdrawalRes] = await Promise.all([
        billQuery, 
        qrQuery, 
        pendingKycQuery, 
        pendingBillQuery,
        pendingQrQuery,
        activeUsersRes,
        supabase.from('admin_withdrawals').select('amount')
      ]);
      
      const pendingKycCount = kycRes.count || 0;
      const pendingBillCount = pendingBillRes.count || 0;
      const pendingQrCount = pendingQrRes.count || 0;
      const activeUsersCount = activeUsersRes.count || 0;
      
      const billData = billRes.data || [];
      const qrData = qrRes.data || [];
      const withdrawalData = withdrawalRes.data || [];
      
      const rangeBillCharges = billData.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0) || 0;
      const rangeQrCharges = qrData.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0) || 0;
      const totalWithdrawals = withdrawalData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      
      const rangeTotalCharges = rangeBillCharges + rangeQrCharges - (timeRange === 'all' ? totalWithdrawals : 0);
      const rangeTotalCCBill = rangeBillAmount;

      const dateDisplay = startDate && endDate 
        ? `${format(startDate, 'dd MMM')} - ${format(endDate, 'dd MMM')}`
        : 'Lifetime';

      setStats([
        {
          title: "Total QR Payments",
          value: `₹${rangeQrAmount.toLocaleString()}`,
          icon: QrCode,
          color: "bg-blue-500",
          description: `Range: ${dateDisplay}`
        },
        {
          title: "Total CC Bill",
          value: `₹${rangeTotalCCBill.toLocaleString()}`,
          icon: CreditCard,
          color: "bg-purple-500",
          description: `Range: ${dateDisplay}`
        },
        {
          title: "QR Payment Charges",
          value: `₹${rangeQrCharges.toLocaleString()}`,
          icon: QrCode,
          color: "bg-emerald-500",
          description: `Range: ${dateDisplay}`
        },
        {
          title: "Bill Payment Charge",
          value: `₹${rangeBillCharges.toLocaleString()}`,
          icon: CreditCard,
          color: "bg-indigo-500",
          description: `Range: ${dateDisplay}`
        },
        {
          title: "Total User Wallet",
          value: `₹${totalWalletBalance.toLocaleString()}`,
          icon: Wallet,
          color: "bg-amber-500",
          description: "Lifetime Total",
          badge: `${activeUsersCount} Active Users`
        },
        {
          title: "Total Service Charge",
          value: `₹${rangeTotalCharges.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-rose-500",
          description: `Range: ${dateDisplay}`
        },
        {
          title: "Pending KYC",
          value: pendingKycCount.toString(),
          icon: ShieldAlert,
          color: "bg-orange-500",
          description: "Awaiting Review"
        },
        {
          title: "Pending Requests",
          value: `${pendingQrCount} QR / ${pendingBillCount} Bill`,
          icon: Clock,
          color: "bg-slate-700",
          description: "Awaiting Action"
        }
      ]);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, customDates]);

  const fetchRefundedRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bill_submissions')
        .select('*, users_profiles(name, firm_name)')
        .eq('status', 'refunded')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRefundedRequests(data || []);
    } catch (err) {
      console.error('Error fetching refunded requests:', err);
    }
  }, []);

  const fetchReasons = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rejection_reasons')
        .select('*, rejection_categories!inner(show_in_bill)')
        .eq('is_active', true)
        .eq('rejection_categories.show_in_bill', true)
        .order('reason_text');
      if (error) throw error;
      setRejectionReasons(data || []);
    } catch (err) {
      console.error('Error fetching reasons:', err);
    }
  }, []);

  const handleAction = async (id: string, type: 'approved' | 'rejected', customReason?: string) => {
    setProcessingId(id);
    try {
      const targetRequest = refundedRequests.find(r => r.id === id);
      if (!targetRequest) throw new Error('Request not found');

      const amount = targetRequest.amount || 0;
      const requestCharges = targetRequest.charges || 0;

      if (type === 'approved') {
        // 1. Credit charges to Admin Wallet
        const { data: qrSettings } = await supabase.from('qr_settings').select('admin_balance').eq('id', 1).single();
        const currentAdminBalance = Number(qrSettings?.admin_balance) || 0;
        
        await supabase
          .from('qr_settings')
          .update({ admin_balance: currentAdminBalance + requestCharges })
          .eq('id', 1);

        // 2. Update status to approved
        await supabase
          .from('bill_submissions')
          .update({ status: 'approved' })
          .eq('id', id);

        // 3. Notify User
        await supabase
          .from('notifications')
          .insert([{
            user_id: targetRequest.user_id,
            target_role: 'user',
            title: 'Bill Payment Approved',
            message: `Your bill payment of ₹${amount.toLocaleString()} has been approved after review!`,
            link: '/user/reports'
          }]);

      } else {
        // 1. Refund full amount (amount + charges) to user
        const { data: userData } = await supabase
          .from('users_profiles')
          .select('wallet_balance')
          .eq('id', targetRequest.user_id)
          .single();
        
        const currentUserBalance = Number(userData?.wallet_balance) || 0;

        await supabase
          .from('users_profiles')
          .update({ wallet_balance: currentUserBalance + amount + requestCharges })
          .eq('id', targetRequest.user_id);

        // 2. Update status to rejected
        await supabase
          .from('bill_submissions')
          .update({ 
            status: 'rejected', 
            rejection_reason: customReason || reason 
          })
          .eq('id', id);

        // 3. Notify User
        await supabase
          .from('notifications')
          .insert([{
            user_id: targetRequest.user_id,
            target_role: 'user',
            title: 'Bill Payment Rejected',
            message: `Your bill payment of ₹${amount.toLocaleString()} was rejected. Reason: ${customReason || reason}`,
            link: '/user/reports'
          }]);
      }

      setRefundedRequests(prev => prev.filter(r => r.id !== id));
      setRejectionRowId(null);
      setReason('');
      fetchStats(); // Update dashboard stats
    } catch (err) {
      console.error('Error processing dashboard action:', err);
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRefundedRequests();
    fetchReasons();
  }, [fetchStats, fetchRefundedRequests, fetchReasons]);

  const rangeLabels: Record<TimeRange, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7days': 'Last 7 Days',
    '30days': 'Last 30 Days',
    all: 'All Time',
    custom: 'Custom Range'
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-slate-500 mt-1">Real-time statistics for your platform.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          {timeRange === 'custom' && (
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-right-4 duration-300 shadow-sm">
              <input 
                type="date" 
                value={customDates.start}
                onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs font-bold text-slate-600 px-2 py-1 outline-none rounded bg-slate-50"
              />
              <span className="text-slate-300 text-xs">to</span>
              <input 
                type="date" 
                value={customDates.end}
                onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs font-bold text-slate-600 px-2 py-1 outline-none rounded bg-slate-50"
              />
              <button 
                onClick={fetchStats}
                className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
                title="Apply Filter"
              >
                <Filter size={14} />
              </button>
            </div>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-indigo-300 transition-all shadow-sm"
            >
              <Calendar size={18} className="text-indigo-500" />
              {rangeLabels[timeRange]}
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${showFilter ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 py-2"
                  >
                    {(Object.keys(rangeLabels) as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setTimeRange(range);
                          setShowFilter(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 ${
                          timeRange === range ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        {rangeLabels[range]}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[400px]">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <p className="text-sm font-medium">Updating statistics...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={stat.title}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className={`p-3 rounded-2xl ${stat.color} text-white shadow-lg`}>
                    <Icon size={24} />
                  </div>
                  {stat.badge && (
                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm animate-pulse">
                      {stat.badge}
                    </div>
                  )}
                </div>
                
                <div className="mt-6 relative z-10">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.title}</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2 font-mono tracking-tight group-hover:text-indigo-600 transition-colors">
                    {stat.value}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 w-fit px-2 py-1 rounded-full">
                    <Clock size={12} />
                    {stat.description}
                  </div>
                </div>

                <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                  <Icon size={120} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Refund Policy Requests Section */}
      {!loading && refundedRequests.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-200/50">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Refund Policy Review</h3>
                <p className="text-xs text-slate-500 font-medium">Recently moved to refund state from approvals.</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 animate-pulse">
              {refundedRequests.length} Pending Actions
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Firm / Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Card Info</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Service Charge</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Debited Amount</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {refundedRequests.map((req) => (
                    <React.Fragment key={req.id}>
                      <tr className={`${rejectionRowId === req.id ? 'bg-rose-50/20' : 'hover:bg-slate-50/30'} transition-colors`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                              <User size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {req.users_profiles?.firm_name || req.users_profiles?.name || `User #${req.user_id.slice(0, 8)}`}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Phone size={10} className="text-slate-400" />
                              {req.customer_mobile}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{req.card_owner_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <CreditCard size={10} className="text-slate-400" />
                              {req.card_number.slice(-4)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{req.card_bank}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-slate-900 flex items-center justify-end font-mono">
                            ₹{req.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-emerald-600 flex items-center justify-end font-mono">
                            ₹{(req.charges || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-indigo-600 flex items-center justify-end font-mono">
                            ₹{(Number(req.amount) + Number(req.charges || 0)).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-100/50 shadow-sm">
                            <RotateCcw size={10} className="animate-spin-slow" />
                            Refund Policy
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setRejectionRowId(rejectionRowId === req.id ? null : req.id)}
                              disabled={processingId === req.id}
                              className={`p-2 rounded-xl transition-all shadow-sm ${rejectionRowId === req.id ? 'bg-rose-100 text-rose-600 ring-4 ring-rose-50' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}
                              title="Reject & Refund"
                            >
                              <XCircle size={20} />
                            </button>
                            <button 
                              onClick={() => handleAction(req.id, 'approved')}
                              disabled={processingId === req.id}
                              className="p-2 bg-emerald-50 text-emerald-500 hover:bg-emerald-100 rounded-xl transition-all shadow-sm"
                              title="Re-Approve"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {rejectionRowId === req.id && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-rose-50/30 border-y border-rose-100/50">
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex flex-col md:flex-row items-end gap-4"
                            >
                              <div className="flex-1 w-full">
                                <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Select Rejection Reason</label>
                                <select 
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                  className="w-full px-4 py-2 bg-white border border-rose-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/20"
                                >
                                  <option value="">-- Choose a reason --</option>
                                  {rejectionReasons.map(r => (
                                    <option key={r.id} value={r.reason_text}>{r.reason_text}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button 
                                  onClick={() => setRejectionRowId(null)}
                                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={() => handleAction(req.id, 'rejected')}
                                  disabled={!reason || processingId === req.id}
                                  className="px-6 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center gap-2 disabled:opacity-50"
                                >
                                  {processingId === req.id ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                  Confirm Refund
                                </button>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
