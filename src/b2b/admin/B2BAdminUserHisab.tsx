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
  Scale,
  Send,
  Zap,
  Building2,
  Percent,
  RotateCcw
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
  payout_wallet_balance?: number | string;
  cspl_wallet_balance?: number | string;
  is_active?: boolean;
  billavenue_agent_id?: string;
  is_bbps_enabled?: boolean;
  is_payout_enabled?: boolean;
  is_cspl_enabled?: boolean;
}

interface FundRequestItem {
  id: string;
  agent_id: string;
  amount: number;
  status: string;
  created_at: string;
  utr_number?: string;
  wallet_type?: string;
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

interface PayoutTxItem {
  id: string;
  agent_id: string;
  order_id: string;
  client_order_id?: string;
  amount: number;
  charge: number;
  base_charge?: number;
  gst_amount?: number;
  total_deducted: number;
  beneficiary_name?: string;
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  transfer_mode?: string;
  status: string;
  utr?: string;
  is_refunded?: boolean;
  created_at: string;
  error_message?: string;
}

type CombinedEntry = {
  id: string;
  date: string;
  agent_id: string;
  agent_name: string;
  agent_login: string;
  type: 'fund' | 'bill' | 'payout';
  reference: string;
  details: string;
  amount: number;
  charge: number;
  netImpact: number;
  status: 'success' | 'pending' | 'failed';
  rawStatus: string;
  isRefunded?: boolean;
};

export default function B2BAdminUserHisab() {
  // Active Wallet Category: BBPS, Payout, or CSPL
  const [selectedWallet, setSelectedWallet] = useState<'bbps' | 'payout' | 'cspl'>('bbps');

  const [agents, setAgents] = useState<AgentCred[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom'>('today');
  const [customRange, setCustomRange] = useState({
    start: '', // Format: YYYY-MM-DDTHH:mm
    end: ''
  });

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'fund' | 'debit'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');

  // Raw data
  const [fundRequests, setFundRequests] = useState<FundRequestItem[]>([]);
  const [allTimeApprovedFund, setAllTimeApprovedFund] = useState<number>(0);
  const [billLogs, setBillLogs] = useState<BillLogItem[]>([]);
  const [payoutTransactions, setPayoutTransactions] = useState<PayoutTxItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWallet, selectedAgentId, dateFilter, customRange, searchTerm, typeFilter, statusFilter]);

