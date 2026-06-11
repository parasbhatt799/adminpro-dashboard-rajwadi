import React, { useState, useEffect } from 'react';
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
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { LogoLoader } from '../shared/LoadingSpinner';

interface UserBillHistoryProps {
  userId: string;
}

export default function UserBillHistory({ userId }: UserBillHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all'>('today');
  const [amountFilter, setAmountFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Fetch past bill submissions
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
    }
  }, [userId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, amountFilter, search]);

  const handlePrint = () => {
    window.print();
  };

  const checkDateFilter = (createdAtStr: string, filter: string) => {
    if (filter === 'all') return true;
    
    const createdDate = new Date(createdAtStr);
    const now = new Date();
    
    // Set to midnight for proper day comparisons
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

  // Filter history based on search, date, and amount
  const filteredHistory = history.filter(item => {
    const term = search.toLowerCase();
    const matchesSearch = (
      (item.provider || '').toLowerCase().includes(term) ||
      (item.consumer_number || '').toLowerCase().includes(term) ||
      (item.transaction_id || '').toLowerCase().includes(term) ||
      (item.service_type || '').toLowerCase().includes(term)
    );

    const matchesDate = checkDateFilter(item.created_at, dateFilter);
    const matchesAmount = amountFilter ? Number(item.amount) >= Number(amountFilter) : true;

    return matchesSearch && matchesDate && matchesAmount;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8">
      {/* Dynamic print-only styling */}
      <AnimatePresence>
        {selectedReceipt && (
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #history-receipt-modal, #history-receipt-modal * {
                visibility: visible !important;
              }
              #history-receipt-modal {
                position: absolute !important;
                left: 50% !important;
                top: 20px !important;
                transform: translateX(-50%) !important;
                width: 100% !important;
                max-width: 450px !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
              }
              html, body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          `}} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Receipt className="text-emerald-500" size={28} />
            BBPS Bill History
          </h2>
          <p className="text-slate-500 mt-1">View and print receipts of all your past utility bill payments.</p>
        </div>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Search</label>
          <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 flex items-center gap-3">
            <Search className="text-slate-400 shrink-0" size={18} />
            <input
              type="text"
              placeholder="Search operator, consumer ID, UTR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs outline-none font-semibold text-slate-700 bg-transparent placeholder-slate-400"
            />
          </div>
        </div>

        {/* Date Filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Date Range</label>
          <select
            value={dateFilter}
            onChange={(e: any) => setDateFilter(e.target.value)}
            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
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
            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-400"
          />
        </div>
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
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date / Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Ref</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {paginatedHistory.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-slate-900">{format(parseISO(item.created_at), 'dd MMM yyyy')}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{format(parseISO(item.created_at), 'hh:mm a')}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-50 text-indigo-600">
                        {item.service_type || 'Utility'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-black text-slate-800">{item.provider}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-slate-600">{item.consumer_number}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100/50 w-fit mx-auto">
                        {item.transaction_id || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-black text-slate-900">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        item.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedReceipt(item)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-all flex items-center justify-center mx-auto cursor-pointer"
                        title="View & Print E-Receipt"
                      >
                        <Printer size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
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

      {/* GORGEOUS POPUP RECEIPT OVERLAY MODAL */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark background blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReceipt(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm print:hidden"
            />

            {/* Receipt container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md bg-white border border-slate-200 rounded-[36px] p-8 shadow-2xl space-y-6 print:border-0 print:shadow-none"
              id="history-receipt-modal"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all print:hidden cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Watermark logo decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full flex items-center justify-center pointer-events-none print:hidden">
                <ShieldCheck size={18} className="text-emerald-500/20 translate-x-3 -translate-y-3" />
              </div>

              {/* E-receipt layout header */}
              <div className="text-center border-b border-dashed border-slate-200 pb-6">
                <div className="flex flex-col items-center justify-center gap-3">
                  <img src="/logo_receipt.png" alt="UsePay" className="h-10 w-auto object-contain" />
                  <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black uppercase tracking-[0.2em]">BBPS E-Receipt</span>
                </div>
                <div className="text-3xl font-black text-slate-800 mt-4">
                  ₹{Number(selectedReceipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-1">Transaction Success</p>
              </div>

              {/* Slate Receipt detail rows */}
              <div className="space-y-4 text-xs font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Operator</span>
                  <span className="font-black text-slate-800 text-right">
                    {selectedReceipt.metadata?.billerName || selectedReceipt.provider}
                  </span>
                </div>

                {/* Display consumer parameters */}
                {selectedReceipt.metadata?.consumerDetails ? (
                  Object.entries(selectedReceipt.metadata.consumerDetails).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">{key}</span>
                      <span className="font-black text-slate-800 text-right">{String(val)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Consumer ID</span>
                    <span className="font-black text-slate-800 text-right">{selectedReceipt.consumer_number}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Transaction ID</span>
                  <span className="font-black text-slate-800 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {selectedReceipt.transaction_id || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Date & Time</span>
                  <span className="font-black text-slate-800 text-right">
                    {selectedReceipt.metadata?.date || format(parseISO(selectedReceipt.created_at), 'dd/MM/yyyy, hh:mm a')}
                  </span>
                </div>
              </div>

              {/* Secure footer mark */}
              <div className="border-t border-slate-100 pt-6 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  Secure BBPS Gateway
                </div>
                <span>Reference ID: {(selectedReceipt.transaction_id || '').substring(0, 8)}</span>
              </div>

              {/* Print CTA */}
              <div className="pt-2 print:hidden">
                <button
                  onClick={handlePrint}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Printer size={16} />
                  Print Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
