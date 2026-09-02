import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Search,
  Calendar,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  X,
  HelpCircle,
  TrendingDown,
  CheckCircle2,
  Filter,
  RotateCcw,
  Sparkles,
  Wallet
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { LogoLoader } from '../shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const getUtrOrTxnId = (item: any): string => {
  if (!item) return 'N/A';
  
  // Prioritize CC01 B-Connect Transaction Reference ID if available
  if (item.rejection_reason && String(item.rejection_reason).startsWith('CC01')) return item.rejection_reason;
  if (item.metadata?.txnRefId && String(item.metadata.txnRefId).startsWith('CC01')) return item.metadata.txnRefId;
  if (item.metadata?.txnid && String(item.metadata.txnid).startsWith('CC01')) return item.metadata.txnid;
  if (item.metadata?.bConnectTxnId && String(item.metadata.bConnectTxnId).startsWith('CC01')) return item.metadata.bConnectTxnId;
  if (item.metadata?.billerResponse?.txnRefId && String(item.metadata.billerResponse.txnRefId).startsWith('CC01')) return item.metadata.billerResponse.txnRefId;
  if (item.transaction_id && String(item.transaction_id).startsWith('CC01')) return item.transaction_id;

  // Fallback to rejection_reason or transaction_id if not BA- placeholder
  if (item.rejection_reason && item.rejection_reason !== 'N/A' && !String(item.rejection_reason).startsWith('BA-')) return item.rejection_reason;
  if (item.transaction_id && item.transaction_id !== 'N/A') return item.transaction_id;
  if (item.metadata?.txnid) return item.metadata.txnid;
  if (item.metadata?.rrn) return item.metadata.rrn;
  if (item.metadata?.reference) return item.metadata.reference;
  if (item.metadata?.utr) return item.metadata.utr;
  if (item.metadata?.billerResponse?.txnid) return item.metadata.billerResponse.txnid;
  if (item.metadata?.rawFetchData?.txnid) return item.metadata.rawFetchData.txnid;
  return 'N/A';
};

interface UserBillHistoryProps {
  userId: string;
}

