import { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock,
  IndianRupee,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';

export default function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('users_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUserProfile(profile);

        setStats([
          {
            title: "Total Balance",
            value: `₹${(Number(profile?.wallet_balance) || 0).toLocaleString()}`,
            change: "Real-time",
            trend: "neutral",
            icon: Wallet,
            color: "bg-emerald-500"
          },
          {
            title: "Total Spent",
            value: "₹0.00",
            change: "0%",
            trend: "neutral",
            icon: ArrowUpRight,
            color: "bg-rose-500"
          },
          {
            title: "Total Received",
            value: "₹0.00",
            change: "0%",
            trend: "neutral",
            icon: ArrowDownLeft,
            color: "bg-indigo-500"
          },
          {
            title: "Pending Tasks",
            value: "0",
            change: "0%",
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
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome back, {userProfile?.name || 'User'}!</h2>
        <p className="text-slate-500 mt-1">Here's what's happening with your account today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stat.color} text-white shadow-lg shadow-current/20`}>
                  <Icon size={24} />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 
                  stat.trend === 'down' ? 'bg-rose-50 text-rose-600' : 
                  'bg-slate-50 text-slate-600'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Recent Transactions</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                    <IndianRupee size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Payment to Vendor #{i}</p>
                    <p className="text-xs text-slate-500">April {10 - i}, 2026 • 12:30 PM</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-rose-600">-₹{500 * i}.00</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Completed</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <ArrowUpRight size={24} />
              </div>
              <span className="font-bold text-sm">Send Money</span>
            </button>
            <button className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 transition-colors flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <ArrowDownLeft size={24} />
              </div>
              <span className="font-bold text-sm">Request Money</span>
            </button>
            <button className="p-6 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition-colors flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Clock size={24} />
              </div>
              <span className="font-bold text-sm">History</span>
            </button>
            <button className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 hover:bg-slate-100 transition-colors flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Wallet size={24} />
              </div>
              <span className="font-bold text-sm">Wallet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
