import { 
  Wallet, 
  TrendingUp, 
  Clock,
  Loader2,
  CreditCard,
  QrCode
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 0. Admin Wallet Balance
      const { data: qrSettingsData } = await supabase
        .from('qr_settings')
        .select('admin_balance')
        .eq('id', 1)
        .single();
      
      const adminWalletBalance = Number(qrSettingsData?.admin_balance) || 0;

      // 1. Total Users Wallet Balance
      const { data: usersData, error: usersError } = await supabase
        .from('users_profiles')
        .select('wallet_balance');
      
      if (usersError) throw usersError;
      const totalWalletBalance = usersData?.reduce((acc, user) => acc + (Number(user.wallet_balance) || 0), 0) || 0;

      // 2. Daily Service Charges & Amounts (Separated)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: billData } = await supabase
        .from('bill_submissions')
        .select('amount, charges')
        .eq('status', 'approved')
        .gte('created_at', today.toISOString());
      
      const { data: qrData } = await supabase
        .from('payment_submissions')
        .select('amount, charges')
        .eq('status', 'approved')
        .gte('created_at', today.toISOString());
      
      const dailyBillCharges = billData?.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0) || 0;
      // 3. Transactions (Filtered by Date)
      let billQuery = supabase.from('bill_submissions').select('amount, charges').eq('status', 'approved');
      let qrQuery = supabase.from('payment_submissions').select('amount, charges').eq('status', 'approved');

      if (startDate && endDate) {
        billQuery = billQuery.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
        qrQuery = qrQuery.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
      }

      const [{ data: billData }, { data: qrData }] = await Promise.all([billQuery, qrQuery]);
      
      const rangeBillCharges = billData?.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0) || 0;
      const rangeQrCharges = qrData?.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0) || 0;
      const rangeBillAmount = billData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      const rangeQrAmount = qrData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      
      const rangeTotalCharges = rangeBillCharges + rangeQrCharges;
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
          description: "Lifetime Total"
        },
        {
          title: "Total Service Charge",
          value: `₹${rangeTotalCharges.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-rose-500",
          description: `Range: ${dateDisplay}`
        }
      ]);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, customDates]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-right-4 duration-300">
              <input 
                type="date" 
                value={customDates.start}
                onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs font-bold text-slate-600 px-2 py-1 outline-none"
              />
              <span className="text-slate-300">to</span>
              <input 
                type="date" 
                value={customDates.end}
                onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs font-bold text-slate-600 px-2 py-1 outline-none"
              />
              <button 
                onClick={fetchStats}
                className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </div>
  );
}
