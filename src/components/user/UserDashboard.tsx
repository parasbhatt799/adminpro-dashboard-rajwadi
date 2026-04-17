import { useState, useEffect } from 'react';
import { 
  Wallet, 
  Clock,
  QrCode,
  CreditCard,
  Loader2,
  Lock
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

        // Fetch Status counts / amounts
        const [qrRes, billRes, pendingQrRes, pendingBillRes] = await Promise.all([
          supabase
            .from('payment_submissions')
            .select('amount')
            .eq('user_id', userId)
            .eq('status', 'approved'),
          supabase
            .from('bill_submissions')
            .select('amount')
            .eq('user_id', userId)
            .eq('status', 'approved'),
          supabase
            .from('payment_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending'),
          supabase
            .from('bill_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending')
        ]);

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
  );
}
