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
  ChevronDown,
  Bell,
  AlertTriangle
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
import { supabase, addDevicePushId } from '../../lib/supabase';
import UserChatWidget from './UserChatWidget';
import DashboardIllustration from './DashboardIllustration';
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
  const [customRange, setCustomRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [showFilter, setShowFilter] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [showPushDeniedBanner, setShowPushDeniedBanner] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);

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

        const [qrRes, billRes, bbpsRes, pendingQrRes, pendingBillRes, pendingBbpsRes, qrSettingsRes] = await Promise.all([
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
            .single()
        ]);

        if (qrSettingsRes.data) {
          setWatermark({
            enabled: qrSettingsRes.data.is_watermark_enabled,
            logo: qrSettingsRes.data.watermark_url
          });
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

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [dateFilter, customRange]);

  useEffect(() => {
    const checkPushPermission = () => {
      if (!('Notification' in window)) return;
      
      const perm = Notification.permission;
      if (perm === 'denied') {
        setShowPushDeniedBanner(true);
        setShowPushBanner(false);
      } else if (perm === 'default') {
        setShowPushBanner(true);
        setShowPushDeniedBanner(false);
      } else if (perm === 'granted') {
        if (userProfile && !userProfile.onesignal_id) {
          setShowPushBanner(true);
          setShowPushDeniedBanner(false);
        } else {
          setShowPushBanner(false);
          setShowPushDeniedBanner(false);
        }
      }
    };

    checkPushPermission();
  }, [userProfile]);

  const handleSubscribePush = async () => {
    setSubscribingPush(true);
    try {
      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        let perm = OneSignal.Notifications?.permission || Notification.permission;
        
        if (perm !== 'granted') {
          try {
            await Promise.race([
              OneSignal.Notifications.requestPermission(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Permission request timed out")), 10000))
            ]);
          } catch (e) {
            console.warn("Permission request failed or timed out:", e);
          }
          
          perm = OneSignal.Notifications?.permission || Notification.permission;
          if (perm !== 'granted') {
            toast.error("નમસ્તે! નોટિફિકેશન પરમિશન મંજૂર નથી થઈ. કૃપા કરીને બ્રાઉઝર પરમિશન સેટિંગ્સ ચેક કરો.");
            setSubscribingPush(false);
            if (perm === 'denied') {
              setShowPushDeniedBanner(true);
              setShowPushBanner(false);
            }
            return;
          }
        }

        if (OneSignal.User?.PushSubscription) {
          await OneSignal.User.PushSubscription.optIn();
          
          let pushId = OneSignal.User.PushSubscription.id;
          let attempts = 0;
          while (!pushId && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            pushId = OneSignal.User.PushSubscription.id;
            attempts++;
          }

          if (pushId) {
            await addDevicePushId(userId, 'user', pushId);
            toast.success("તમારું ડિવાઇસ સફળતાપૂર્વક સબસ્ક્રાઇબ થઈ ગયું છે!");
            const { data: updatedProfile } = await supabase
              .from('users_profiles')
              .select('*')
              .eq('id', userId)
              .single();
            if (updatedProfile) {
              setUserProfile(updatedProfile);
            }
            setShowPushBanner(false);
          } else {
            toast.error("OneSignal ID હજી મળ્યો નથી. કૃપા કરીને ફરી ટ્રાય કરો.");
          }
        } else {
          toast.error("OneSignal API રેડી નથી. મહેરબાની કરીને થોડી સેકન્ડ પછી ટ્રાય કરો.");
        }
      } else {
        const OneSignalDeferred = (window as any).OneSignalDeferred;
        if (OneSignalDeferred) {
          OneSignalDeferred.push(async (OS: any) => {
            let perm = OS.Notifications?.permission || Notification.permission;
            if (perm !== 'granted') {
              try {
                await Promise.race([
                  OS.Notifications.requestPermission(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error("Permission request timed out")), 10000))
                ]);
              } catch (e) {
                console.warn("Deferred permission request failed:", e);
              }
              perm = OS.Notifications?.permission || Notification.permission;
            }

            if (perm === 'granted' && OS.User?.PushSubscription) {
              await OS.User.PushSubscription.optIn();
              let pushId = OS.User.PushSubscription.id;
              let attempts = 0;
              while (!pushId && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                pushId = OS.User.PushSubscription.id;
                attempts++;
              }
              if (pushId) {
                await addDevicePushId(userId, 'user', pushId);
                toast.success("ડિવાઇસ સબસ્ક્રાઇબ થઈ ગયું છે!");
                const { data: updatedProfile } = await supabase
                  .from('users_profiles')
                  .select('*')
                  .eq('id', userId)
                  .single();
                if (updatedProfile) {
                  setUserProfile(updatedProfile);
                }
                setShowPushBanner(false);
              }
            } else {
              toast.error("નોટિફિકેશન પરમિશન મંજૂર કરવામાં આવી નથી.");
              if (perm === 'denied') {
                setShowPushDeniedBanner(true);
                setShowPushBanner(false);
              }
            }
          });
        } else {
          toast.error("OneSignal SDK લોડ થયો નથી. કૃપા કરીને ઇન્ટરનેટ ચેક કરો.");
        }
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      toast.error("સબસ્ક્રિપ્શનમાં ખામી આવી: " + (err.message || err));
    } finally {
      setSubscribingPush(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <LogoLoader size="md" />
      </div>
    );
  }

  const firstName = userProfile?.name ? userProfile.name.trim().split(/\s+/)[0] : 'User';

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

      <div className="relative z-10 space-y-6">
        {/* Push Notification Banner */}
        {showPushBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white rounded-[24px] p-5 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/20"
          >
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl shrink-0 text-white flex items-center justify-center">
                <Bell size={24} className="animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-indigo-100">પ્રોસેસ અપડેટ્સ મેળવો (Get Alerts)</h3>
                <p className="text-xs text-white/90 mt-1 max-w-xl font-medium">
                  તમારી Payment અને Bill Requests Approve કે Reject થાય ત્યારે ત્વરિત નોટિફિકેશન મેળવવા માટે સબસ્ક્રાઇબ કરો.
                </p>
              </div>
            </div>
            <button
              onClick={handleSubscribePush}
              disabled={subscribingPush}
              className="px-5 py-2.5 bg-white text-indigo-700 font-extrabold rounded-xl text-xs transition-all hover:bg-indigo-50 active:scale-95 shadow-md shadow-indigo-950/20 flex items-center gap-2 shrink-0 self-end md:self-center"
            >
              {subscribingPush ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Subscribing...</span>
                </>
              ) : (
                "Subscribe Now"
              )}
            </button>
          </motion.div>
        )}

        {/* Push Notification Denied Banner */}
        {showPushDeniedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 border border-rose-100 text-rose-800 rounded-[24px] p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 rounded-xl shrink-0 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-rose-900">નોટિફિકેશન બ્લોક છે! (Notifications Blocked)</h3>
                <p className="text-xs text-rose-700 mt-1 max-w-xl font-medium">
                  બ્રાઉઝર કે ફોન સેટિંગ્સમાં જઈને આ વેબસાઈટ માટે નોટિફિકેશન પરમિશન **Allow** કરો જેથી તમને પેમેન્ટ એપ્રૂવલ/રિજેક્શનની અપડેટ્સ મળી શકે.
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
      <UserChatWidget userId={userId} />
    </div>
  );
}
