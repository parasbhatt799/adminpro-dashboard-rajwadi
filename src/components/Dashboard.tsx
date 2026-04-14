import { 
  Wallet, 
  TrendingUp, 
  Clock,
  Loader2
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
      const dailyQrCharges = qrData?.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0) || 0;
      const dailyBillAmount = billData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      const dailyQrAmount = qrData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      const dailyTotalCharges = dailyBillCharges + dailyQrCharges;
      const dailyTotalCCBill = dailyBillAmount; // Excludes charges as requested

      // 3. Total Users
      const { count: totalUsers } = await supabase
        .from('users_profiles')
        .select('*', { count: 'exact', head: true });

      const todayStr = new Date().toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });

      setStats([
        {
          title: "Total QR Payments",
          value: `₹${dailyQrAmount.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-blue-500",
          description: `Last update: ${todayStr}`
        },
        {
          title: "Total Bill Payments",
          value: `₹${dailyBillAmount.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-cyan-500",
          description: `Last update: ${todayStr}`
        },
        {
          title: "Total CC Bill",
          value: `₹${dailyTotalCCBill.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-purple-500",
          description: `Last update: ${todayStr}`
        },
        {
          title: "QR Payment Charges",
          value: `₹${dailyQrCharges.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-emerald-500",
          description: `Last update: ${todayStr}`
        },
        {
          title: "Bill Payment Charge",
          value: `₹${dailyBillCharges.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-indigo-500",
          description: `Last update: ${todayStr}`
        },
        {
          title: "Total User Wallet",
          value: `₹${totalWalletBalance.toLocaleString()}`,
          icon: Wallet,
          color: "bg-amber-500",
          description: `Last update: ${todayStr}`
        },
        {
          title: "Daily Total Service Charge",
          value: `₹${dailyTotalCharges.toLocaleString()}`,
          icon: TrendingUp,
          color: "bg-rose-500",
          description: `Last update: ${todayStr}`
        }
      ]);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <p className="text-sm font-medium">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500 mt-1">Welcome back, Admin. Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={stat.title}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${stat.color} text-white`}>
                  <Icon size={24} />
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight">
                  {stat.value}
                </h3>
                <p className="text-xs text-slate-400 mt-2">{stat.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
