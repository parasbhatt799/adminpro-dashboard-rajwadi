import React, { useState, useEffect } from 'react';
import {
  Send,
  Search,
  Calendar,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  X,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Building2,
  CreditCard
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { LogoLoader } from '../shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

interface UserPayoutHistoryProps {
  userId: string;
}

export default function UserPayoutHistory({ userId }: UserPayoutHistoryProps) {
  const toast = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const itemsPerPage = 10;

  // Fetch payout transactions
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payout_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err: any) {
      console.error('Error fetching payout history:', err);
      toast.error('Failed to load payout history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchHistory();

      // Realtime subscription for instant status updates
      const channel = supabase
        .channel('user_payout_submissions_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payout_submissions',
            filter: `user_id=eq.${userId}`
          },
          () => {
            fetchHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, statusFilter, search]);

  const checkDateFilter = (createdAtStr: string, filter: string) => {
    if (filter === 'all') return true;

    const createdDate = new Date(createdAtStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'today') {
      return createdDate >= todayStart;
    }

    if (filter === 'yesterday') {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      return createdDate >= yesterdayStart && createdDate < todayStart;
    }

    if (filter === '7days') {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return createdDate >= sevenDaysAgo;
    }

    if (filter === '30days') {
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate >= thirtyDaysAgo;
    }

    if (filter === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdDate >= monthStart;
    }

    return true;
  };

  // Filter transactions
  const filteredHistory = history.filter((item) => {
    // 1. Date filter
    if (!checkDateFilter(item.created_at, dateFilter)) return false;

    // 2. Status filter
    if (statusFilter !== 'all') {
      const itemStatus = (item.status || 'pending').toLowerCase();
      if (statusFilter === 'approved' && itemStatus !== 'approved') return false;
      if (statusFilter === 'pending' && itemStatus !== 'pending' && itemStatus !== 'processing') return false;
      if (statusFilter === 'rejected' && itemStatus !== 'rejected' && itemStatus !== 'failed') return false;
    }

    // 3. Search query
    if (search.trim() !== '') {
      const query = search.toLowerCase().trim();
      const beneficiaryName = (item.account_holder_name || item.beneficiary_name || '').toLowerCase();
      const bankName = (item.bank_name || '').toLowerCase();
      const accountNumber = (item.account_number || '').toLowerCase();
      const ifsc = (item.ifsc_code || '').toLowerCase();
      const utr = (item.utr_number || item.transaction_id || item.bank_ref || '').toLowerCase();
      const amountStr = (item.amount || '').toString();

      return (
        beneficiaryName.includes(query) ||
        bankName.includes(query) ||
        accountNumber.includes(query) ||
        ifsc.includes(query) ||
        utr.includes(query) ||
        amountStr.includes(query)
      );
    }

    return true;
  });

  // Calculate summary metrics
  const totalAmount = filteredHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalApproved = filteredHistory
    .filter((i) => ['approved', 'success'].includes((i.status || '').toLowerCase()))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const approvedCount = filteredHistory.filter((i) => ['approved', 'success'].includes((i.status || '').toLowerCase())).length;
  
  const pendingAmount = filteredHistory
    .filter((i) => ['pending', 'processing'].includes((i.status || '').toLowerCase()))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const pendingCount = filteredHistory.filter((i) => ['pending', 'processing'].includes((i.status || '').toLowerCase())).length;

  const rejectedAmount = filteredHistory
    .filter((i) => ['rejected', 'failed', 'refunded'].includes((i.status || '').toLowerCase()))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const rejectedCount = filteredHistory.filter((i) => ['rejected', 'failed', 'refunded'].includes((i.status || '').toLowerCase())).length;

  // Pagination calculation
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'approved':
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Approved
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw size={13} className="text-blue-600 animate-spin" />
            Processing
          </span>
        );
      case 'rejected':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X size={13} className="text-rose-600" />
            Rejected
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle size={13} className="text-amber-600" />
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} className="text-amber-600" />
            Pending
          </span>
        );
    }
  };

  const cleanValue = (val: any): string => {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.includes('"success"') || trimmed.includes('"data"') || trimmed.includes('{"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.data?.rrn) return String(parsed.data.rrn);
        if (parsed.data?.utr) return String(parsed.data.utr);
        if (parsed.data?.txnid) return String(parsed.data.txnid);
        if (parsed.rrn) return String(parsed.rrn);
        if (parsed.utr) return String(parsed.utr);
        if (parsed.txnid) return String(parsed.txnid);
        if (parsed.message) return String(parsed.message);
      } catch (e) {
        // ignore JSON parse error
      }
      return '';
    }
    return trimmed;
  };

  const getUtrDisplay = (item: any) => {
    const cleanUtr = cleanValue(item.utr_number);
    if (cleanUtr && !cleanUtr.toLowerCase().includes('success')) return cleanUtr;

    const cleanBankRef = cleanValue(item.bank_ref);
    if (cleanBankRef && !cleanBankRef.toLowerCase().includes('success')) return cleanBankRef;

    const cleanTxnId = cleanValue(item.transaction_id);
    if (cleanTxnId && !cleanTxnId.toLowerCase().includes('success')) return cleanTxnId;

    const candidates = [item.utr_number, item.bank_ref, item.transaction_id];
    for (const cand of candidates) {
      if (cand && typeof cand === 'string') {
        const trimmed = cand.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.includes('"success"') && !trimmed.includes('"data"') && !trimmed.includes('{"')) {
          return trimmed;
        }
      }
    }

    return 'Processing...';
  };

  const getRemarkDisplay = (item: any) => {
    const remark = item.remark || item.rejection_reason;
    if (!remark || typeof remark !== 'string') return '';
    const trimmed = remark.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.includes('"success"') || trimmed.includes('"data"') || trimmed.includes('{"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.message) return String(parsed.message);
        if (parsed.error) return String(parsed.error);
      } catch (e) {
        // Do not return raw JSON
      }
      return '';
    }
    return trimmed;
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1">
              <Send size={14} />
              <span>UsePay Payout History</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Bank Payout Records
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">
              Track and manage all your instant beneficiary bank payouts and settlements.
            </p>
          </div>
          <button
            onClick={fetchHistory}
            className="self-start sm:self-center px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer backdrop-blur-md active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Volume</span>
            <div className="text-lg sm:text-xl font-black text-white mt-1">
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">{filteredHistory.length} total payouts</span>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Successful</span>
            <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
              ₹{totalApproved.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-300/80 mt-1 block">{approvedCount} approved</span>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Pending / In-Progress</span>
            <div className="text-lg sm:text-xl font-black text-amber-400 mt-1">
              ₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-amber-300/80 mt-1 block">{pendingCount} pending payouts</span>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Failed / Rejected</span>
            <div className="text-lg sm:text-xl font-black text-rose-400 mt-1">
              ₹{rejectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-rose-300/80 mt-1 block">{rejectedCount} refunded payouts</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Beneficiary, Account, IFSC, or UTR..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none rounded-xl text-xs font-bold text-slate-800 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date & Status Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-slate-500 shrink-0" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved / Success</option>
                <option value="pending">Pending / Processing</option>
                <option value="rejected">Rejected / Failed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <LogoLoader />
            <p className="text-xs font-bold text-slate-400 mt-4 animate-pulse">Loading payout transactions...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Send size={22} />
            </div>
            <h3 className="text-sm font-black text-slate-800">No Payout Records Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no payout transactions matching your selected filters. Try broadening your date or search query.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Date & Time</th>
                    <th className="py-4 px-6">Beneficiary Details</th>
                    <th className="py-4 px-6 text-right">Amount (₹)</th>
                    <th className="py-4 px-6">UTR / Bank Ref</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {paginatedHistory.map((txn) => {
                    const name = txn.account_holder_name || txn.beneficiary_name || 'N/A';
                    const bank = txn.bank_name || 'Bank Transfer';
                    const acc = txn.account_number || 'N/A';
                    const ifsc = txn.ifsc_code || '';
                    const charge = Number(txn.charge_amount) || 0;
                    const amount = Number(txn.amount) || 0;
                    const totalDeduction = amount + charge;

                    return (
                      <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Date & Time */}
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-800">
                            {format(parseISO(txn.created_at), 'dd MMM yyyy')}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            {format(parseISO(txn.created_at), 'hh:mm:ss a')}
                          </div>
                        </td>

                        {/* Beneficiary Details */}
                        <td className="py-4 px-6">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                              <Building2 size={16} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-xs">{name}</div>
                              <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                                <span>{bank}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-600">A/C: {acc}</span>
                              </div>
                              {ifsc && <div className="text-[10px] font-mono text-slate-400">IFSC: {ifsc}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-6 text-right">
                          <div className="font-black text-slate-900 text-sm">
                            ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          {charge > 0 && (
                            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              + Charge: ₹{charge.toFixed(2)} (Total: ₹{totalDeduction.toFixed(2)})
                            </div>
                          )}
                        </td>

                        {/* UTR */}
                        <td className="py-4 px-6 font-mono text-xs">
                          <div className="font-extrabold text-slate-800">{getUtrDisplay(txn)}</div>
                          {getRemarkDisplay(txn) && (
                            <div className="text-[10px] font-sans font-medium text-rose-500 mt-0.5 max-w-xs truncate" title={getRemarkDisplay(txn)}>
                              {getRemarkDisplay(txn)}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 text-center">
                          {getStatusBadge(txn.status)}
                        </td>

                        {/* Receipt Button */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => setSelectedReceipt(txn)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200 hover:border-indigo-200"
                          >
                            <Printer size={13} />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-200/80 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-bold text-slate-800">
                    {Math.min(currentPage * itemsPerPage, filteredHistory.length)}
                  </span>{' '}
                  of <span className="font-bold text-slate-800">{filteredHistory.length}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative animate-fadeIn">
            {/* Modal Close Button */}
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Receipt Header */}
            <div className="text-center space-y-2 border-b border-slate-100 pb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-1">
                <Send size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Payout Transfer Receipt</h3>
              <p className="text-xs font-semibold text-slate-400">
                UsePay Instant Beneficiary Settlement
              </p>
            </div>

            {/* Status & Amount Display */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 text-center space-y-2">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">TRANSACTION AMOUNT</div>
              <div className="text-3xl font-black text-slate-900">
                ₹{Number(selectedReceipt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="pt-1 flex justify-center">{getStatusBadge(selectedReceipt.status)}</div>
            </div>

            {/* Transaction Details List */}
            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Beneficiary Name</span>
                <span className="font-extrabold text-slate-900 text-right">{selectedReceipt.account_holder_name || selectedReceipt.beneficiary_name || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Bank Name</span>
                <span className="font-extrabold text-slate-800 text-right">{selectedReceipt.bank_name || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Account Number</span>
                <span className="font-mono font-extrabold text-slate-800 text-right">{selectedReceipt.account_number || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">IFSC Code</span>
                <span className="font-mono font-extrabold text-slate-800 text-right">{selectedReceipt.ifsc_code || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">UTR / Bank Ref</span>
                <span className="font-mono font-extrabold text-indigo-600 text-right">{getUtrDisplay(selectedReceipt)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Service Charge</span>
                <span className="font-extrabold text-slate-800 text-right">₹{Number(selectedReceipt.charge_amount || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Date & Time</span>
                <span className="font-extrabold text-slate-800 text-right">
                  {format(parseISO(selectedReceipt.created_at), 'dd MMM yyyy, hh:mm:ss a')}
                </span>
              </div>

              {getRemarkDisplay(selectedReceipt) && (
                <div className="flex justify-between items-start py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Remark / Reason</span>
                  <span className="font-semibold text-rose-600 text-right max-w-[200px]">{getRemarkDisplay(selectedReceipt)}</span>
                </div>
              )}
            </div>

            {/* Receipt Footer & Print Action */}
            <div className="pt-4 space-y-3">
              <button
                onClick={handlePrintReceipt}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-98 transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>Print Receipt</span>
              </button>
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Verified Payment Transaction</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
