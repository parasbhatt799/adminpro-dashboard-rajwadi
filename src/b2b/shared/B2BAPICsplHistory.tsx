import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Zap, Clock, CheckCircle2, XCircle, Search, RefreshCw, 
  Calendar, IndianRupee, Hash, X, Filter, ChevronLeft, 
  ChevronRight, User, Building2, Receipt, Copy, Download, 
  FileSpreadsheet, FileText, Smartphone, ArrowRightLeft, Eye, Check
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';

interface B2BAPICsplHistoryProps {
  isAdmin: boolean;
  agentId?: string; // Optional if isAdmin is false
}

interface CsplLogEntry {
  id: string;
  created_at: string;
  agent_id: string;
  endpoint: string;
  request_payload?: any;
  response_payload?: any;
  request_body?: any;
  response_body?: any;
  status_code: number;
  payment_status?: string;
  developer_charge?: number;
  owner_charge?: number;
  charge_deducted?: number;
}

export default function B2BAPICsplHistory({ isAdmin, agentId }: B2BAPICsplHistoryProps) {
  const [logs, setLogs] = useState<CsplLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');
  const [amountFilter, setAmountFilter] = useState('');
  const [chargeFilter, setChargeFilter] = useState('');
  const [txnIdFilter, setTxnIdFilter] = useState('');
  const [b2bLoginFilter, setB2bLoginFilter] = useState('all');

  // Agent Map for Admin Display
  const [agentMap, setAgentMap] = useState<Record<string, { b2b_login_id?: string; name?: string }>>({});

  // Action States
  const [selectedLog, setSelectedLog] = useState<CsplLogEntry | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, customRange, statusFilter, b2bLoginFilter, amountFilter, chargeFilter, txnIdFilter]);

  useEffect(() => {
    fetchLogs();

    // Subscribe to realtime updates on b2b_api_logs
    const channel = supabase
      .channel('b2b_cspl_history_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_api_logs' },
        () => {
          fetchLogs(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, agentId, dateFilter, customRange]);

  const fetchLogs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      let startDateIso: string | null = null;
      let endDateIso: string | null = null;
      const now = new Date();

      if (dateFilter === 'today') {
        startDateIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
        endDateIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      } else if (dateFilter === 'yesterday') {
        const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        startDateIso = yStart.toISOString();
        endDateIso = yEnd.toISOString();
      } else if (dateFilter === '7days') {
        startDateIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === '30days') {
        startDateIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === 'thisMonth') {
        startDateIso = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
      } else if (dateFilter === 'custom') {
        if (customRange.start) {
          startDateIso = new Date(`${customRange.start}T00:00:00`).toISOString();
        }
        if (customRange.end) {
          endDateIso = new Date(`${customRange.end}T23:59:59.999`).toISOString();
        }
      }

      let allLogs: CsplLogEntry[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      let safetyCounter = 0;
      const maxPages = 50;

      while (hasMore && safetyCounter < maxPages) {
        safetyCounter++;
        let query = supabase
          .from('b2b_api_logs')
          .select('*')
          .or("endpoint.eq./api/b2b/cspl/pay-bill,endpoint.eq./api/v1/b2b/cspl/pay-bill")
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (!isAdmin && agentId) {
          query = query.eq('agent_id', agentId);
        }

        if (startDateIso) query = query.gte('created_at', startDateIso);
        if (endDateIso) query = query.lte('created_at', endDateIso);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allLogs = allLogs.concat(data);
          if (data.length < step) hasMore = false;
          else from += step;
        } else {
          hasMore = false;
        }
      }

      setLogs(allLogs);

      // Fetch agent map if admin
      if (isAdmin) {
        try {
          const { data: creds } = await supabase
            .from('b2b_api_credentials')
            .select('id, agent_id, b2b_login_id, first_name, last_name');

          if (creds) {
            const map: Record<string, { b2b_login_id?: string; name?: string }> = {};
            creds.forEach((c: any) => {
              const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
              const info = { b2b_login_id: c.b2b_login_id || 'N/A', name: fullName };
              if (c.id) map[c.id] = info;
              if (c.agent_id) map[c.agent_id] = info;
            });
            setAgentMap(map);
          }
        } catch (e) {
          console.error('Error fetching agent map:', e);
        }
      }
    } catch (err) {
      console.error('Error fetching CSPL logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (statusCode: number, responseBody: any, paymentStatus?: string) => {
    const rawStatus = (responseBody?.payment_status || responseBody?.status || paymentStatus || '').toLowerCase();
    const responseCode = String(responseBody?.responseCode || responseBody?.data?.responseCode || '').trim();
    const isSuccess =
      rawStatus === 'success' ||
      rawStatus === 'successful' ||
      responseCode === '000' ||
      (statusCode === 200 && rawStatus !== 'failed' && rawStatus !== 'error');

    const isPending = rawStatus === 'pending' || (statusCode === 202 && !isSuccess);

    if (isSuccess) {
      return {
        text: 'Success',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      };
    }
    if (isPending) {
      return {
        text: 'Pending',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        icon: <Clock className="w-4 h-4 text-amber-400" />
      };
    }
    return {
      text: 'Failed',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      icon: <XCircle className="w-4 h-4 text-rose-400" />
    };
  };

  const handleLiveCheck = async (log: CsplLogEntry) => {
    try {
      const req = log.request_payload || log.request_body || {};
      const res = log.response_payload || log.response_body || {};
      const transactionId = req?.transaction_id || res?.transaction_id || req?.client_transaction_id || log.id;

      if (!transactionId) {
        alert('Transaction ID not found for this log.');
        return;
      }

      setUpdatingStatus(log.id);
      const API_URL = import.meta.env.VITE_API_URL || '';

      let resData = await fetch(`${API_URL}/api/v1/b2b/cspl/status/${transactionId}`);
      if (!resData.ok && resData.status === 404) {
        resData = await fetch(`${API_URL}/api/b2b/cspl/status/${transactionId}`);
      }
      const data = await resData.json();

      if (data.status === 'success' || data.data) {
        await fetchLogs(true);
        const currentStatus = data.data?.status || data.data?.payment_status || 'CHECKED';
        const msg = data.data?.message ? `\nNote: ${data.data.message}` : '';
        alert(`Current CSPL Status: ${currentStatus}${msg}\nOur database was synced automatically!`);
      } else {
        const errorText = data?.message || data?.error || 'Unable to check status online.';
        alert(`Status Check: ${errorText}`);
      }
    } catch (err: any) {
      console.error('Live CSPL status check error:', err);
      alert('Error connecting to CSPL status service');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Compute unique B2B login IDs for admin filter
  const uniqueLoginIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(agentMap).forEach(info => {
      if (info.b2b_login_id && info.b2b_login_id !== 'N/A') set.add(info.b2b_login_id);
    });
    logs.forEach(log => {
      const loginId = agentMap[log.agent_id]?.b2b_login_id;
      if (loginId && loginId !== 'N/A') set.add(loginId);
    });
    return Array.from(set).sort();
  }, [agentMap, logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const req = log.request_payload || log.request_body || {};
      const res = log.response_payload || log.response_body || {};
      const amount = req?.amount !== undefined && req?.amount !== null ? String(req.amount) : '';
      const txnId = req?.transaction_id || res?.transaction_id || req?.client_transaction_id || '';
      const statusInfo = getStatusInfo(log.status_code, res, log.payment_status);

      // Status Filter
      if (statusFilter !== 'all' && statusInfo.text.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Admin Login Filter
      if (isAdmin && b2bLoginFilter !== 'all') {
        const loginId = agentMap[log.agent_id]?.b2b_login_id || '';
        if (loginId.toLowerCase() !== b2bLoginFilter.toLowerCase()) return false;
      }

      // Amount Filter
      if (amountFilter.trim()) {
        const numeric = Number(amountFilter.trim());
        if (!isNaN(numeric)) {
          if (!amount.includes(amountFilter.trim()) && Math.abs(Number(amount) - numeric) >= 0.01) return false;
        } else if (!amount.includes(amountFilter.trim())) {
          return false;
        }
      }

      // Charge Filter
      if (chargeFilter.trim()) {
        const chg = Number(log.charge_deducted || req?.chargeDeducted || req?.chargePerBill || 0);
        if (!chg.toString().includes(chargeFilter.trim())) return false;
      }

      // Transaction ID Filter
      if (txnIdFilter.trim() && !txnId.toLowerCase().includes(txnIdFilter.trim().toLowerCase())) {
        return false;
      }

      // Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const info = agentMap[log.agent_id];
        const searchString = `
          ${log.agent_id || ''}
          ${info?.b2b_login_id || ''}
          ${info?.name || ''}
          ${req.billerId || ''}
          ${req.billerName || ''}
          ${req.mobile || ''}
          ${req.consumerNumber || ''}
          ${txnId}
        `.toLowerCase();
        if (!searchString.includes(term)) return false;
      }

      return true;
    });
  }, [logs, statusFilter, b2bLoginFilter, amountFilter, chargeFilter, txnIdFilter, searchTerm, agentMap, isAdmin]);

  // Summary Metrics
  const stats = useMemo(() => {
    let successCount = 0;
    let successAmount = 0;
    let successCharge = 0;
    let successDevCharge = 0;
    let successOwnerCharge = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let failedCount = 0;
    let failedAmount = 0;

    filteredLogs.forEach(log => {
      const req = log.request_payload || log.request_body || {};
      const res = log.response_payload || log.response_body || {};
      const amt = Number(req.amount || 0);
      const statusInfo = getStatusInfo(log.status_code, res, log.payment_status);
      const isSuccess = statusInfo.text === 'Success';
      const chg = !isSuccess ? 0 : Number(log.charge_deducted || req.chargeDeducted || req.chargePerBill || 0);
      const devChg = !isSuccess ? 0 : Number(log.developer_charge || req.developerCharge || 0);
      const ownerChg = !isSuccess ? 0 : Number(log.owner_charge || req.ownerCharge || Math.max(0, chg - devChg));

      if (isSuccess) {
        successCount++;
        successAmount += amt;
        successCharge += chg;
        successDevCharge += devChg;
        successOwnerCharge += ownerChg;
      } else if (statusInfo.text === 'Pending') {
        pendingCount++;
        pendingAmount += amt;
      } else {
        failedCount++;
        failedAmount += amt;
      }
    });

    return {
      successCount,
      successAmount,
      successCharge,
      successDevCharge,
      successOwnerCharge,
      pendingCount,
      pendingAmount,
      failedCount,
      failedAmount,
      totalCount: filteredLogs.length,
      totalVolume: successAmount + pendingAmount + failedAmount
    };
  }, [filteredLogs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const XLSX = await import('xlsx');
      const rows = filteredLogs.map((log, index) => {
        const req = log.request_payload || log.request_body || {};
        const res = log.response_payload || log.response_body || {};
        const statusInfo = getStatusInfo(log.status_code, res, log.payment_status);
        const agentInfo = agentMap[log.agent_id];

        return {
          'Sr No': index + 1,
          'Date & Time': format(parseISO(log.created_at), 'dd/MM/yyyy hh:mm a'),
          ...(isAdmin ? { 'B2B Login ID': agentInfo?.b2b_login_id || log.agent_id, 'Agent Name': agentInfo?.name || '' } : {}),
          'Biller ID': req.billerId || 'N/A',
          'Biller Name': req.billerName || '',
          'Mobile / Consumer': req.mobile || req.consumerNumber || 'N/A',
          'Bill Amount (₹)': Number(req.amount || 0),
          'Charge (₹)': Number(log.charge_deducted || req.chargeDeducted || 0),
          ...(isAdmin ? {
            'Dev Charge (₹)': Number(log.developer_charge || 0),
            'Owner Charge (₹)': Number(log.owner_charge || 0)
          } : {}),
          'API Txn ID': req.transaction_id || res.transaction_id || log.id,
          'Client Txn ID': req.client_transaction_id || '',
          'Status': statusInfo.text.toUpperCase()
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CSPL Bills');
      XLSX.writeFile(wb, `CSPL_Bill_History_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Failed to export Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  // PDF Export
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text('CSPL Fast Bill Payment History', 14, 15);
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Total Bills: ${filteredLogs.length} | Success Volume: Rs. ${stats.successAmount.toFixed(2)}`, 14, 22);

      const tableData = filteredLogs.map((log, idx) => {
        const req = log.request_payload || log.request_body || {};
        const res = log.response_payload || log.response_body || {};
        const statusInfo = getStatusInfo(log.status_code, res, log.payment_status);
        const agentInfo = agentMap[log.agent_id];

        const row: any[] = [
          (idx + 1).toString(),
          format(parseISO(log.created_at), 'dd/MM/yy\nhh:mm a')
        ];

        if (isAdmin) {
          row.push(agentInfo?.b2b_login_id || log.agent_id?.slice(0, 8));
        }

        row.push(
          req.billerId || 'N/A',
          req.mobile || req.consumerNumber || 'N/A',
          `Rs. ${Number(req.amount || 0).toFixed(2)}`,
          `Rs. ${Number(log.charge_deducted || req.chargeDeducted || 0).toFixed(2)}`,
          req.transaction_id || res.transaction_id || log.id?.slice(0, 10),
          statusInfo.text.toUpperCase()
        );

        return row;
      });

      const headers = ['#', 'Date & Time'];
      if (isAdmin) headers.push('Agent');
      headers.push('Biller ID', 'Consumer / Mobile', 'Amount', 'Charge', 'Txn ID', 'Status');

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
        bodyStyles: { fontSize: 7.5 }
      });

      doc.save(`CSPL_Bill_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 rounded-3xl border border-blue-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">CSPL Fast Bill History</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                ⚡ Dedicated CSPL Gateway
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Live transaction logs and real-time status of all bills processed via CSPL High-Speed Gateway.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 relative z-10 flex-wrap">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total CSPL Volume */}
        <div className="bg-slate-800/90 border border-blue-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">CSPL Success Volume</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1 truncate">
            ₹{stats.successAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Successful Bills</span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {stats.successCount} Bills
            </span>
          </div>
        </div>

        {/* CSPL Fee / Commission */}
        <div className="bg-slate-800/90 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              {isAdmin ? 'CSPL Fee Collected' : 'Service Charges'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1 truncate">
            ₹{stats.successCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>{isAdmin ? 'Owner Profit' : 'Total Charges'}</span>
            <span className="font-bold text-amber-400">
              {isAdmin ? `₹${stats.successOwnerCharge.toFixed(2)}` : `${stats.successCount} Applied`}
            </span>
          </div>
        </div>

        {/* Pending Bills */}
        <div className="bg-slate-800/90 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Processing</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1 truncate">
            ₹{stats.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Pending Count</span>
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {stats.pendingCount} Entries
            </span>
          </div>
        </div>

        {/* Failed / Auto-Refunded */}
        <div className="bg-slate-800/90 border border-rose-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Failed & Refunded</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1 truncate">
            ₹{stats.failedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Failed Bills</span>
            <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              {stats.failedCount} Refunded
            </span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Date Filter Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Date Filter
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold uppercase block">From Date</label>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold uppercase block">To Date</label>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer outline-none"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed / Refunded</option>
            </select>
          </div>

          {/* Admin Agent Filter */}
          {isAdmin && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                B2B Agent
              </label>
              <select
                value={b2bLoginFilter}
                onChange={(e) => setB2bLoginFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer outline-none font-mono"
              >
                <option value="all">All Agents</option>
                {uniqueLoginIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-blue-400" />
              Amount (₹)
            </label>
            <input
              type="text"
              placeholder="Search amount..."
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>

          {/* General Search */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              Search Details
            </label>
            <input
              type="text"
              placeholder="Biller, Mobile, Txn ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Reset Filter Button */}
        {(dateFilter !== 'today' || statusFilter !== 'all' || b2bLoginFilter !== 'all' || amountFilter || chargeFilter || txnIdFilter || searchTerm) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
            <span className="text-slate-400">
              Showing <span className="font-bold text-blue-400">{filteredLogs.length}</span> of <span className="font-bold text-slate-300">{logs.length}</span> CSPL bills
            </span>
            <button
              onClick={() => {
                setDateFilter('today');
                setStatusFilter('all');
                setB2bLoginFilter('all');
                setAmountFilter('');
                setChargeFilter('');
                setTxnIdFilter('');
                setSearchTerm('');
                setCustomRange({ start: '', end: '' });
              }}
              className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400">
            <Zap className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">No CSPL Bill Payments Found</h3>
          <p className="text-slate-400 text-sm">
            {(dateFilter !== 'today' || statusFilter !== 'all' || searchTerm || amountFilter)
              ? 'No CSPL transactions match your current filters.'
              : 'No CSPL bills have been processed today.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700/60 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Date & Time</th>
                  {isAdmin && <th className="px-4 py-3.5 text-blue-400">B2B Agent</th>}
                  <th className="px-4 py-3.5">Biller Details</th>
                  <th className="px-4 py-3.5">Consumer / Mobile</th>
                  <th className="px-4 py-3.5">Bill Amount</th>
                  <th className="px-4 py-3.5 text-amber-400">Charge</th>
                  {isAdmin && <th className="px-4 py-3.5 text-cyan-400">Dev Fee</th>}
                  {isAdmin && <th className="px-4 py-3.5 text-purple-400">Owner Fee</th>}
                  <th className="px-4 py-3.5 text-slate-300">Transaction ID</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {paginatedLogs.map((log) => {
                  const req = log.request_payload || log.request_body || {};
                  const res = log.response_payload || log.response_body || {};
                  const statusInfo = getStatusInfo(log.status_code, res, log.payment_status);
                  const isSuccess = statusInfo.text === 'Success';
                  const chargeVal = !isSuccess ? 0 : Number(log.charge_deducted || req.chargeDeducted || req.chargePerBill || 0);
                  const devChargeVal = !isSuccess ? 0 : Number(log.developer_charge || req.developerCharge || 0);
                  const ownerChargeVal = !isSuccess ? 0 : Number(log.owner_charge || req.ownerCharge || Math.max(0, chargeVal - devChargeVal));
                  const txnId = req.transaction_id || res.transaction_id || log.id;
                  const clientTxnId = req.client_transaction_id || res.client_transaction_id;

                  return (
                    <tr key={log.id} className="hover:bg-slate-700/25 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-200 text-xs">
                          {format(parseISO(log.created_at), 'dd MMM, yyyy')}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {format(parseISO(log.created_at), 'hh:mm:ss a')}
                        </div>
                      </td>

                      {/* Admin Agent */}
                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-blue-300 font-mono text-xs truncate max-w-[130px]" title={agentMap[log.agent_id]?.b2b_login_id || log.agent_id}>
                            {agentMap[log.agent_id]?.b2b_login_id || log.agent_id}
                          </div>
                          {agentMap[log.agent_id]?.name && (
                            <div className="text-slate-400 text-[11px] truncate max-w-[130px]">{agentMap[log.agent_id]?.name}</div>
                          )}
                        </td>
                      )}

                      {/* Biller Info */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-blue-400 text-xs truncate max-w-[140px]" title={req.billerName || req.billerId}>
                          {req.billerName || req.billerId || 'CSPL Biller'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {req.billerId || 'N/A'}
                        </div>
                      </td>

                      {/* Consumer / Mobile */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs text-white">
                          {req.mobile || req.consumerNumber || 'N/A'}
                        </div>
                        {req.consumerNumber && req.mobile && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Smartphone className="w-3 h-3 text-slate-500" />
                            {req.mobile}
                          </div>
                        )}
                      </td>

                      {/* Bill Amount */}
                      <td className="px-4 py-3.5 font-bold text-white font-mono text-xs">
                        ₹{Number(req.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Charge */}
                      <td className="px-4 py-3.5 font-bold text-amber-400 font-mono text-xs">
                        ₹{chargeVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Admin Fee Splits */}
                      {isAdmin && (
                        <td className="px-4 py-3.5 font-bold text-cyan-400 font-mono text-xs">
                          ₹{devChargeVal.toFixed(2)}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-4 py-3.5 font-bold text-purple-400 font-mono text-xs">
                          ₹{ownerChargeVal.toFixed(2)}
                        </td>
                      )}

                      {/* Txn ID */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700/60 text-[11px] font-semibold text-slate-200 truncate max-w-[130px]" title={txnId}>
                            {txnId}
                          </span>
                          <button
                            onClick={() => copyToClipboard(txnId, `copy_${log.id}`)}
                            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                            title="Copy Transaction ID"
                          >
                            {copiedId === `copy_${log.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {clientTxnId && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[130px] mt-0.5" title={`Client: ${clientTxnId}`}>
                            Ref: {clientTxnId}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleLiveCheck(log)}
                            disabled={updatingStatus === log.id}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg border text-xs font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 transition-colors cursor-pointer"
                            title="Check Live CSPL Status"
                          >
                            {updatingStatus === log.id ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredLogs.length > 0 && (
            <div className="bg-slate-800/90 px-6 py-4 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  Showing <span className="font-semibold text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-white">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> of{' '}
                  <span className="font-semibold text-white">{filteredLogs.length}</span> entries
                </span>
                <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={filteredLogs.length || 1000}>All</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>

                <span className="text-xs text-slate-400 font-medium px-2">
                  Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="CSPL Transaction Details"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-700">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Transaction ID</span>
                <span className="font-mono text-white break-all">
                  {selectedLog.request_payload?.transaction_id || selectedLog.response_payload?.transaction_id || selectedLog.id}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Date & Time</span>
                <span className="text-white">{format(parseISO(selectedLog.created_at), 'dd MMM yyyy, hh:mm:ss a')}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Bill Amount</span>
                <span className="text-white font-bold text-sm">
                  ₹{Number(selectedLog.request_payload?.amount || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Charge Deducted</span>
                <span className="text-amber-400 font-bold text-sm">
                  ₹{Number(selectedLog.charge_deducted || selectedLog.request_payload?.chargeDeducted || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Biller ID</span>
                <span className="text-blue-400 font-mono">{selectedLog.request_payload?.billerId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Consumer Number</span>
                <span className="text-white font-mono">{selectedLog.request_payload?.consumerNumber || selectedLog.request_payload?.mobile || 'N/A'}</span>
              </div>
            </div>

            {/* Request Payload JSON */}
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">Request Payload</span>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.request_payload, null, 2)}
              </pre>
            </div>

            {/* Response Payload JSON */}
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">CSPL Response Payload</span>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.response_payload, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
