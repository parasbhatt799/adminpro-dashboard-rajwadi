import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  FileSpreadsheet, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Users, 
  Calendar, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Receipt,
  Scale
} from 'lucide-react';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import * as XLSX from 'xlsx';

interface AgentCred {
  id: string;
  agent_id?: string;
  b2b_login_id?: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  wallet_balance?: number | string;
  is_active?: boolean;
  billavenue_agent_id?: string;
}

interface FundRequestItem {
  id: string;
  agent_id: string;
  amount: number;
  status: string;
  created_at: string;
  utr_number?: string;
  b2b_admin_bank_accounts?: {
    account_name?: string;
    bank_name?: string;
  };
}

interface BillLogItem {
  id: string;
  agent_id: string;
  created_at: string;
  status_code: number;
  payment_status?: string;
  charge_deducted?: number;
  developer_charge?: number;
  owner_charge?: number;
  request_payload?: any;
  response_payload?: any;
}

type CombinedEntry = {
  id: string;
  date: string;
  agent_id: string;
  agent_name: string;
  agent_login: string;
  type: 'fund' | 'bill';
  reference: string;
  details: string;
  amount: number;
  charge: number;
  netImpact: number;
  status: 'success' | 'pending' | 'failed';
  rawStatus: string;
};

export default function B2BAdminUserHisab() {
  const [agents, setAgents] = useState<AgentCred[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom'>('today');
  const [customRange, setCustomRange] = useState({
    start: '', // Format: YYYY-MM-DDTHH:mm
    end: ''
  });

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'fund' | 'bill'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');

  // Raw data
  const [fundRequests, setFundRequests] = useState<FundRequestItem[]>([]);
  const [billLogs, setBillLogs] = useState<BillLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAgentId, dateFilter, customRange, searchTerm, typeFilter, statusFilter]);

  // Initial load of agents list
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchHisabData();

    // Supabase Realtime subscriptions for both tables
    const fundChannel = supabase
      .channel('b2b_hisab_fund_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_fund_requests' }, () => {
        fetchHisabData();
        fetchAgents();
      })
      .subscribe();

    const logChannel = supabase
      .channel('b2b_hisab_log_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_api_logs' }, () => {
        fetchHisabData();
      })
      .subscribe();

    const credChannel = supabase
      .channel('b2b_hisab_cred_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_api_credentials' }, () => {
        fetchAgents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(fundChannel);
      supabase.removeChannel(logChannel);
      supabase.removeChannel(credChannel);
    };
  }, [selectedAgentId, dateFilter, customRange]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('b2b_api_credentials')
        .select('id, agent_id, b2b_login_id, first_name, last_name, mobile, wallet_balance, is_active, billavenue_agent_id')
        .order('first_name', { ascending: true });

      if (error) throw error;
      if (data) setAgents(data);
    } catch (err) {
      console.error('Error fetching B2B agents:', err);
    }
  };

  const calculateDateBounds = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let startIso: string | null = null;
    let endIso: string | null = null;

    if (dateFilter === 'today') {
      startIso = todayStart.toISOString();
      endIso = todayEnd.toISOString();
    } else if (dateFilter === 'yesterday') {
      const yStart = new Date(todayStart);
      yStart.setDate(yStart.getDate() - 1);
      const yEnd = new Date(todayStart.getTime() - 1);
      startIso = yStart.toISOString();
      endIso = yEnd.toISOString();
    } else if (dateFilter === '7days') {
      const d7 = new Date(todayStart);
      d7.setDate(d7.getDate() - 7);
      startIso = d7.toISOString();
    } else if (dateFilter === '30days') {
      const d30 = new Date(todayStart);
      d30.setDate(d30.getDate() - 30);
      startIso = d30.toISOString();
    } else if (dateFilter === 'thisMonth') {
      const m1 = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      startIso = m1.toISOString();
    } else if (dateFilter === 'custom') {
      if (customRange.start) {
        startIso = new Date(customRange.start).toISOString();
      }
      if (customRange.end) {
        endIso = new Date(customRange.end).toISOString();
      }
    }

    return { startIso, endIso };
  };

  const fetchHisabData = async () => {
    try {
      setLoading(true);
      const { startIso, endIso } = calculateDateBounds();

      // 1. Fetch Fund Requests
      let allFunds: FundRequestItem[] = [];
      let fundFrom = 0;
      const fundStep = 1000;
      let fundHasMore = true;

      while (fundHasMore) {
        let q = supabase
          .from('b2b_fund_requests')
          .select('id, agent_id, amount, status, created_at, utr_number, b2b_admin_bank_accounts(account_name, bank_name)')
          .order('created_at', { ascending: false })
          .range(fundFrom, fundFrom + fundStep - 1);

        if (selectedAgentId !== 'all') {
          q = q.eq('agent_id', selectedAgentId);
        }
        if (startIso) q = q.gte('created_at', startIso);
        if (endIso) q = q.lte('created_at', endIso);

        const { data, error } = await q;
        if (error) {
          console.error('Error fetching fund requests:', error);
          break;
        }

        if (data && data.length > 0) {
          allFunds = allFunds.concat(data as any);
          if (data.length < fundStep) fundHasMore = false;
          else fundFrom += fundStep;
        } else {
          fundHasMore = false;
        }
      }

      setFundRequests(allFunds);

      // 2. Fetch Bill Logs
      let allLogs: BillLogItem[] = [];
      let logFrom = 0;
      const logStep = 1000;
      let logHasMore = true;

      while (logHasMore) {
        let q = supabase
          .from('b2b_api_logs')
          .select('id, agent_id, created_at, status_code, payment_status, charge_deducted, developer_charge, owner_charge, request_payload, response_payload')
          .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
          .order('created_at', { ascending: false })
          .range(logFrom, logFrom + logStep - 1);

        if (selectedAgentId !== 'all') {
          q = q.eq('agent_id', selectedAgentId);
        }
        if (startIso) q = q.gte('created_at', startIso);
        if (endIso) q = q.lte('created_at', endIso);

        const { data, error } = await q;
        if (error) {
          console.error('Error fetching bill logs:', error);
          break;
        }

        if (data && data.length > 0) {
          allLogs = allLogs.concat(data as any);
          if (data.length < logStep) logHasMore = false;
          else logFrom += logStep;
        } else {
          logHasMore = false;
        }
      }

      setBillLogs(allLogs);
    } catch (err) {
      console.error('Error fetching hisab data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Agent Lookup Map
  const agentMap = useMemo(() => {
    const map: Record<string, AgentCred> = {};
    agents.forEach((ag) => {
      if (ag.id) map[ag.id] = ag;
      if (ag.agent_id) map[ag.agent_id] = ag;
    });
    return map;
  }, [agents]);

  // Helper to determine status for a bill log
  const parseBillLogStatus = (log: BillLogItem) => {
    const req = log.request_payload || {};
    const res = log.response_payload || {};
    const bpr = res?.ExtBillPayResponse || res?.billPayResponse || res;
    const responseCode = String(bpr?.responseCode || res?.responseCode || '').trim();
    const responseReason = String(bpr?.responseReason || res?.responseReason || '').trim().toLowerCase();
    const txnStatus = String(bpr?.txnStatus || res?.txnStatus || res?.statusCheckDetails?.bbpsStatus || '').trim().toUpperCase();
    const errorCode = String(bpr?.errorInfo?.error?.errorCode || bpr?.errorCode || res?.errorCode || '').trim().toUpperCase();
    const txnRefId = bpr?.txnRefId || res?.txnRefId || bpr?.txnReferenceId || res?.txnReferenceId;
    const hasCC01 = !!(txnRefId && String(txnRefId).toUpperCase().startsWith('CC01'));
    const rawStatus = (res?.payment_status || res?.finalStatus || log.payment_status || '').toLowerCase();

    // Success check
    const isSuccess =
      txnStatus === 'SUCCESS' ||
      txnStatus === 'APPROVED' ||
      (rawStatus === 'success' && txnStatus !== 'AWAITED' && txnStatus !== 'PENDING') ||
      (!['AWAITED', 'PENDING', 'FAILED', 'FAILURE', 'REJECTED'].includes(txnStatus) &&
        (responseCode === '000' || responseCode === '0000') &&
        (responseReason === 'successful' || responseReason === 'success') &&
        errorCode !== 'PNR001' && errorCode !== 'PWB001') ||
      (hasCC01 && log.status_code === 200 && rawStatus !== 'failed');

    if (isSuccess) return 'success';

    // Pending check
    const isPending =
      txnStatus === 'PENDING' ||
      txnStatus === 'AWAITED' ||
      rawStatus === 'pending' ||
      (hasCC01 && rawStatus !== 'failed' && !isSuccess) ||
      (log.status_code === 200 && !responseCode && !rawStatus);

    if (isPending) return 'pending';

    return 'failed';
  };

  // Helper to extract bill amount and charge
  const parseBillLogValues = (log: BillLogItem) => {
    const req = log.request_payload || {};
    const res = log.response_payload || {};

    const amount = Number(req?.amount || res?.amount || 0);

    const charge = Number(
      log.charge_deducted ??
      req?.chargeDeducted ??
      req?.chargePerBill ??
      req?.charge ??
      (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ??
      0
    );

    return { amount, charge };
  };

  // -------------------------------------------------------------
  // CARDS CALCULATIONS (SUMMARY STATS)
  // -------------------------------------------------------------
  const summaryStats = useMemo(() => {
    // 1. Approve Fund Total
    let approvedFundAmount = 0;
    let approvedFundCount = 0;
    let pendingFundAmount = 0;
    let pendingFundCount = 0;

    fundRequests.forEach((req) => {
      const st = (req.status || '').toLowerCase();
      const amt = Number(req.amount || 0);
      if (st === 'approved') {
        approvedFundAmount += amt;
        approvedFundCount++;
      } else if (st === 'pending') {
        pendingFundAmount += amt;
        pendingFundCount++;
      }
    });

    // 2. Bill Payment Total & Charges
    let billSuccessAmount = 0;
    let billSuccessCount = 0;
    let billSuccessCharge = 0;

    let billPendingAmount = 0;
    let billPendingCount = 0;
    let billPendingCharge = 0;

    let billFailedAmount = 0;
    let billFailedCount = 0;

    billLogs.forEach((log) => {
      const status = parseBillLogStatus(log);
      const { amount, charge } = parseBillLogValues(log);

      if (status === 'success') {
        billSuccessAmount += amount;
        billSuccessCount++;
        billSuccessCharge += charge;
      } else if (status === 'pending') {
        billPendingAmount += amount;
        billPendingCount++;
        billPendingCharge += charge;
      } else {
        billFailedAmount += amount;
        billFailedCount++;
      }
    });

    // 3. User Wallet Balance
    let totalUserBalance = 0;
    if (selectedAgentId === 'all') {
      agents.forEach((ag) => {
        totalUserBalance += Number(ag.wallet_balance || 0);
      });
    } else {
      const ag = agentMap[selectedAgentId];
      totalUserBalance = Number(ag?.wallet_balance || 0);
    }

    // 4. Accounting Hisab Equation
    // Total Inflow = Approved Fund
    // Total Outflow = Bill Payment Amount + Total Charge
    const totalOutflow = billSuccessAmount + billSuccessCharge;
    const expectedRemaining = approvedFundAmount - totalOutflow;
    const difference = totalUserBalance - expectedRemaining;

    return {
      approvedFundAmount,
      approvedFundCount,
      pendingFundAmount,
      pendingFundCount,

      billSuccessAmount,
      billSuccessCount,
      billSuccessCharge,

      billPendingAmount,
      billPendingCount,
      billPendingCharge,

      billFailedAmount,
      billFailedCount,

      totalUserBalance,
      totalOutflow,
      expectedRemaining,
      difference
    };
  }, [fundRequests, billLogs, agents, selectedAgentId, agentMap]);

  // -------------------------------------------------------------
  // COMBINED CHRONOLOGICAL TRANSACTIONS LIST
  // -------------------------------------------------------------
  const combinedEntries: CombinedEntry[] = useMemo(() => {
    const list: CombinedEntry[] = [];

    // Add Fund Requests
    fundRequests.forEach((req) => {
      const ag = agentMap[req.agent_id];
      const agName = ag ? [ag.first_name, ag.last_name].filter(Boolean).join(' ') || 'B2B User' : 'Unknown User';
      const agLogin = ag?.b2b_login_id || ag?.mobile || 'N/A';
      const st = (req.status || '').toLowerCase();

      let mappedStatus: 'success' | 'pending' | 'failed' = 'pending';
      if (st === 'approved') mappedStatus = 'success';
      else if (st === 'rejected') mappedStatus = 'failed';

      const amt = Number(req.amount || 0);
      const bankInfo = req.b2b_admin_bank_accounts
        ? `${req.b2b_admin_bank_accounts.bank_name || ''} - ${req.b2b_admin_bank_accounts.account_name || ''}`.trim()
        : '';

      list.push({
        id: `fund-${req.id}`,
        date: req.created_at,
        agent_id: req.agent_id,
        agent_name: agName,
        agent_login: agLogin,
        type: 'fund',
        reference: req.utr_number ? `UTR: ${req.utr_number}` : `Req ID: #${req.id.slice(0, 8)}`,
        details: bankInfo || 'Wallet Fund Request',
        amount: amt,
        charge: 0,
        netImpact: amt, // credit
        status: mappedStatus,
        rawStatus: req.status
      });
    });

    // Add Bill Logs
    billLogs.forEach((log) => {
      const ag = agentMap[log.agent_id];
      const agName = ag ? [ag.first_name, ag.last_name].filter(Boolean).join(' ') || 'B2B User' : 'Unknown User';
      const agLogin = ag?.b2b_login_id || ag?.mobile || 'N/A';

      const req = log.request_payload || {};
      const res = log.response_payload || {};
      const status = parseBillLogStatus(log);
      const { amount, charge } = parseBillLogValues(log);

      const txnId = res?.transaction_id || req?.transaction_id || req?.client_transaction_id || log.id;
      const bbpsTxnId = res?.billPayResponse?.txnRefId || res?.ExtBillPayResponse?.txnRefId || res?.txnRefId || '';
      const refText = bbpsTxnId ? `BBPS Ref: ${bbpsTxnId}` : `Txn ID: ${txnId ? String(txnId).slice(0, 14) : log.id.slice(0, 8)}`;

      const billerInfo = req?.billerId ? `Biller: ${req.billerId}` : 'Bill Payment';
      const mobileInfo = req?.mobile ? `Mob: ${req.mobile}` : '';
      const detailText = [billerInfo, mobileInfo].filter(Boolean).join(' | ');

      list.push({
        id: `bill-${log.id}`,
        date: log.created_at,
        agent_id: log.agent_id,
        agent_name: agName,
        agent_login: agLogin,
        type: 'bill',
        reference: refText,
        details: detailText,
        amount: amount,
        charge: charge,
        netImpact: -(amount + charge), // debit
        status: status,
        rawStatus: status.toUpperCase()
      });
    });

    // Sort descending by date
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [fundRequests, billLogs, agentMap]);

  // Filtered entries for table
  const filteredEntries = useMemo(() => {
    return combinedEntries.filter((item) => {
      // Type Filter
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;

      // Status Filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Search
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matches =
          item.agent_name.toLowerCase().includes(s) ||
          item.agent_login.toLowerCase().includes(s) ||
          item.reference.toLowerCase().includes(s) ||
          item.details.toLowerCase().includes(s) ||
          String(item.amount).includes(s);
        if (!matches) return false;
      }

      return true;
    });
  }, [combinedEntries, typeFilter, statusFilter, searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  // -------------------------------------------------------------
  // EXPORT TO EXCEL
  // -------------------------------------------------------------
  const handleExportExcel = () => {
    try {
      const selectedAgentName =
        selectedAgentId === 'all'
          ? 'All Users'
          : `${agentMap[selectedAgentId]?.first_name || ''} (${agentMap[selectedAgentId]?.b2b_login_id || ''})`;

      // 1. Summary Sheet
      const summaryData = [
        ['B2B USER HISAB & RECONCILIATION REPORT'],
        ['Generated At', format(new Date(), 'dd-MMM-yyyy hh:mm a')],
        ['Selected User', selectedAgentName],
        ['Date Filter', dateFilter.toUpperCase()],
        [],
        ['SUMMARY METRICS', 'AMOUNT (INR)', 'COUNT / REMARKS'],
        ['Approve Fund Total Amount', summaryStats.approvedFundAmount, `${summaryStats.approvedFundCount} Requests Approved`],
        ['Pending Fund Amount', summaryStats.pendingFundAmount, `${summaryStats.pendingFundCount} Requests Pending`],
        ['Bill Payment Total Amount (Success)', summaryStats.billSuccessAmount, `${summaryStats.billSuccessCount} Bills Paid`],
        ['Total Service Charges Deducted', summaryStats.billSuccessCharge, 'Charges from Successful Bills'],
        ['Total Spent Outflow (Bills + Charges)', summaryStats.totalOutflow, ''],
        ['Current User Wallet Balance', summaryStats.totalUserBalance, 'Live Balance in Wallet'],
        ['Expected Wallet Balance (Fund - Outflow)', summaryStats.expectedRemaining, ''],
        ['Reconciliation Difference', summaryStats.difference, summaryStats.difference === 0 ? '100% Matched' : 'Discrepancy / Prior Balance']
      ];

      // 2. Transaction Records Sheet
      const txData = [
        ['#', 'Date & Time', 'User Name', 'Login ID', 'Type', 'Reference ID', 'Details / Biller', 'Amount (INR)', 'Charge (INR)', 'Net Impact (INR)', 'Status'],
        ...filteredEntries.map((row, idx) => [
          idx + 1,
          format(new Date(row.date), 'dd/MM/yyyy hh:mm a'),
          row.agent_name,
          row.agent_login,
          row.type === 'fund' ? 'Fund In (ક્રેડિટ)' : 'Bill Out (ડેબિટ)',
          row.reference,
          row.details,
          row.amount,
          row.charge,
          row.netImpact,
          row.status.toUpperCase()
        ])
      ];

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const wsTx = XLSX.utils.aoa_to_sheet(txData);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Hisab Summary');
      XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions Ledger');

      const fileName = `B2B_Hisab_${selectedAgentId === 'all' ? 'All_Users' : agentMap[selectedAgentId]?.b2b_login_id || 'User'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Error exporting Excel report.');
    }
  };

  const selectedAgentObj = selectedAgentId !== 'all' ? agentMap[selectedAgentId] : null;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                User Hisab & Reconciliation
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-medium">
                  સિંગલ સ્ક્રીન હિસાબ
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                એક જ પેજ પરથી એપ્રૂવ ફંડ, બિલ પેમેન્ટ, ચાર્જ અને યુઝર બેલેન્સનો સંપૂર્ણ હિસાબ મેળવો
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              fetchHisabData();
              fetchAgents();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition font-medium text-sm disabled:opacity-50"
            title="ડેટા રિફ્રેશ કરો"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-lg shadow-emerald-600/20 transition"
            title="Excel શીટ ડાઉનલોડ કરો"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel Export
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 🔍 FILTERS BAR (USER DROPDOWN & DATE-TIME FILTERS)           */}
      {/* ============================================================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm border-b border-slate-800/80 pb-3">
          <Filter className="h-4 w-4 text-indigo-400" />
          <span>ફિલ્ટર્સ (Filters): યુઝર વાઇઝ & તારીખ-સમય ફિલ્ટર</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* 1. USER WISE DROPDOWN FILTER */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              યુઝર પસંદ કરો (User / Agent Wise Filter):
            </label>
            <div className="relative">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none pr-9 font-medium"
              >
                <option value="all">🌐 બધા યુઝર્સ (All B2B Agents) - કુલ {agents.length}</option>
                {agents.map((ag) => {
                  const name = [ag.first_name, ag.last_name].filter(Boolean).join(' ') || 'User';
                  const bal = Number(ag.wallet_balance || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                  return (
                    <option key={ag.id} value={ag.id}>
                      {name} ({ag.b2b_login_id || ag.mobile || ag.id.slice(0, 6)}) — વૉલેટ: ₹{bal}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
            {selectedAgentObj && (
              <p className="text-[11px] text-indigo-400 mt-1 truncate">
                સિલેક્ટ કરેલ: <span className="text-white font-medium">{selectedAgentObj.first_name} {selectedAgentObj.last_name}</span> | Login ID: <span className="text-amber-400 font-mono">{selectedAgentObj.b2b_login_id || 'N/A'}</span>
              </p>
            )}
          </div>

          {/* 2. DATE PRESET DROPDOWN */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              તારીખ ગાળો (Date Range):
            </label>
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none pr-9 font-medium"
              >
                <option value="today">આજે (Today)</option>
                <option value="yesterday">ગઈકાલે (Yesterday)</option>
                <option value="7days">છેલ્લા ૭ દિવસ (Last 7 Days)</option>
                <option value="30days">છેલ્લા ૩૦ દિવસ (Last 30 Days)</option>
                <option value="thisMonth">આ મહિને (This Month)</option>
                <option value="all">ઓલ ટાઈમ (All Time History)</option>
                <option value="custom">કસ્ટમ તારીખ અને સમય (Custom Range)...</option>
              </select>
              <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {dateFilter === 'today' && 'આજના દિવસના 12:00 AM થી અત્યાર સુધીનો હિસાબ'}
              {dateFilter === 'yesterday' && 'ગઈકાલના આખા દિવસનો હિસાબ'}
              {dateFilter === '7days' && 'છેલ્લા 7 દિવસના તમામ ટ્રાન્ઝેક્શન્સ'}
              {dateFilter === '30days' && 'છેલ્લા 30 દિવસના તમામ ટ્રાન્ઝેક્શન્સ'}
              {dateFilter === 'thisMonth' && 'ચાલુ મહિનાની 1લી તારીખથી અત્યાર સુધી'}
              {dateFilter === 'all' && 'શરૂઆતથી અત્યાર સુધીનો પૂર્ણ હિસાબ'}
              {dateFilter === 'custom' && 'ચોક્કસ સમયગાળો નીચે સેટ કરો'}
            </p>
          </div>

          {/* 3. CURRENT ACTIVE FILTER SUMMARY */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">કુલ એન્ટ્રીઓ (Total Records)</span>
              <span className="text-lg font-bold text-white">
                {fundRequests.length + billLogs.length}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({fundRequests.length} ફંડ + {billLogs.length} બિલ)
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">સ્થિતિ (Status)</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-medium">
                Live Data
              </span>
            </div>
          </div>
        </div>

        {/* CUSTOM DATE & TIME PICKER (Conditional) */}
        {dateFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-3.5 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                શરૂઆતની તારીખ અને સમય (Start Date & Time):
              </label>
              <input
                type="datetime-local"
                value={customRange.start}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                અંતિમ તારીખ અને સમય (End Date & Time):
              </label>
              <input
                type="datetime-local"
                value={customRange.end}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 📊 ALL 4 MAIN CARDS + HISAB TALLY STATUS CARD                */}
      {/* ============================================================ */}
      {loading ? (
        <div className="h-44 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <LoadingSpinner size="lg" />
          <p className="text-slate-400 text-sm mt-3 animate-pulse">હિસાબ ગણતરી ચાલુ છે...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* CARD 1: APPROVE FUND TOTAL AMOUNT */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-500/15 p-3 rounded-xl border border-emerald-500/30 text-emerald-400">
                <ArrowDownLeft className="h-6 w-6" />
              </div>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                {summaryStats.approvedFundCount} મંજૂર (Approved)
              </span>
            </div>
            <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mb-1">
              Approve Fund Total Amount
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.approvedFundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>પેન્ડિંગ રિક્વેસ્ટ:</span>
              <span className="text-amber-400 font-semibold">
                {summaryStats.pendingFundCount} (₹{summaryStats.pendingFundAmount.toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          {/* CARD 2: BILL PAYMENT TOTAL AMOUNT */}
          <div className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-blue-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-500/15 p-3 rounded-xl border border-blue-500/30 text-blue-400">
                <Receipt className="h-6 w-6" />
              </div>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                {summaryStats.billSuccessCount} સફળ (Success)
              </span>
            </div>
            <p className="text-xs font-extrabold text-blue-400 uppercase tracking-wider mb-1">
              Bill Payment Total Amount
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.billSuccessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-blue-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>પેન્ડિંગ / ફેલ બિલ્સ:</span>
              <span className="text-slate-300 font-medium">
                {summaryStats.billPendingCount} પેન્ડિંગ | {summaryStats.billFailedCount} ફેલ
              </span>
            </div>
          </div>

          {/* CARD 3: CHARGE TOTAL AMOUNT */}
          <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-purple-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-purple-500/15 p-3 rounded-xl border border-purple-500/30 text-purple-400">
                <DollarSign className="h-6 w-6" />
              </div>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-semibold">
                સર્વિસ ચાર્જ
              </span>
            </div>
            <p className="text-xs font-extrabold text-purple-400 uppercase tracking-wider mb-1">
              Charge Total Amount
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.billSuccessCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>બિલ + ચાર્જ કુલ ખર્ચ:</span>
              <span className="text-purple-300 font-semibold">
                ₹{summaryStats.totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* CARD 4: TOTAL USER BALANCE */}
          <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-500/15 p-3 rounded-xl border border-amber-500/30 text-amber-400">
                <Wallet className="h-6 w-6" />
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                {selectedAgentId === 'all' ? 'બધા યુઝર્સ' : 'સિલેક્ટેડ યુઝર'}
              </span>
            </div>
            <p className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-1">
              Total User Balance
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.totalUserBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>વૉલેટ સ્થિતિ:</span>
              <span className="text-emerald-400 font-semibold">લાઈવ ઉપલબ્ધ બેલેન્સ</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ⚖️ HISAB RECONCILIATION FORMULA STRIP                        */}
      {/* ============================================================ */}
      {!loading && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  સંપૂર્ણ હિસાબ મેળવણી (Accounting Equation Tally)
                </h3>
                <p className="text-xs text-slate-400">
                  કુલ મંજૂર ફંડ - (બિલ પેમેન્ટ + કપાયેલ ચાર્જ) = બાકી વૉલેટ બેલેન્સ
                </p>
              </div>
            </div>

            {/* Reconciliation Tally Status */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-emerald-400 font-semibold" title="કુલ એપ્રૂવ ફંડ">
                ફંડ: ₹{summaryStats.approvedFundAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-400 font-bold">-</span>
              <span className="text-slate-500 font-bold">(</span>
              <span className="text-blue-400 font-semibold" title="કુલ બિલ પેમેન્ટ">
                બિલ: ₹{summaryStats.billSuccessAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-400 font-bold">+</span>
              <span className="text-purple-400 font-semibold" title="કુલ ચાર્જ">
                ચાર્જ: ₹{summaryStats.billSuccessCharge.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-500 font-bold">)</span>
              <span className="text-slate-400 font-bold">=</span>
              <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="ફંડમાંથી બિલ અને ચાર્જ બાદ કરતાં વધતી રકમ">
                બાકી વૉલેટ: ₹{summaryStats.expectedRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Difference Indicator */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">અપેક્ષિત બાકી રકમ (Fund - Spent):</span>
              <span className="text-white font-mono font-bold">
                ₹{summaryStats.expectedRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">હાલનું વૉલેટ બેલેન્સ:</span>
              <span className="text-amber-300 font-mono font-bold">
                ₹{summaryStats.totalUserBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              {Math.abs(summaryStats.difference) < 0.01 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ૧૦૦% હિસાબ મેળવેલ (Perfect Tally Matched)
                </span>
              ) : dateFilter !== 'all' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  આ સમયગાળાનો હિસાબ (અગાઉનું બેલેન્સ સામેલ હોઈ શકે)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  તફાવત (Difference): ₹{Math.abs(summaryStats.difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 📋 COMBINED TRANSACTIONS TABLE (NO TABS, ALL ON SAME PAGE)    */}
      {/* ============================================================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* TABLE CONTROLS BAR */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              વિગતવાર હિસાબ લેજર (Combined Transactions Ledger)
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                {filteredEntries.length} Records
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              સિંગલ લિસ્ટમાં ફંડ જમા અને બિલ પેમેન્ટના તમામ ટ્રાન્ઝેક્શન્સ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search UTR, Txn, Mobile..."
                className="bg-slate-950 border border-slate-700 text-white rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52 sm:w-60"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${typeFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                બધું (All)
              </button>
              <button
                onClick={() => setTypeFilter('fund')}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${typeFilter === 'fund' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                📥 ફંડ
              </button>
              <button
                onClick={() => setTypeFilter('bill')}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${typeFilter === 'bill' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                📤 બિલ્સ
              </button>
            </div>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">બધા સ્ટેટસ (All Status)</option>
              <option value="success">સફળ / મંજૂર (Success/Approved)</option>
              <option value="pending">પેન્ડિંગ (Pending)</option>
              <option value="failed">ફેલ / રદ (Failed/Rejected)</option>
            </select>
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">તારીખ & સમય</th>
                <th className="px-4 py-3.5">યુઝર / એજન્ટ</th>
                <th className="px-4 py-3.5">પ્રકાર (Type)</th>
                <th className="px-4 py-3.5">રેફરન્સ / વિગત</th>
                <th className="px-4 py-3.5 text-right">રકમ (Amount)</th>
                <th className="px-4 py-3.5 text-right">ચાર્જ (Charge)</th>
                <th className="px-4 py-3.5 text-right">કુલ અસર (Net Impact)</th>
                <th className="px-4 py-3.5 text-center">સ્ટેટસ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="h-8 w-8 text-slate-600" />
                      <p className="font-semibold text-sm">કોઈ ટ્રાન્ઝેક્શન્સ મળ્યા નહીં</p>
                      <p className="text-xs text-slate-500">પસંદ કરેલ યુઝર અથવા ફિલ્ટર બદલીને ફરી પ્રયાસ કરો.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((row) => {
                  const isFund = row.type === 'fund';
                  const isSuccess = row.status === 'success';
                  const isPending = row.status === 'pending';

                  return (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Date & Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-white">
                          {format(new Date(row.date), 'dd MMM yyyy')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {format(new Date(row.date), 'hh:mm:ss a')}
                        </div>
                      </td>

                      {/* User / Agent */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white truncate max-w-[160px]" title={row.agent_name}>
                          {row.agent_name}
                        </div>
                        <div className="text-[11px] text-indigo-400 font-mono truncate">
                          ID: {row.agent_login}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isFund ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                            <ArrowDownLeft className="h-3 w-3" />
                            ફંડ જમા (Credit)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold text-[11px]">
                            <ArrowUpRight className="h-3 w-3" />
                            બિલ ચૂકવણી (Debit)
                          </span>
                        )}
                      </td>

                      {/* Reference & Details */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="font-mono text-slate-200 truncate font-medium" title={row.reference}>
                          {row.reference}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate" title={row.details}>
                          {row.details}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-mono font-bold text-sm ${isFund ? 'text-emerald-400' : 'text-slate-100'}`}>
                          {isFund ? '+' : ''}₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Charge */}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono">
                        {row.charge > 0 ? (
                          <span className="text-purple-400 font-semibold">
                            ₹{row.charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Net Impact */}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-bold">
                        {isFund ? (
                          <span className="text-emerald-400">
                            +₹{row.netImpact.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-rose-400">
                            -₹{Math.abs(row.netImpact).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            {isFund ? 'Approved' : 'Success'}
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-semibold text-[10px]">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 font-semibold text-[10px]">
                            <XCircle className="h-3 w-3" />
                            {isFund ? 'Rejected' : 'Failed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>દર્શાવો:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value={25}>25 પ્રતિ પેજ</option>
              <option value={50}>50 પ્રતિ પેજ</option>
              <option value={100}>100 પ્રતિ પેજ</option>
            </select>
            <span>કુલ {filteredEntries.length} માંથી {(currentPage - 1) * pageSize + 1} થી {Math.min(currentPage * pageSize, filteredEntries.length)}</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
              title="અગાઉનું પેજ"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-white px-2">
              પેજ {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
              title="આગળનું પેજ"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
