import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  IndianRupee,
  RotateCcw,
  Download,
  Loader2,
  User,
  ExternalLink,
  Table as TableIcon,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  X,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QRPaymentRequest {
  id: string;
  user_id: string;
  utr_id: string;
  amount: number;
  charges: number;
  admin_share?: number;
  distributor_share?: number;
  super_distributor_share?: number;
  card_number: string;
  proof_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
  };
  qr_history?: {
    qr_name: string;
  };
}

export default function QRPaymentReport() {
  const [requests, setRequests] = useState<QRPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedProof, setSelectedProof] = useState<QRPaymentRequest | null>(null);
  const [fullTotals, setFullTotals] = useState({ amount: 0, admin: 0, distributor: 0, superDistributor: 0, final: 0 });
  const limit = 10;

  // Autocomplete state
  const [allFirms, setAllFirms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [allQrNames, setAllQrNames] = useState<string[]>([]);
  const [qrSuggestions, setQrSuggestions] = useState<string[]>([]);
  const [showQrSuggestions, setShowQrSuggestions] = useState(false);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [qrNameFilter, setQrNameFilter] = useState('');
  const [exactAmount, setExactAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchFirmNames = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('firm_name')
        .not('firm_name', 'is', null);
      if (error) throw error;
      const uniqueFirms = Array.from(new Set(data.map(d => d.firm_name))).sort();
      setAllFirms(uniqueFirms);
    } catch (err) {
      console.error('Error fetching firm names:', err);
    }
  };

  const fetchQrNames = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_history')
        .select('qr_name');
      if (error) throw error;
      const uniqueNames = Array.from(new Set(data.map(d => d.qr_name))).sort();
      setAllQrNames(uniqueNames);
    } catch (err) {
      console.error('Error fetching QR names:', err);
    }
  };

  useEffect(() => {
    fetchFirmNames();
    fetchQrNames();
  }, []);

  useEffect(() => {
    if (firmName.trim().length > 0) {
      const filtered = allFirms.filter(f =>
        f.toLowerCase().includes(firmName.toLowerCase())
      ).slice(0, 10);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [firmName, allFirms]);

  useEffect(() => {
    if (qrNameFilter.trim().length > 0) {
      const filtered = allQrNames.filter(n =>
        n.toLowerCase().includes(qrNameFilter.toLowerCase())
      ).slice(0, 10);
      setQrSuggestions(filtered);
    } else {
      setQrSuggestions([]);
    }
  }, [qrNameFilter, allQrNames]);

  const fetchRequests = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setOffset(0);
    }

    try {
      let selectQuery = '*, users_profiles!payment_submissions_user_id_fkey!inner(name, firm_name)';

      // Use !inner join ONLY when filtering by QR Name to avoid hiding legacy payments by default
      if (qrNameFilter) {
        selectQuery += ', qr_history!inner(qr_name)';
      } else {
        selectQuery += ', qr_history(qr_name)';
      }

      let query = supabase
        .from('payment_submissions')
        .select(selectQuery + ', admin_share, super_distributor_share, distributor_share')
        .order('created_at', { ascending: false });

      // Exclude rejected by default as per requirement
      query = query.neq('status', 'rejected');

      // Apply Filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (firmName) {
        query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      }
      if (qrNameFilter) {
        query = query.ilike('qr_history.qr_name', `%${qrNameFilter}%`);
      }
      if (exactAmount) {
        query = query.eq('amount', Number(exactAmount));
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const currentOffset = isLoadMore ? offset + limit : 0;
      const { data, error } = await query.range(currentOffset, currentOffset + limit - 1);

      if (error) throw error;

      if (isLoadMore) {
        setRequests(prev => [...prev, ...((data as any) || [])]);
      } else {
        setRequests((data as any) || []);
      }

      setHasMore(data?.length === limit);
      if (data?.length === limit) {
        setOffset(currentOffset);
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchFullTotals = async () => {
    try {
      let selectStr = 'amount, charges, admin_share, super_distributor_share, distributor_share';
      
      if (firmName) selectStr += ', users_profiles!payment_submissions_user_id_fkey!inner(firm_name)';
      else selectStr += ', users_profiles!payment_submissions_user_id_fkey(firm_name)';

      if (qrNameFilter) selectStr += ', qr_history!inner(qr_name)';
      else selectStr += ', qr_history(qr_name)';

      let query = supabase
        .from('payment_submissions')
        .select(selectStr)
        .neq('status', 'rejected');

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (firmName) query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      if (qrNameFilter) query = query.ilike('qr_history.qr_name', `%${qrNameFilter}%`);
      if (exactAmount) query = query.eq('amount', Number(exactAmount));
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

      // Handle pagination for totals (Supabase 1000 row limit bypass)
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
      }

      const totals = allData.reduce((acc, curr: any) => ({
        amount: acc.amount + Number(curr.amount || 0),
        admin: acc.admin + Number(curr.admin_share || 0),
        distributor: acc.distributor + Number(curr.distributor_share || 0),
        superDistributor: acc.superDistributor + Number(curr.super_distributor_share || 0),
        final: acc.final + (Number(curr.amount || 0) - Number(curr.charges || 0))
      }), { amount: 0, admin: 0, distributor: 0, superDistributor: 0, final: 0 });

      setFullTotals(totals);
    } catch (err) {
      console.error('Error fetching full totals:', err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchFullTotals();

    // Real-time listener for live total updates
    const channel = supabase
      .channel('qr_report_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_submissions' }, () => {
        fetchRequests();
        fetchFullTotals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, startDate, endDate, firmName, qrNameFilter, exactAmount]);

  const handleSearch = () => {
    fetchRequests();
    fetchFullTotals();
  };

  const handleReset = () => {
    setFirmName('');
    setQrNameFilter('');
    setExactAmount('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    fetchRequests();
  };

  const calculateTotals = (data: QRPaymentRequest[]) => {
    return data.reduce((acc, curr) => ({
      amount: acc.amount + Number(curr.amount || 0),
      admin: acc.admin + Number(curr.admin_share || 0),
      distributor: acc.distributor + Number(curr.distributor_share || 0),
      superDistributor: acc.superDistributor + Number(curr.super_distributor_share || 0),
      final: acc.final + (Number(curr.amount || 0) - Number(curr.charges || 0))
    }), { amount: 0, admin: 0, distributor: 0, superDistributor: 0, final: 0 });
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payment_submissions')
        .select('*, users_profiles!payment_submissions_user_id_fkey(firm_name), qr_history(qr_name)')
        .neq('status', 'rejected');

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (firmName) query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      if (qrNameFilter) query = query.ilike('qr_history.qr_name', `%${qrNameFilter}%`);
      if (exactAmount) query = query.eq('amount', Number(exactAmount));
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

      // Reuse pagination logic for export
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
      }

      const totals = allData.reduce((acc, curr: any) => ({
        amount: acc.amount + Number(curr.amount || 0),
        admin: acc.admin + Number(curr.admin_share || 0),
        distributor: acc.distributor + Number(curr.distributor_share || 0),
        superDistributor: acc.superDistributor + Number(curr.super_distributor_share || 0),
        final: acc.final + (Number(curr.amount || 0) - Number(curr.charges || 0))
      }), { amount: 0, admin: 0, distributor: 0, superDistributor: 0, final: 0 });

      const exportData = allData.map(req => ({
        'Date': new Date(req.created_at).toLocaleDateString(),
        'Firm Name': req.users_profiles?.firm_name || 'N/A',
        'UTR ID': req.utr_id,
        'QR Used': req.qr_history?.qr_name || 'Legacy',
        'Card No': req.card_number || '****',
        'Status': req.status.toUpperCase(),
        'Amount': Number(req.amount),
        'Admin Profit': Number(req.admin_share || 0),
        'Dist. Profit': Number(req.distributor_share || 0),
        'S.Dist. Profit': Number(req.super_distributor_share || 0),
        'Final Total': Number(req.amount) - Number(req.charges || 0)
      }));

      // Add totals row
      exportData.push({
        'Date': 'TOTAL',
        'Firm Name': '',
        'UTR ID': '',
        'QR Used': '',
        'Card No': '',
        'Status': '',
        'Amount': Number(totals.amount.toFixed(2)) as any,
        'Admin Profit': Number(totals.admin.toFixed(2)) as any,
        'Dist. Profit': Number(totals.distributor.toFixed(2)) as any,
        'S.Dist. Profit': Number(totals.superDistributor.toFixed(2)) as any,
        'Final Total': Number(totals.final.toFixed(2)) as any
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QR Payments');
      XLSX.writeFile(wb, `QR_Payment_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to export data.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payment_submissions')
        .select('*, users_profiles!payment_submissions_user_id_fkey(firm_name), qr_history(qr_name)')
        .neq('status', 'rejected');

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (firmName) query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      if (qrNameFilter) query = query.ilike('qr_history.qr_name', `%${qrNameFilter}%`);
      if (exactAmount) query = query.eq('amount', Number(exactAmount));
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
      }

      const totals = allData.reduce((acc, curr: any) => ({
        amount: acc.amount + Number(curr.amount || 0),
        admin: acc.admin + Number(curr.admin_share || 0),
        distributor: acc.distributor + Number(curr.distributor_share || 0),
        superDistributor: acc.superDistributor + Number(curr.super_distributor_share || 0),
        final: acc.final + (Number(curr.amount || 0) - Number(curr.charges || 0))
      }), { amount: 0, admin: 0, distributor: 0, superDistributor: 0, final: 0 });

      const doc = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      const tableData = allData.map(req => [
        new Date(req.created_at).toLocaleDateString(),
        req.users_profiles?.firm_name || 'N/A',
        req.utr_id,
        req.qr_history?.qr_name || 'Legacy',
        req.card_number || '****',
        req.status.toUpperCase(),
        req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        (req.admin_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        (req.distributor_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        (req.super_distributor_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        (Number(req.amount) - Number(req.charges || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]);

      const footer = [
        ['TOTAL', '', '', '', '', '',
          totals.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          totals.admin.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          totals.distributor.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          totals.superDistributor.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          totals.final.toLocaleString(undefined, { minimumFractionDigits: 2 })
        ]
      ];

      autoTable(doc, {
        head: [['Date', 'Firm Name', 'UTR ID', 'QR Used', 'Card No', 'Status', 'Amount', 'Admin Profit', 'Dist. Profit', 'S.Dist. Profit', 'Final Total']],
        body: tableData,
        foot: footer,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        margin: { top: 20 },
        didDrawPage: (data: any) => {
          doc.text('QR Payment Report', data.settings.margin.left, 12);
        }
      });

      doc.save(`QR_Payment_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Payment Report</h2>
          <p className="text-slate-500 mt-1">Review approved and pending QR transactions with detailed filtering.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-emerald-200"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-rose-200"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Firm Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search firm..."
                value={firmName}
                onChange={(e) => {
                  setFirmName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSuggestions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden"
                  >
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase px-2">Suggestions</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setFirmName(s);
                            setShowSuggestions(false);
                            // Auto-trigger search when selecting a suggestion
                            setTimeout(() => fetchRequests(), 0);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors group"
                        >
                          <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 truncate">
                            {s}
                          </span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Used QR</label>
            <div className="relative">
              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search QR..."
                value={qrNameFilter}
                onChange={(e) => {
                  setQrNameFilter(e.target.value);
                  setShowQrSuggestions(true);
                }}
                onFocus={() => setShowQrSuggestions(true)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* QR Name Suggestions Dropdown */}
            <AnimatePresence>
              {showQrSuggestions && qrSuggestions.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowQrSuggestions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden"
                  >
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase px-2">QR Suggestions</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                      {qrSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setQrNameFilter(s);
                            setShowQrSuggestions(false);
                            setTimeout(() => fetchRequests(), 0);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors group"
                        >
                          <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 truncate">
                            {s}
                          </span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Exact Amount</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="number"
                placeholder="Enter amount..."
                value={exactAmount}
                onChange={(e) => setExactAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="all">Approved & Pending</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-[38px] rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <Search size={16} />
              Filter
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white h-[38px]"
              title="Reset Filters"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none bg-transparent"
              />
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date / Firm</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">UTR ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Card No</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">QR Used</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Admin Profit</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Dist. Profit</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">S.Dist. Profit</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Final Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />
                    <p className="text-sm text-slate-500 mt-2 font-medium">Generating report...</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <QrCode className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No results found for the current filters</p>
                  </td>
                </tr>
              ) : (
                <>
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{req.users_profiles?.firm_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                          {req.utr_id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg">
                          {req.card_number || '****'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg flex items-center justify-center">
                          {req.qr_history?.qr_name || 'Legacy'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-slate-900">
                          ₹{req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-rose-500 font-bold text-sm">
                        ₹{(req.admin_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-amber-600 font-bold text-sm">
                        ₹{(req.distributor_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-pink-600 font-bold text-sm">
                        ₹{(req.super_distributor_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-bold text-sm">
                        ₹{(Number(req.amount) - Number(req.charges || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedProof(req)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-block transition-colors"
                          title="View Proof"
                        >
                          <ExternalLink size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Overall Totals Row */}
                  <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-100">
                    <td colSpan={2} className="px-6 py-4 text-indigo-900 text-sm">
                      {(firmName || qrNameFilter || exactAmount || startDate || endDate || statusFilter !== 'all') ? 'FILTERED TOTAL' : 'OVERALL TOTAL'}
                    </td>
                    <td colSpan={2} className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-right text-indigo-900 text-sm">
                      ₹{fullTotals.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-rose-700 text-sm">
                      ₹{fullTotals.admin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-amber-700 text-sm font-bold">
                      ₹{fullTotals.distributor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-pink-700 text-sm font-bold">
                      ₹{fullTotals.superDistributor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-900 text-sm font-black">
                      ₹{fullTotals.final.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchRequests(true)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
            Load More Data
          </button>
        </div>
      )}

      {/* Proof Preview Modal */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setSelectedProof(null)}
                  className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 bg-slate-50 flex items-center justify-center overflow-hidden p-2 md:p-4">
                <img
                  src={selectedProof.proof_url}
                  alt="Payment Proof"
                  className="max-w-full max-h-[calc(95vh-150px)] object-contain rounded-xl shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                      <Hash size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">UTR ID</p>
                      <p className="text-sm font-bold text-slate-900">{selectedProof.utr_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                      <IndianRupee size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Amount</p>
                      <p className="text-sm font-bold text-emerald-900">₹{selectedProof.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(selectedProof.proof_url);
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `proof-${selectedProof.utr_id}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      window.open(selectedProof.proof_url, '_blank');
                    }
                  }}
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
