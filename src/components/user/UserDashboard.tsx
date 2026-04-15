import { useState, useEffect } from 'react';
import { 
  Wallet, 
  Clock,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';

export default function UserDashboard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

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

      </div>
    </div>
  );
}