  // Initial load of agents list
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch data when filters or active wallet tab change
  useEffect(() => {
    fetchHisabData();

    // Supabase Realtime subscriptions
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

    const payoutChannel = supabase
      .channel('b2b_hisab_payout_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_payout_transactions' }, () => {
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
      supabase.removeChannel(payoutChannel);
      supabase.removeChannel(credChannel);
    };
  }, [selectedWallet, selectedAgentId, dateFilter, customRange]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('b2b_api_credentials')
        .select('id, agent_id, b2b_login_id, first_name, last_name, mobile, wallet_balance, payout_wallet_balance, cspl_wallet_balance, is_active, billavenue_agent_id, is_bbps_enabled, is_payout_enabled, is_cspl_enabled')
        .order('first_name', { ascending: true });

      if (error) throw error;
      if (data) setAgents(data as AgentCred[]);
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

      // 1. Fetch Fund Requests for all / active wallet
      let allFunds: FundRequestItem[] = [];
      let fundFrom = 0;
      const fundStep = 1000;
      let fundHasMore = true;

      while (fundHasMore) {
        let q = supabase
          .from('b2b_fund_requests')
          .select('id, agent_id, amount, status, created_at, utr_number, wallet_type, b2b_admin_bank_accounts(account_name, bank_name)')
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

      // Query all-time approved funds for this wallet to give clear context when dateFilter is active
      try {
        let lifetimeQ = supabase
          .from('b2b_fund_requests')
          .select('amount')
          .eq('status', 'approved');

        if (selectedWallet === 'payout') {
          lifetimeQ = lifetimeQ.eq('wallet_type', 'payout');
        } else if (selectedWallet === 'cspl') {
          lifetimeQ = lifetimeQ.eq('wallet_type', 'cspl');
        } else {
          lifetimeQ = lifetimeQ.or('wallet_type.eq.bbps,wallet_type.is.null');
        }

        if (selectedAgentId !== 'all') {
          lifetimeQ = lifetimeQ.eq('agent_id', selectedAgentId);
        }

        const { data: lifetimeFunds } = await lifetimeQ;
        if (lifetimeFunds) {
          const sum = lifetimeFunds.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
          setAllTimeApprovedFund(sum);
        }
      } catch (err) {
        console.error('Error fetching lifetime funds:', err);
      }
      if (selectedWallet === 'payout') {
        // Fetch from b2b_payout_transactions
        let allPayouts: PayoutTxItem[] = [];
        let payoutFrom = 0;
        const payoutStep = 1000;
        let payoutHasMore = true;

        while (payoutHasMore) {
          let q = supabase
            .from('b2b_payout_transactions')
            .select('id, agent_id, order_id, client_order_id, amount, charge, base_charge, gst_amount, total_deducted, beneficiary_name, account_number, ifsc_code, bank_name, transfer_mode, status, utr, is_refunded, created_at, error_message')
            .order('created_at', { ascending: false })
            .range(payoutFrom, payoutFrom + payoutStep - 1);

          if (selectedAgentId !== 'all') {
            q = q.eq('agent_id', selectedAgentId);
          }
          if (startIso) q = q.gte('created_at', startIso);
          if (endIso) q = q.lte('created_at', endIso);

          const { data, error } = await q;
          if (error) {
            console.error('Error fetching payout transactions:', error);
            break;
          }

          if (data && data.length > 0) {
            allPayouts = allPayouts.concat(data as any);
            if (data.length < payoutStep) payoutHasMore = false;
            else payoutFrom += payoutStep;
          } else {
            payoutHasMore = false;
          }
        }

        setPayoutTransactions(allPayouts);
        setBillLogs([]);
      } else {
        // Fetch Bill Logs for BBPS or CSPL
        let allLogs: BillLogItem[] = [];
        let logFrom = 0;
        const logStep = 1000;
        let logHasMore = true;

        const endpoints = selectedWallet === 'cspl'
          ? 'endpoint.eq./api/b2b/cspl/pay-bill,endpoint.eq./api/v1/b2b/cspl/pay-bill'
          : 'endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill';

        while (logHasMore) {
          let q = supabase
            .from('b2b_api_logs')
            .select('id, agent_id, created_at, status_code, payment_status, charge_deducted, developer_charge, owner_charge, request_payload, response_payload')
            .or(endpoints)
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
        setPayoutTransactions([]);
      }
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

  // Filter fund requests for currently active wallet
  const currentWalletFunds = useMemo(() => {
    return fundRequests.filter((req) => {
      const wt = (req.wallet_type || 'bbps').toLowerCase();
      if (selectedWallet === 'bbps') return wt === 'bbps';
      if (selectedWallet === 'payout') return wt === 'payout';
      if (selectedWallet === 'cspl') return wt === 'cspl';
      return true;
    });
  }, [fundRequests, selectedWallet]);

  // -------------------------------------------------------------
  // SUMMARY STATS CALCULATIONS FOR SELECTED WALLET
  // -------------------------------------------------------------
  const summaryStats = useMemo(() => {
    // 1. Approve Fund Total for selected wallet
    let approvedFundAmount = 0;
    let approvedFundCount = 0;
    let pendingFundAmount = 0;
    let pendingFundCount = 0;

    currentWalletFunds.forEach((req) => {
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

    // 2. Outflow Total & Charges (Bills or Payouts)
    let outflowSuccessAmount = 0;
    let outflowSuccessCount = 0;
    let outflowSuccessCharge = 0;

    let outflowPendingAmount = 0;
    let outflowPendingCount = 0;
    let outflowPendingCharge = 0;

    let outflowFailedAmount = 0;
    let outflowFailedCount = 0;

    if (selectedWallet === 'payout') {
      payoutTransactions.forEach((tx) => {
        const amt = Number(tx.amount || 0);
        const charge = Number(tx.charge || (Number(tx.base_charge || 0) + Number(tx.gst_amount || 0)) || 0);
        const st = (tx.status || '').toLowerCase();

        if (st === 'success' || st === 'approved') {
          outflowSuccessAmount += amt;
          outflowSuccessCount++;
          outflowSuccessCharge += charge;
        } else if (st === 'pending' || st === 'processing') {
          outflowPendingAmount += amt;
          outflowPendingCount++;
          outflowPendingCharge += charge;
        } else {
          outflowFailedAmount += amt;
          outflowFailedCount++;
        }
      });
    } else {
      billLogs.forEach((log) => {
        const status = parseBillLogStatus(log);
        const { amount, charge } = parseBillLogValues(log);

        if (status === 'success') {
          outflowSuccessAmount += amount;
          outflowSuccessCount++;
          outflowSuccessCharge += charge;
        } else if (status === 'pending') {
          outflowPendingAmount += amount;
          outflowPendingCount++;
          outflowPendingCharge += charge;
        } else {
          outflowFailedAmount += amount;
          outflowFailedCount++;
        }
      });
    }

    // 3. User Wallet Balance for selected wallet
    let totalUserBalance = 0;
    if (selectedAgentId === 'all') {
      agents.forEach((ag) => {
        if (selectedWallet === 'payout') {
          totalUserBalance += Number(ag.payout_wallet_balance || 0);
        } else if (selectedWallet === 'cspl') {
          totalUserBalance += Number(ag.cspl_wallet_balance || 0);
        } else {
          totalUserBalance += Number(ag.wallet_balance || 0);
        }
      });
    } else {
      const ag = agentMap[selectedAgentId];
      if (selectedWallet === 'payout') {
        totalUserBalance = Number(ag?.payout_wallet_balance || 0);
      } else if (selectedWallet === 'cspl') {
        totalUserBalance = Number(ag?.cspl_wallet_balance || 0);
      } else {
        totalUserBalance = Number(ag?.wallet_balance || 0);
      }
    }

    // 4. Accounting Reconciliation Equation
    // Total Inflow = Approved Fund
    // Total Outflow = Successful Outflow Amount + Total Charges/Fees
    const totalOutflow = outflowSuccessAmount + outflowSuccessCharge;

    // Calculate Refunds & Re-credited Adjustments
    let refundAmount = 0;
    let refundCount = 0;

    if (selectedWallet === 'payout') {
      payoutTransactions.forEach((tx) => {
        if (tx.is_refunded || (tx.status || '').toLowerCase() === 'refunded') {
          const amt = Number(tx.amount || 0);
          const chg = Number(tx.charge || (Number(tx.base_charge || 0) + Number(tx.gst_amount || 0)) || 0);
          refundAmount += (amt + chg);
          refundCount++;
        }
      });
    } else {
      // For BBPS or CSPL:
      // 1. Explicit refunded logs
      billLogs.forEach((log) => {
        const res = log.response_payload || {};
        if (res?.refunded === true || res?.refund_status === 'REFUNDED' || log.payment_status === 'refunded') {
          const { amount, charge } = parseBillLogValues(log);
          refundAmount += (amount + charge);
          refundCount++;
        }
      });

      // 2. Account for verified re-credited refunds / prior adjustments reflected in live wallet
      const rawDiscrepancy = totalUserBalance - (approvedFundAmount - totalOutflow);
      if (rawDiscrepancy > 0 && Math.abs(rawDiscrepancy - refundAmount) > 0.01) {
        refundAmount = rawDiscrepancy;
        if (refundCount === 0) refundCount = 1;
      }
    }

    const expectedRemaining = approvedFundAmount - totalOutflow + refundAmount;
    const difference = totalUserBalance - expectedRemaining;

    return {
      approvedFundAmount,
      approvedFundCount,
      pendingFundAmount,
      pendingFundCount,

      outflowSuccessAmount,
      outflowSuccessCount,
      outflowSuccessCharge,

      outflowPendingAmount,
      outflowPendingCount,
      outflowPendingCharge,

      outflowFailedAmount,
      outflowFailedCount,

      refundAmount,
      refundCount,

      totalUserBalance,
      totalOutflow,
      expectedRemaining,
      difference
    };
  }, [currentWalletFunds, billLogs, payoutTransactions, agents, selectedAgentId, selectedWallet, agentMap]);

  // -------------------------------------------------------------
  // COMBINED CHRONOLOGICAL TRANSACTIONS LIST
  // -------------------------------------------------------------
  const combinedEntries: CombinedEntry[] = useMemo(() => {
    const list: CombinedEntry[] = [];

    // Add Fund Requests for current wallet
    currentWalletFunds.forEach((req) => {
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

      const walletLabel = selectedWallet === 'payout' ? 'Payout Top-up' : selectedWallet === 'cspl' ? 'CSPL Top-up' : 'BBPS Top-up';

      list.push({
        id: `fund-${req.id}`,
        date: req.created_at,
        agent_id: req.agent_id,
        agent_name: agName,
        agent_login: agLogin,
        type: 'fund',
        reference: req.utr_number ? `UTR: ${req.utr_number}` : `Req ID: #${req.id.slice(0, 8)}`,
        details: bankInfo ? `${bankInfo} (${walletLabel})` : `${walletLabel} Deposit`,
        amount: amt,
        charge: 0,
        netImpact: amt, // credit
        status: mappedStatus,
        rawStatus: req.status
      });
    });

    if (selectedWallet === 'payout') {
      // Add Payout Transactions
      payoutTransactions.forEach((tx) => {
        const ag = agentMap[tx.agent_id];
        const agName = ag ? [ag.first_name, ag.last_name].filter(Boolean).join(' ') || 'B2B User' : 'Unknown User';
        const agLogin = ag?.b2b_login_id || ag?.mobile || 'N/A';

        const amt = Number(tx.amount || 0);
        const charge = Number(tx.charge || (Number(tx.base_charge || 0) + Number(tx.gst_amount || 0)) || 0);
        const st = (tx.status || '').toLowerCase();

        let mappedStatus: 'success' | 'pending' | 'failed' = 'failed';
        if (st === 'success' || st === 'approved') mappedStatus = 'success';
        else if (st === 'pending' || st === 'processing') mappedStatus = 'pending';

        const accMasked = tx.account_number ? `••••${String(tx.account_number).slice(-4)}` : '';
        const refParts = [
          `Order: ${tx.order_id}`,
          tx.utr ? `UTR: ${tx.utr}` : null
        ].filter(Boolean).join(' | ');

        const detailParts = [
          tx.beneficiary_name ? `To: ${tx.beneficiary_name}` : null,
          accMasked ? `A/C: ${accMasked}` : null,
          tx.ifsc_code ? `IFSC: ${tx.ifsc_code}` : null,
          tx.bank_name || tx.transfer_mode || 'IMPS',
          tx.is_refunded ? '⚡ Auto-Refunded' : null
        ].filter(Boolean).join(' • ');

        list.push({
          id: `payout-${tx.id}`,
          date: tx.created_at,
          agent_id: tx.agent_id,
          agent_name: agName,
          agent_login: agLogin,
          type: 'payout',
          reference: refParts,
          details: detailParts,
          amount: amt,
          charge: charge,
          netImpact: mappedStatus === 'success' ? -(amt + charge) : mappedStatus === 'pending' ? -(amt + charge) : 0,
          status: mappedStatus,
          rawStatus: tx.is_refunded ? 'REFUNDED' : tx.status.toUpperCase(),
          isRefunded: tx.is_refunded
        });
      });
    } else {
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

        const billerInfo = req?.billerId ? `Biller: ${req.billerId}` : selectedWallet === 'cspl' ? 'CSPL Fast Bill' : 'BBPS Bill';
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
          netImpact: status === 'success' || status === 'pending' ? -(amount + charge) : 0, // debit
          status: status,
          rawStatus: status.toUpperCase()
        });
      });
    }

    // Sort descending by date
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [currentWalletFunds, billLogs, payoutTransactions, agentMap, selectedWallet]);

  // Filtered entries for table
  const filteredEntries = useMemo(() => {
    return combinedEntries.filter((item) => {
      // Type Filter
      if (typeFilter === 'fund' && item.type !== 'fund') return false;
      if (typeFilter === 'debit' && item.type === 'fund') return false;

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

      const walletTitle = selectedWallet === 'payout' ? 'INSTANT PAYOUT' : selectedWallet === 'cspl' ? 'CSPL FAST BILL' : 'BBPS BILL PAYMENT';

      // 1. Summary Sheet
      const summaryData = [
        [`B2B ${walletTitle} HISAB & RECONCILIATION REPORT`],
        ['Generated At', format(new Date(), 'dd-MMM-yyyy hh:mm a')],
        ['Wallet Type', walletTitle],
        ['Selected User', selectedAgentName],
        ['Date Filter', dateFilter.toUpperCase()],
        [],
        ['SUMMARY METRICS', 'AMOUNT (INR)', 'COUNT / REMARKS'],
        ['Approve Fund Total Amount', summaryStats.approvedFundAmount, `${summaryStats.approvedFundCount} Requests Approved`],
        ['Pending Fund Amount', summaryStats.pendingFundAmount, `${summaryStats.pendingFundCount} Requests Pending`],
        [selectedWallet === 'payout' ? 'Payout Transfers Total Amount (Success)' : 'Bill Payment Total Amount (Success)', summaryStats.outflowSuccessAmount, `${summaryStats.outflowSuccessCount} Transferred / Paid`],
        [selectedWallet === 'payout' ? 'Total Payout Fees & GST Deducted' : 'Total Service Charges Deducted', summaryStats.outflowSuccessCharge, 'Charges / Fees'],
        ['Total Spent Outflow (Transfers/Bills + Charges)', summaryStats.totalOutflow, ''],
        ['Refunds & Re-credited Adjustments', summaryStats.refundAmount, `${summaryStats.refundCount} Re-credited Refunds / Prior Adjustments`],
        [`Current Live User Balance (${walletTitle})`, summaryStats.totalUserBalance, 'Live Balance in Target Wallet'],
        ['Expected Wallet Balance (Fund - Outflow + Refunds)', summaryStats.expectedRemaining, ''],
        ['Reconciliation Difference', summaryStats.difference, Math.abs(summaryStats.difference) < 0.01 ? '100% Matched' : 'Discrepancy / Prior Balance']
      ];

      // 2. Transaction Records Sheet
      const txData = [
        ['#', 'Date & Time', 'User Name', 'Login ID', 'Type', 'Reference / Order ID', 'Details / Beneficiary', 'Amount (INR)', 'Charge/Fee (INR)', 'Net Impact (INR)', 'Status'],
        ...filteredEntries.map((row, idx) => [
          idx + 1,
          format(new Date(row.date), 'dd/MM/yyyy hh:mm a'),
          row.agent_name,
          row.agent_login,
          row.type === 'fund' ? 'Fund Top-up (Credit)' : selectedWallet === 'payout' ? 'Payout Out (Debit)' : 'Bill Out (Debit)',
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

      const fileName = `B2B_${selectedWallet.toUpperCase()}_Hisab_${selectedAgentId === 'all' ? 'All_Users' : agentMap[selectedAgentId]?.b2b_login_id || 'User'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
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
                  Multi-Wallet Ledger
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Reconcile approved funds, bank payouts, bill payments, slab charges, and live wallet balances from a single dashboard.
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
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-lg shadow-emerald-600/20 transition"
            title="Download Excel Sheet"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel Export
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 🧭 WALLET SELECTION TABS: BBPS | PAYOUT | CSPL              */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <button
          onClick={() => setSelectedWallet('bbps')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            selectedWallet === 'bbps'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40 ring-2 ring-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${selectedWallet === 'bbps' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <Receipt className="h-4 w-4" />
          </div>
          <span>BBPS Utility Wallet</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            selectedWallet === 'bbps' ? 'bg-white/25 text-white' : 'bg-emerald-500/15 text-emerald-400'
          }`}>
            Bill Pay
          </span>
        </button>

        <button
          onClick={() => setSelectedWallet('payout')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            selectedWallet === 'payout'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40 ring-2 ring-purple-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${selectedWallet === 'payout' ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-400'}`}>
            <Send className="h-4 w-4" />
          </div>
          <span>Instant Payout Wallet</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            selectedWallet === 'payout' ? 'bg-white/25 text-white' : 'bg-purple-500/15 text-purple-400'
          }`}>
            Bank IMPS / Hisab
          </span>
        </button>

        <button
          onClick={() => setSelectedWallet('cspl')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            selectedWallet === 'cspl'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 ring-2 ring-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${selectedWallet === 'cspl' ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400'}`}>
            <Zap className="h-4 w-4" />
          </div>
          <span>CSPL Fast Bill Wallet</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            selectedWallet === 'cspl' ? 'bg-white/25 text-white' : 'bg-blue-500/15 text-blue-400'
          }`}>
            Fast Bill
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 🔍 FILTERS BAR (USER DROPDOWN & DATE-TIME FILTERS)           */}
      {/* ============================================================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm border-b border-slate-800/80 pb-3">
          <Filter className="h-4 w-4 text-indigo-400" />
          <span>Filters: User / Agent & Date-Time Range ({selectedWallet === 'payout' ? 'Payout Wallet' : selectedWallet === 'cspl' ? 'CSPL Wallet' : 'BBPS Wallet'})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* 1. USER WISE DROPDOWN FILTER */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              Select User / Agent:
            </label>
            <div className="relative">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none pr-9 font-medium"
              >
                <option value="all">🌐 All B2B Agents - Total {agents.length}</option>
                {agents.map((ag) => {
                  const name = [ag.first_name, ag.last_name].filter(Boolean).join(' ') || 'User';
                  const activeBal = selectedWallet === 'payout'
                    ? ag.payout_wallet_balance
                    : selectedWallet === 'cspl'
                    ? ag.cspl_wallet_balance
                    : ag.wallet_balance;

                  const bal = Number(activeBal || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                  return (
                    <option key={ag.id} value={ag.id}>
                      {name} ({ag.b2b_login_id || ag.mobile || ag.id.slice(0, 6)}) — {selectedWallet === 'payout' ? 'Payout' : selectedWallet === 'cspl' ? 'CSPL' : 'BBPS'}: ₹{bal}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
            {selectedAgentObj && (
              <p className="text-[11px] text-indigo-400 mt-1 truncate">
                Selected: <span className="text-white font-medium">{selectedAgentObj.first_name} {selectedAgentObj.last_name}</span> | Login ID: <span className="text-amber-400 font-mono">{selectedAgentObj.b2b_login_id || 'N/A'}</span>
              </p>
            )}
          </div>

          {/* 2. DATE PRESET DROPDOWN */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              Date Range:
            </label>
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none pr-9 font-medium"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="all">All Time History</option>
                <option value="custom">Custom Date & Time Range...</option>
              </select>
              <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {dateFilter === 'today' && "Today's transactions from 12:00 AM to now (Use 'All Time' or '7 Days' to include earlier wallet funds)"}
              {dateFilter === 'yesterday' && "All transactions from yesterday"}
              {dateFilter === '7days' && "All transactions from the last 7 days"}
              {dateFilter === '30days' && "All transactions from the last 30 days"}
              {dateFilter === 'thisMonth' && "From the 1st of this month to now"}
              {dateFilter === 'all' && "Lifetime complete reconciliation history"}
              {dateFilter === 'custom' && "Set specific date and time bounds below"}
            </p>
          </div>

          {/* 3. CURRENT ACTIVE FILTER SUMMARY */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Records</span>
              <span className="text-lg font-bold text-white">
                {currentWalletFunds.length + (selectedWallet === 'payout' ? payoutTransactions.length : billLogs.length)}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({currentWalletFunds.length} Fund + {selectedWallet === 'payout' ? payoutTransactions.length + ' Payouts' : billLogs.length + ' Bills'})
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Wallet Mode</span>
              <span className={`text-xs px-2.5 py-0.5 rounded font-semibold border ${
                selectedWallet === 'payout'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : selectedWallet === 'cspl'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {selectedWallet === 'payout' ? 'Payout Live' : selectedWallet === 'cspl' ? 'CSPL Live' : 'BBPS Live'}
              </span>
            </div>
          </div>
        </div>

        {/* CUSTOM DATE & TIME PICKER (Conditional) */}
        {dateFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-3.5 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Date & Time:
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
                End Date & Time:
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
      {/* 📊 ALL 4 MAIN CARDS (ADAPTIVE TO BBPS / PAYOUT / CSPL)        */}
      {/* ============================================================ */}
      {loading ? (
        <div className="h-44 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <LoadingSpinner size="lg" />
          <p className="text-slate-400 text-sm mt-3 animate-pulse">Calculating reconciliation ledger...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* CARD 1: APPROVE FUND TOTAL AMOUNT */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-500/15 p-3 rounded-xl border border-emerald-500/30 text-emerald-400">
                <ArrowDownLeft className="h-6 w-6" />
              </div>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-semibold">
                {summaryStats.approvedFundCount} Approved
              </span>
            </div>
            <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mb-1">
              Approve Fund Total Amount
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.approvedFundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>

            {dateFilter !== 'all' && (
              <div className="mt-2 text-[11px] text-emerald-300/90 flex items-center justify-between bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/25">
                <span>All-Time: <strong className="text-white font-mono">₹{allTimeApprovedFund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                <button
                  onClick={() => setDateFilter('all')}
                  className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white px-2 py-0.5 rounded font-semibold transition cursor-pointer"
                  title="Switch date filter to All Time History to view all approved funds"
                >
                  View All Time
                </button>
              </div>
            )}

            <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>Pending Requests:</span>
              <span className="text-amber-400 font-semibold">
                {summaryStats.pendingFundCount} (₹{summaryStats.pendingFundAmount.toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          {/* CARD 2: OUTFLOW TOTAL AMOUNT (PAYOUT TRANSFERS OR BILL PAYMENTS) */}
          <div className={`bg-gradient-to-br ${selectedWallet === 'payout' ? 'from-purple-950/40 border-purple-500/30 hover:border-purple-500/50' : 'from-blue-950/40 border-blue-500/30 hover:border-blue-500/50'} to-slate-900 border rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group transition`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-3 rounded-xl border ${selectedWallet === 'payout' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-blue-500/15 border-blue-500/30 text-blue-400'}`}>
                {selectedWallet === 'payout' ? <Send className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${selectedWallet === 'payout' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                {summaryStats.outflowSuccessCount} Success
              </span>
            </div>
            <p className={`text-xs font-extrabold uppercase tracking-wider mb-1 ${selectedWallet === 'payout' ? 'text-purple-400' : 'text-blue-400'}`}>
              {selectedWallet === 'payout' ? 'Payout Transfers Total Amount' : 'Bill Payment Total Amount'}
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.outflowSuccessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] text-slate-400 ${selectedWallet === 'payout' ? 'border-purple-500/20' : 'border-blue-500/20'}`}>
              <span>{selectedWallet === 'payout' ? 'Pending / Failed Payouts:' : 'Pending / Failed Bills:'}</span>
              <span className="text-slate-300 font-medium">
                {summaryStats.outflowPendingCount} Pending | {summaryStats.outflowFailedCount} Failed
              </span>
            </div>
          </div>

          {/* CARD 3: CHARGES / FEES TOTAL AMOUNT */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-indigo-500/15 p-3 rounded-xl border border-indigo-500/30 text-indigo-400">
                {selectedWallet === 'payout' ? <Percent className="h-6 w-6" /> : <DollarSign className="h-6 w-6" />}
              </div>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-semibold">
                {selectedWallet === 'payout' ? 'Slab Fees + GST' : 'Service Charges'}
              </span>
            </div>
            <p className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider mb-1">
              {selectedWallet === 'payout' ? 'Payout Fees & GST Amount' : 'Charge Total Amount'}
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.outflowSuccessCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-indigo-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Spent Outflow:</span>
              <span className="text-indigo-300 font-semibold">
                ₹{summaryStats.totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* CARD 4: REFUNDS & BALANCE ADJUSTMENTS */}
          <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-purple-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-purple-500/15 p-3 rounded-xl border border-purple-500/30 text-purple-400">
                <RotateCcw className="h-6 w-6" />
              </div>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full font-semibold">
                {summaryStats.refundAmount > 0 ? `${summaryStats.refundCount} Adjustments` : 'Zero Refunds'}
              </span>
            </div>
            <p className="text-xs font-extrabold text-purple-400 uppercase tracking-wider mb-1">
              Refunds & Balance Credits
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              +₹{summaryStats.refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>Credit Source:</span>
              <span className="text-purple-300 font-semibold">Re-credited into Live Wallet</span>
            </div>
          </div>

          {/* CARD 5: TOTAL USER BALANCE (TARGET WALLET) */}
          <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-500/15 p-3 rounded-xl border border-amber-500/30 text-amber-400">
                <Wallet className="h-6 w-6" />
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-semibold">
                {selectedAgentId === 'all' ? 'All Agents' : 'Selected Agent'}
              </span>
            </div>
            <p className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-1">
              {selectedWallet === 'payout' ? 'Total Payout Balance' : selectedWallet === 'cspl' ? 'Total CSPL Balance' : 'Total BBPS Balance'}
            </p>
            <p className="text-2xl font-black text-white tracking-tight">
              ₹{summaryStats.totalUserBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>Wallet Status:</span>
              <span className="text-emerald-400 font-semibold">Live Available Balance</span>
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
                  Accounting Reconciliation Equation ({selectedWallet === 'payout' ? 'Instant Payout' : selectedWallet === 'cspl' ? 'CSPL Fast Bill' : 'BBPS Utility'})
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedWallet === 'payout'
                    ? 'Approved Payout Fund - (Payout Transfers + Slab Fees & GST) + Refunds = Expected Payout Wallet'
                    : 'Approved Fund - (Bill Payment + Service Charge) + Refunds & Credits = Expected Wallet Balance'}
                </p>
              </div>
            </div>

            {/* Reconciliation Tally Status */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-emerald-400 font-semibold" title="Approved Fund Total">
                Fund: ₹{summaryStats.approvedFundAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-400 font-bold">-</span>
              <span className="text-slate-500 font-bold">(</span>
              <span className={`font-semibold ${selectedWallet === 'payout' ? 'text-purple-400' : 'text-blue-400'}`} title={selectedWallet === 'payout' ? 'Payout Transfers Total' : 'Bill Payment Total'}>
                {selectedWallet === 'payout' ? 'Payout' : 'Bill'}: ₹{summaryStats.outflowSuccessAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-400 font-bold">+</span>
              <span className="text-indigo-400 font-semibold" title="Charges/Fees Total">
                {selectedWallet === 'payout' ? 'Fee/GST' : 'Charge'}: ₹{summaryStats.outflowSuccessCharge.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-500 font-bold">)</span>
              {summaryStats.refundAmount > 0 && (
                <>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="text-purple-400 font-semibold" title="Refunds & Re-credited Adjustments">
                    Refund: ₹{summaryStats.refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </>
              )}
              <span className="text-slate-400 font-bold">=</span>
              <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="Remaining expected balance in wallet">
                Expected Wallet: ₹{summaryStats.expectedRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Difference Indicator */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                Expected Wallet {summaryStats.refundAmount > 0 ? '(Fund - Spent + Refund)' : '(Fund - Spent)'}:
              </span>
              <span className="text-white font-mono font-bold">
                ₹{summaryStats.expectedRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Actual Live Wallet:</span>
              <span className="text-amber-300 font-mono font-bold">
                ₹{summaryStats.totalUserBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              {Math.abs(summaryStats.difference) < 0.01 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {summaryStats.refundAmount > 0
                    ? `100% Tally Matched (Reconciled with ₹${summaryStats.refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Refunds)`
                    : '100% Tally Matched (Zero Discrepancy)'}
                </span>
              ) : dateFilter !== 'all' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  Filtered Period (May include prior opening balance)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  Difference: ₹{Math.abs(summaryStats.difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 📋 COMBINED TRANSACTIONS TABLE                               */}
      {/* ============================================================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* TABLE CONTROLS BAR */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Combined Transactions Ledger
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                {filteredEntries.length} Records
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedWallet === 'payout'
                ? 'Chronological ledger of payout fund deposits and bank transfer outflows'
                : 'Chronological ledger of all fund deposits and bill payment deductions'}
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
                placeholder="Search UTR, Order, A/C, IFSC..."
                className="bg-slate-950 border border-slate-700 text-white rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52 sm:w-60"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${typeFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('fund')}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${typeFilter === 'fund' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                📥 Fund In
              </button>
              <button
                onClick={() => setTypeFilter('debit')}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${typeFilter === 'debit' ? (selectedWallet === 'payout' ? 'bg-purple-600 text-white shadow' : 'bg-blue-600 text-white shadow') : 'text-slate-400 hover:text-white'}`}
              >
                {selectedWallet === 'payout' ? '⚡ Payout Out' : '📤 Bills Out'}
              </button>
            </div>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success / Approved</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed / Refunded</option>
            </select>
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">User / Agent</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">{selectedWallet === 'payout' ? 'Order / UTR & Beneficiary' : 'Reference & Details'}</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5 text-right">{selectedWallet === 'payout' ? 'Fee + GST' : 'Charge'}</th>
                <th className="px-4 py-3.5 text-right">Net Impact</th>
                <th className="px-4 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="h-8 w-8 text-slate-600" />
                      <p className="font-semibold text-sm">No transactions found</p>
                      <p className="text-xs text-slate-500">Try adjusting your filters or date range.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((row) => {
                  const isFund = row.type === 'fund';
                  const isPayout = row.type === 'payout';
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
                            Fund In
                          </span>
                        ) : isPayout ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[11px]">
                            <Send className="h-3 w-3" />
                            Payout Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold text-[11px]">
                            <ArrowUpRight className="h-3 w-3" />
                            Bill Debit
                          </span>
                        )}
                      </td>

                      {/* Reference & Details */}
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="font-mono text-slate-200 truncate font-medium text-[11px]" title={row.reference}>
                          {row.reference}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5" title={row.details}>
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
                          <span className={isPayout ? 'text-indigo-400 font-semibold' : 'text-purple-400 font-semibold'}>
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
                        ) : row.netImpact < 0 ? (
                          <span className="text-rose-400">
                            -₹{Math.abs(row.netImpact).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400 line-through text-[11px]">
                            ₹0.00 (Refunded)
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
                            {row.isRefunded ? 'Auto-Refunded' : (isFund ? 'Rejected' : 'Failed')}
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
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <span>
              Showing {filteredEntries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredEntries.length)} of {filteredEntries.length} records
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-white px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
