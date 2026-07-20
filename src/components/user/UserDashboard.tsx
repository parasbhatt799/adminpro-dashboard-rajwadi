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
import { LogoLoader } from '../shared/LoadingSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfToday,
  format
} from 'date-fns';
import { supabase } from '../../lib/supabase';
import DashboardIllustration from './DashboardIllustration';
import DashboardSlider from './DashboardSlider';
import { useToast } from '../../context/ToastContext';

type DateFilter = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom';

export default function UserDashboard({ userId }: { userId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [distributor, setDistributor] = useState<any>(null);
  const [watermark, setWatermark] = useState<{ enabled: boolean; logo: string | null }>({ enabled: false, logo: null });
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [reminders, setReminders] = useState<any[]>([]);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!userId) return;

        const { data: profile } = await supabase
          .from('users_profiles')
          .select('*, distributor:distributor_id(name, firm_name)')
          .eq('id', userId)
          .single();

        setUserProfile(profile);
        setDistributor((profile as any)?.distributor);

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

        let bbpsQuery = supabase
          .from('bbps_submissions')
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

        let pendingBbpsQuery = supabase
          .from('bbps_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'pending');

        if (startDate && endDate) {
          qrQuery = qrQuery.gte('created_at', startDate).lte('created_at', endDate);
          billQuery = billQuery.gte('created_at', startDate).lte('created_at', endDate);
          bbpsQuery = bbpsQuery.gte('created_at', startDate).lte('created_at', endDate);
          pendingQrQuery = pendingQrQuery.gte('created_at', startDate).lte('created_at', endDate);
          pendingBillQuery = pendingBillQuery.gte('created_at', startDate).lte('created_at', endDate);
          pendingBbpsQuery = pendingBbpsQuery.gte('created_at', startDate).lte('created_at', endDate);
        }

        const [qrRes, billRes, bbpsRes, pendingQrRes, pendingBillRes, pendingBbpsRes, qrSettingsRes, remindersRes] = await Promise.all([
          qrQuery,
          billQuery,
          bbpsQuery,
          pendingQrQuery,
          pendingBillQuery,
          pendingBbpsQuery,
          supabase
            .from('qr_settings')
            .select('watermark_url, is_watermark_enabled')
            .eq('id', 1)
            .single(),
          supabase
            .from('bill_reminders')
            .select('*')
            .eq('user_id', userId)
            .eq('is_paid', false)
            .order('due_date', { ascending: true })
        ]);

        if (qrSettingsRes.data) {
          setWatermark({
            enabled: qrSettingsRes.data.is_watermark_enabled,
            logo: qrSettingsRes.data.watermark_url
          });
        }

        if (remindersRes.data) {
          setReminders(remindersRes.data);
        }

        const qrTotal = qrRes.data?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
        const billTotal = (billRes.data?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0) +
          (bbpsRes.data?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0);
        const totalPending = (pendingQrRes.count || 0) + (pendingBillRes.count || 0) + (pendingBbpsRes.count || 0);

        setStats([
          {
            title: (profile?.role === 'distributor' || profile?.role === 'super_distributor') ? "Commission Wallet" : "Total Balance",
            value: `₹${(Number((profile?.role === 'distributor' || profile?.role === 'super_distributor') ? profile?.commission_balance : profile?.wallet_balance) || 0).toLocaleString()}`,
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
          ...((profile?.role !== 'distributor' && profile?.role !== 'super_distributor') ? [
            {
              title: "QR Payment",
              value: `₹${qrTotal.toLocaleString()}`,
              trend: "neutral",
              icon: QrCode,
              color: "bg-blue-500"
            },
            {
              title: "Live Bill Payment",
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
          ] : [])
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

    // Listener for User Profile (Wallet Balance)
    const profileChannel = supabase.channel(`profile_dashboard_${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users_profiles',
        filter: `id=eq.${userId}`
      }, (payload) => {
        if (payload.new) {
          setUserProfile(payload.new);
          // Stats will re-calculate because userProfile is a dependency or we force a refresh
          fetchStats();
        }
      })
      .subscribe();

    const remindersChannel = supabase.channel(`reminders_dashboard_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bill_reminders',
        filter: `user_id=eq.${userId}`
      }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(remindersChannel);
    };
  }, [dateFilter, customRange]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <LogoLoader size="md" />
      </div>
    );
  }

  const firstName = userProfile?.name ? userProfile.name.trim().split(/\s+/)[0] : 'User';

  const activeReminders = reminders.filter(r => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = new Date(todayStr);
    const billDate = new Date(r.bill_date);
    const dueDate = new Date(r.due_date);
    return today > billDate && today <= dueDate;
  });

  const getDaysRemaining = (dueDateStr: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = new Date(todayStr);
    const due = new Date(dueDateStr);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-8 relative min-h-[70vh]">
      {/* Background Animated Circles */}
      <DashboardIllustration />

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

      <DashboardSlider />

      {/* Grid Layout for dashboard elements and sidebar */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Content (left) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-extrabold uppercase tracking-wider pb-1 animate-text-gradient">
                    {getGreeting()}, {firstName}
                  </h2>
                  {(userProfile?.role === 'distributor' || userProfile?.role === 'super_distributor') && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-indigo-200">
                        {userProfile?.role === 'super_distributor' ? 'Super Distributor' : 'Distributor'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        ID: {userId}
                      </span>
                    </div>
                  )}
                </div>

                {distributor && userProfile?.role !== 'distributor' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Managed By:</span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                      {distributor.firm_name || distributor.name}
                    </span>
                  </div>
                )}
              </div>
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
                            className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 ${dateFilter === range ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
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

        {/* Side Reminders Widget */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="text-indigo-500" size={16} />
                Bill Reminders
              </h3>
              {activeReminders.length > 0 && (
                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-100 animate-pulse">
                  {activeReminders.length} Active
                </span>
              )}
            </div>

            {activeReminders.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-xs font-bold text-slate-400">No active bill reminders</p>
                <p className="text-[10px] text-slate-400 leading-relaxed px-4">Fetched bills will automatically show alerts here starting the day after bill date.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {activeReminders.map((reminder) => {
                  const daysLeft = getDaysRemaining(reminder.due_date);
                  let urgencyColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
                  let cardBorder = "border-slate-100";
                  
                  if (daysLeft <= 0) {
                    urgencyColor = "text-rose-600 bg-rose-50 border-rose-100 animate-pulse font-black";
                    cardBorder = "border-rose-200 shadow-sm bg-rose-50/10";
                  } else if (daysLeft === 1) {
                    urgencyColor = "text-amber-600 bg-amber-50 border-amber-100 font-bold";
                    cardBorder = "border-amber-200 bg-amber-50/5";
                  }

                  return (
                    <div 
                      key={reminder.id}
                      className={`p-4 bg-white border ${cardBorder} rounded-2xl space-y-3 hover:border-indigo-200 transition-colors shadow-sm`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-slate-800 line-clamp-1">{reminder.bank_name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 line-clamp-1">Name: {reminder.customer_name}</p>
                          <p className="text-[10px] font-mono text-slate-400">No: ****{reminder.card_number.slice(-4)}</p>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${urgencyColor} whitespace-nowrap`}>
                          {daysLeft <= 0 ? "Due Today" : daysLeft === 1 ? "1 Day Left" : `${daysLeft} Days Left`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-2">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Due Amount</p>
                          <p className="text-xs font-black text-slate-800">₹{Number(reminder.due_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <Link 
                          to="/user/bill-payment" 
                          state={{ prefilledCardNumber: reminder.card_number, prefilledBillerName: reminder.bank_name }}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl transition-colors shadow-sm shadow-indigo-100 uppercase tracking-wider"
                        >
                          Pay
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
