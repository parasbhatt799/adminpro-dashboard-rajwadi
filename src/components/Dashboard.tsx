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
  ShieldAlert,
  TrendingDown,
  RefreshCw,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogoLoader } from './shared/LoadingSpinner';
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

interface SparklineProps {
  data: number[];
  color?: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color = 'stroke-indigo-500' }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const width = 80;
  const height = 30;
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });
  
  const pathData = `M ${points.join(' L ')}`;
  
  return (
    <svg className="w-20 h-8 shrink-0 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <path
        d={pathData}
        fill="none"
        className={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
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
  const [error, setError] = useState<string | null>(null);
  const [payprimeBalance, setPayprimeBalance] = useState<number | null>(null);
  const [payprimeUsername, setPayprimeUsername] = useState<string>('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let startDate: string | null = null;
      let endDate: string | null = null;
      const now = new Date();

      switch (timeRange) {
        case 'today':
          startDate = startOfDay(now).toISOString();
          endDate = endOfDay(now).toISOString();
          break;
        case 'yesterday':
          startDate = startOfYesterday().toISOString();
          endDate = endOfYesterday().toISOString();
          break;
        case '7days':
          startDate = startOfDay(subDays(now, 7)).toISOString();
          endDate = endOfDay(now).toISOString();
          break;
        case '30days':
          startDate = startOfDay(subDays(now, 30)).toISOString();
          endDate = endOfYesterday().toISOString();
          break;
        case 'custom':
          startDate = startOfDay(parseISO(customDates.start)).toISOString();
          endDate = endOfDay(parseISO(customDates.end)).toISOString();
          break;
        case 'all':
        default:
          startDate = null;
          endDate = null;
      }

      const { data: rpcStats, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (rpcError) throw rpcError;

      let fetchedBalance = 0;
      let fetchedUsername = "";
      try {
        const balanceRes = await fetch("/api/payprime-balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const balanceData = await balanceRes.json();
        if (balanceData && typeof balanceData.balance === 'number') {
          fetchedBalance = balanceData.balance;
          fetchedUsername = balanceData.username || "";
        }
      } catch (e) {
        console.error("Failed to fetch PayPrime balance:", e);
      }
      setPayprimeBalance(fetchedBalance);
      setPayprimeUsername(fetchedUsername);

      // Fetch BBPS stats within range
      let bbpsStatsQuery = supabase
        .from('bbps_submissions')
        .select('amount, charges')
        .in('status', ['approved', 'pending']);
      
      if (startDate) {
        bbpsStatsQuery = bbpsStatsQuery.gte('created_at', startDate);
      }
      if (endDate) {
        bbpsStatsQuery = bbpsStatsQuery.lte('created_at', endDate);
      }

      const { data: bbpsData, error: bbpsError } = await bbpsStatsQuery;
      if (bbpsError) throw bbpsError;

      const rangeBbpsAmount = (bbpsData || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
      const rangeBbpsCharges = (bbpsData || []).reduce((acc, r) => acc + Number(r.charges || 0), 0);

      // Get pending BBPS count
      const { count: pendingBbpsCount, error: pendingBbpsErr } = await supabase
        .from('bbps_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      const pendingBbps = pendingBbpsErr ? 0 : (pendingBbpsCount || 0);

      // Calculate previous period dates for comparison
      let prevStartDate: string | null = null;
      let prevEndDate: string | null = null;
      if (startDate && endDate) {
        const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
        prevStartDate = new Date(new Date(startDate).getTime() - diff - 1000).toISOString();
        prevEndDate = new Date(new Date(startDate).getTime() - 1000).toISOString();
      }

      let prevRpcStats: any = null;
      if (prevStartDate && prevEndDate) {
        try {
          const { data: pStats } = await supabase.rpc('get_dashboard_stats', {
            p_start_date: prevStartDate,
            p_end_date: prevEndDate
          });
          if (pStats) prevRpcStats = pStats;
        } catch (e) {
          console.error("Failed to fetch previous stats:", e);
        }
      }

      const getComparison = (current: number, previous: number) => {
        if (!previous || previous === 0) {
          if (current > 0) return { percent: '+100%', isPositive: true, isNeutral: false };
          return { percent: '0%', isPositive: false, isNeutral: true };
        }
        const diff = current - previous;
        const pct = (diff / previous) * 100;
        const sign = pct > 0 ? '+' : '';
        return {
          percent: `${sign}${pct.toFixed(1)}%`,
          isPositive: pct > 0,
          isNeutral: pct === 0
        };
      };

      const fiveDaysAgo = subDays(new Date(), 5).toISOString();

      // Fetch last 5 days approved submissions for sparklines (Real Database Data)
      const { data: qrRecent } = await supabase
        .from('payment_submissions')
        .select('amount, admin_share, distributor_share, super_distributor_share, created_at')
        .eq('status', 'approved')
        .gte('created_at', fiveDaysAgo);

      const { data: billRecent } = await supabase
        .from('bill_submissions')
        .select('amount, admin_share, distributor_share, created_at')
        .eq('status', 'approved')
        .gte('created_at', fiveDaysAgo);

      const { data: bbpsRecent } = await supabase
        .from('bbps_submissions')
        .select('amount, charges, created_at')
        .in('status', ['approved', 'pending'])
        .gte('created_at', fiveDaysAgo);

      const { data: payoutRecent } = await supabase
        .from('payout_submissions')
        .select('charge_amount, created_at')
        .eq('status', 'approved')
        .gte('created_at', fiveDaysAgo);

      const { data: usersRecent } = await supabase
        .from('users_profiles')
        .select('created_at')
        .eq('role', 'user')
        .gte('created_at', fiveDaysAgo);

      const getSparklineData = (records: any[], key = 'amount') => {
        const points = [0, 0, 0, 0, 0];
        const now = new Date();
        records?.forEach(r => {
          const rDate = new Date(r.created_at);
          const dayDiff = Math.floor((now.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24));
          if (dayDiff >= 0 && dayDiff < 5) {
            points[4 - dayDiff] += Number(r[key] || 0);
          }
        });
        return points;
      };

      const getActiveUsersSparkline = () => {
        const points = [active_users_count, active_users_count, active_users_count, active_users_count, active_users_count];
        const now = new Date();
        usersRecent?.forEach(u => {
          const uDate = new Date(u.created_at);
          const dayDiff = Math.floor((now.getTime() - uDate.getTime()) / (1000 * 60 * 60 * 24));
          if (dayDiff >= 0 && dayDiff < 5) {
            for (let i = 0; i < 4 - dayDiff; i++) {
              points[i] = Math.max(0, points[i] - 1);
            }
          }
        });
        return points;
      };

      const getSparklineColor = (data: number[]) => {
        if (!data || data.length < 2) return 'stroke-blue-500';
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        if (last > prev) return 'stroke-emerald-500';
        if (last < prev) return 'stroke-rose-500';
        return 'stroke-blue-500';
      };

      const qrSpark = getSparklineData(qrRecent, 'amount');
      const ccSpark = getSparklineData(billRecent, 'amount');
      const bbpsSpark = getSparklineData(bbpsRecent, 'amount');
      const userSpark = getActiveUsersSparkline();
      const qrChargesSpark = getSparklineData(qrRecent, 'admin_share');
      const billChargesSpark = getSparklineData(billRecent, 'admin_share');
      const bbpsChargesSpark = getSparklineData(bbpsRecent, 'charges');
      const payoutChargesSpark = getSparklineData(payoutRecent, 'charge_amount');
      const serviceChargesSpark = qrChargesSpark.map((v, i) => v + billChargesSpark[i] + bbpsChargesSpark[i] + payoutChargesSpark[i]);
      const qrAdminChargesSpark = getSparklineData(qrRecent, 'admin_share');
      const billAdminChargesSpark = getSparklineData(billRecent, 'admin_share');
      const bbpsAdminChargesSpark = getSparklineData(bbpsRecent, 'charges');
      const distShareSpark = qrRecent && billRecent ? qrChargesSpark.map((_, i) => getSparklineData(qrRecent, 'distributor_share')[i] + getSparklineData(billRecent, 'distributor_share')[i]) : [0,0,0,0,0];
      const superDistShareSpark = getSparklineData(qrRecent, 'super_distributor_share');
      const payoutChargesSparkOnly = getSparklineData(payoutRecent, 'charge_amount');

      const {
        admin_wallet_balance,
        total_user_wallet_balance,
        active_users_count,
        pending_kyc_count,
        pending_bill_count,
        pending_qr_count,
        pending_payout_count,
        range_qr_amount,
        range_bill_amount,
        range_payout_amount,
        admin_qr_charges,
        admin_bill_charges,
        range_payout_charges,
        range_withdrawals,
        total_distributor_share,
        total_super_distributor_share
      } = rpcStats;

      const totalEarnings = (admin_bill_charges || 0) + (admin_qr_charges || 0) + (range_payout_charges || 0) + rangeBbpsCharges;
      const displayServiceCharge = totalEarnings + total_distributor_share + (total_super_distributor_share || 0);

      const dateDisplay = startDate && endDate
        ? `${format(parseISO(startDate), 'dd MMM')} - ${format(parseISO(endDate), 'dd MMM')}`
        : 'Lifetime';

      const formatCurrency = (val: number) => {
        if (isNaN(val) || val === null || val === undefined) return '₹0.00';
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      setStats([
        {
          title: "Total QR Payments",
          value: formatCurrency(range_qr_amount),
          icon: QrCode,
          color: "bg-blue-500",
          bgGradient: "from-blue-500/5 to-transparent",
          borderColor: "hover:border-blue-200",
          iconColor: "text-blue-500",
          iconBg: "bg-blue-50",
          description: `Range: ${dateDisplay}`,
          path: "/qr-payment-requests",
          sparklineData: qrSpark,
          sparklineColor: getSparklineColor(qrSpark),
          comparison: getComparison(range_qr_amount, prevRpcStats?.range_qr_amount || 0)
        },
        {
          title: "Total CC Bill",
          value: formatCurrency(range_bill_amount),
          icon: CreditCard,
          color: "bg-purple-500",
          bgGradient: "from-purple-500/5 to-transparent",
          borderColor: "hover:border-purple-200",
          iconColor: "text-purple-500",
          iconBg: "bg-purple-50",
          description: `Range: ${dateDisplay}`,
          path: "/bill-payment-requests",
          sparklineData: ccSpark,
          sparklineColor: getSparklineColor(ccSpark),
          comparison: getComparison(range_bill_amount, prevRpcStats?.range_bill_amount || 0)
        },
        {
          title: "Total BBPS Payments",
          value: formatCurrency(rangeBbpsAmount),
          icon: Zap,
          color: "bg-teal-500",
          bgGradient: "from-teal-500/5 to-transparent",
          borderColor: "hover:border-teal-200",
          iconColor: "text-teal-500",
          iconBg: "bg-teal-50",
          description: `Range: ${dateDisplay}`,
          path: "/bbps-history",
          sparklineData: bbpsSpark,
          sparklineColor: getSparklineColor(bbpsSpark),
          comparison: getComparison(rangeBbpsAmount, prevRpcStats?.range_bbps_amount || 0)
        },
        {
          title: "Total User Wallet",
          value: formatCurrency(total_user_wallet_balance),
          icon: Wallet,
          color: "bg-amber-500",
          bgGradient: "from-amber-500/5 to-transparent",
          borderColor: "hover:border-amber-200",
          iconColor: "text-amber-500",
          iconBg: "bg-amber-50",
          description: "Lifetime Total",
          badge: `${active_users_count} Active Users`,
          sparklineData: userSpark,
          sparklineColor: getSparklineColor(userSpark),
          comparison: getComparison(active_users_count, prevRpcStats?.active_users_count || active_users_count)
        },
        {
          title: "Total Service Charge",
          value: formatCurrency(displayServiceCharge),
          icon: TrendingUp,
          color: "bg-indigo-600",
          bgGradient: "from-indigo-500/5 to-transparent",
          borderColor: "hover:border-indigo-200",
          iconColor: "text-indigo-600",
          iconBg: "bg-indigo-50",
          description: `Total Earnings: ${dateDisplay}`,
          sparklineData: serviceChargesSpark,
          sparklineColor: getSparklineColor(serviceChargesSpark),
          comparison: getComparison(
            displayServiceCharge, 
            prevRpcStats 
              ? (Number(prevRpcStats.admin_bill_charges || 0) + Number(prevRpcStats.admin_qr_charges || 0) + Number(prevRpcStats.range_payout_charges || 0) + Number(prevRpcStats.range_bbps_charges || 0) + Number(prevRpcStats.total_distributor_share || 0) + Number(prevRpcStats.total_super_distributor_share || 0))
              : displayServiceCharge
          )
        },
        {
          title: "QR Payment Charges",
          value: formatCurrency(admin_qr_charges),
          icon: QrCode,
          color: "bg-emerald-500",
          bgGradient: "from-emerald-500/5 to-transparent",
          borderColor: "hover:border-emerald-200",
          iconColor: "text-emerald-500",
          iconBg: "bg-emerald-50",
          description: `Range: ${dateDisplay}`,
          sparklineData: qrAdminChargesSpark,
          sparklineColor: getSparklineColor(qrAdminChargesSpark),
          comparison: getComparison(admin_qr_charges, prevRpcStats?.admin_qr_charges || 0)
        },
        {
          title: "Bill Payment Charge",
          value: formatCurrency(admin_bill_charges),
          icon: CreditCard,
          color: "bg-indigo-500",
          bgGradient: "from-indigo-500/5 to-transparent",
          borderColor: "hover:border-indigo-200",
          iconColor: "text-indigo-500",
          iconBg: "bg-indigo-50",
          description: `Range: ${dateDisplay}`,
          sparklineData: billAdminChargesSpark,
          sparklineColor: getSparklineColor(billAdminChargesSpark),
          comparison: getComparison(admin_bill_charges, prevRpcStats?.admin_bill_charges || 0)
        },
        {
          title: "BBPS Service Charges",
          value: formatCurrency(rangeBbpsCharges),
          icon: Zap,
          color: "bg-teal-600",
          bgGradient: "from-teal-600/5 to-transparent",
          borderColor: "hover:border-teal-300",
          iconColor: "text-teal-600",
          iconBg: "bg-teal-50",
          description: `Range: ${dateDisplay}`,
          sparklineData: bbpsAdminChargesSpark,
          sparklineColor: getSparklineColor(bbpsAdminChargesSpark),
          comparison: getComparison(rangeBbpsCharges, prevRpcStats?.rangeBbpsCharges || 0)
        },
        {
          title: "Total Distributor Charge",
          value: formatCurrency(total_distributor_share),
          icon: User,
          color: "bg-orange-500",
          bgGradient: "from-orange-500/5 to-transparent",
          borderColor: "hover:border-orange-200",
          iconColor: "text-orange-500",
          iconBg: "bg-orange-50",
          description: `Distributor Profit: ${dateDisplay}`,
          sparklineData: distShareSpark,
          sparklineColor: getSparklineColor(distShareSpark),
          comparison: getComparison(total_distributor_share, prevRpcStats?.total_distributor_share || 0)
        },
        {
          title: "Total Super Distributor Charge",
          value: formatCurrency(total_super_distributor_share || 0),
          icon: User,
          color: "bg-pink-600",
          bgGradient: "from-pink-600/5 to-transparent",
          borderColor: "hover:border-pink-200",
          iconColor: "text-pink-600",
          iconBg: "bg-pink-50",
          description: `Super Distributor Profit: ${dateDisplay}`,
          sparklineData: superDistShareSpark,
          sparklineColor: getSparklineColor(superDistShareSpark),
          comparison: getComparison(total_super_distributor_share || 0, prevRpcStats?.total_super_distributor_share || 0)
        },
        {
          title: "Payout Service Charge",
          value: formatCurrency(range_payout_charges),
          icon: TrendingDown,
          color: "bg-amber-600",
          bgGradient: "from-amber-600/5 to-transparent",
          borderColor: "hover:border-amber-300",
          iconColor: "text-amber-600",
          iconBg: "bg-amber-50",
          description: `Range: ${dateDisplay}`,
          sparklineData: payoutChargesSparkOnly,
          sparklineColor: getSparklineColor(payoutChargesSparkOnly),
          comparison: getComparison(range_payout_charges, prevRpcStats?.range_payout_charges || 0)
        },
        {
          title: "Pending Actions",
          value: (
            <div className="flex flex-row items-center gap-1 mt-1 flex-wrap">
              <div className="flex flex-col items-center bg-emerald-50/80 px-2 py-1 rounded-xl border border-emerald-100/40 min-w-[36px]">
                <span className="text-base font-black text-emerald-700 leading-none">{pending_qr_count}</span>
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">QR</span>
              </div>
              <div className="flex flex-col items-center bg-indigo-50/80 px-2 py-1 rounded-xl border border-indigo-100/40 min-w-[36px]">
                <span className="text-base font-black text-indigo-700 leading-none">{pending_bill_count}</span>
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">Bill</span>
              </div>
              <div className="flex flex-col items-center bg-teal-50/80 px-2 py-1 rounded-xl border border-teal-100/40 min-w-[36px]">
                <span className="text-base font-black text-teal-700 leading-none">{pendingBbps}</span>
                <span className="text-[8px] font-black text-teal-500 uppercase tracking-tighter">BBPS</span>
              </div>
              <div className="flex flex-col items-center bg-amber-50/80 px-2 py-1 rounded-xl border border-amber-100/40 min-w-[36px]">
                <span className="text-base font-black text-amber-700 leading-none">{pending_payout_count}</span>
                <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Pay</span>
              </div>
              <div className="flex flex-col items-center bg-orange-50/80 px-2 py-1 rounded-xl border border-orange-100/40 min-w-[36px]">
                <span className="text-base font-black text-orange-700 leading-none">{pending_kyc_count}</span>
                <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter">KYC</span>
              </div>
            </div>
          ),
          icon: ShieldAlert,
          color: "bg-slate-700",
          bgGradient: "from-slate-700/5 to-transparent",
          borderColor: "hover:border-slate-300",
          iconColor: "text-slate-700",
          iconBg: "bg-slate-100",
          description: "All pending reviews"
        },
        {
          title: "Quick Refresh",
          value: (
            <button
              onClick={() => window.location.reload()}
              className="mt-1 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 active:scale-95 cursor-pointer"
            >
              <RefreshCw size={12} />
              Reload Now
            </button>
          ),
          icon: RefreshCw,
          color: "bg-slate-800",
          bgGradient: "from-slate-800/5 to-transparent",
          borderColor: "hover:border-slate-400",
          iconColor: "text-slate-800",
          iconBg: "bg-slate-100",
          description: "Sync platform data"
        }
      ]);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [timeRange, customDates]);

  const fetchRefundedRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bill_submissions')
        .select('*, users_profiles!bill_submissions_user_id_fkey(name, firm_name)')
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
        // Use Atomic RPC for re-approval (Just updates status back to approved)
        const { data: result, error: rpcError } = await supabase.rpc('reapprove_bill_payment_atomic', {
          p_bill_id: id
        });

        if (rpcError) throw rpcError;
        if (!result.success) throw new Error(result.message);

        // Notify User
        await supabase
          .from('notifications')
          .insert([{
            user_id: targetRequest.user_id,
            target_role: 'user',
            title: 'Bill Payment Approved',
            message: `Your bill payment of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been approved after review!`,
            link: '/user/reports'
          }]);

      } else {
        // Use Atomic RPC for final refund (Updates status + Refunds user + Deducts from Admin in ONE step)
        const { data: result, error: rpcError } = await supabase.rpc('confirm_bill_refund_atomic', {
          p_bill_id: id,
          p_reason: customReason || reason
        });

        if (rpcError) throw rpcError;
        if (!result.success) throw new Error(result.message);

        // Notify User
        await supabase
          .from('notifications')
          .insert([{
            user_id: targetRequest.user_id,
            target_role: 'user',
            title: 'Bill Payment Rejected',
            message: `Your bill payment of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} was rejected. Reason: ${customReason || reason}`,
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

    // Real-time listener for stats refresh
    const statsChannel = supabase
      .channel('dashboard_stats_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_submissions' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_submissions' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bbps_submissions' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_submissions' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_withdrawals' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_profiles' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(statsChannel);
    };
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
          <div className="flex items-center flex-wrap gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
            <motion.button
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              onClick={() => window.location.reload()}
              className="p-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center group"
              title="Reload Page"
            >
              <RefreshCw size={18} className="group-active:scale-90 transition-transform" />
            </motion.button>

            {payprimeBalance !== null && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/80 px-3.5 py-1.5 rounded-2xl shadow-sm animate-in fade-in zoom-in duration-300">
                <Wallet size={14} className="text-blue-600 animate-pulse" />
                <span className="text-[10px] font-black text-blue-700 tracking-wider uppercase">payprime blance:</span>
                <span className="text-sm font-extrabold text-indigo-900 font-mono">
                  ₹{payprimeBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {payprimeUsername && (
                  <span className="hidden sm:inline-block text-[9px] font-bold text-blue-500 bg-blue-100/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    {payprimeUsername}
                  </span>
                )}
              </div>
            )}
          </div>
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
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 ${timeRange === range ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
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

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <span>Error loading dashboard statistics: {error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
          <LogoLoader size="md" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            const isClickable = !!stat.path;
            return (
              <div
                key={stat.title}
                onClick={() => {
                  if (stat.path) {
                    navigate(stat.path);
                  }
                }}
                className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 group relative overflow-hidden flex flex-col justify-between ${
                  isClickable ? 'cursor-pointer hover:shadow-md hover:border-slate-200 active:scale-[0.98]' : ''
                } ${stat.borderColor || 'hover:border-indigo-100'}`}
              >
                {/* Accent subtle background gradient matching the theme color */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient || 'from-slate-50/50 to-transparent'} opacity-30 pointer-events-none`} />

                <div className="relative z-10 flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${stat.iconBg || 'bg-slate-50'} ${stat.iconColor || 'text-slate-600'} shadow-sm`}>
                    <Icon size={20} />
                  </div>
                  {stat.badge && (
                    <div className="bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
                      {stat.badge}
                    </div>
                  )}
                </div>

                <div className="mt-4 relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.title}</p>
                  
                  {typeof stat.value === 'object' ? (
                    <div className="mt-1">{stat.value}</div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <h3 className="text-2xl font-black text-slate-800 font-mono tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                        {stat.value}
                      </h3>
                      {stat.sparklineData && (
                        <Sparkline data={stat.sparklineData} color={stat.sparklineColor} />
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-3 text-[9px] font-extrabold uppercase tracking-wider">
                    {stat.comparison && (
                      <span className={`px-1.5 py-0.5 rounded-md border ${
                        stat.comparison.isNeutral 
                          ? 'bg-slate-50 text-slate-400 border-slate-100' 
                          : stat.comparison.isPositive 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' 
                            : 'bg-rose-50 text-rose-600 border-rose-100/50'
                      }`}>
                        {stat.comparison.percent}
                      </span>
                    )}
                    <span className="text-slate-400 truncate">{stat.description}</span>
                  </div>
                </div>

                <div className="absolute right-[-15px] bottom-[-15px] opacity-[0.02] group-hover:scale-110 transition-transform duration-500 text-slate-900 pointer-events-none">
                  <Icon size={90} />
                </div>
              </div>
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
                <h3 className="text-lg font-bold text-slate-900">Bank Panding Review</h3>
                <p className="text-xs text-slate-500 font-medium">Recently moved to Bank Panding state from approvals.</p>
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
                                {req.users_profiles?.firm_name || req.users_profiles?.name || `User #${req.user_id?.slice(0, 8) || 'N/A'}`}
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
                              {(req.card_number || '').slice(-4)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{req.card_bank}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-slate-900 flex items-center justify-end font-mono">
                            ₹{req.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-emerald-600 flex items-center justify-end font-mono">
                            ₹{(req.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-indigo-600 flex items-center justify-end font-mono">
                            ₹{(Number(req.amount) + Number(req.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-100/50 shadow-sm">
                            <RotateCcw size={10} className="animate-spin-slow" />
                            Bank Panding
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
