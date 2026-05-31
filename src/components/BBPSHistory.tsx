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
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Shield,
  IndianRupee,
  User,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { LogoLoader } from './shared/LoadingSpinner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';

interface BBPSTransaction {
  id: string;
  user_id: string;
  service_type: string;
  provider: string;
  consumer_number: string;
  amount: number;
  charges: number;
  status: string;
  transaction_id?: string;
  rejection_reason?: string;
  created_at: string;
  metadata?: any;
  users_profiles?: {
    name: string;
    firm_name: string;
    profile_photo_url?: string;
  };
}

const getTodayStr = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export default function BBPSHistory() {
  const [transactions, setTransactions] = useState<BBPSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'failed'>('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedReceipt, setSelectedReceipt] = useState<BBPSTransaction | null>(null);
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});

  // Stats
  const [stats, setStats] = useState({
    count: 0,
    totalBase: 0,
    totalCharges: 0,
    totalDebited: 0
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilter('all');
    setDateFilter('today');
    setStartDate(getTodayStr());
    setEndDate(getTodayStr());
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    const today = new Date();
    
    const formatDate = (date: Date) => {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };

    if (value === 'today') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (value === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (value === 'last7') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (value === 'last30') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (value === 'all' || value === 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchTransactions = async (silent = false) => {
    if (!silent) setLoading(true);
    else setFetchingHistory(true);

    try {
      let query = supabase
        .from('bbps_submissions')
        .select('*, users_profiles!bbps_submissions_user_id_fkey(name, firm_name, profile_photo_url)');

      // Apply Status Filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      // Apply Search Filter (on user firm/name or biller details)
      if (searchQuery) {
        query = query.or(`consumer_number.ilike.%${searchQuery}%,provider.ilike.%${searchQuery}%,transaction_id.ilike.%${searchQuery}%,service_type.ilike.%${searchQuery}%`);
      }

      // Apply Date Filters
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
        console.log("[BBPSHistory] GTE Date:", startLocal.toISOString());
        query = query.gte('created_at', startLocal.toISOString());
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999);
        console.log("[BBPSHistory] LTE Date:", endLocal.toISOString());
        query = query.lte('created_at', endLocal.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      console.log("[BBPSHistory] Fetched Rows count:", data?.length, "Error:", error);

      if (error) throw error;

      // Filter locally for firm_name/name if search query is active
      let filteredData = data || [];
      if (searchQuery) {
        const term = searchQuery.toLowerCase();
        filteredData = filteredData.filter(item => 
          (item.users_profiles?.firm_name || '').toLowerCase().includes(term) ||
          (item.users_profiles?.name || '').toLowerCase().includes(term) ||
          (item.consumer_number || '').toLowerCase().includes(term) ||
          (item.provider || '').toLowerCase().includes(term) ||
          (item.transaction_id || '').toLowerCase().includes(term) ||
          (item.service_type || '').toLowerCase().includes(term)
        );
      }

      setTransactions(filteredData);

      // Calculate Stats
      const statsObj = filteredData.reduce((acc, curr) => {
        const amt = Number(curr.amount) || 0;
        const chg = Number(curr.charges) || 0;
        return {
          count: acc.count + 1,
          totalBase: acc.totalBase + amt,
          totalCharges: acc.totalCharges + chg,
          totalDebited: acc.totalDebited + (amt + chg)
        };
      }, { count: 0, totalBase: 0, totalCharges: 0, totalDebited: 0 });

      setStats(statsObj);

      // Fetch admin list if not present
      if (Object.keys(adminMap).length === 0) {
        const { data: admins } = await supabase.from('admin_profiles').select('mobile_number, name');
        const map: Record<string, string> = {};
        admins?.forEach(a => {
          map[a.mobile_number] = a.name || a.mobile_number;
        });
        setAdminMap(map);
      }

    } catch (err) {
      console.error('Error fetching admin BBPS history:', err);
    } finally {
      setLoading(false);
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin_bbps_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bbps_submissions'
      }, () => {
        fetchTransactions(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, searchQuery, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  // Export functions
  const exportToExcel = () => {
    try {
      const exportData = transactions.map(item => ({
        'Date': new Date(item.created_at).toLocaleDateString(),
        'Time': new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Firm Name': item.users_profiles?.firm_name || 'N/A',
        'User Name': item.users_profiles?.name || 'N/A',
        'Category': item.service_type.toUpperCase(),
        'Operator / Biller': item.provider,
        'Consumer Number': item.consumer_number,
        'Transaction UTR': item.transaction_id || 'N/A',
        'Base Amount': Number(item.amount),
        'Service Charge': Number(item.charges),
        'Debited Total': Number(item.amount) + Number(item.charges),
        'Status': item.status.toUpperCase()
      }));

      // Append Total row
      exportData.push({
        'Date': 'TOTAL',
        'Time': '',
        'Firm Name': '',
        'User Name': '',
        'Category': '',
        'Operator / Biller': '',
        'Consumer Number': '',
        'Transaction UTR': '',
        'Base Amount': Number(stats.totalBase.toFixed(2)),
        'Service Charge': Number(stats.totalCharges.toFixed(2)),
        'Debited Total': Number(stats.totalDebited.toFixed(2)),
        'Status': ''
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, 
        { wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, 
        { wch: 15 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BBPS Bill Payments');
      XLSX.writeFile(wb, `BBPS_Bill_History_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      const tableData = transactions.map(item => [
        format(parseISO(item.created_at), 'dd/MM/yyyy HH:mm'),
        item.users_profiles?.firm_name || 'N/A',
        item.service_type.toUpperCase(),
        item.provider,
        item.consumer_number,
        item.transaction_id || 'N/A',
        item.status.toUpperCase(),
        Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        Number(item.charges).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (Number(item.amount) + Number(item.charges)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);

      const footer = [
        [
          'TOTAL', '', '', '', '', '', '',
          stats.totalBase.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          stats.totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          stats.totalDebited.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]
      ];

      autoTable(doc, {
        head: [['Date / Time', 'Firm Name', 'Category', 'Operator / Biller', 'Consumer No', 'Transaction UTR', 'Status', 'Base Amount', 'Charge', 'Debited']],
        body: tableData,
        foot: footer,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { top: 20 },
        didDrawPage: (data: any) => {
          doc.text('BBPS Bill History Report', data.settings.margin.left, 12);
        }
      });

      doc.save(`BBPS_Bill_History_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    }
  };

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
            <Receipt className="text-indigo-600" size={28} />
            BBPS Bill History
          </h2>
          <p className="text-slate-500 mt-1">Monitor, filter, and export all real-time secure BBPS utility payments.</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-emerald-200 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-rose-200 cursor-pointer shadow-sm"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Payments</p>
            <p className="text-2xl font-black text-slate-950 leading-none">{stats.count}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Base Amount</p>
            <p className="text-2xl font-black text-slate-950 leading-none">₹{stats.totalBase.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Commission</p>
            <p className="text-2xl font-black text-slate-950 leading-none">₹{stats.totalCharges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Debited</p>
            <p className="text-2xl font-black text-slate-950 leading-none">₹{stats.totalDebited.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>

      {/* Filter and Query bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Quick Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="px-4 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="custom">Custom</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Start</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent leading-none"
                  />
                </div>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">End</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent leading-none"
                  />
                </div>
              </div>
            )}

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="approved">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <button
              onClick={clearFilters}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white cursor-pointer"
              title="Clear All Filters"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search Firm, Name, Operator, Consumer No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grid / Table container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        {fetchingHistory && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="bg-white p-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-center">
              <LogoLoader size="sm" />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-center">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Firm / Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator / Provider</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consumer Number</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction UTR</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Amt</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-rose-500">Charges</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                    <p className="text-xs text-slate-400 font-bold uppercase mt-3">Fetching transaction records...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center space-y-4 text-slate-400">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-700">No BBPS Transactions Found</h4>
                      <p className="text-xs text-slate-400 mt-1">Adjust filters or search parameters to locate entries.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* User Profile / Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 overflow-hidden shrink-0">
                          {item.users_profiles?.profile_photo_url ? (
                            <img src={item.users_profiles.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={16} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-none">
                            {item.users_profiles?.firm_name || item.users_profiles?.name || `User #${item.user_id.slice(0, 8)}`}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none">
                            {format(parseISO(item.created_at), 'dd MMM yyyy')} • {format(parseISO(item.created_at), 'hh:mm a')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 uppercase">
                        {item.service_type || 'Utility'}
                      </span>
                    </td>

                    {/* Provider */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-black text-slate-800 leading-snug">{item.provider}</p>
                    </td>

                    {/* Consumer No */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-slate-600 font-mono">{item.consumer_number}</p>
                    </td>

                    {/* Transaction ID */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100/50 w-fit mx-auto">
                        {item.transaction_id || 'N/A'}
                      </p>
                    </td>

                    {/* Amounts */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-slate-900">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-rose-600">₹{Number(item.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-black text-emerald-600">₹{(Number(item.amount) + Number(item.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        item.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {item.status === 'approved' ? 'Success' : item.status}
                      </span>
                    </td>

                    {/* Print Action */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedReceipt(item)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-all flex items-center justify-center mx-auto cursor-pointer border border-slate-200"
                        title="View & Print E-Receipt"
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP RECEIPT OVERLAY MODAL */}
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

              {/* Secure logo decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full flex items-center justify-center pointer-events-none print:hidden">
                <ShieldCheck size={18} className="text-emerald-500/20 translate-x-3 -translate-y-3" />
              </div>

              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-slate-200 pb-6 relative">
                <img src="/logo.png" alt="UsePay" className="absolute left-0 top-0 h-7 w-auto object-contain" />
                <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black uppercase tracking-[0.2em]">BBPS E-Receipt</span>
                <div className="text-3xl font-black text-slate-800 mt-4">
                  ₹{(Number(selectedReceipt.amount) + Number(selectedReceipt.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  (Base: ₹{Number(selectedReceipt.amount).toLocaleString('en-IN')} + Commission: ₹{Number(selectedReceipt.charges).toLocaleString('en-IN')})
                </p>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-2">Transaction Success</p>
              </div>

              {/* Slate Receipt detail rows */}
              <div className="space-y-4 text-xs font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Retailer / Firm</span>
                  <span className="font-black text-slate-800 text-right">
                    {selectedReceipt.users_profiles?.firm_name || selectedReceipt.users_profiles?.name || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Category</span>
                  <span className="font-black text-slate-800 text-right uppercase">
                    {selectedReceipt.service_type}
                  </span>
                </div>

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
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Transaction UTR</span>
                  <span className="font-black text-slate-800 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {selectedReceipt.transaction_id || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Date & Time</span>
                  <span className="font-black text-slate-800 text-right font-mono">
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
                <span>Ref ID: {(selectedReceipt.transaction_id || '').substring(0, 8)}</span>
              </div>

              {/* Print CTA */}
              <div className="pt-2 print:hidden">
                <button
                  onClick={handlePrint}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
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
