import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Smartphone,
  Search,
  Loader2,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  Calendar,
  Filter,
  DollarSign,
  Compass,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LogoLoader } from './shared/LoadingSpinner';
import { useToast } from '../context/ToastContext';

interface RechargeTransaction {
  id: string;
  user_id: string;
  mobile: string;
  operator: string;
  circle: string;
  amount: number;
  plan_id: string;
  txn_ref_id: string;
  request_id: string;
  status: 'success' | 'pending' | 'failed';
  response: any;
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
  };
}

export default function RechargeDashboard() {
  const toast = useToast();
  const [transactions, setTransactions] = useState<RechargeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // API Deposit Balance
  const [depositBalance, setDepositBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalAmount: 0,
    successCount: 0,
    failedCount: 0,
    pendingCount: 0
  });

  // Filters
  const [mobileQuery, setMobileQuery] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [circleFilter, setCircleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination / Rows limit
  const [displayCount, setDisplayCount] = useState(10);

  // Modals
  const [selectedTxn, setSelectedTxn] = useState<RechargeTransaction | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecharges();
    fetchDepositBalance();
  }, []);

  const fetchDepositBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch('/api/recharge/deposit');
      const data = await res.json();
      if (data && data.depositEnquiryResponse) {
        const bal = Number(data.depositEnquiryResponse.balance) || 0;
        setDepositBalance(bal);
      } else if (data && typeof data.balance !== 'undefined') {
        setDepositBalance(Number(data.balance));
      } else {
        setDepositBalance(null);
      }
    } catch (err) {
      console.error('Error fetching deposit balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchRecharges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recharge_transactions')
        .select(`
          *,
          users_profiles:user_id(name, firm_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const txns = (data || []) as RechargeTransaction[];
      setTransactions(txns);

      // Compute aggregates
      let totalAmount = 0;
      let successCount = 0;
      let failedCount = 0;
      let pendingCount = 0;

      txns.forEach(t => {
        if (t.status === 'success') {
          totalAmount += Number(t.amount) || 0;
          successCount++;
        } else if (t.status === 'failed') {
          failedCount++;
        } else if (t.status === 'pending') {
          pendingCount++;
        }
      });

      setStats({
        totalAmount,
        successCount,
        failedCount,
        pendingCount
      });
    } catch (err: any) {
      console.error('Error loading recharges:', err);
      toast.error(err.message || 'Failed to fetch recharge transactions.');
    } finally {
      setLoading(false);
    }
  };

  // Recheck Status for a single pending transaction
  const handleRecheckStatus = async (requestId: string) => {
    if (!requestId) return;
    setRecheckingId(requestId);
    try {
      const res = await fetch(`/api/recharge/status?requestId=${requestId}`);
      const data = await res.json();
      const statusResponse = data?.transactionStatusResponse;
      
      if (statusResponse) {
        const apiStatus = statusResponse.status?.toLowerCase();
        let message = `Transaction is ${apiStatus || 'pending'}.`;
        
        if (apiStatus === 'success' || apiStatus === 'approved') {
          toast.success('Transaction is successful! Refreshed status.');
        } else if (apiStatus === 'failed' || apiStatus === 'rejected') {
          toast.error('Transaction failed on status re-check.');
        } else {
          toast.info('Transaction is still pending.');
        }
        
        await fetchRecharges();
      } else {
        toast.error('Unable to fetch transaction status details.');
      }
    } catch (err: any) {
      console.error('Error rechecking status:', err);
      toast.error('Status check request failed.');
    } finally {
      setRecheckingId(null);
    }
  };

  // Filter Transactions in client side
  const getFilteredTransactions = () => {
    let filtered = [...transactions];

    if (mobileQuery.trim()) {
      const q = mobileQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.mobile.toLowerCase().includes(q) ||
        (t.users_profiles?.name || '').toLowerCase().includes(q) ||
        (t.users_profiles?.firm_name || '').toLowerCase().includes(q) ||
        (t.request_id || '').toLowerCase().includes(q) ||
        (t.txn_ref_id || '').toLowerCase().includes(q)
      );
    }

    if (operatorFilter !== 'all') {
      filtered = filtered.filter(t => t.operator.toLowerCase().includes(operatorFilter.toLowerCase()));
    }

    if (circleFilter !== 'all') {
      filtered = filtered.filter(t => t.circle.toLowerCase() === circleFilter.toLowerCase());
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (startDate) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(`${startDate}T00:00:00`));
    }

    if (endDate) {
      filtered = filtered.filter(t => new Date(t.created_at) <= new Date(`${endDate}T23:59:59`));
    }

    return filtered;
  };

  const filteredTxns = getFilteredTransactions();

  const exportToExcel = () => {
    const exportData = filteredTxns.slice(0, displayCount).map(r => ({
      'Date': new Date(r.created_at).toLocaleString(),
      'User': r.users_profiles?.name || 'N/A',
      'Firm': r.users_profiles?.firm_name || 'N/A',
      'Mobile Number': r.mobile,
      'Operator': r.operator,
      'Circle': r.circle,
      'Amount': r.amount,
      'Plan Type': r.plan_id || 'Manual',
      'Status': r.status.toUpperCase(),
      'Transaction Ref ID': r.txn_ref_id || 'N/A',
      'Request ID': r.request_id || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recharges');
    XLSX.writeFile(wb, `Recharges_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const tableData = filteredTxns.slice(0, displayCount).map(r => [
        new Date(r.created_at).toLocaleString(),
        r.users_profiles?.name || 'N/A',
        r.users_profiles?.firm_name || 'N/A',
        r.mobile,
        r.operator,
        r.circle,
        `Rs. ${r.amount}`,
        r.status.toUpperCase(),
        r.txn_ref_id || 'N/A',
        r.request_id || 'N/A'
      ]);

      autoTable(doc, {
        head: [['Date', 'User', 'Firm', 'Mobile', 'Operator', 'Circle', 'Amount', 'Status', 'Txn Ref', 'Request ID']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 }
      });

      doc.save(`Recharges_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    }
  };

  // Operator breakdowns
  const getOperatorBreakdown = () => {
    const data: Record<string, { count: number, sum: number }> = {};
    transactions.filter(t => t.status === 'success').forEach(t => {
      const op = t.operator.split(' ')[0] || t.operator;
      if (!data[op]) {
        data[op] = { count: 0, sum: 0 };
      }
      data[op].count++;
      data[op].sum += Number(t.amount) || 0;
    });
    return Object.entries(data).map(([name, val]) => ({ name, ...val }));
  };

  const operatorBreakdowns = getOperatorBreakdown();

  return (
    <div className="space-y-6">
      {/* Header & Balance Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Smartphone className="text-emerald-500" size={28} />
            Recharge Control Panel
          </h2>
          <p className="text-slate-500 mt-1">Manage, audit, and trace mobile prepaid recharge transactions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchRecharges();
              fetchDepositBalance();
            }}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm cursor-pointer"
            title="Refresh Data"
          >
            <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-100/50 transition-all cursor-pointer">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button onClick={exportToPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-rose-100/50 transition-all cursor-pointer">
            <FileText size={18} /> PDF
          </button>
        </div>
      </div>

      {/* Top statistics rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* API deposit balance */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-sm relative overflow-hidden lg:col-span-1"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 shadow-inner">
              <Wallet size={20} />
            </div>
            <button
              onClick={fetchDepositBalance}
              disabled={balanceLoading}
              className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {balanceLoading ? '...' : 'Check'}
            </button>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">API Wallet</p>
            <h3 className="text-lg font-black tracking-tight">
              {depositBalance !== null ? `₹${depositBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Click Check'}
            </h3>
          </div>
        </motion.div>

        {/* Total volume */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-1"
        >
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner">
            <DollarSign size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Success Vol</p>
            <h3 className="text-lg font-black text-slate-950">₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
          </div>
        </motion.div>

        {/* Success count */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-1"
        >
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shadow-inner">
            <CheckCircle2 size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Success Txns</p>
            <h3 className="text-lg font-black text-slate-950">{stats.successCount}</h3>
          </div>
        </motion.div>

        {/* Pending count */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-1"
        >
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shadow-inner">
            <Clock size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pending Txns</p>
            <h3 className="text-lg font-black text-slate-950">{stats.pendingCount}</h3>
          </div>
        </motion.div>

        {/* Failed count */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-1"
        >
          <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shadow-inner">
            <XCircle size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Failed Txns</p>
            <h3 className="text-lg font-black text-slate-950">{stats.failedCount}</h3>
          </div>
        </motion.div>
      </div>

      {/* Operator breakdown panel */}
      {operatorBreakdowns.length > 0 && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Operator Sales Share</h3>
          <div className="flex flex-wrap gap-4">
            {operatorBreakdowns.map((op, idx) => (
              <div key={idx} className="flex-1 min-w-[150px] p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-800 uppercase">{op.name}</span>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{op.count} Sales</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-600">₹{op.sum.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtering panel */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by Mobile, Firm, or User..."
            value={mobileQuery}
            onChange={(e) => setMobileQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-1.5">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold text-slate-700 outline-none bg-transparent"
            />
          </div>
          <div className="w-px h-8 bg-slate-200 mx-2" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold text-slate-700 outline-none bg-transparent"
            />
          </div>
        </div>

        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
        >
          <option value="all">All Operators</option>
          <option value="Airtel">Airtel</option>
          <option value="Jio">Jio</option>
          <option value="Vi">Vi (Vodafone Idea)</option>
          <option value="BSNL">BSNL</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>

        <button
          onClick={fetchRecharges}
          className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-slate-200 cursor-pointer"
        >
          Apply
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            Show
            <select
              value={displayCount}
              onChange={(e) => setDisplayCount(Number(e.target.value))}
              className="mx-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none focus:border-emerald-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            entries
          </div>
          {filteredTxns.length > 0 && (
            <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-emerald-100">
              Showing {Math.min(displayCount, filteredTxns.length)} of {filteredTxns.length} records
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-50">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Time</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User / Firm</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recharge Mobile</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator & Circle</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Txn / Request ID</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-3">Loading recharge audit trail...</p>
                  </td>
                </tr>
              ) : filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100">
                      <Smartphone size={24} />
                    </div>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">No recharge transactions found</p>
                  </td>
                </tr>
              ) : (
                filteredTxns.slice(0, displayCount).map((r, idx) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                    key={r.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {r.users_profiles ? (
                        <Link
                          to={`/users-list?id=${r.user_id}`}
                          className="flex flex-col hover:opacity-80 transition-opacity"
                        >
                          <span className="text-xs font-bold text-slate-950">{r.users_profiles.firm_name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{r.users_profiles.name}</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Self / Seeded</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-slate-900 font-mono">{r.mobile}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{r.operator}</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">{r.circle}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-xs font-black text-slate-900">₹{Number(r.amount).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        r.status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        r.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                        {r.status === 'pending' ? <Clock size={10} className="animate-spin" /> : null}
                        {r.status === 'success' ? <CheckCircle2 size={10} /> : null}
                        {r.status === 'failed' ? <XCircle size={10} /> : null}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-600 font-bold font-mono">Ref: {r.txn_ref_id || 'N/A'}</span>
                        <span className="text-[9px] text-slate-400 font-semibold font-mono">Req: {r.request_id || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleRecheckStatus(r.request_id)}
                            disabled={recheckingId === r.request_id}
                            className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Re-check Status"
                          >
                            {recheckingId === r.request_id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <RotateCcw size={13} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedTxn(r)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                          title="View API Details"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Payload Modal */}
      <AnimatePresence>
        {selectedTxn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-[32px] p-8 border border-slate-200 shadow-2xl relative flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-emerald-500" />
                  API Transaction Payload
                </h3>
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Request ID</span>
                    <p className="font-bold text-slate-800 mt-0.5 font-mono">{selectedTxn.request_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Txn Ref ID</span>
                    <p className="font-bold text-slate-800 mt-0.5 font-mono">{selectedTxn.txn_ref_id || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Full JSON Response</span>
                  <pre className="p-4 bg-slate-950 text-slate-300 rounded-2xl text-xs overflow-x-auto font-mono max-h-[300px]">
                    {JSON.stringify(selectedTxn.response || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