export default function UserBillHistory({ userId }: UserBillHistoryProps) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all'>('today');
  const [amountFilter, setAmountFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const toast = useToast();

  // Advanced Search TXN States
  const [searchType, setSearchType] = useState<'txnId' | 'mobile'>('txnId');
  const [searchTxnId, setSearchTxnId] = useState<string>('');
  const [searchMobile, setSearchMobile] = useState<string>('');
  const [searchStartDate, setSearchStartDate] = useState<string>('');
  const [searchEndDate, setSearchEndDate] = useState<string>('');
  const [isAdvancedSearchActive, setIsAdvancedSearchActive] = useState<boolean>(false);

  // Fetch past bill submissions & wallet balance
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bbps_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching BBPS history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchHistory();
      supabase
        .from('users_profiles')
        .select('main_wallet')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.main_wallet !== undefined) {
            setWalletBalance(Number(data.main_wallet) || 0);
          }
        });
    }
  }, [userId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, amountFilter, search, isAdvancedSearchActive]);

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
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdDate >= firstDayOfMonth;
    }
    
    return true;
  };

  const handleAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdvancedSearchActive(true);
    toast.success('Filters applied successfully.');
  };

  const handleResetAdvancedSearch = () => {
    setSearchTxnId('');
    setSearchMobile('');
    setSearchStartDate('');
    setSearchEndDate('');
    setSearch('');
    setDateFilter('today');
    setAmountFilter('');
    setIsAdvancedSearchActive(false);
    toast.info('Search & filters reset.');
  };

  // Filter history based on search, date, and amount
  const filteredHistory = history.filter(item => {
    // 1. Transaction ID Filter (if filled in Txn ID mode)
    if (searchType === 'txnId' && searchTxnId.trim()) {
      const idTerm = searchTxnId.trim().toLowerCase();
      const utrOrId = getUtrOrTxnId(item).toLowerCase();
      const rawTxnId = (item.transaction_id || '').toLowerCase();
      const rawRef = (item.rejection_reason || '').toLowerCase();
      if (!utrOrId.includes(idTerm) && !rawTxnId.includes(idTerm) && !rawRef.includes(idTerm)) {
        return false;
      }
    }

    // 2. Mobile Filter (if filled in Mobile mode)
    if (searchType === 'mobile' && searchMobile.trim()) {
      const mobTerm = searchMobile.trim().toLowerCase();
      const consumerNo = (item.consumer_number || '').toString().toLowerCase();
      const custMobile = (item.metadata?.customerMobile || item.metadata?.customerNumber || item.metadata?.mobileNumber || item.metadata?.mobile || item.customer_mobile || '').toString().toLowerCase();
      const metaStr = JSON.stringify(item.metadata || {}).toLowerCase();
      if (!consumerNo.includes(mobTerm) && !custMobile.includes(mobTerm) && !metaStr.includes(mobTerm)) {
        return false;
      }
    }

    // 3. Custom Date Range Filter (if dates selected in Mobile mode)
    if (searchType === 'mobile' && item.created_at) {
      const itemMs = new Date(item.created_at).getTime();
      if (searchStartDate) {
        const startMs = new Date(`${searchStartDate}T00:00:00`).getTime();
        if (!isNaN(startMs) && itemMs < startMs) return false;
      }
      if (searchEndDate) {
        const endMs = new Date(`${searchEndDate}T23:59:59.999`).getTime();
        if (!isNaN(endMs) && itemMs > endMs) return false;
      }
    }

    // 4. Quick Date Range Filter (in Txn ID mode or when no custom dates)
    if (searchType === 'txnId' && dateFilter && dateFilter !== 'all') {
      if (!checkDateFilter(item.created_at, dateFilter)) return false;
    }

    // 5. Min Amount Filter
    if (amountFilter && Number(item.amount) < Number(amountFilter)) {
      return false;
    }

    // 6. Quick Text Search Filter
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchesSearch = (
        (item.provider || '').toLowerCase().includes(term) ||
        (item.consumer_number || '').toLowerCase().includes(term) ||
        (getUtrOrTxnId(item)).toLowerCase().includes(term) ||
        (item.service_type || '').toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8">

      {/* Header card with current balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 rounded-[32px] border border-slate-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <Sparkles size={12} className="animate-spin-slow" />
            Secure Gateway
          </span>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black text-white tracking-tight">
              Bharat Connect
            </h2>
          </div>
          <p className="text-slate-400 max-w-md text-sm leading-relaxed">
            View and print receipts of all your past utility bill payments with direct Bharat Connect settlement.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-3.5 bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 shadow-inner">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shadow-md">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Balance</p>
              <p className="text-xl font-black text-white">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Search & Filter Panel */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/80">
              <Filter size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Search & Filter Transactions</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Filter utility bills by Txn ID, Mobile, Date Range, or Amount</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 w-fit">
            <button
              type="button"
              onClick={() => setSearchType('txnId')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${searchType === 'txnId'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              B-Connect Txn ID
            </button>
            <button
              type="button"
              onClick={() => setSearchType('mobile')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${searchType === 'mobile'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Mobile & Date Range
            </button>
          </div>
        </div>

        <form onSubmit={handleAdvancedSearch}>
          {searchType === 'txnId' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end gap-4">
              {/* Txn ID Input */}
              <div className="lg:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">B-Connect Transaction ID</label>
                <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 flex items-center gap-3 focus-within:bg-white focus-within:border-indigo-500 transition-all">
                  <Search className="text-slate-400 shrink-0" size={16} />
                  <input
                    type="text"
                    value={searchTxnId}
                    onChange={(e) => setSearchTxnId(e.target.value)}
                    placeholder="Enter CC01... or Ref ID"
                    className="w-full text-xs outline-none font-semibold text-slate-800 bg-transparent placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Quick Date Range */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Quick Date</label>
                <select
                  value={dateFilter}
                  onChange={(e: any) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Min Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Min Amount (₹)</label>
                <input
                  type="number"
                  placeholder="Min amount..."
                  value={amountFilter}
                  onChange={(e) => setAmountFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-100 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Search size={16} />
                  Search
                </button>
                {(searchTxnId || dateFilter !== 'today' || amountFilter || isAdvancedSearchActive) && (
                  <button
                    type="button"
                    onClick={handleResetAdvancedSearch}
                    className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap"
                    title="Reset Filters"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end gap-4">
              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Customer Mobile</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={searchMobile}
                  onChange={(e) => setSearchMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white transition-all placeholder-slate-400"
                />
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Start Date</label>
                <input
                  type="date"
                  value={searchStartDate}
                  onChange={(e) => setSearchStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">End Date</label>
                <input
                  type="date"
                  value={searchEndDate}
                  onChange={(e) => setSearchEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {/* Min Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Min Amount (₹)</label>
                <input
                  type="number"
                  placeholder="Min amount..."
                  value={amountFilter}
                  onChange={(e) => setAmountFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-100 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Search size={16} />
                  Search
                </button>
                {(searchMobile || searchStartDate || searchEndDate || amountFilter || isAdvancedSearchActive) && (
                  <button
                    type="button"
                    onClick={handleResetAdvancedSearch}
                    className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap"
                    title="Reset Filters"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* History Table / Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center">
            <LogoLoader size="md" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-16 text-center space-y-4 text-slate-400">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <HelpCircle size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-700">No BBPS Transactions Found</h4>
              <p className="text-xs text-slate-400 mt-1">When you make bill payments, they will show up here.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-center">
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date / Time</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Ref</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mobile Number</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">B-Connect Transaction ID</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {paginatedHistory.map((item, idx) => {
                  const mobileNo = item.metadata?.customerMobile || item.metadata?.customerNumber || item.metadata?.mobileNumber || item.metadata?.mobile || item.customer_mobile || 'N/A';
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-center">
                        <p className="text-xs font-bold text-slate-900">{format(parseISO(item.created_at), 'dd MMM yyyy')}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{format(parseISO(item.created_at), 'hh:mm a')}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-50 text-indigo-600">
                          {item.service_type || 'Utility'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className="text-xs font-black text-slate-800">{item.provider}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className="text-xs font-bold text-slate-600">{item.consumer_number}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className="text-xs font-bold text-slate-700 font-mono">{mobileNo}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100/50 w-fit mx-auto">
                          {getUtrOrTxnId(item)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className="text-xs font-black text-slate-900">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          item.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => navigate(`/user/view-receipt?id=${item.transaction_id}`)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-all flex items-center justify-center mx-auto cursor-pointer"
                          title="View & Print E-Receipt"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredHistory.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-bold">
            Showing <span className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="text-slate-800">
              {Math.min(currentPage * itemsPerPage, filteredHistory.length)}
            </span>{' '}
            of <span className="text-slate-800">{filteredHistory.length}</span> bills
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 disabled:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200/50 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 disabled:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200/50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
