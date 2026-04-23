import { useState, useEffect } from 'react';
import { 
  Wallet, 
  Clock, 
  QrCode, 
  CreditCard, 
  Loader2, 
  Lock,
  Filter,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfToday, 
  format 
} from 'date-fns';
import { supabase } from '../../lib/supabase';

type DateFilter = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom';

export default function UserDashboard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [watermark, setWatermark] = useState<{ enabled: boolean; logo: string | null }>({ enabled: false, logo: null });
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customRange, setCustomRange] = useState({ 
    start: format(new Date(), 'yyyy-MM-dd'), 
    end: format(new Date(), 'yyyy-MM-dd') 
  });
  const [showFilter, setShowFilter] = useState(false);

  const rangeLabels: Record<DateFilter, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7days': 'Last 7 Days',
    '30days': 'Last 30 Days',
    all: 'All Time',
    custom: 'Custom Range'
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!userId) return;

        const { data: profile } = await supabase
          .from('users_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        setUserProfile(profile);

        // Date range logic
        let startDate: string | null = null;
        let endDate: string | null = null;
        const now = new Date();

        if (dateFilter === 'today') {
          startDate = startOfDay(now).toISOString();
          endDate = endOfDay(now).toISOString();
        } else if (dateFilter === 'yesterday') {
          startDate = startOfDay(subDays(now, 1)).toISOString();
          endDate = endOfDay(subDays(now, 1)).toISOString();
        } else if (dateFilter === '7days') {
          startDate = startOfDay(subDays(now, 6)).toISOString();
          endDate = endOfDay(now).toISOString();
        } else if (dateFilter === '30days') {
          startDate = startOfDay(subDays(now, 29)).toISOString();
          endDate = endOfDay(now).toISOString();
        } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
          startDate = startOfDay(new Date(customRange.start)).toISOString();
          endDate = endOfDay(new Date(customRange.end)).toISOString();
        }

        let qrQuery = supabase
          .from('payment_submissions')
          .select('amount')
          .eq('user_id', userId)
          .eq('status', 'approved');

        let billQuery = supabase
          .from('bill_submissions')
          .select('amount')
          .eq('user_id', userId)
          .eq('status', 'approved');

        let pendingQrQuery = supabase
          .from('payment_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'pending');

        let pendingBillQuery = supabase
          .from('bill_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'pending');

        if (startDate && endDate) {
          qrQuery = qrQuery.gte('created_at', startDate).lte('created_at', endDate);
          billQuery = billQuery.gte('created_at', startDate).lte('created_at', endDate);
          pendingQrQuery = pendingQrQuery.gte('created_at', startDate).lte('created_at', endDate);
          pendingBillQuery = pendingBillQuery.gte('created_at', startDate).lte('created_at', endDate);
        }

        const [qrRes, billRes, pendingQrRes, pendingBillRes, qrSettingsRes] = await Promise.all([
          qrQuery,
          billQuery,
          pendingQrQuery,
          pendingBillQuery,
          supabase
            .from('qr_settings')
            .select('watermark_url, is_watermark_enabled')
            .eq('id', 1)
            .single()
        ]);

        if (qrSettingsRes.data) {
          setWatermark({
            enabled: qrSettingsRes.data.is_watermark_enabled,
            logo: qrSettingsRes.data.watermark_url
          });
        }

        const qrTotal = qrRes.data?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
        const billTotal = billRes.data?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
        const totalPending = (pendingQrRes.count || 0) + (pendingBillRes.count || 0);

        setStats([
          {
            title: "Total Balance",
            value: `₹${(Number(profile?.wallet_balance) || 0).toLocaleString()}`,
            trend: "neutral",
            icon: Wallet,
            color: "bg-emerald-500"
          },
          ...(Number(profile?.hold_balance || 0) > 0 ? [{
            title: "Hold Balance",
            value: `₹${(Number(profile?.hold_balance) || 0).toLocaleString()}`,
            trend: "neutral",
            icon: Lock,
            color: "bg-amber-500",
            subtitle: "Locked by Admin"
          }] : []),
          {
            title: "QR Payment",
            value: `₹${qrTotal.toLocaleString()}`,
            trend: "neutral",
            icon: QrCode,
            color: "bg-blue-500"
          },
          {
            title: "Bill Payment",
            value: `₹${billTotal.toLocaleString()}`,
            trend: "neutral",
            icon: CreditCard,
            color: "bg-purple-500"
          },
          {
            title: "Pending Requests",
            value: totalPending.toString(),
            trend: "neutral",
            icon: Clock,
            color: "bg-amber-500"
          }
        ]);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Realtime Listener for Branding Updates (Moved to correct scope)
    const channel = supabase.channel('branding_dashboard')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'qr_settings', filter: 'id=eq.1' }, (payload) => {
        if (payload.new) {
          setWatermark({
            enabled: payload.new.is_watermark_enabled,
            logo: payload.new.watermark_url
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter, customRange]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 relative min-h-[70vh]">
      {/* Dashboard Watermark */}
      {watermark.enabled && watermark.logo && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0"
          style={{ opacity: 0.04 }}
        >
          <img
            src={watermark.logo}
            alt="Watermark"
            className="w-[1100px] h-auto object-contain transform -rotate-[30deg] translate-y-10 -translate-x-5"
          />
        </div>
      )}

      <div className="relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐁𝐀𝐂𝐊 🙏 {userProfile?.name || 'User'}!</h2>
            <p className="text-slate-500 mt-1">Here's what's happening with your account today.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-right-4 duration-300 shadow-sm">
                <input 
                  type="date" 
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-xs font-bold text-slate-600 px-2 py-1 outline-none rounded bg-slate-50"
                />
                <span className="text-slate-300 text-xs">to</span>
                <input 
                  type="date" 
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-xs font-bold text-slate-600 px-2 py-1 outline-none rounded bg-slate-50"
                />
              </div>
            )}

            <div className="relative">
              <button 
                onClick={() => setShowFilter(!showFilter)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-indigo-300 transition-all shadow-sm"
              >
                <Calendar size={18} className="text-indigo-500" />
                {rangeLabels[dateFilter]}
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
                      {(Object.keys(rangeLabels) as DateFilter[]).map((range) => (
                        <button
                          key={range}
                          onClick={() => {
                            setDateFilter(range);
                            setShowFilter(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 ${
                            dateFilter === range ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                {stat.title === "Hold Balance" && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full flex items-center justify-center translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
                    <Lock size={12} className="text-amber-500" />
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${stat.color} text-white shadow-lg shadow-current/20`}>
                    <Icon size={24} />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                {stat.subtitle && (
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-2">{stat.subtitle}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
