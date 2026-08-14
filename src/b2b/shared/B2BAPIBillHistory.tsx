import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Clock, CheckCircle2, XCircle, FileText, FileSpreadsheet, Search, CreditCard, RefreshCw, Calendar, IndianRupee, Hash, X, Filter, ChevronLeft, ChevronRight, User, Building2, Smartphone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';

interface B2BAPIBillHistoryProps {
  isAdmin: boolean;
  agentId?: string; // Passed if isAdmin is false
}

interface LogEntry {
  id: string;
  created_at: string;
  agent_id: string;
  request_payload?: any;
  response_payload?: any;
  request_body?: any;
  response_body?: any;
  status_code: number;
  payment_status?: string;
}

export default function B2BAPIBillHistory({ isAdmin, agentId }: B2BAPIBillHistoryProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');
  const [amountFilter, setAmountFilter] = useState('');
  const [txnIdFilter, setTxnIdFilter] = useState('');
  const [b2bLoginFilter, setB2bLoginFilter] = useState('all');
  const [billAvenueAgentIdFilter, setBillAvenueAgentIdFilter] = useState('all');
  const [cardMobileFilter, setCardMobileFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const [agentMap, setAgentMap] = useState<Record<string, { b2b_login_id?: string; billavenue_agent_id?: string; name?: string }>>({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, customRange, statusFilter, amountFilter, txnIdFilter, searchTerm, b2bLoginFilter, billAvenueAgentIdFilter, cardMobileFilter]);

  useEffect(() => {
    fetchLogs();

    // Enable Supabase Realtime
    const channel = supabase
      .channel('b2b_api_logs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_api_logs' },
        (payload) => {
          console.log('Realtime change received:', payload);
          fetchLogs(); // Auto refresh when data changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, agentId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      let allLogs: LogEntry[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      let safetyCounter = 0;

      while (hasMore && safetyCounter < 1000) {
        safetyCounter++;
        let query = supabase
          .from('b2b_api_logs')
          .select('*')
          .or("endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill")
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (!isAdmin && agentId) {
          query = query.eq('agent_id', agentId);
        }

        const { data, error } = await query;
        
        if (error) throw error;

        if (data && data.length > 0) {
          allLogs = allLogs.concat(data);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      setLogs(allLogs);

      // Fetch B2B agent credentials with batch pagination for mapping B2B Login ID and BillAvenue Agent ID
      try {
        let allCreds: any[] = [];
        let credsFrom = 0;
        const credsStep = 1000;
        let credsHasMore = true;

        while (credsHasMore) {
          const { data: credsBatch, error: credsErr } = await supabase
            .from('b2b_api_credentials')
            .select('id, agent_id, b2b_login_id, billavenue_agent_id, first_name, last_name')
            .range(credsFrom, credsFrom + credsStep - 1);

          if (credsErr) throw credsErr;

          if (credsBatch && credsBatch.length > 0) {
            allCreds = allCreds.concat(credsBatch);
            if (credsBatch.length < credsStep) {
              credsHasMore = false;
            } else {
              credsFrom += credsStep;
            }
          } else {
            credsHasMore = false;
          }
        }

        const map: Record<string, { b2b_login_id?: string; billavenue_agent_id?: string; name?: string }> = {};
        allCreds.forEach((c: any) => {
          const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
          const info = {
            b2b_login_id: c.b2b_login_id || 'N/A',
            billavenue_agent_id: c.billavenue_agent_id || c.agent_id || 'N/A',
            name: fullName
          };
          if (c.id) map[c.id] = info;
          if (c.agent_id) map[c.agent_id] = info;
        });
        setAgentMap(map);
      } catch (e) {
        console.error('Error fetching agent creds map:', e);
      }
    } catch (err) {
      console.error('Error fetching API logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (logId: string, newStatus: 'success' | 'failed') => {
    const promptMsg = newStatus === 'failed' 
      ? `Are you sure you want to mark this bill as FAILED?\nThe agent's wallet will be refunded.` 
      : `Are you sure you want to mark this bill as SUCCESS?`;
    if (!confirm(promptMsg)) return;
    
    try {
      setUpdatingStatus(logId);
      const { data, error } = await supabase.rpc('admin_update_b2b_bill_status', {
        p_log_id: logId,
        p_status: newStatus
      });

      if (error) throw error;
      
      if (data && data.success) {
        alert(data.message || 'Status updated successfully');
        fetchLogs(); // Refresh the list
      } else {
        alert(data?.message || 'Failed to update status');
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Error updating status: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleLiveCheck = async (log: LogEntry) => {
    try {
      const req = log.request_payload || log.request_body || {};
      const res = log.response_payload || log.response_body || {};
      const transactionId = req?.transaction_id || req?.requestId || res?.transaction_id;
      if (!transactionId) {
        alert('Transaction ID not found for this log.');
        return;
      }

      setUpdatingStatus(log.id);
      
      const API_URL = import.meta.env.VITE_API_URL || '';
      
      const resData = await fetch(`${API_URL}/api/b2b/admin/status/${transactionId}`);
      const data = await resData.json();
      
      if (data.status === 'success') {
        const messageDetails = data.data?.message ? `\nNote: ${data.data.message}` : '';
        alert(`Current BBPS Status: ${data.data?.bbps_status || 'CHECKED'}${messageDetails}\nOur DB was updated automatically!`);
        fetchLogs();
      } else {
        const errorText = data?.message || data?.error || data?.details || 'Unable to fetch transaction status.';
        alert(`Status Check Message: ${errorText}`);
      }

    } catch (error: any) {
      console.error('Live check error:', error);
      alert('Error checking status online');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusInfo = (statusCode: number, responseBody: any, paymentStatus?: string) => {
    const rawStatus = (paymentStatus || responseBody?.payment_status || responseBody?.finalStatus || '').toLowerCase();
    const bpr = responseBody?.ExtBillPayResponse || responseBody?.billPayResponse || responseBody;
    const responseCode = bpr?.responseCode || responseBody?.responseCode;
    const responseReason = (bpr?.responseReason || responseBody?.responseReason || '').toLowerCase();
    const txnRefId = bpr?.txnRefId || responseBody?.txnRefId;
    const hasCC01 = !!(txnRefId && String(txnRefId).toUpperCase().startsWith('CC01'));

    const isSuccess = 
      rawStatus === 'success' || 
      responseCode === '000' || 
      responseCode === '0000' || 
      responseReason === 'successful' || 
      responseReason === 'success' ||
      (hasCC01 && statusCode === 200 && rawStatus !== 'failed');

    if (isSuccess) {
      return { 
        text: 'Success', 
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      };
    }

    const hasErrorInfo = !!(bpr?.errorInfo || responseBody?.errorInfo || responseBody?.reason);
    const isFailed = rawStatus === 'failed' || statusCode === 500 || (hasErrorInfo && !hasCC01);

    if (isFailed) {
      return { 
        text: 'Failed', 
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        icon: <XCircle className="w-4 h-4 text-rose-400" />
      };
    }

    return { 
      text: 'Pending', 
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: <Clock className="w-4 h-4 text-amber-400" />
    };
  };

  const getAgentIdColor = (agentIdStr?: string) => {
    if (!agentIdStr || agentIdStr === 'N/A') return 'text-slate-400';
    const colors = [
      'text-emerald-400',
      'text-cyan-400',
      'text-amber-400',
      'text-indigo-400',
      'text-purple-400',
      'text-pink-400',
      'text-sky-400',
      'text-teal-400',
      'text-yellow-400',
      'text-rose-400'
    ];
    let hash = 0;
    for (let i = 0; i < agentIdStr.length; i++) {
      hash = (hash << 5) - hash + agentIdStr.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
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

  // Compute unique B2B Login IDs for dropdown filter
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

  // Compute unique BillAvenue Agent IDs for dropdown filter
  const uniqueBillAvenueAgentIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(agentMap).forEach(info => {
      if (info.billavenue_agent_id && info.billavenue_agent_id !== 'N/A') set.add(info.billavenue_agent_id);
    });
    logs.forEach(log => {
      const reqBody = log.request_payload || log.request_body || {};
      const baId = agentMap[log.agent_id]?.billavenue_agent_id || reqBody?.billavenueAgentId;
      if (baId && baId !== 'N/A') set.add(baId);
    });
    return Array.from(set).sort();
  }, [agentMap, logs]);

  const filteredLogs = logs.filter(log => {
    const reqBody = log.request_payload || log.request_body || {};
    const resBody = log.response_payload || log.response_body || {};

    const amount = reqBody?.amount !== undefined && reqBody?.amount !== null ? String(reqBody.amount) : '';
    const txnId = resBody?.transaction_id || reqBody?.transaction_id || reqBody?.requestId || '';
    const bbpsTxnId = resBody?.billPayResponse?.txnRefId || resBody?.ExtBillPayResponse?.txnRefId || resBody?.txnRefId || '';
    const statusInfo = getStatusInfo(log.status_code, resBody, log.payment_status);

    // Date Filter
    const matchesDate = checkDateFilter(log.created_at, dateFilter);

    // Status Filter (All, Success, Pending, Failed)
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = statusInfo.text.toLowerCase() === statusFilter.toLowerCase();
    }

    // B2B Login ID Filter
    let matchesB2bLogin = true;
    if (b2bLoginFilter !== 'all') {
      const loginId = agentMap[log.agent_id]?.b2b_login_id || '';
      matchesB2bLogin = loginId.toLowerCase() === b2bLoginFilter.toLowerCase();
    }

    // BillAvenue Agent ID Filter
    let matchesBillAvenueAgentId = true;
    if (billAvenueAgentIdFilter !== 'all') {
      const baId = agentMap[log.agent_id]?.billavenue_agent_id || reqBody?.billavenueAgentId || '';
      matchesBillAvenueAgentId = baId.toLowerCase() === billAvenueAgentIdFilter.toLowerCase();
    }

    // Card / Mobile Search Filter
    const cardMobileTrimmed = cardMobileFilter.trim().toLowerCase();
    let matchesCardMobile = true;
    if (cardMobileTrimmed) {
      const mobileVal = (reqBody.mobile || '').toString().toLowerCase();
      const primaryParam = reqBody.customerParams && reqBody.customerParams.length > 0 
        ? (reqBody.customerParams[0].value || '').toString().toLowerCase() 
        : '';
      const paramsVal = (reqBody.customerParams || [])
        .map((p: any) => (p.value || '').toString().toLowerCase())
        .join(' ');
      matchesCardMobile = mobileVal.includes(cardMobileTrimmed) || 
                          primaryParam.includes(cardMobileTrimmed) || 
                          paramsVal.includes(cardMobileTrimmed);
    }

    // Amount Filter
    const amountTrimmed = amountFilter.trim();
    let matchesAmount = true;
    if (amountTrimmed) {
      const numericFilter = Number(amountTrimmed);
      if (!isNaN(numericFilter)) {
        matchesAmount = amount.includes(amountTrimmed) || Math.abs(Number(amount) - numericFilter) < 0.01;
      } else {
        matchesAmount = amount.includes(amountTrimmed);
      }
    }

    // Transaction ID Filter
    const txnTrimmed = txnIdFilter.trim().toLowerCase();
    let matchesTxnId = true;
    if (txnTrimmed) {
      matchesTxnId = txnId.toLowerCase().includes(txnTrimmed) || bbpsTxnId.toLowerCase().includes(txnTrimmed);
    }

    // General Search
    const searchTrimmed = searchTerm.trim().toLowerCase();
    let matchesSearch = true;
    if (searchTrimmed) {
      const info = agentMap[log.agent_id];
      const paramsVal = (reqBody.customerParams || [])
        .map((p: any) => (p.value || '').toString().toLowerCase())
        .join(' ');
      const searchString = `
        ${log.agent_id || ''} 
        ${info?.b2b_login_id || ''}
        ${info?.billavenue_agent_id || ''}
        ${info?.name || ''}
        ${reqBody.billerId || ''} 
        ${reqBody.mobile || ''} 
        ${paramsVal}
        ${txnId}
        ${bbpsTxnId}
      `.toLowerCase();
      matchesSearch = searchString.includes(searchTrimmed);
    }

    return matchesDate && matchesStatus && matchesB2bLogin && matchesBillAvenueAgentId && matchesCardMobile && matchesAmount && matchesTxnId && matchesSearch;
  });

  // Calculate summary metrics for current filtered logs
  const stats = useMemo(() => {
    let successCount = 0;
    let successAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let failedCount = 0;
    let failedAmount = 0;

    filteredLogs.forEach(log => {
      const reqBody = log.request_payload || log.request_body || {};
      const resBody = log.response_payload || log.response_body || {};
      const amt = Number(reqBody.amount || 0);
      const statusInfo = getStatusInfo(log.status_code, resBody, log.payment_status);

      if (statusInfo.text === 'Success') {
        successCount++;
        successAmount += amt;
      } else if (statusInfo.text === 'Pending') {
        pendingCount++;
        pendingAmount += amt;
      } else {
        failedCount++;
        failedAmount += amt;
      }
    });

    const totalCount = filteredLogs.length;
    const totalAmount = successAmount + pendingAmount + failedAmount;

    return {
      successCount,
      successAmount,
      pendingCount,
      pendingAmount,
      failedCount,
      failedAmount,
      totalCount,
      totalAmount
    };
  }, [filteredLogs]);

  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / pageSize) || 1, [filteredLogs.length, pageSize]);

  const paginatedLogs = useMemo(() => {
    if (pageSize >= filteredLogs.length) return filteredLogs;
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportData = filteredLogs.map((log, idx) => {
        const reqBody = log.request_payload || log.request_body || {};
        const resBody = log.response_payload || log.response_body || {};
        const statusInfo = getStatusInfo(log.status_code, resBody, log.payment_status);
        const txnId = resBody?.transaction_id || 'N/A';
        const bbpsTxnId = resBody?.billPayResponse?.txnRefId || resBody?.ExtBillPayResponse?.txnRefId || resBody?.txnRefId || 'N/A';
        const primaryParam = reqBody.customerParams && reqBody.customerParams.length > 0 
          ? reqBody.customerParams[0].value 
          : '';
        const chargeVal = Number(
          (log as any).charge_deducted ?? 
          reqBody?.chargeDeducted ?? 
          reqBody?.chargePerBill ?? 
          reqBody?.charge ?? 
          (reqBody?.totalDeduction && reqBody?.amount ? reqBody.totalDeduction - reqBody.amount : undefined) ?? 
          0
        );

        const row: Record<string, any> = {
          'S.No': idx + 1,
          'Date & Time': format(parseISO(log.created_at), 'dd MMM yyyy, hh:mm:ss a'),
        };

        if (isAdmin) {
          const info = agentMap[log.agent_id];
          row['B2B Login ID'] = info?.b2b_login_id || log.agent_id || '';
          row['BillAvenue Agent ID'] = info?.billavenue_agent_id || reqBody?.billavenueAgentId || '';
        }

        row['Biller ID'] = reqBody.billerId || 'Unknown';
        row['Parameter / Consumer No'] = primaryParam || '';
        row['Mobile'] = reqBody.mobile || '';
        row['Amount (₹)'] = Number(reqBody.amount || 0);
        row['Charge (₹)'] = Number(chargeVal.toFixed(2));
        row['API Txn ID'] = txnId;
        row['BBPS Ref ID'] = bbpsTxnId;
        row['Status'] = statusInfo.text;

        return row;
      });

      // Total summary row
      const summaryRow: Record<string, any> = {
        'S.No': 'TOTAL',
        'Date & Time': `${filteredLogs.length} Payments`,
      };
      if (isAdmin) summaryRow['Agent ID'] = '';
      summaryRow['Biller ID'] = '';
      summaryRow['Parameter / Consumer No'] = '';
      summaryRow['Mobile'] = '';
      summaryRow['Amount (₹)'] = Number(stats.totalAmount.toFixed(2));
      summaryRow['Charge (₹)'] = Number(filteredLogs.reduce((acc, log) => {
        const reqBody = log.request_payload || log.request_body || {};
        const chg = Number(
          (log as any).charge_deducted ?? 
          reqBody?.chargeDeducted ?? 
          reqBody?.chargePerBill ?? 
          reqBody?.charge ?? 
          (reqBody?.totalDeduction && reqBody?.amount ? reqBody.totalDeduction - reqBody.amount : undefined) ?? 
          0
        );
        return acc + chg;
      }, 0).toFixed(2));
      summaryRow['API Txn ID'] = '';
      summaryRow['BBPS Ref ID'] = '';
      summaryRow['Status'] = '';

      exportData.push(summaryRow);

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'API Bill Payments');
      XLSX.writeFile(wb, `B2B_API_Bill_Payments_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
    }
  };

  const exportToPDF = async () => {
    try {
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = (autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule) as any;

      const doc = new JsPDFClass({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      let totalCharges = 0;
      const tableData = filteredLogs.map((log, idx) => {
        const reqBody = log.request_payload || log.request_body || {};
        const resBody = log.response_payload || log.response_body || {};
        const statusInfo = getStatusInfo(log.status_code, resBody, log.payment_status);
        const txnId = resBody?.transaction_id || 'N/A';
        const bbpsTxnId = resBody?.billPayResponse?.txnRefId || resBody?.ExtBillPayResponse?.txnRefId || resBody?.txnRefId || 'N/A';
        const primaryParam = reqBody.customerParams && reqBody.customerParams.length > 0 
          ? reqBody.customerParams[0].value 
          : '';
        const chargeVal = Number(
          (log as any).charge_deducted ?? 
          reqBody?.chargeDeducted ?? 
          reqBody?.chargePerBill ?? 
          reqBody?.charge ?? 
          (reqBody?.totalDeduction && reqBody?.amount ? reqBody.totalDeduction - reqBody.amount : undefined) ?? 
          0
        );
        totalCharges += chargeVal;

        const row = [
          (idx + 1).toString(),
          format(parseISO(log.created_at), 'dd/MM/yyyy HH:mm'),
        ];

        if (isAdmin) {
          row.push((log.agent_id || '').substring(0, 12));
        }

        row.push(
          reqBody.billerId || 'N/A',
          primaryParam || reqBody.mobile || 'N/A',
          `₹ ${Number(reqBody.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          `₹ ${chargeVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          txnId,
          bbpsTxnId,
          statusInfo.text
        );

        return row;
      });

      const headers = ['#', 'Date / Time'];
      if (isAdmin) headers.push('Agent ID');
      headers.push('Biller ID', 'Param / Mobile', 'Amount', 'Charge', 'API Txn ID', 'BBPS Txn ID', 'Status');

      const footerRow = [
        'TOTAL',
        `${filteredLogs.length} Entries`,
      ];
      if (isAdmin) footerRow.push('');
      footerRow.push(
        '',
        '',
        `₹ ${stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `₹ ${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        '',
        '',
        ''
      );

      doc.setFontSize(14);
      doc.text('B2B API Bill Payments History Report', 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 21);

      autoTable(doc, {
        head: [headers],
        body: tableData,
        foot: [footerRow],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { top: 26 }
      });

      doc.save(`B2B_API_Bill_Payments_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-400" />
            API Bill Payments History
          </h2>
          <p className="text-slate-400">View detailed history of all bill payments processed via the B2B API.</p>
        </div>

        {/* Excel and PDF Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={exportToPDF}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="Export to PDF"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Card */}
        <div className="bg-slate-800/90 border border-emerald-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Success Payments</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.successAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Successful Count</span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {stats.successCount} Entries
            </span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-slate-800/90 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Payments</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Pending Count</span>
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {stats.pendingCount} Entries
            </span>
          </div>
        </div>

        {/* Failed Card */}
        <div className="bg-slate-800/90 border border-rose-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Failed Payments</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.failedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Failed Count</span>
            <span className="font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              {stats.failedCount} Entries
            </span>
          </div>
        </div>

        {/* Total Volume Card */}
        <div className="bg-slate-800/90 border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Volume</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Total Entries</span>
            <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {stats.totalCount} Entries
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-700 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Date Filter Dropdown (Default: Today) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer outline-none"
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

          {/* Custom Date Range Inputs */}
          {dateFilter === 'custom' && (
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/80">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase block">From Date</label>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase block">To Date</label>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Status Filter Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer outline-none"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* B2B Login ID Dropdown Filter */}
          {isAdmin && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                B2B Login ID
              </label>
              <select
                value={b2bLoginFilter}
                onChange={(e) => setB2bLoginFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer outline-none font-mono"
              >
                <option value="all">All B2B Login IDs</option>
                {uniqueLoginIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* BillAvenue Agent ID Dropdown Filter */}
          {isAdmin && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                BillAvenue Agent ID
              </label>
              <select
                value={billAvenueAgentIdFilter}
                onChange={(e) => setBillAvenueAgentIdFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer outline-none font-mono"
              >
                <option value="all">All BillAvenue Agent IDs</option>
                {uniqueBillAvenueAgentIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CARD / MOBILE Search Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              Card / Mobile
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Card / Mobile No..."
                value={cardMobileFilter}
                onChange={(e) => setCardMobileFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500 outline-none font-mono"
              />
              {cardMobileFilter && (
                <button
                  onClick={() => setCardMobileFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Transaction ID Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-400" />
              Transaction ID
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Txn ID / BBPS ID..."
                value={txnIdFilter}
                onChange={(e) => setTxnIdFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500 outline-none font-mono"
              />
              {txnIdFilter && (
                <button
                  onClick={() => setTxnIdFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Amount Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-indigo-400" />
              Amount
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by amount..."
                value={amountFilter}
                onChange={(e) => setAmountFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500 outline-none font-mono"
              />
              {amountFilter && (
                <button
                  onClick={() => setAmountFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search Details (Biller, Mobile, Agent) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              Search Details
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Biller ID, Mobile, Agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Summary & Reset Button */}
        {(dateFilter !== 'today' || statusFilter !== 'all' || b2bLoginFilter !== 'all' || billAvenueAgentIdFilter !== 'all' || cardMobileFilter || amountFilter || txnIdFilter || searchTerm) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
            <span className="text-slate-400">
              Showing <span className="font-bold text-indigo-400">{filteredLogs.length}</span> of <span className="font-bold text-slate-300">{logs.length}</span> payments
            </span>
            <button
              onClick={() => {
                setDateFilter('today');
                setStatusFilter('all');
                setB2bLoginFilter('all');
                setBillAvenueAgentIdFilter('all');
                setCardMobileFilter('');
                setAmountFilter('');
                setTxnIdFilter('');
                setSearchTerm('');
                setCustomRange({ start: '', end: '' });
              }}
              className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20"
            >
              <X className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <CreditCard className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-1">No API Bill Payments Found</h3>
          <p className="text-slate-500 text-sm">
            {(dateFilter !== 'today' || statusFilter !== 'all' || searchTerm || amountFilter || txnIdFilter)
              ? 'No payments match your selected filter criteria.'
              : 'There are currently no bill payments made today.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700/50 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-3 py-3">Date & Time</th>
                  {isAdmin && <th className="px-3 py-3 text-indigo-400">B2B Login ID</th>}
                  {isAdmin && <th className="px-3 py-3 text-emerald-400">BillAvenue Agent ID</th>}
                  <th className="px-3 py-3">Biller ID</th>
                  <th className="px-3 py-3">CARD / MOBILE</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3 text-amber-400">Charge</th>
                  <th className="px-3 py-3 text-slate-300">API TXN ID</th>
                  <th className="px-3 py-3 text-indigo-400">BBPS TXN ID</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {paginatedLogs.map((log) => {
                  const reqBody = log.request_payload || {};
                  const resBody = log.response_payload || {};
                  const statusInfo = getStatusInfo(log.status_code, resBody, log.payment_status);
                  const txnId = resBody?.transaction_id || 'N/A';
                  const bbpsTxnId = resBody?.billPayResponse?.txnRefId || resBody?.ExtBillPayResponse?.txnRefId || resBody?.txnRefId;
                  
                  // Extract the primary customer parameter (like Credit Card number, Consumer Number)
                  const primaryParam = reqBody.customerParams && reqBody.customerParams.length > 0 
                    ? reqBody.customerParams[0].value 
                    : null;
                  
                  const chargeVal = Number(
                    (log as any).charge_deducted ?? 
                    reqBody?.chargeDeducted ?? 
                    reqBody?.chargePerBill ?? 
                    reqBody?.charge ?? 
                    (reqBody?.totalDeduction && reqBody?.amount ? reqBody.totalDeduction - reqBody.amount : undefined) ?? 
                    0
                  );
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-300 text-xs">{format(parseISO(log.created_at), 'dd MMM, yyyy')}</div>
                        <div className="text-slate-500 text-[11px]">{format(parseISO(log.created_at), 'hh:mm:ss a')}</div>
                      </td>
                      
                      {isAdmin && (
                        <td className="px-3 py-3">
                          <div className="font-bold text-indigo-300 font-mono text-xs truncate max-w-[130px]" title={agentMap[log.agent_id]?.b2b_login_id || log.agent_id}>
                            {agentMap[log.agent_id]?.b2b_login_id || log.agent_id}
                          </div>
                          {agentMap[log.agent_id]?.name && (
                            <div className="text-slate-400 text-[11px] truncate max-w-[130px]">{agentMap[log.agent_id]?.name}</div>
                          )}
                        </td>
                      )}

                      {isAdmin && (
                        <td className="px-3 py-3">
                          {(() => {
                            const baId = agentMap[log.agent_id]?.billavenue_agent_id || reqBody?.billavenueAgentId || reqBody?.agentId || 'N/A';
                            const idColor = getAgentIdColor(baId);
                            return (
                              <div className={`font-semibold font-mono text-xs truncate max-w-[140px] ${idColor}`} title={baId}>
                                {baId}
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      
                      <td className="px-3 py-3">
                        <div className="font-medium text-indigo-400 text-xs truncate max-w-[130px]" title={reqBody.billerId || 'Unknown Biller'}>{reqBody.billerId || 'Unknown Biller'}</div>
                      </td>
                      
                      <td className="px-3 py-3">
                        {primaryParam && (
                          <div className="text-white text-xs font-mono mb-0.5">{primaryParam}</div>
                        )}
                        <div className="text-slate-400 text-[11px] font-mono">{reqBody.mobile || 'N/A'}</div>
                      </td>
                      
                      <td className="px-3 py-3">
                        <div className="font-bold text-white text-xs">₹ {Number(reqBody.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-bold text-amber-400 text-xs">
                          {chargeVal > 0 ? `₹ ${chargeVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ 0.00'}
                        </div>
                      </td>

                      <td className="px-3 py-3 font-mono text-xs text-slate-300">
                        {txnId !== 'N/A' ? (
                          <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700/50 text-[11px] block truncate max-w-[130px]" title={txnId}>{txnId}</span>
                        ) : (
                          <span className="text-slate-500 font-sans">-</span>
                        )}
                      </td>

                      <td className="px-3 py-3 font-mono text-xs text-indigo-300">
                        {bbpsTxnId ? (
                          <span className="bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 text-[11px] block truncate max-w-[140px]" title={bbpsTxnId}>{bbpsTxnId}</span>
                        ) : (
                          <span className="text-slate-500 font-sans">-</span>
                        )}
                      </td>
                      
                      <td className="px-3 py-3">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.text}
                        </div>
                      </td>
                      
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <>
                              {statusInfo.text === 'Pending' && (
                                <button 
                                  onClick={() => handleLiveCheck(log)}
                                  disabled={updatingStatus === log.id}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border text-xs font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 transition-colors"
                                  title="Check Live BBPS Status"
                                >
                                  {updatingStatus === log.id ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button 
                                onClick={() => handleStatusChange(log.id, 'success')}
                                disabled={updatingStatus === log.id || statusInfo.text === 'Success'}
                                className={`inline-flex items-center gap-1 p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                  statusInfo.text === 'Success' 
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed' 
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                }`}
                                title="Mark as Success"
                              >
                                {updatingStatus === log.id ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                              <button 
                                onClick={() => handleStatusChange(log.id, 'failed')}
                                disabled={updatingStatus === log.id || statusInfo.text === 'Failed'}
                                className={`inline-flex items-center gap-1 p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                  statusInfo.text === 'Failed' 
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed' 
                                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                                }`}
                                title="Reject & Refund"
                              >
                                {updatingStatus === log.id ? <LoadingSpinner size="sm" /> : <XCircle className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" /> {isAdmin ? 'Details' : 'View Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          {filteredLogs.length > 0 && (
            <div className="bg-slate-800/90 px-6 py-4 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  Showing <span className="font-semibold text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-white">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> of{' '}
                  <span className="font-semibold text-white">{filteredLogs.length}</span> entries
                </span>
                <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={filteredLogs.length || 1000}>All ({filteredLogs.length})</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>

                <span className="text-xs text-slate-400 font-medium px-2">
                  Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="API Bill Payment Details"
          size="4xl" // Large size for detailed JSON viewing
        >
          {(() => {
            const req = selectedLog.request_payload || {};
            const res = selectedLog.response_payload || {};
            const statusInfo = getStatusInfo(selectedLog.status_code, res, selectedLog.payment_status);
            const bbpsTxnId = res?.billPayResponse?.txnRefId || res?.ExtBillPayResponse?.txnRefId || res?.txnRefId;
            const chargeVal = Number(
              (selectedLog as any).charge_deducted ?? 
              req?.chargeDeducted ?? 
              req?.chargePerBill ?? 
              req?.charge ?? 
              (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ?? 
              0
            );

            return (
              <div className="space-y-6">
                
                {/* Summary Header */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Bill Amount</div>
                    <div className="text-lg font-bold text-white">₹ {Number(req.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-amber-500 uppercase font-bold mb-1">Service Charge</div>
                    <div className="text-lg font-bold text-amber-400">₹ {chargeVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-emerald-500 uppercase font-bold mb-1">Total Amount</div>
                    <div className="text-lg font-bold text-emerald-400">₹ {(Number(req.amount || 0) + chargeVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Status</div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.icon} {statusInfo.text}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Transaction ID</div>
                    <div className="text-sm font-mono text-slate-300 break-all" title="API Txn ID">{res.transaction_id || 'N/A'}</div>
                    {bbpsTxnId && (
                       <div className="text-xs font-mono text-indigo-400 mt-1" title="BillAvenue Ref ID">BBPS: {bbpsTxnId}</div>
                    )}
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Date</div>
                    <div className="text-sm text-slate-300">{format(parseISO(selectedLog.created_at), 'dd MMM yyyy, hh:mm:ss a')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Request Column */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-indigo-400 flex items-center gap-2 border-b border-slate-700 pb-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      Request Details (Agent -&gt; API)
                    </h3>
                    
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                       <dl className="space-y-3 text-sm">
                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">Biller ID</dt>
                           <dd className="text-white font-medium">{req.billerId || 'N/A'}</dd>
                         </div>
                         
                         {req.customerParams && req.customerParams.length > 0 && (
                           <div>
                             <dt className="text-slate-500 text-xs uppercase font-bold">Parameters</dt>
                             <dd className="text-white font-medium text-sm mt-1">
                               {req.customerParams.map((p: any, i: number) => (
                                 <div key={i} className="mb-1"><span className="text-slate-400 text-xs">{p.name}:</span> <span className="font-mono">{p.value}</span></div>
                               ))}
                             </dd>
                           </div>
                         )}

                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">Mobile</dt>
                           <dd className="text-white font-medium">{req.mobile || 'N/A'}</dd>
                         </div>
                       </dl>
                       
                       {/* Customer Params */}
                       {req.customerParams && req.customerParams.length > 0 && (
                         <div className="mt-4 pt-4 border-t border-slate-800">
                           <dt className="text-slate-500 text-xs uppercase font-bold mb-2">Customer Parameters</dt>
                           <div className="bg-slate-950 rounded-lg p-3 space-y-2">
                             {req.customerParams.map((param: any, idx: number) => (
                               <div key={idx} className="flex justify-between items-center text-xs">
                                 <span className="text-slate-400">{param.name}:</span>
                                 <span className="text-indigo-300 font-medium">{param.value}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                       {/* Biller Response Info (if provided during pay) */}
                       {req.billerResponseInfo && Object.keys(req.billerResponseInfo).length > 0 && (
                         <div className="mt-4 pt-4 border-t border-slate-800">
                           <dt className="text-slate-500 text-xs uppercase font-bold mb-2">Fetched Bill Details (billerResponseInfo)</dt>
                           <div className="bg-slate-950 rounded-lg p-3">
                             <pre className="text-[10px] text-slate-300 overflow-x-auto">
                               {JSON.stringify(req.billerResponseInfo, null, 2)}
                             </pre>
                           </div>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Response Column */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-emerald-400 flex items-center gap-2 border-b border-slate-700 pb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      Response Details (API -&gt; Agent)
                    </h3>

                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                      <dl className="space-y-3 text-sm">
                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">HTTP Status Code</dt>
                           <dd className="text-white font-mono">{selectedLog.status_code}</dd>
                         </div>
                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">API Response Code</dt>
                           <dd className="text-amber-400 font-mono font-bold">
                             {res?.data?.responseCode || res?.responseCode || 'N/A'}
                           </dd>
                         </div>
                      </dl>

                      <div className="mt-4 pt-4 border-t border-slate-800">
                        <dt className="text-slate-500 text-xs uppercase font-bold mb-2">Full JSON Response</dt>
                        <div className="bg-slate-950 rounded-lg p-3">
                          <pre className="text-[10px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(res, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

    </div>
  );
}
