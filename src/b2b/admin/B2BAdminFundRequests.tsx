import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Wallet, Check, X, Search, Clock, ExternalLink, Calendar, CheckCircle2, XCircle, Eye, FileSpreadsheet, FileText, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';
import { format } from 'date-fns';

export default function B2BAdminFundRequests() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedProofReq, setSelectedProofReq] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('b2b_admin_fund_requests_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_fund_requests' },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let allReqs: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      let safetyCounter = 0;

      while (hasMore && safetyCounter < 100) {
        safetyCounter++;
        let query = supabase
          .from('b2b_fund_requests')
          .select(`
            *,
            b2b_api_credentials(first_name, last_name, b2b_login_id, mobile, wallet_balance)
          `)
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allReqs = allReqs.concat(data);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      setRequests(allReqs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load fund requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, agentId: string, amount: number, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this fund request of ₹${amount}?`)) return;

    try {
      if (action === 'approve') {
        // Atomic balance update
        const { data: success, error: rpcError } = await supabase.rpc('add_b2b_wallet_balance', {
          p_agent_id: agentId,
          p_amount: amount
        });

        if (rpcError || !success) throw rpcError || new Error('Failed to update balance');
        
        await supabase.from('b2b_fund_requests').update({ status: 'approved' }).eq('id', requestId);
        toast.success('Request approved and balance added');
      } else {
        await supabase.from('b2b_fund_requests').update({ status: 'rejected' }).eq('id', requestId);
        toast.success('Request rejected');
      }
      
      fetchRequests();
    } catch (err) {
      console.error('Error processing request:', err);
      toast.error('Failed to process request');
    }
  };

  const checkDateFilter = (createdAtStr: string, filter: string) => {
    if (filter === 'all') return true;
    
    const createdDate = new Date(createdAtStr);
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    if (filter === 'today') {
      return createdDate >= todayStart && createdDate <= todayEnd;
    }
    
    if (filter === 'yesterday') {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      return createdDate >= yesterdayStart && createdDate <= yesterdayEnd;
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

    if (filter === 'custom') {
      if (!customRange.start && !customRange.end) return true;
      const start = customRange.start ? new Date(`${customRange.start}T00:00:00`) : new Date(0);
      const end = customRange.end ? new Date(`${customRange.end}T23:59:59.999`) : new Date();
      return createdDate >= start && createdDate <= end;
    }
    
    return true;
  };

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    const cred = req.b2b_api_credentials;
    const matchesSearch = (
      req.utr_number?.toLowerCase().includes(term) ||
      cred?.b2b_login_id?.toLowerCase().includes(term) ||
      cred?.first_name?.toLowerCase().includes(term) ||
      cred?.mobile?.includes(term)
    );

    const matchesDate = checkDateFilter(req.created_at, dateFilter);

    return matchesSearch && matchesDate;
  });

  // Calculate summary metrics
  const stats = useMemo(() => {
    let approvedCount = 0;
    let approvedAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let rejectedCount = 0;
    let rejectedAmount = 0;

    filteredRequests.forEach(req => {
      const amt = Number(req.amount || 0);
      if (req.status === 'approved') {
        approvedCount++;
        approvedAmount += amt;
      } else if (req.status === 'pending') {
        pendingCount++;
        pendingAmount += amt;
      } else if (req.status === 'rejected') {
        rejectedCount++;
        rejectedAmount += amt;
      }
    });

    const totalCount = filteredRequests.length;
    const totalAmount = approvedAmount + pendingAmount + rejectedAmount;

    return {
      approvedCount,
      approvedAmount,
      pendingCount,
      pendingAmount,
      rejectedCount,
      rejectedAmount,
      totalCount,
      totalAmount
    };
  }, [filteredRequests]);

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportData: Record<string, any>[] = filteredRequests.map((req, idx) => {
        const cred = req.b2b_api_credentials;
        const agentName = [cred?.first_name, cred?.last_name].filter(Boolean).join(' ') || cred?.b2b_login_id || 'N/A';
        return {
          'S.No': idx + 1,
          'Date & Time': format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a'),
          'Agent Name / ID': agentName,
          'Mobile': cred?.mobile || '',
          'Amount (₹)': Number(req.amount || 0),
          'UTR / Reference Number': req.utr_number || '',
          'Status': req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending',
          'Proof Screenshot': req.proof_url || ''
        };
      });

      // Summary Row
      exportData.push({
        'S.No': 'TOTAL',
        'Date & Time': `${filteredRequests.length} Requests`,
        'Agent Name / ID': '',
        'Mobile': '',
        'Amount (₹)': Number(stats.totalAmount.toFixed(2)),
        'UTR / Reference Number': '',
        'Status': '',
        'Proof Screenshot': ''
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 22 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 45 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fund Requests Admin');
      XLSX.writeFile(wb, `Admin_B2B_Fund_Requests_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exported successfully!');
    } catch (err) {
      console.error('Excel Export Error:', err);
      toast.error('Failed to export Excel');
    }
  };

  const exportToPDF = async () => {
    try {
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = (autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule) as any;

      const doc = new JsPDFClass({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const tableData = filteredRequests.map((req, idx) => {
        const cred = req.b2b_api_credentials;
        const agentName = [cred?.first_name, cred?.last_name].filter(Boolean).join(' ') || cred?.b2b_login_id || 'N/A';
        return [
          (idx + 1).toString(),
          format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a'),
          agentName,
          `₹ ${Number(req.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          req.utr_number || 'N/A',
          req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending'
        ];
      });

      const footer = [
        [
          'TOTAL',
          `${filteredRequests.length} Requests`,
          '',
          `₹ ${stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          '',
          ''
        ]
      ];

      doc.setFontSize(14);
      doc.text('B2B Admin Fund Load Requests Report', 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 21);

      autoTable(doc, {
        head: [['#', 'Date & Time', 'Agent', 'Amount', 'UTR Number', 'Status']],
        body: tableData,
        foot: footer,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { top: 26 }
      });

      doc.save(`Admin_B2B_Fund_Requests_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-400" />
            Fund Load Requests
          </h2>
          <p className="text-slate-400">Approve or reject B2B API agent top-ups.</p>
        </div>

        {/* Excel and PDF Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={filteredRequests.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={exportToPDF}
            disabled={filteredRequests.length === 0}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Export to PDF"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved Card */}
        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Approved Amount</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-300 tracking-tight mb-1">
            ₹ {stats.approvedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Approved Count</span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {stats.approvedCount} Requests
            </span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Amount</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-300 tracking-tight mb-1">
            ₹ {stats.pendingAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Pending Count</span>
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {stats.pendingCount} Requests
            </span>
          </div>
        </div>

        {/* Rejected Card */}
        <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Rejected Amount</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-300 tracking-tight mb-1">
            ₹ {stats.rejectedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Rejected Count</span>
            <span className="font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              {stats.rejectedCount} Requests
            </span>
          </div>
        </div>

        {/* Total Volume Card */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Requested</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-300 tracking-tight mb-1">
            ₹ {stats.totalAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Total Requests</span>
            <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {stats.totalCount} Requests
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Agent ID, Name, UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-slate-900 text-white placeholder-slate-500"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Date Range Dropdown Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full sm:w-auto border border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 bg-slate-900 text-sm font-medium text-slate-200 cursor-pointer"
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

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto border border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 bg-slate-900 text-sm font-medium text-slate-200 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Custom Date Range Inputs */}
          {dateFilter === 'custom' && (
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-700">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">From Date</label>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-900"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">To Date</label>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8">
              <LoadingSpinner />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center p-8 text-slate-400">
              No fund requests found.
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">UTR Details</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                          <Wallet className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            {req.b2b_api_credentials?.first_name} {req.b2b_api_credentials?.last_name}
                          </div>
                          <div className="text-xs text-indigo-300 font-mono">{req.b2b_api_credentials?.b2b_login_id}</div>
                          <div className="text-xs text-emerald-400 font-medium">Bal: ₹{req.b2b_api_credentials?.wallet_balance?.toFixed(2)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-white text-base">₹{req.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-indigo-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 inline-block">
                        {req.utr_number}
                      </div>
                      {req.proof_url && (
                        <div className="mt-1">
                          <button
                            onClick={() => setSelectedProofReq(req)}
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Proof
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        req.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(req.id, req.agent_id, req.amount, 'approve')}
                            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(req.id, req.agent_id, req.amount, 'reject')}
                            className="bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Proof & Fund Request Detail Modal */}
      {selectedProofReq && (
        <Modal
          isOpen={!!selectedProofReq}
          onClose={() => setSelectedProofReq(null)}
          title="Payment Proof & Request Details"
          size="2xl"
          isDark={true}
        >
          <div className="space-y-6">
            {/* Details Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-700 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase block">Agent Name</span>
                <span className="font-bold text-white text-sm block mt-0.5">
                  {selectedProofReq.b2b_api_credentials?.first_name} {selectedProofReq.b2b_api_credentials?.last_name}
                </span>
                <span className="block text-[11px] text-indigo-300 font-mono mt-0.5">{selectedProofReq.b2b_api_credentials?.b2b_login_id}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase block">Requested Amount</span>
                <span className="font-bold text-indigo-400 text-base block mt-0.5">₹{Number(selectedProofReq.amount).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase block">UTR Number</span>
                <span className="font-bold font-mono text-indigo-300 text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700 inline-block mt-1">
                  {selectedProofReq.utr_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase block">Status</span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full inline-block mt-1 border ${
                  selectedProofReq.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  selectedProofReq.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {selectedProofReq.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Proof Preview Image with Interactive Zoom & Pan Movement */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Screenshot / Receipt</span>
                {selectedProofReq.proof_url && (
                  <a
                    href={selectedProofReq.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Full Image
                  </a>
                )}
              </div>
              
              {selectedProofReq.proof_url ? (
                <ProofImageViewer src={selectedProofReq.proof_url} />
              ) : (
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 flex items-center justify-center min-h-[200px]">
                  <div className="text-slate-400 text-sm py-8">No proof image uploaded for this request</div>
                </div>
              )}
            </div>

            {/* Bottom Actions inside Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-400 font-medium">
                Requested On: {format(new Date(selectedProofReq.created_at), 'dd MMM yyyy, hh:mm a')}
              </div>

              <div className="flex items-center gap-3">
                {selectedProofReq.status === 'pending' ? (
                  <>
                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        await handleAction(selectedProofReq.id, selectedProofReq.agent_id, selectedProofReq.amount, 'reject');
                        setActionLoading(false);
                        setSelectedProofReq(null);
                      }}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <X className="w-4 h-4" /> Reject Request
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        await handleAction(selectedProofReq.id, selectedProofReq.agent_id, selectedProofReq.amount, 'approve');
                        setActionLoading(false);
                        setSelectedProofReq(null);
                      }}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Check className="w-4 h-4" /> Approve & Credit Balance
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedProofReq(null)}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-600"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Interactive Proof Image Viewer Component with Mouse Wheel Zoom & Drag Pan
function ProofImageViewer({ src }: { src: string }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prevZoom) => {
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      const nextZoom = Math.min(Math.max(0.8, prevZoom + delta), 5);
      if (nextZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return parseFloat(nextZoom.toFixed(2));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.3, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.3, 0.8);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return parseFloat(next.toFixed(2));
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-2">
      {/* Zoom / Movement Control Toolbar */}
      <div className="flex items-center justify-between bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 text-xs">
        <span className="font-bold text-slate-300 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-indigo-400" />
          <span>Zoom: <span className="font-mono text-indigo-300">{Math.round(zoom * 100)}%</span></span>
          {rotation > 0 && <span className="text-slate-400 font-mono">({rotation}°)</span>}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Zoom In (Scroll Up)"
          >
            <ZoomIn className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Zoom Out (Scroll Down)"
          >
            <ZoomOut className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            title="Reset Zoom & Position"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Image Display Container with Wheel Zoom & Mouse Drag Pan */}
      <div
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative bg-slate-950 rounded-2xl p-4 border border-slate-700 flex items-center justify-center min-h-[300px] max-h-[480px] overflow-hidden select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          className="transition-transform duration-100 ease-out flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={src}
            alt="Payment Proof"
            draggable={false}
            className="max-h-[420px] w-auto object-contain rounded-xl shadow-2xl pointer-events-none"
          />
        </div>
        
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm text-indigo-300 border border-slate-700 text-[10px] font-mono px-2.5 py-1 rounded-lg pointer-events-none shadow-md">
          {zoom > 1 || position.x !== 0 || position.y !== 0 ? 'Scroll to Zoom | Drag to Move' : 'Scroll mouse wheel to Zoom | Drag to Pan'}
        </div>
      </div>
    </div>
  );
}
