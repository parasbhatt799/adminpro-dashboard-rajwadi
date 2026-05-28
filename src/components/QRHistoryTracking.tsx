import { LogoLoader } from './shared/LoadingSpinner';
import {
  History,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Calendar,
  ChevronDown,
  RotateCcw,
  Pencil,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfYesterday,
  endOfYesterday,
  format,
  parseISO
} from 'date-fns';

const COLOR_PRIORITY: Record<string, number> = {
  pink: 1,
  indigo: 2,
  green: 3,
  yellow: 4,
  white: 5
};

interface QRHistoryItem {
  id: string;
  qr_name: string;
  qr_url: string;
  is_active: boolean;
  created_at: string;
  whatsapp_number?: string;
  profit_percentage?: number;
  counts?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    amount: number;
    admin_share: number;
    super_distributor_share: number;
    distributor_share: number;
  };
}

export default function QRHistoryTracking({ adminRole }: { adminRole?: string | null }) {
  const isFullAdmin = adminRole === 'full';
  const [loading, setLoading] = useState(true);
  const [qrHistory, setQrHistory] = useState<QRHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [historyUpdateLoading, setHistoryUpdateLoading] = useState(false);
  const [masterList, setMasterList] = useState<{ qr_name: string; mobile_number: string; qr_image_url: string; profit_percentage: number }[]>([]);
  const [showHistoryDropdownId, setShowHistoryDropdownId] = useState<string | null>(null);
  const [qrSearch, setQrSearch] = useState('');

  // History Filters
  const [historyTimeRange, setHistoryTimeRange] = useState<any>('today');
  const [historyCustomDates, setHistoryCustomDates] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [historyQrSearch, setHistoryQrSearch] = useState('');
  const [showHistoryFilter, setShowHistoryFilter] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const isDeveloper = localStorage.getItem('userId') === '9999099999';

  const fetchQRData = async () => {
    try {
      setHistoryLoading(true);

      let startDate: string | null = null;
      let endDate: string | null = null;
      const now = new Date();

      switch (historyTimeRange) {
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
          endDate = endOfYesterday().toISOString();
          break;
        case '30days':
          startDate = startOfDay(subDays(now, 30)).toISOString();
          endDate = endOfYesterday().toISOString();
          break;
        case 'custom':
          if (historyCustomDates.start && historyCustomDates.end) {
            startDate = startOfDay(parseISO(historyCustomDates.start)).toISOString();
            endDate = endOfDay(parseISO(historyCustomDates.end)).toISOString();
          }
          break;
      }

      // Single optimized RPC call
      const { data: history, error: rpcError } = await supabase.rpc('get_qr_history_with_stats', {
        time_start: startDate,
        time_end: endDate,
        search_term: historyQrSearch || ''
      });

      if (rpcError) throw rpcError;

      if (history) {
        const enrichedHistory = history.map((item: any) => ({
          ...item,
          counts: {
            total: Number(item.total_count),
            pending: Number(item.pending_count),
            approved: Number(item.approved_count),
            rejected: Number(item.rejected_count),
            amount: Number(item.total_amount),
            admin_share: Number(item.admin_share),
            super_distributor_share: Number(item.super_distributor_share || 0),
            distributor_share: Number(item.distributor_share),
          }
        }));

        // Filter: Only show rows that have activity in the selected time range
        const filtered = enrichedHistory.filter(item => {
          if (!isFullAdmin && item.qr_name?.toUpperCase() === 'MADHAV ENTERPRISE') {
            return false;
          }
          if (historyTimeRange === 'all') return true;
          return Number(item.total_count) > 0;
        });

        setQrHistory(filtered);
      } else {
        setQrHistory([]);
      }

    } catch (err) {
      console.error('Error in fetchQRData:', err);
      setError('Data loading error. Please check your internet connection.');
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  };

  const resetFilters = () => {
    setHistoryTimeRange('today');
    setHistoryQrSearch('');
    setShowHistoryFilter(false);
    setCurrentPage(1);
  };

  const fetchMasterList = async () => {
    try {
      const { data } = await supabase
        .from('qr_master')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      const sorted = (data || []).sort((a, b) => {
        const pA = COLOR_PRIORITY[a.bg_color || 'white'] || 5;
        const pB = COLOR_PRIORITY[b.bg_color || 'white'] || 5;
        if (pA !== pB) return pA - pB;
        return a.display_order - b.display_order;
      });

      setMasterList(sorted);
    } catch (err) {
      console.error('Error fetching master list:', err);
    }
  };

  const updateHistoryName = async (historyId: string, newName: string, newWhatsapp: string, percentage: number = 0) => {
    try {
      setHistoryUpdateLoading(true);
      const { error } = await supabase
        .from('qr_history')
        .update({
          qr_name: newName,
          whatsapp_number: newWhatsapp || null,
          profit_percentage: percentage
        })
        .eq('id', historyId);

      if (error) throw error;

      setSuccess('QR details updated successfully');
      setEditingHistoryId(null);
      fetchQRData(); 
    } catch (err) {
      console.error('Error updating history:', err);
      setError('Failed to update QR details');
    } finally {
      setHistoryUpdateLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = qrHistory.map(item => {
      const base = {
        'QR Name': item.qr_name,
        'Date': `${format(new Date(item.created_at), 'dd/MM/yyyy')} ${format(new Date(item.created_at), 'HH:mm')}`,
        'WhatsApp': item.whatsapp_number || '-',
        'Status': item.is_active ? 'Active' : 'Archived',
        'Total Entries': item.counts?.total || 0,
        'Approved Amount': item.counts?.amount || 0,
        'Pending / Approved / Rejected': `${item.counts?.pending || 0} / ` +
          `${item.counts?.approved || 0} / ` +
          `${item.counts?.rejected || 0}`
      };
      
      if (isFullAdmin) {
        return {
          ...base,
          'Admin Charge': item.counts?.admin_share || 0,
          'Super Distributor Charge': item.counts?.super_distributor_share || 0,
          'Distributor Charge': item.counts?.distributor_share || 0,
          'Total Charge': (item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0),
          'QR %': `${item.profit_percentage || 0}%`,
          'QR Profit': (item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100),
          'Admin Final Profit': ((item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0)) - ((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100))
        };
      } else {
        return {
          ...base,
          'QR %': `${item.profit_percentage || 0}%`,
          'QR Profit': (item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100)
        };
      }
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QR History");
    XLSX.writeFile(wb, `QR_Tracking_History_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  const deleteHistoryRow = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this QR history record?')) return;

    try {
      setHistoryLoading(true);
      const { error } = await supabase
        .from('qr_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('QR history record deleted successfully');
      fetchQRData();
    } catch (err) {
      console.error('Error deleting history:', err);
      setError('Failed to delete history record.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

      const headers = isFullAdmin 
        ? ['QR Name', 'Created At', 'WhatsApp', 'Status', 'Entries', 'Amount', 'P/A/R', 'Admin', 'S.Dist', 'Dist', 'Total', 'QR %', 'QR Profit', 'Final Profit']
        : ['QR Name', 'Created At', 'WhatsApp', 'Status', 'Entries', 'Amount', 'P/A/R', 'QR %', 'QR Profit'];

      const tableData = qrHistory.map(item => {
        const base = [
          item.qr_name,
          new Date(item.created_at).toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          item.whatsapp_number || '-',
          item.is_active ? 'Active' : 'Archived',
          item.counts?.total || 0,
          `₹${(item.counts?.amount || 0).toLocaleString('en-IN')}`,
          `${item.counts?.pending || 0} / ${item.counts?.approved || 0} / ${item.counts?.rejected || 0}`
        ];

        if (isFullAdmin) {
          return [
            ...base,
            `₹${(item.counts?.admin_share || 0).toLocaleString('en-IN')}`,
            `₹${(item.counts?.super_distributor_share || 0).toLocaleString('en-IN')}`,
            `₹${(item.counts?.distributor_share || 0).toLocaleString('en-IN')}`,
            `₹${((item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0)).toLocaleString('en-IN')}`,
            `${item.profit_percentage || 0}%`,
            `₹${((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100)).toLocaleString('en-IN')}`,
            `₹${(((item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0)) - ((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100))).toLocaleString('en-IN')}`
          ];
        } else {
          return [
            ...base,
            `${item.profit_percentage || 0}%`,
            `₹${((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100)).toLocaleString('en-IN')}`
          ];
        }
      });

      autoTable(doc, {
        head: [headers],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        styles: { fontSize: 7, cellPadding: 2 }
      });

      doc.save(`QR_Tracking_History_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Error:', err);
      setError('Failed to generate PDF');
    }
  };

  useEffect(() => {
    fetchQRData();
    fetchMasterList();

    // Debounced real-time listener to avoid heavy refetches
    let timeoutId: any;
    const channel = supabase
      .channel('qr_history_tracking_page')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_submissions'
      }, () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fetchQRData();
        }, 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timeoutId);
    };
  }, [historyTimeRange, historyCustomDates, historyQrSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LogoLoader size="md" className="mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Tracking History</h2>
          <p className="text-slate-500 mt-1">Monitor the overall performance and analytics per QR activation period.</p>
        </div>
        <button
          onClick={fetchQRData}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm flex items-center justify-center"
          title="Refresh Data"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-600 p-4 rounded-2xl text-sm font-bold shadow-sm"
          >
            <CheckCircle2 size={16} />
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-sm font-bold shadow-sm"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Table Section */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <History size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">History Log</h3>
              <p className="text-xs font-medium text-slate-400">Search and filter active/archived QR performance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
              <input
                type="text"
                placeholder="Search QR..."
                value={historyQrSearch}
                onChange={(e) => setHistoryQrSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 w-40 transition-all shadow-sm"
              />
            </div>

            {/* Time Range Selector */}
            <div className="relative">
              <button
                onClick={() => setShowHistoryFilter(!showHistoryFilter)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${historyTimeRange !== 'all'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                  }`}
              >
                <Calendar size={16} />
                {historyTimeRange === 'all' ? 'All Time' :
                  historyTimeRange === 'today' ? 'Today' :
                    historyTimeRange === 'yesterday' ? 'Yesterday' :
                      historyTimeRange === '7days' ? 'Last 7 Days' :
                        historyTimeRange === '30days' ? 'Last 30 Days' : 'Custom'}
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHistoryFilter ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showHistoryFilter && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowHistoryFilter(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 py-2"
                    >
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: '7days', label: 'Last 7 Days' },
                        { id: '30days', label: 'Last 30 Days' },
                        { id: 'custom', label: 'Custom Range' }
                      ].map((range) => (
                        <button
                          key={range.id}
                          onClick={() => {
                            setHistoryTimeRange(range.id);
                            setShowHistoryFilter(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors hover:bg-slate-50 ${historyTimeRange === range.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                        >
                          {range.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Date Range */}
            {historyTimeRange === 'custom' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm"
              >
                <input
                  type="date"
                  value={historyCustomDates.start}
                  onChange={(e) => setHistoryCustomDates(prev => ({ ...prev, start: e.target.value }))}
                  className="text-[10px] font-bold text-slate-600 px-1.5 py-1 outline-none rounded bg-slate-50 border-none"
                />
                <span className="text-slate-300 text-[10px]">to</span>
                <input
                  type="date"
                  value={historyCustomDates.end}
                  onChange={(e) => setHistoryCustomDates(prev => ({ ...prev, end: e.target.value }))}
                  className="text-[10px] font-bold text-slate-600 px-1.5 py-1 outline-none rounded bg-slate-50 border-none"
                />
              </motion.div>
            )}

            {/* Reset */}
            {(historyTimeRange !== 'all' || historyQrSearch) && (
              <button
                onClick={resetFilters}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                title="Reset Filters"
              >
                <RotateCcw size={16} />
              </button>
            )}

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95"
            >
              <FileSpreadsheet size={14} />
              <span>Excel</span>
            </button>

            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-100 active:scale-95"
            >
              <Download size={14} />
              <span>PDF</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm relative">
          {historyLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="bg-white p-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-center">
                <LogoLoader size="sm" />
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-1.5 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight">QR Name / Info</th>
                  <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Status</th>
                  <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Entries</th>
                  <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Appr. Amount</th>
                  <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight">Breakdown<br/>(P/A/R)</th>
                  {isFullAdmin && (
                    <>
                      <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Admin</th>
                      <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">S.Dist</th>
                      <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Dist.</th>
                      <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Total</th>
                    </>
                  )}
                  <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">QR %</th>
                  <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">QR Profit</th>
                  {isFullAdmin && (
                    <th className="px-1 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center">Final Profit</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {qrHistory.length === 0 ? (
                  <tr>
                    <td colSpan={isFullAdmin ? 12 : 7} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                      No QR history available.
                    </td>
                  </tr>
                ) : (
                  qrHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item) => (
                    <tr key={item.id} className={`${item.is_active ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'} transition-colors`}>
                        <td className="px-1.5 py-3">
                          {editingHistoryId === item.id ? (
                            <div className="flex flex-col gap-1 min-w-[150px] relative">
                            <button
                              type="button"
                              onClick={() => setShowHistoryDropdownId(showHistoryDropdownId === item.id ? null : item.id)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center justify-between"
                              disabled={historyUpdateLoading}
                            >
                              <span className="truncate">{item.qr_name}</span>
                              <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHistoryDropdownId === item.id ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                              {showHistoryDropdownId === item.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => {
                                    setShowHistoryDropdownId(null);
                                    setQrSearch('');
                                  }} />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute top-0 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden"
                                  >
                                    <div className="p-2 border-b border-slate-50">
                                      <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                        <input
                                          autoFocus
                                          type="text"
                                          placeholder="Search..."
                                          value={qrSearch}
                                          onChange={(e) => setQrSearch(e.target.value)}
                                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-50 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10"
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                      {masterList
                                        .filter(m => m.qr_name.toLowerCase().includes(qrSearch.toLowerCase()))
                                        .map((m, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                              updateHistoryName(item.id, m.qr_name, m.mobile_number, item.profit_percentage || 0);
                                              setShowHistoryDropdownId(null);
                                              setQrSearch('');
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                          >
                                            {m.qr_name}
                                          </button>
                                        ))}
                                    </div>
                                    <div className="p-1 border-t border-slate-50 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowHistoryDropdownId(null);
                                          setQrSearch('');
                                        }}
                                        className="px-2 py-1 text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>

                            <input
                              type="number"
                              placeholder="%"
                              defaultValue={item.profit_percentage || 0}
                              id={`percentage-${item.id}`}
                              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById(`percentage-${item.id}`) as HTMLInputElement;
                                updateHistoryName(item.id, item.qr_name, item.whatsapp_number || '', Number(input.value));
                              }}
                              className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-bold hover:bg-indigo-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingHistoryId(null);
                                setShowHistoryDropdownId(null);
                              }}
                              className="text-[10px] font-bold text-rose-500 hover:underline text-left px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/name">
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight uppercase">{item.qr_name}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                <p className="text-[10px] text-slate-400 font-bold whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                {item.whatsapp_number && (
                                  <div className="flex items-center gap-1">
                                    <Phone size={8} className="text-indigo-400" />
                                    <span className="text-[10px] text-indigo-500 font-black">{item.whatsapp_number}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isDeveloper && (
                              <>
                                <button
                                  onClick={() => setEditingHistoryId(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover/name:opacity-100 transition-all"
                                  title="Edit QR Name"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => deleteHistoryRow(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover/name:opacity-100 transition-all"
                                  title="Delete QR History"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-3 text-center">
                        <span className={`text-[9px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-full ${item.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {item.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-1 py-3 text-center">
                        <span className="text-xs font-bold text-slate-700">{item.counts?.total || 0}</span>
                      </td>
                      <td className="px-1 py-3 text-center">
                        <span className="text-xs font-bold text-emerald-600">₹{(item.counts?.amount || 0).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-1 py-3">
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] font-bold text-amber-500">{item.counts?.pending || 0}</span>
                          <span className="text-slate-200">/</span>
                          <span className="text-[10px] font-bold text-emerald-500">{item.counts?.approved || 0}</span>
                          <span className="text-slate-200">/</span>
                          <span className="text-[10px] font-bold text-rose-500">{item.counts?.rejected || 0}</span>
                        </div>
                      </td>
                      {isFullAdmin && (
                        <>
                          <td className="px-1 py-3 text-center">
                            <span className="text-xs font-bold text-indigo-600">₹{(item.counts?.admin_share || 0).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-1 py-3 text-center">
                            <span className="text-xs font-bold text-purple-600">₹{(item.counts?.super_distributor_share || 0).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-1 py-3 text-center">
                            <span className="text-xs font-bold text-orange-600">₹{(item.counts?.distributor_share || 0).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-1 py-3 text-center">
                            <span className="text-xs font-bold text-emerald-600">₹{((item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0)).toLocaleString('en-IN')}</span>
                          </td>
                        </>
                      )}
                      <td className="px-1 py-3 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-500">
                          {item.profit_percentage || 0}%
                        </span>
                      </td>
                      <td className="px-1 py-3 text-center">
                        <span className="text-xs font-bold text-rose-500">₹{((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100)).toLocaleString('en-IN')}</span>
                      </td>
                      {isFullAdmin && (
                        <td className="px-1 py-3 text-center">
                          <span className="text-xs font-bold text-indigo-600">₹{(((item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0)) - ((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100))).toLocaleString('en-IN')}</span>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {qrHistory.length > 0 && (
                <tfoot className="bg-slate-50/50 border-t-2 border-slate-100">
                  <tr className="font-black text-slate-700">
                    <td className="px-1.5 py-3 text-[9px] uppercase tracking-tight text-slate-400">Summary</td>
                    <td className="px-1 py-3 text-center">-</td>
                    <td className="px-1 py-3 text-center text-xs">
                      {qrHistory.reduce((sum, item) => sum + (item.counts?.total || 0), 0)}
                    </td>
                    <td className="px-1 py-3 text-center text-emerald-600 text-xs">
                      ₹{qrHistory.reduce((sum, item) => sum + (item.counts?.amount || 0), 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-1 py-3">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px] text-amber-500">{qrHistory.reduce((sum, item) => sum + (item.counts?.pending || 0), 0)}</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-[9px] text-emerald-500">{qrHistory.reduce((sum, item) => sum + (item.counts?.approved || 0), 0)}</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-[9px] text-rose-500">{qrHistory.reduce((sum, item) => sum + (item.counts?.rejected || 0), 0)}</span>
                      </div>
                    </td>
                    {isFullAdmin && (
                      <>
                        <td className="px-1 py-3 text-center text-indigo-600 text-xs">
                          ₹{qrHistory.reduce((sum, item) => sum + (item.counts?.admin_share || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-1 py-3 text-center text-purple-600 text-xs">
                          ₹{qrHistory.reduce((sum, item) => sum + (item.counts?.super_distributor_share || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-1 py-3 text-center text-orange-600 text-xs">
                          ₹{qrHistory.reduce((sum, item) => sum + (item.counts?.distributor_share || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-1 py-3 text-center text-emerald-600 text-xs">
                          ₹{qrHistory.reduce((sum, item) => sum + (item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0), 0).toLocaleString('en-IN')}
                        </td>
                      </>
                    )}
                    <td className="px-1 py-3 text-center text-slate-400">-</td>
                    <td className="px-1 py-3 text-center text-rose-500 text-xs">
                      ₹{qrHistory.reduce((sum, item) => sum + ((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100)), 0).toLocaleString('en-IN')}
                    </td>
                    {isFullAdmin && (
                      <td className="px-1 py-3 text-center text-indigo-700 text-xs">
                        ₹{qrHistory.reduce((sum, item) => sum + (((item.counts?.admin_share || 0) + (item.counts?.super_distributor_share || 0) + (item.counts?.distributor_share || 0)) - ((item.counts?.amount || 0) * ((item.profit_percentage || 0) / 100))), 0).toLocaleString('en-IN')}
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {qrHistory.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900">{Math.min(qrHistory.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to <span className="font-bold text-slate-900">{Math.min(qrHistory.length, currentPage * ITEMS_PER_PAGE)}</span> of <span className="font-bold text-slate-900">{qrHistory.length}</span> results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>

              {(() => {
                const totalPages = Math.ceil(qrHistory.length / ITEMS_PER_PAGE);
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + 4);

                if (endPage - startPage < 4) {
                  startPage = Math.max(1, endPage - 4);
                }

                return [...Array(endPage - startPage + 1)].map((_, i) => {
                  const page = startPage + i;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${currentPage === page
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600'
                        }`}
                    >
                      {page}
                    </button>
                  );
                });
              })()}

              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(qrHistory.length / ITEMS_PER_PAGE), prev + 1))}
                disabled={currentPage === Math.ceil(qrHistory.length / ITEMS_PER_PAGE)}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100/50">
        <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <AlertCircle size={18} />
          Tracking Logic
        </h4>
        <p className="text-sm text-indigo-700 leading-relaxed">
          Every QR you upload is tracked by its unique <strong>ID</strong>. When users submit payments, they are automatically linked to the QR that was <strong>Active</strong> at the time of submission. Toggling visibility "Off" does not change the tracking; new entries will still count towards the same QR ID until a new one is uploaded to replace it.
        </p>
      </div>
    </div>
  );
}
