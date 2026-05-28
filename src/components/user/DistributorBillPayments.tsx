import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  User,
  CreditCard,
  AlertCircle,
  ChevronUp,
  IndianRupee
} from 'lucide-react';
import { LogoLoader } from '../shared/LoadingSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface BillSubmission {
  id: string;
  user_id: string;
  customer_mobile: string;
  card_bank: string;
  card_number: string;
  card_owner_name: string;
  amount: number;
  charges: number;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  rejection_reason?: string;
  created_at: string;
  users_profiles: {
    name: string;
    firm_name: string;
  };
}

export default function DistributorBillPayments({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<BillSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('distributor');
  const [dateFilter, setDateFilter] = useState('today');
  const [amountFilter, setAmountFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter, amountFilter]);

  const getDateRange = (filter: string) => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (filter) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thismonth':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'lastmonth':
        start.setMonth(now.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'alltime':
      default:
        return null;
    }
    return { start, end };
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // 0. Get user role
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      const role = profile?.role || 'distributor';
      setCurrentUserRole(role);

      let query = supabase
        .from('bill_submissions')
        .select(`
          *,
          users_profiles!bill_submissions_user_id_fkey!inner(name, firm_name, distributor_id)
        `);

      if (role === 'super_distributor') {
        const { data: distributors } = await supabase
          .from('users_profiles')
          .select('id')
          .eq('super_distributor_id', userId)
          .eq('role', 'distributor');
        
        const distIds = (distributors || []).map(d => d.id);
        if (distIds.length === 0) {
          setSubmissions([]);
          return;
        }
        query = query.in('users_profiles.distributor_id', distIds);
      } else {
        query = query.eq('users_profiles.distributor_id', userId);
      }

      const range = getDateRange(dateFilter);
      if (range) {
        query = query
          .gte('created_at', range.start.toISOString())
          .lte('created_at', range.end.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching distributor bill payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [userId, dateFilter]);

  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = !searchQuery || 
      s.customer_mobile.includes(searchQuery) || 
      s.users_profiles.firm_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.card_owner_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAmount = !amountFilter || 
      s.amount.toString().includes(amountFilter);

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    
    return matchesSearch && matchesAmount && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Users Bill Payment History</h2>
        <p className="text-slate-500 mt-1">Review bill payment requests submitted by your users.</p>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
        {/* Date Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date Period</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer h-[42px]"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="thismonth">This Month</option>
            <option value="lastmonth">Last Month</option>
            <option value="alltime">All Time</option>
          </select>
        </div>

        {/* Amount Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount</label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="number"
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              placeholder="Filter amount..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[42px] font-semibold"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer h-[42px]"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="refunded">Refund Policy</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mobile, firm name..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[42px] font-semibold"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">User / Firm</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Customer / Bank</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Card Details</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Bill Amount</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Debited</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No bill payments found
                  </td>
                </tr>
              ) : (
                paginatedSubmissions.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                            <User size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{req.users_profiles.firm_name}</p>
                            <p className="text-[10px] text-slate-400">{new Date(req.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900">{req.card_bank}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{req.customer_mobile}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                          <CreditCard size={12} className="text-slate-400" />
                          {req.card_number}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium truncate max-w-[120px] mx-auto">{req.card_owner_name}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-slate-900 flex items-center justify-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {Number(req.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-indigo-600 flex items-center justify-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {(Number(req.amount) + Number(req.charges || 0)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                            req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                            req.status === 'refunded' ? 'bg-indigo-50 text-indigo-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {req.status === 'pending' && <Clock size={10} />}
                            {req.status === 'approved' && <CheckCircle2 size={10} />}
                            {req.status === 'rejected' && <XCircle size={10} />}
                            {req.status === 'refunded' && <RotateCcw size={10} />}
                            {req.status === 'refunded' ? 'Refund Policy' : req.status}
                          </span>
                          {req.status === 'rejected' && (
                            <button 
                              onClick={() => setExpandedRowId(expandedRowId === req.id ? null : req.id)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              {expandedRowId === req.id ? 'Hide' : 'Reason'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRowId === req.id && (
                      <tr>
                        <td colSpan={6} className="bg-rose-50/50 px-6 py-4 border-t border-rose-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600">
                              <AlertCircle size={16} />
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest block">Rejection Reason</span>
                              <span className="text-sm font-bold text-slate-900">{req.rejection_reason || 'No reason provided'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )))
              }
            </tbody>
          </table>
        </div>
      </div>

        {totalPages > 1 && (
          <div className="mt-6 px-6 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs font-bold text-slate-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none"
              >
                Previous
              </button>
              <div className="flex items-center gap-1.5">
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all select-none ${
                      currentPage === page
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
