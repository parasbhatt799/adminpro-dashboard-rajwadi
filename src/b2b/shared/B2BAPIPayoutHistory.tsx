import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Zap, Clock, CheckCircle2, XCircle, Search, RefreshCw, 
  Calendar, IndianRupee, Hash, X, Filter, ChevronLeft, 
  ChevronRight, User, Building2, Receipt, Copy, Download, 
  FileSpreadsheet, FileText, ArrowRightLeft, AlertCircle, Eye, Printer, Check, Send
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';

interface B2BAPIPayoutHistoryProps {
  isAdmin: boolean;
  agentId?: string; // Optional if isAdmin is false
}

interface PayoutTransaction {
  id: string;
  agent_id: string;
  order_id: string;
  client_order_id?: string;
  amount: number;
  fee: number;
  base_fee?: number;
  gst_amount?: number;
  total_deducted: number;
  beneficiary_name?: string;
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  transfer_mode?: string;
  status: 'success' | 'pending' | 'failed' | 'refunded';
  utr?: string;
  api_txn_id?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  request_payload?: any;
}

export default function B2BAPIPayoutHistory({ isAdmin, agentId }: B2BAPIPayoutHistoryProps) {
  const [payouts, setPayouts] = useState<PayoutTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed' | 'refunded'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'IMPS' | 'NEFT'>('all');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('all');

  // Agent Map for Admin Display
  const [agentMap, setAgentMap] = useState<Record<string, { b2b_login_id?: string; company_name?: string; name?: string }>>({});
  const [agentList, setAgentList] = useState<{ id: string; name: string; b2b_login_id?: string }[]>([]);

  // Action States
  const [selectedPayout, setSelectedPayout] = useState<PayoutTransaction | null>(null);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, customRange, statusFilter, modeFilter, selectedAgentFilter]);

  // Initial Load & Real-time Subscription
  useEffect(() => {
    fetchPayouts();

    // Subscribe to realtime updates on b2b_payout_transactions
    const channel = supabase
      .channel('b2b_payout_history_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_payout_transactions' },
        () => {
          fetchPayouts(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, agentId]);

  const fetchPayouts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let query = supabase
        .from('b2b_payout_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin && agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      const normalizedData = (data || []).map((item: any) => {
        const reqPayload = item.request_payload || {};
        const fee = item.fee !== undefined ? Number(item.fee) : (item.charge !== undefined ? Number(item.charge) : 0);
        const gstAmount = reqPayload.gst_amount !== undefined 
          ? Number(reqPayload.gst_amount) 
          : (item.gst_amount !== undefined ? Number(item.gst_amount) : Math.round((fee - (fee / 1.18)) * 100) / 100);
        const baseFee = reqPayload.base_fee !== undefined 
          ? Number(reqPayload.base_fee) 
          : (item.base_charge !== undefined ? Number(item.base_charge) : Math.round((fee / 1.18) * 100) / 100);

        return {
          ...item,
          fee,
          base_fee: baseFee,
          gst_amount: gstAmount,
          failure_reason: item.failure_reason || item.error_message || '',
          client_order_id: item.client_order_id || reqPayload?.client_order_id || ''
        };
      });
      setPayouts(normalizedData);

      // If Admin, load agent metadata map
      if (isAdmin) {
        const { data: agents } = await supabase
          .from('b2b_api_credentials')
          .select('id, b2b_login_id, first_name, last_name');

        if (agents) {
          const map: Record<string, { b2b_login_id?: string; company_name?: string; name?: string }> = {};
          const list: { id: string; name: string; b2b_login_id?: string }[] = [];

          agents.forEach((ag) => {
            const fullName = [ag.first_name, ag.last_name].filter(Boolean).join(' ').trim();
            const displayName = fullName || ag.b2b_login_id || 'B2B Partner';
            map[ag.id] = {
              b2b_login_id: ag.b2b_login_id || 'N/A',
              company_name: displayName,
              name: displayName
            };
            list.push({ id: ag.id, name: displayName, b2b_login_id: ag.b2b_login_id });
          });

          setAgentMap(map);
          setAgentList(list);
        }
      }
    } catch (err) {
      console.error('Error fetching payout transactions:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const [resendingWebhookOrderId, setResendingWebhookOrderId] = useState<string | null>(null);

  // Live Gateway Status Re-check
  const handleLiveStatusCheck = async (orderId: string) => {
    try {
      setCheckingOrderId(orderId);
      let res = await fetch(`/api/v1/b2b/admin/payout/status/${encodeURIComponent(orderId)}`);
      if (!res.ok && res.status === 404) {
        res = await fetch(`/api/b2b/admin/payout/status/${encodeURIComponent(orderId)}`);
      }
      const result = await res.json();

      if (res.ok && result.status === 'success') {
        alert(`Status Checked Successfully!\nStatus: ${result.data?.status?.toUpperCase() || 'UNKNOWN'}\nUTR: ${result.data?.utr || 'N/A'}`);
        fetchPayouts(true);
      } else {
        alert(result.message || result.error || 'Status check returned an error');
      }
    } catch (e: any) {
      console.error('Failed to check live payout status:', e);
      alert('Network error while checking payout status: ' + (e.message || ''));
    } finally {
      setCheckingOrderId(null);
    }
  };

  // Admin Resend Webhook to Partner
  const handleResendWebhook = async (orderId: string) => {
    try {
      setResendingWebhookOrderId(orderId);
      let res = await fetch('/api/v1/b2b/admin/payout/resend-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      if (!res.ok && res.status === 404) {
        res = await fetch('/api/b2b/admin/payout/resend-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId })
        });
      }
      const result = await res.json();

      if (res.ok && result.status === 'success') {
        alert(`✅ Webhook Delivered!\n\nTarget URL: ${result.data?.webhook_url}\nHTTP Response Status: ${result.data?.http_status}\nResponse: ${typeof result.data?.response_body === 'object' ? JSON.stringify(result.data?.response_body) : (result.data?.response_body || 'OK')}`);
      } else {
        alert(result.message || result.error || 'Failed to resend webhook. Check if agent has configured a Webhook URL.');
      }
    } catch (e: any) {
      console.error('Failed to resend webhook:', e);
      alert('Network error while resending webhook: ' + (e.message || ''));
    } finally {
      setResendingWebhookOrderId(null);
    }
  };

  // Filter Logic
  const filteredPayouts = useMemo(() => {
    const now = new Date();

    return payouts.filter((item) => {
      // 1. Agent Filter (Admin only)
      if (isAdmin && selectedAgentFilter !== 'all' && item.agent_id !== selectedAgentFilter) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const itemStatus = (item.status || 'pending').toLowerCase();
        if (itemStatus !== statusFilter) return false;
      }

      // 3. Mode Filter
      if (modeFilter !== 'all') {
        const itemMode = (item.transfer_mode || 'IMPS').toUpperCase();
        if (itemMode !== modeFilter) return false;
      }

      // 4. Date Range Filter
      if (item.created_at) {
        const itemDate = parseISO(item.created_at);
        if (dateFilter === 'today') {
          if (itemDate < startOfDay(now) || itemDate > endOfDay(now)) return false;
        } else if (dateFilter === 'yesterday') {
          const yesterday = subDays(now, 1);
          if (itemDate < startOfDay(yesterday) || itemDate > endOfDay(yesterday)) return false;
        } else if (dateFilter === '7days') {
          if (itemDate < subDays(now, 7)) return false;
        } else if (dateFilter === '30days') {
          if (itemDate < subDays(now, 30)) return false;
        } else if (dateFilter === 'thisMonth') {
          if (itemDate < startOfMonth(now)) return false;
        } else if (dateFilter === 'custom') {
          if (customRange.start && itemDate < startOfDay(parseISO(customRange.start))) return false;
          if (customRange.end && itemDate > endOfDay(parseISO(customRange.end))) return false;
        }
      }

      // 5. Search Bar Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const orderId = (item.order_id || '').toLowerCase();
        const clientOrderId = (item.client_order_id || '').toLowerCase();
        const benName = (item.beneficiary_name || '').toLowerCase();
        const accNo = (item.account_number || '').toLowerCase();
        const ifsc = (item.ifsc_code || '').toLowerCase();
        const utr = (item.utr || '').toLowerCase();
        const bank = (item.bank_name || '').toLowerCase();

        return (
          orderId.includes(term) ||
          clientOrderId.includes(term) ||
          benName.includes(term) ||
          accNo.includes(term) ||
          ifsc.includes(term) ||
          utr.includes(term) ||
          bank.includes(term)
        );
      }

      return true;
    });
  }, [payouts, isAdmin, selectedAgentFilter, statusFilter, modeFilter, dateFilter, customRange, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalVolume = 0;
    let totalFees = 0;
    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let refundedCount = 0;

    filteredPayouts.forEach((p) => {
      const amt = Number(p.amount) || 0;
      const fee = Number(p.fee) || 0;
      const status = (p.status || '').toLowerCase();

      if (status === 'success') {
        totalVolume += amt;
        totalFees += fee;
        successCount++;
      } else if (status === 'pending') {
        pendingCount++;
      } else if (status === 'refunded') {
        refundedCount++;
      } else if (status === 'failed') {
        failedCount++;
      }
    });

    return {
      totalVolume,
      totalFees,
      totalCount: filteredPayouts.length,
      successCount,
      pendingCount,
      failedCount,
      refundedCount
    };
  }, [filteredPayouts]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredPayouts.length / pageSize) || 1;
  const paginatedPayouts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayouts.slice(start, start + pageSize);
  }, [filteredPayouts, currentPage, pageSize]);

  // Export to Excel
  const exportToExcel = async () => {
    try {
      setExportingExcel(true);
      const XLSX = await import('xlsx');

      const dataRows = filteredPayouts.map((p, idx) => ({
        'S.No': idx + 1,
        'Date & Time': format(parseISO(p.created_at), 'dd MMM yyyy, hh:mm:ss a'),
        ...(isAdmin ? { 'Agent Name': agentMap[p.agent_id]?.name || 'B2B Agent', 'Login ID': agentMap[p.agent_id]?.b2b_login_id || 'N/A' } : {}),
        'Order ID': p.order_id,
        'Client Order ID': p.client_order_id || 'N/A',
        'Beneficiary Name': p.beneficiary_name || 'N/A',
        'Account Number': p.account_number || 'N/A',
        'IFSC Code': p.ifsc_code || 'N/A',
        'Bank Name': p.bank_name || 'N/A',
        'Transfer Mode': p.transfer_mode || 'IMPS',
        'Amount (₹)': Number(p.amount).toFixed(2),
        'Base Fee (₹)': Number(p.base_fee || 0).toFixed(2),
        'GST 18% (₹)': Number(p.gst_amount || 0).toFixed(2),
        'Total Fee (₹)': Number(p.fee).toFixed(2),
        'Total Deducted (₹)': Number(p.total_deducted).toFixed(2),
        'Bank UTR': p.utr || 'N/A',
        'Status': (p.status || 'PENDING').toUpperCase(),
        'Failure Reason': p.failure_reason || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payout History');

      XLSX.writeFile(workbook, `B2B_Payout_History_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to export Excel file');
    } finally {
      setExportingExcel(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      setExportingPdf(true);
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = (autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule) as any;

      const doc = new JsPDFClass({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 297, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('B2B Instant Payout Transaction Report', 14, 12);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Total Records: ${filteredPayouts.length} | Total Volume: Rs. ${metrics.totalVolume.toLocaleString('en-IN')}`, 14, 19);

      // Table Headers & Rows
      const tableHead = [
        ['#', 'Date & Time', ...(isAdmin ? ['Agent'] : []), 'Order ID', 'Beneficiary', 'Account / IFSC', 'Mode', 'Amount (Rs)', 'Fee', 'Total', 'Bank UTR', 'Status']
      ];

      const tableRows = filteredPayouts.map((p, idx) => [
        idx + 1,
        format(parseISO(p.created_at), 'dd/MM/yyyy HH:mm'),
        ...(isAdmin ? [agentMap[p.agent_id]?.name || 'Agent'] : []),
        p.order_id,
        p.beneficiary_name || 'N/A',
        `${p.account_number || ''}\n${p.ifsc_code || ''}`,
        p.transfer_mode || 'IMPS',
        Number(p.amount).toFixed(2),
        Number(p.fee).toFixed(2),
        Number(p.total_deducted).toFixed(2),
        p.utr || 'N/A',
        (p.status || 'PENDING').toUpperCase()
      ]);

      autoTable(doc, {
        startY: 28,
        head: tableHead,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 10, right: 10 }
      });

      doc.save(`B2B_Payout_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF document');
    } finally {
      setExportingPdf(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'success') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          SUCCESS
        </span>
      );
    }
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="h-3 w-3 text-amber-400 animate-spin" />
          PENDING
        </span>
      );
    }
    if (s === 'refunded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <ArrowRightLeft className="h-3 w-3 text-cyan-400" />
          REFUNDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="h-3 w-3 text-rose-400" />
        FAILED
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-800/90 border border-purple-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-36 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Zap className="h-3.5 w-3.5 text-purple-400" /> 24x7 Instant Bank Payouts
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {isAdmin ? 'B2B Admin Payout History' : 'My Payout Transactions History'}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-2xl">
              Audit log of 24x7 instant bank transfers via IMPS / NEFT, real-time bank UTR tracking, fees deducted, and receipt downloads.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              onClick={() => fetchPayouts()}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 transition-all cursor-pointer"
              title="Refresh Transactions"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={exportToExcel}
              disabled={exportingExcel || filteredPayouts.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold border border-emerald-500/30 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>

            <button
              onClick={exportToPDF}
              disabled={exportingPdf || filteredPayouts.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-bold border border-purple-500/30 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              {exportingPdf ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl shadow-lg">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Volume</span>
          <div className="text-xl font-black text-white">₹ {metrics.totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <span className="text-[10px] text-emerald-400 mt-1 block">Successful transfers</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl shadow-lg">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Count</span>
          <div className="text-xl font-black text-indigo-300">{metrics.totalCount}</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Payout requests</span>
        </div>

        <div className="bg-slate-800/80 border border-emerald-500/20 p-4 rounded-2xl shadow-lg bg-emerald-950/10">
          <span className="text-[11px] font-semibold text-emerald-300 block mb-1">Successful</span>
          <div className="text-xl font-black text-emerald-400">{metrics.successCount}</div>
          <span className="text-[10px] text-emerald-500/80 mt-1 block">Completed</span>
        </div>

        <div className="bg-slate-800/80 border border-amber-500/20 p-4 rounded-2xl shadow-lg bg-amber-950/10">
          <span className="text-[11px] font-semibold text-amber-300 block mb-1">Pending</span>
          <div className="text-xl font-black text-amber-400">{metrics.pendingCount}</div>
          <span className="text-[10px] text-amber-500/80 mt-1 block">Awaiting bank</span>
        </div>

        <div className="bg-slate-800/80 border border-rose-500/20 p-4 rounded-2xl shadow-lg bg-rose-950/10">
          <span className="text-[11px] font-semibold text-rose-300 block mb-1">Failed / Refund</span>
          <div className="text-xl font-black text-rose-400">{metrics.failedCount + metrics.refundedCount}</div>
          <span className="text-[10px] text-rose-400/80 mt-1 block">Wallet refunded</span>
        </div>

        <div className="bg-slate-800/80 border border-purple-500/20 p-4 rounded-2xl shadow-lg bg-purple-950/10">
          <span className="text-[11px] font-semibold text-purple-300 block mb-1">Slab Fees</span>
          <div className="text-xl font-black text-purple-400">₹ {metrics.totalFees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <span className="text-[10px] text-purple-400/80 mt-1 block">Charges collected</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-4">
        {/* Row 1: Search & Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Client ID, Name, Account, IFSC, or UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Transfer Mode Filter */}
          <div>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Modes (IMPS / NEFT)</option>
              <option value="IMPS">IMPS Only</option>
              <option value="NEFT">NEFT Only</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Filters & Admin Agent Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-700/60">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === tab.id
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Admin Agent Filter */}
          {isAdmin && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <User className="h-4 w-4 text-purple-400 shrink-0" />
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="all">All B2B Agents</option>
                {agentList.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.b2b_login_id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-700/60 bg-slate-900/40 p-3 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Select Range:</span>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-xs">Loading payout transactions...</span>
          </div>
        ) : paginatedPayouts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center p-6">
            <Zap className="h-12 w-12 text-slate-600 mb-3 opacity-40" />
            <h3 className="text-base font-bold text-white mb-1">No Payout Transactions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchTerm ? 'No transactions matched your search criteria.' : 'No instant payout transfers recorded for the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3.5 font-bold text-slate-400">Date & Time</th>
                  {isAdmin && <th className="px-4 py-3.5 font-bold text-purple-300">Agent Details</th>}
                  <th className="px-4 py-3.5 font-bold text-indigo-300">Order IDs</th>
                  <th className="px-4 py-3.5 font-bold text-slate-300">Beneficiary Information</th>
                  <th className="px-4 py-3.5 font-bold text-slate-400 text-center">Mode</th>
                  <th className="px-4 py-3.5 font-bold text-right text-emerald-400">Amount (₹)</th>
                  <th className="px-4 py-3.5 font-bold text-right text-purple-400">Fee (₹)</th>
                  <th className="px-4 py-3.5 font-bold text-right text-white">Total (₹)</th>
                  <th className="px-4 py-3.5 font-bold text-cyan-300">Bank UTR</th>
                  <th className="px-4 py-3.5 font-bold text-center text-slate-300">Status</th>
                  <th className="px-4 py-3.5 font-bold text-center text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 bg-slate-900/30">
                {paginatedPayouts.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                    {/* Date */}
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">
                        {format(parseISO(tx.created_at), 'dd MMM yyyy')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {format(parseISO(tx.created_at), 'hh:mm:ss a')}
                      </div>
                    </td>

                    {/* Agent Details (Admin Only) */}
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-white text-xs">
                          {agentMap[tx.agent_id]?.name || 'B2B Agent'}
                        </div>
                        <div className="text-[10px] font-mono text-purple-400">
                          {agentMap[tx.agent_id]?.b2b_login_id || 'ID: ' + tx.agent_id.substring(0, 8)}
                        </div>
                      </td>
                    )}

                    {/* Order ID & Client Order ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-mono font-bold text-indigo-300">
                        <span>{tx.order_id}</span>
                        <button
                          onClick={() => copyToClipboard(tx.order_id, `order_${tx.id}`)}
                          className="text-slate-500 hover:text-white"
                          title="Copy Order ID"
                        >
                          {copiedId === `order_${tx.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      {tx.client_order_id && (
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={tx.client_order_id}>
                          Ref: {tx.client_order_id}
                        </div>
                      )}
                    </td>

                    {/* Beneficiary Info */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">
                        {tx.beneficiary_name || 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <span>A/c: {tx.account_number}</span>
                        <button
                          onClick={() => copyToClipboard(tx.account_number || '', `acc_${tx.id}`)}
                          className="text-slate-500 hover:text-white"
                          title="Copy Account Number"
                        >
                          {copiedId === `acc_${tx.id}` ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {tx.ifsc_code} {tx.bank_name ? `• ${tx.bank_name}` : ''}
                      </div>
                    </td>

                    {/* Mode */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                        (tx.transfer_mode || 'IMPS').toUpperCase() === 'IMPS'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {tx.transfer_mode || 'IMPS'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      ₹ {Number(tx.amount).toFixed(2)}
                    </td>

                    {/* Fee */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-mono font-bold text-purple-300">
                        ₹ {Number(tx.fee).toFixed(2)}
                      </div>
                      {(tx.gst_amount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          ₹{(tx.base_fee || 0).toFixed(2)} + 18% GST
                        </div>
                      )}
                    </td>

                    {/* Total Deducted */}
                    <td className="px-4 py-3 text-right font-mono font-black text-white whitespace-nowrap">
                      ₹ {Number(tx.total_deducted).toFixed(2)}
                    </td>

                    {/* Bank UTR */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {tx.utr ? (
                        <div className="flex items-center gap-1 font-mono font-bold text-cyan-300">
                          <span>{tx.utr}</span>
                          <button
                            onClick={() => copyToClipboard(tx.utr || '', `utr_${tx.id}`)}
                            className="text-slate-500 hover:text-white"
                            title="Copy UTR"
                          >
                            {copiedId === `utr_${tx.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {getStatusBadge(tx.status)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View Receipt */}
                        <button
                          onClick={() => setSelectedPayout(tx)}
                          className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="View Payout Receipt"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Re-check live status button */}
                        <button
                          onClick={() => handleLiveStatusCheck(tx.order_id)}
                          disabled={checkingOrderId === tx.order_id}
                          className="p-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 hover:text-white transition-colors disabled:opacity-50"
                          title="Check Live Status with Gateway"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${checkingOrderId === tx.order_id ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Admin Resend Webhook */}
                        {isAdmin && (
                          <button
                            onClick={() => handleResendWebhook(tx.order_id)}
                            disabled={resendingWebhookOrderId === tx.order_id}
                            className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 hover:text-white transition-colors disabled:opacity-50"
                            title="Resend Webhook to Agent"
                          >
                            <Send className={`h-3.5 w-3.5 ${resendingWebhookOrderId === tx.order_id ? 'animate-pulse' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && filteredPayouts.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700/70 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <span className="text-white font-bold">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
              <span className="text-white font-bold">{Math.min(currentPage * pageSize, filteredPayouts.length)}</span> of{' '}
              <span className="text-white font-bold">{filteredPayouts.length}</span> transactions
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-bold text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Details / Receipt Modal */}
      {selectedPayout && (
        <Modal
          isOpen={!!selectedPayout}
          onClose={() => setSelectedPayout(null)}
          title="Instant Payout Receipt"
        >
          <div className="space-y-6 text-slate-200">
            {/* Receipt Header Badge */}
            <div className="text-center p-6 bg-slate-900/90 rounded-2xl border border-slate-700 space-y-2">
              <div className="inline-flex p-3 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 mb-1">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-2xl font-black text-white">
                ₹ {Number(selectedPayout.amount).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">
                Total Deducted: <span className="font-bold text-white">₹ {Number(selectedPayout.total_deducted).toFixed(2)}</span> (Fee: ₹ {Number(selectedPayout.fee).toFixed(2)})
              </div>
              <div className="pt-2">
                {getStatusBadge(selectedPayout.status)}
              </div>
            </div>

            {/* Receipt Fields Grid */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/80 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono font-bold text-indigo-300">{selectedPayout.order_id}</span>
              </div>

              {selectedPayout.client_order_id && (
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Client Order ID:</span>
                  <span className="font-mono font-semibold text-slate-200">{selectedPayout.client_order_id}</span>
                </div>
              )}

              {selectedPayout.utr && (
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Bank UTR Number:</span>
                  <span className="font-mono font-bold text-cyan-300">{selectedPayout.utr}</span>
                </div>
              )}

              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Beneficiary Name:</span>
                <span className="font-bold text-white">{selectedPayout.beneficiary_name}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Account Number:</span>
                <span className="font-mono font-bold text-slate-200">{selectedPayout.account_number}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">IFSC Code:</span>
                <span className="font-mono font-bold text-slate-200">{selectedPayout.ifsc_code}</span>
              </div>

              {selectedPayout.bank_name && (
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Bank Name:</span>
                  <span className="text-slate-200">{selectedPayout.bank_name}</span>
                </div>
              )}

              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Transfer Mode:</span>
                <span className="font-bold text-purple-300">{selectedPayout.transfer_mode || 'IMPS'}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Date & Time:</span>
                <span className="text-slate-300">{format(parseISO(selectedPayout.created_at), 'dd MMM yyyy, hh:mm:ss a')}</span>
              </div>

              {selectedPayout.failure_reason && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                  <strong className="block mb-1 text-rose-400">Failure Reason:</strong>
                  {selectedPayout.failure_reason}
                </div>
              )}
            </div>

            {/* Fee & Tax Breakdown Box */}
            <div className="bg-slate-900/90 rounded-xl p-4 border border-purple-500/30 space-y-2 text-xs">
              <div className="font-bold text-white text-xs border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <IndianRupee className="h-3.5 w-3.5 text-purple-400" />
                  Deduction & Tax Breakdown
                </span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-semibold">
                  18% GST Included
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Payout Transfer Amount:</span>
                <span className="font-mono font-bold text-white">₹ {Number(selectedPayout.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Base Slab Charge:</span>
                <span className="font-mono">₹ {Number(selectedPayout.base_fee || (selectedPayout.fee / 1.18)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>GST (18% on Slab Charge):</span>
                <span className="font-mono font-bold">+₹ {Number(selectedPayout.gst_amount || (selectedPayout.fee - (selectedPayout.fee / 1.18))).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-200 border-t border-slate-800 pt-1.5 font-bold">
                <span>Total Fee (Base + 18% GST):</span>
                <span className="font-mono text-purple-400">₹ {Number(selectedPayout.fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white border-t border-slate-700/80 pt-2 font-black text-sm">
                <span>Total Wallet Deducted:</span>
                <span className="font-mono text-emerald-400">₹ {Number(selectedPayout.total_deducted).toFixed(2)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              {isAdmin && (
                <button
                  onClick={() => handleResendWebhook(selectedPayout.order_id)}
                  disabled={resendingWebhookOrderId === selectedPayout.order_id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  title="Deliver Webhook Payload to Agent Endpoint"
                >
                  <Send className={`h-4 w-4 ${resendingWebhookOrderId === selectedPayout.order_id ? 'animate-pulse' : ''}`} />
                  {resendingWebhookOrderId === selectedPayout.order_id ? 'Sending Webhook...' : 'Resend Webhook'}
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print Slip
              </button>
              <button
                onClick={() => setSelectedPayout(null)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
