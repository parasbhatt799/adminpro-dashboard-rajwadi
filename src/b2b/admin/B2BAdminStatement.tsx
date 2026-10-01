import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Receipt, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  Filter, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building2, 
  Zap, 
  Layers, 
  Landmark, 
  DollarSign, 
  Copy, 
  ExternalLink, 
  Users, 
  Info,
  Scale,
  Eye,
  X
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import * as XLSX from 'xlsx';

export interface AdminStatementTxn {
  id: string;
  agentId: string;
  agentName: string;
  agentLogin: string;
  agentMobile: string;
  date: string;
  timestamp: number;
  type: 'credit' | 'debit';
  source: 'fund_request' | 'bill_payment' | 'bill_refund' | 'payout_transfer' | 'payout_refund';
  title: string;
  narration: string;
  reference: string;
  billerName?: string;
  consumerNo?: string;
  beneficiaryName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  orderId?: string;
  amount: number;
  charge: number;
  baseFee?: number;
  gstAmount?: number;
  netCredit: number;
  netDebit: number;
  runningBalance: number;
  status: 'approved' | 'success' | 'pending' | 'failed' | 'refunded';
  walletType: 'bbps' | 'payout' | 'cspl';
  raw: any;
}

export interface AdminDailyLedger {
  dateKey: string;
  displayDate: string;
  dayName: string;
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  netChange: number;
  txnCount: number;
  txns: AdminStatementTxn[];
}

export interface AgentOption {
  id: string;
  agent_id?: string;
  b2b_login_id?: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  wallet_balance?: number;
  payout_wallet_balance?: number;
  cspl_wallet_balance?: number;
  is_active?: boolean;
}

export default function B2BAdminStatement() {
  const toast = useToast();

  // Active Wallet Category: BBPS, CSPL, or Payout
  const [selectedWallet, setSelectedWallet] = useState<'bbps' | 'cspl' | 'payout'>('bbps');

  // Active View Mode: Statement (Passbook) vs Daily Ledger
  const [activeTab, setActiveTab] = useState<'statement' | 'daily'>('statement');

  // Agents list
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

  // Date Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  // Table filters & search
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Expanded dates in daily view
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw database records
  const [allFunds, setAllFunds] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [allPayouts, setAllPayouts] = useState<any[]>([]);

  // Selected Txn for Details Modal
  const [selectedTxn, setSelectedTxn] = useState<AdminStatementTxn | null>(null);

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch statement data when wallet or agent changes
  useEffect(() => {
    fetchData();

    // Supabase Realtime subscriptions
    const fundChannel = supabase
      .channel('admin_statement_funds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_fund_requests' }, () => {
        fetchData(true);
        fetchAgents();
      })
      .subscribe();

    const logChannel = supabase
      .channel('admin_statement_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_api_logs' }, () => {
        fetchData(true);
      })
      .subscribe();

    const payoutChannel = supabase
      .channel('admin_statement_payouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_payout_transactions' }, () => {
        fetchData(true);
      })
      .subscribe();

    const credChannel = supabase
      .channel('admin_statement_creds')
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
  }, [selectedWallet, selectedAgentId]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWallet, selectedAgentId, dateFilter, customRange, typeFilter, statusFilter, searchTerm, activeTab]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('b2b_api_credentials')
        .select('id, agent_id, b2b_login_id, first_name, last_name, mobile, wallet_balance, payout_wallet_balance, cspl_wallet_balance, is_active')
        .order('first_name', { ascending: true });

      if (error) throw error;
      if (data) setAgents(data as AgentOption[]);
    } catch (err: any) {
      console.error('Error fetching agents:', err);
    }
  };

  // Agent Lookup Map
  const agentMap = useMemo(() => {
    const map: Record<string, AgentOption> = {};
    agents.forEach((ag) => {
      if (ag.id) map[ag.id] = ag;
      if (ag.agent_id) map[ag.agent_id] = ag;
    });
    return map;
  }, [agents]);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch Fund Requests for the selected wallet (all time for accurate running balance)
      let fundsData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        let q = supabase
          .from('b2b_fund_requests')
          .select('id, agent_id, amount, status, wallet_type, created_at, updated_at, utr_number, b2b_admin_bank_accounts(account_name, bank_name)')
          .order('created_at', { ascending: true })
          .range(from, from + step - 1);

        if (selectedAgentId !== 'all') {
          q = q.eq('agent_id', selectedAgentId);
        }

        const { data, error } = await q;
        if (error) throw error;
        if (data && data.length > 0) {
          fundsData = fundsData.concat(data);
          if (data.length < step) hasMore = false;
          else from += step;
        } else {
          hasMore = false;
        }
      }
      setAllFunds(fundsData);

      // 2. If Payout: Fetch all Payout transactions
      if (selectedWallet === 'payout') {
        let payoutsData: any[] = [];
        let pFrom = 0;
        let pHasMore = true;

        while (pHasMore) {
          let q = supabase
            .from('b2b_payout_transactions')
            .select('id, agent_id, order_id, client_order_id, amount, fee, charge, base_charge, gst_amount, total_deducted, beneficiary_name, account_number, ifsc_code, bank_name, transfer_mode, status, utr, is_refunded, created_at, request_payload, error_message')
            .order('created_at', { ascending: true })
            .range(pFrom, pFrom + step - 1);

          if (selectedAgentId !== 'all') {
            q = q.eq('agent_id', selectedAgentId);
          }

          const { data, error } = await q;
          if (error) throw error;
          if (data && data.length > 0) {
            payoutsData = payoutsData.concat(data);
            if (data.length < step) pHasMore = false;
            else pFrom += step;
          } else {
            pHasMore = false;
          }
        }
        setAllPayouts(payoutsData);
        setAllLogs([]);
      } else {
        // 3. If BBPS or CSPL: Fetch API Logs
        let logsData: any[] = [];
        let lFrom = 0;
        let lHasMore = true;

        const endpoints = selectedWallet === 'cspl'
          ? 'endpoint.eq./api/b2b/cspl/pay-bill,endpoint.eq./api/v1/b2b/cspl/pay-bill'
          : 'endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill';

        while (lHasMore) {
          let q = supabase
            .from('b2b_api_logs')
            .select('id, agent_id, endpoint, status_code, payment_status, charge_deducted, developer_charge, owner_charge, request_payload, response_payload, created_at')
            .or(endpoints)
            .order('created_at', { ascending: true })
            .range(lFrom, lFrom + step - 1);

          if (selectedAgentId !== 'all') {
            q = q.eq('agent_id', selectedAgentId);
          }

          const { data, error } = await q;
          if (error) throw error;
          if (data && data.length > 0) {
            logsData = logsData.concat(data);
            if (data.length < step) lHasMore = false;
            else lFrom += step;
          } else {
            lHasMore = false;
          }
        }
        setAllLogs(logsData);
        setAllPayouts([]);
      }
    } catch (err: any) {
      console.error('Statement fetch error:', err);
      toast?.error?.('Failed to load statement data: ' + (err?.message || ''));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper to determine status and details of a bill log
  const parseBillLog = (log: any) => {
    const req = log.request_payload || {};
    const res = log.response_payload || {};
    const bpr = res?.ExtBillPayResponse || res?.billPayResponse || res;
    const responseCode = String(bpr?.responseCode || res?.responseCode || '').trim();
    const responseReason = String(bpr?.responseReason || res?.responseReason || '').trim().toLowerCase();
    const txnStatus = String(bpr?.txnStatus || res?.txnStatus || res?.statusCheckDetails?.bbpsStatus || '').trim().toUpperCase();
    const errorCode = String(bpr?.errorInfo?.error?.errorCode || bpr?.errorCode || res?.errorCode || '').trim().toUpperCase();
    const txnRefId = bpr?.txnRefId || res?.txnRefId || bpr?.txnReferenceId || res?.txnReferenceId || log.id;
    const hasCC01 = !!(txnRefId && String(txnRefId).toUpperCase().startsWith('CC01'));
    const rawStatus = (res?.payment_status || res?.finalStatus || log.payment_status || '').toLowerCase();

    let status: 'success' | 'pending' | 'failed' | 'refunded' = 'failed';
    const isSuccess =
      txnStatus === 'SUCCESS' ||
      txnStatus === 'APPROVED' ||
      (rawStatus === 'success' && txnStatus !== 'AWAITED' && txnStatus !== 'PENDING') ||
      (!['AWAITED', 'PENDING', 'FAILED', 'FAILURE', 'REJECTED'].includes(txnStatus) &&
        (responseCode === '000' || responseCode === '0000') &&
        (responseReason === 'successful' || responseReason === 'success') &&
        errorCode !== 'PNR001' && errorCode !== 'PWB001') ||
      (hasCC01 && log.status_code === 200 && rawStatus !== 'failed');

    const isPending =
      txnStatus === 'PENDING' ||
      txnStatus === 'AWAITED' ||
      rawStatus === 'pending' ||
      (hasCC01 && rawStatus !== 'failed' && !isSuccess) ||
      (log.status_code === 200 && !responseCode && !rawStatus);

    if (isSuccess) status = 'success';
    else if (isPending) status = 'pending';
    else if (rawStatus === 'refunded' || res?.refund_status === 'REFUNDED') status = 'refunded';
    else status = 'failed';

    const billAmount = Number(req?.amount || res?.amount || 0);
    const charge = Number(
      log.charge_deducted ??
      req?.chargeDeducted ??
      req?.chargePerBill ??
      req?.charge ??
      (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : 0)
    );

    const billerName = req?.billerName || req?.biller_name || req?.billerId || res?.billerName || (selectedWallet === 'cspl' ? 'CSPL Biller' : 'BBPS Biller');
    const consumerNo = req?.consumerNumber || req?.consumer_no || req?.account_number || req?.caNumber || req?.mobileNumber || '';
    const clientTxnId = req?.client_transaction_id || req?.clientTransactionId || '';

    return {
      status,
      billAmount,
      charge,
      totalDeduction: billAmount + charge,
      billerName,
      consumerNo,
      reference: txnRefId || clientTxnId || log.id,
      clientTxnId
    };
  };

  // Convert raw records into a unified chronological ledger
  const allChronologicalTxns = useMemo(() => {
    const list: AdminStatementTxn[] = [];

    // Helper to get agent display info
    const getAgent = (agentId: string) => {
      const ag = agentMap[agentId];
      return {
        name: ag ? `${ag.first_name || ''} ${ag.last_name || ''}`.trim() || ag.b2b_login_id || 'Unknown Agent' : 'Unknown Agent',
        login: ag?.b2b_login_id || agentId?.slice(0, 8),
        mobile: ag?.mobile || 'N/A'
      };
    };

    if (selectedWallet === 'bbps') {
      // 1. BBPS Fund Requests (Approved)
      allFunds.forEach((f) => {
        if (f.status !== 'approved') return;
        const wType = (f.wallet_type || 'bbps').toLowerCase();
        if (wType !== 'bbps') return;

        const amt = Number(f.amount || 0);
        const bankName = f.b2b_admin_bank_accounts?.bank_name || 'Admin Bank';
        const utr = f.utr_number || 'N/A';
        const agInfo = getAgent(f.agent_id);

        list.push({
          id: `fund_${f.id}`,
          agentId: f.agent_id,
          agentName: agInfo.name,
          agentLogin: agInfo.login,
          agentMobile: agInfo.mobile,
          date: f.created_at,
          timestamp: new Date(f.created_at).getTime(),
          type: 'credit',
          source: 'fund_request',
          title: 'BBPS Wallet Top-Up',
          narration: `Bank: ${bankName} | UTR: ${utr}`,
          reference: utr,
          amount: amt,
          charge: 0,
          netCredit: amt,
          netDebit: 0,
          runningBalance: 0,
          status: 'approved',
          walletType: 'bbps',
          raw: f
        });
      });

      // 2. BBPS Bill Payment Logs
      allLogs.forEach((l) => {
        const parsed = parseBillLog(l);
        const agInfo = getAgent(l.agent_id);

        if (parsed.status === 'success' || parsed.status === 'pending') {
          list.push({
            id: `bill_${l.id}`,
            agentId: l.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: l.created_at,
            timestamp: new Date(l.created_at).getTime(),
            type: 'debit',
            source: 'bill_payment',
            title: `Bill - ${parsed.billerName}`,
            narration: `A/C: ${parsed.consumerNo || 'N/A'} | Ref: ${parsed.reference}${parsed.charge > 0 ? ` (Fee ₹${parsed.charge.toFixed(2)})` : ''}`,
            reference: parsed.reference,
            billerName: parsed.billerName,
            consumerNo: parsed.consumerNo,
            amount: parsed.billAmount,
            charge: parsed.charge,
            netCredit: 0,
            netDebit: parsed.totalDeduction,
            runningBalance: 0,
            status: parsed.status,
            walletType: 'bbps',
            raw: l
          });
        } else if (parsed.status === 'failed' || parsed.status === 'refunded') {
          // Record debit attempt
          list.push({
            id: `bill_fail_${l.id}`,
            agentId: l.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: l.created_at,
            timestamp: new Date(l.created_at).getTime(),
            type: 'debit',
            source: 'bill_payment',
            title: `Bill (Failed) - ${parsed.billerName}`,
            narration: `A/C: ${parsed.consumerNo || 'N/A'} | Ref: ${parsed.reference}`,
            reference: parsed.reference,
            billerName: parsed.billerName,
            consumerNo: parsed.consumerNo,
            amount: parsed.billAmount,
            charge: parsed.charge,
            netCredit: 0,
            netDebit: parsed.totalDeduction,
            runningBalance: 0,
            status: 'failed',
            walletType: 'bbps',
            raw: l
          });

          // Immediate Refund Credit
          list.push({
            id: `bill_refund_${l.id}`,
            agentId: l.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: l.created_at,
            timestamp: new Date(l.created_at).getTime() + 10,
            type: 'credit',
            source: 'bill_refund',
            title: `Refund - Failed Bill`,
            narration: `Auto-refund for ${parsed.billerName} | A/C: ${parsed.consumerNo || 'N/A'}`,
            reference: parsed.reference,
            billerName: parsed.billerName,
            consumerNo: parsed.consumerNo,
            amount: parsed.totalDeduction,
            charge: 0,
            netCredit: parsed.totalDeduction,
            netDebit: 0,
            runningBalance: 0,
            status: 'refunded',
            walletType: 'bbps',
            raw: l
          });
        }
      });
    } else if (selectedWallet === 'cspl') {
      // 1. CSPL Fund Requests
      allFunds.forEach((f) => {
        if (f.status !== 'approved') return;
        if ((f.wallet_type || '').toLowerCase() !== 'cspl') return;

        const amt = Number(f.amount || 0);
        const bankName = f.b2b_admin_bank_accounts?.bank_name || 'Admin Bank';
        const utr = f.utr_number || 'N/A';
        const agInfo = getAgent(f.agent_id);

        list.push({
          id: `fund_${f.id}`,
          agentId: f.agent_id,
          agentName: agInfo.name,
          agentLogin: agInfo.login,
          agentMobile: agInfo.mobile,
          date: f.created_at,
          timestamp: new Date(f.created_at).getTime(),
          type: 'credit',
          source: 'fund_request',
          title: 'CSPL Wallet Top-Up',
          narration: `Bank: ${bankName} | UTR: ${utr}`,
          reference: utr,
          amount: amt,
          charge: 0,
          netCredit: amt,
          netDebit: 0,
          runningBalance: 0,
          status: 'approved',
          walletType: 'cspl',
          raw: f
        });
      });

      // 2. CSPL Bill Payment Logs
      allLogs.forEach((l) => {
        const parsed = parseBillLog(l);
        const agInfo = getAgent(l.agent_id);

        if (parsed.status === 'success' || parsed.status === 'pending') {
          list.push({
            id: `bill_${l.id}`,
            agentId: l.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: l.created_at,
            timestamp: new Date(l.created_at).getTime(),
            type: 'debit',
            source: 'bill_payment',
            title: `CSPL Bill - ${parsed.billerName}`,
            narration: `A/C: ${parsed.consumerNo || 'N/A'} | Ref: ${parsed.reference}${parsed.charge > 0 ? ` (Fee ₹${parsed.charge.toFixed(2)})` : ''}`,
            reference: parsed.reference,
            billerName: parsed.billerName,
            consumerNo: parsed.consumerNo,
            amount: parsed.billAmount,
            charge: parsed.charge,
            netCredit: 0,
            netDebit: parsed.totalDeduction,
            runningBalance: 0,
            status: parsed.status,
            walletType: 'cspl',
            raw: l
          });
        } else if (parsed.status === 'failed' || parsed.status === 'refunded') {
          list.push({
            id: `bill_fail_${l.id}`,
            agentId: l.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: l.created_at,
            timestamp: new Date(l.created_at).getTime(),
            type: 'debit',
            source: 'bill_payment',
            title: `CSPL Bill (Failed) - ${parsed.billerName}`,
            narration: `A/C: ${parsed.consumerNo || 'N/A'} | Ref: ${parsed.reference}`,
            reference: parsed.reference,
            billerName: parsed.billerName,
            consumerNo: parsed.consumerNo,
            amount: parsed.billAmount,
            charge: parsed.charge,
            netCredit: 0,
            netDebit: parsed.totalDeduction,
            runningBalance: 0,
            status: 'failed',
            walletType: 'cspl',
            raw: l
          });

          list.push({
            id: `bill_refund_${l.id}`,
            agentId: l.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: l.created_at,
            timestamp: new Date(l.created_at).getTime() + 10,
            type: 'credit',
            source: 'bill_refund',
            title: `Refund - Failed CSPL Bill`,
            narration: `Auto-refund for ${parsed.billerName} | A/C: ${parsed.consumerNo || 'N/A'}`,
            reference: parsed.reference,
            billerName: parsed.billerName,
            consumerNo: parsed.consumerNo,
            amount: parsed.totalDeduction,
            charge: 0,
            netCredit: parsed.totalDeduction,
            netDebit: 0,
            runningBalance: 0,
            status: 'refunded',
            walletType: 'cspl',
            raw: l
          });
        }
      });
    } else if (selectedWallet === 'payout') {
      // 1. Payout Fund Requests
      allFunds.forEach((f) => {
        if (f.status !== 'approved') return;
        if ((f.wallet_type || '').toLowerCase() !== 'payout') return;

        const amt = Number(f.amount || 0);
        const bankName = f.b2b_admin_bank_accounts?.bank_name || 'Admin Bank';
        const utr = f.utr_number || 'N/A';
        const agInfo = getAgent(f.agent_id);

        list.push({
          id: `fund_${f.id}`,
          agentId: f.agent_id,
          agentName: agInfo.name,
          agentLogin: agInfo.login,
          agentMobile: agInfo.mobile,
          date: f.created_at,
          timestamp: new Date(f.created_at).getTime(),
          type: 'credit',
          source: 'fund_request',
          title: 'Payout Wallet Top-Up',
          narration: `Bank: ${bankName} | UTR: ${utr}`,
          reference: utr,
          amount: amt,
          charge: 0,
          netCredit: amt,
          netDebit: 0,
          runningBalance: 0,
          status: 'approved',
          walletType: 'payout',
          raw: f
        });
      });

      // 2. Payout Transactions
      allPayouts.forEach((p) => {
        const amt = Number(p.amount || 0);
        const fee = Number(p.charge || p.fee || 0);
        const baseAmt = p.base_charge !== undefined ? Number(p.base_charge) : fee;
        const gstAmt = p.gst_amount !== undefined ? Number(p.gst_amount) : 0;
        const totalDeducted = Number(p.total_deducted || (amt + fee));
        const beneficiary = p.beneficiary_name || 'Beneficiary';
        const ref = p.utr || p.order_id || p.client_order_id || p.id;
        const agInfo = getAgent(p.agent_id);

        let narration = `A/C: ${p.account_number || 'N/A'} | IFSC: ${p.ifsc_code || 'N/A'} | Mode: ${p.transfer_mode || 'IMPS'}`;
        if (p.utr) narration += ` | UTR: ${p.utr}`;
        if (fee > 0) narration += ` (Fee ₹${fee.toFixed(2)})`;

        if (p.status === 'success' || p.status === 'pending' || p.status === 'processing') {
          list.push({
            id: `payout_${p.id}`,
            agentId: p.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: p.created_at,
            timestamp: new Date(p.created_at).getTime(),
            type: 'debit',
            source: 'payout_transfer',
            title: `Payout - ${beneficiary}`,
            narration,
            reference: ref,
            beneficiaryName: beneficiary,
            accountNumber: p.account_number,
            ifscCode: p.ifsc_code,
            bankName: p.bank_name,
            orderId: p.order_id,
            amount: amt,
            charge: fee,
            baseFee: baseAmt,
            gstAmount: gstAmt,
            netCredit: 0,
            netDebit: totalDeducted,
            runningBalance: 0,
            status: p.status,
            walletType: 'payout',
            raw: p
          });
        } else if (p.status === 'failed' || p.status === 'refunded') {
          list.push({
            id: `payout_fail_${p.id}`,
            agentId: p.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: p.created_at,
            timestamp: new Date(p.created_at).getTime(),
            type: 'debit',
            source: 'payout_transfer',
            title: `Payout (Failed) - ${beneficiary}`,
            narration,
            reference: ref,
            beneficiaryName: beneficiary,
            accountNumber: p.account_number,
            ifscCode: p.ifsc_code,
            bankName: p.bank_name,
            orderId: p.order_id,
            amount: amt,
            charge: fee,
            netCredit: 0,
            netDebit: totalDeducted,
            runningBalance: 0,
            status: 'failed',
            walletType: 'payout',
            raw: p
          });

          list.push({
            id: `payout_refund_${p.id}`,
            agentId: p.agent_id,
            agentName: agInfo.name,
            agentLogin: agInfo.login,
            agentMobile: agInfo.mobile,
            date: p.created_at,
            timestamp: new Date(p.created_at).getTime() + 10,
            type: 'credit',
            source: 'payout_refund',
            title: `Refund - Failed Payout`,
            narration: `Auto-refund for ${beneficiary} | Ref: ${ref}`,
            reference: ref,
            beneficiaryName: beneficiary,
            accountNumber: p.account_number,
            ifscCode: p.ifsc_code,
            bankName: p.bank_name,
            orderId: p.order_id,
            amount: totalDeducted,
            charge: 0,
            netCredit: totalDeducted,
            netDebit: 0,
            runningBalance: 0,
            status: 'refunded',
            walletType: 'payout',
            raw: p
          });
        }
      });
    }

    // Sort strictly chronological (oldest to newest) to accurately calculate running balance
    list.sort((a, b) => a.timestamp - b.timestamp);

    // Compute running balance
    let bal = 0;
    for (let i = 0; i < list.length; i++) {
      bal = bal + list[i].netCredit - list[i].netDebit;
      list[i].runningBalance = Math.round(bal * 100) / 100;
    }

    return list;
  }, [allFunds, allLogs, allPayouts, selectedWallet, agentMap]);

  // Determine Start and End timestamps for active Date Filter
  const dateBounds = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (dateFilter === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (dateFilter === 'yesterday') {
      const y = subDays(now, 1);
      start = startOfDay(y);
      end = endOfDay(y);
    } else if (dateFilter === '7days') {
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
    } else if (dateFilter === '30days') {
      start = startOfDay(subDays(now, 29));
      end = endOfDay(now);
    } else if (dateFilter === 'thisMonth') {
      start = startOfMonth(now);
      end = endOfDay(now);
    } else if (dateFilter === 'custom') {
      if (customRange.start) start = startOfDay(parseISO(customRange.start));
      if (customRange.end) end = endOfDay(parseISO(customRange.end));
    }

    return {
      startTime: start ? start.getTime() : null,
      endTime: end ? end.getTime() : null
    };
  }, [dateFilter, customRange]);

  // Calculate Opening Balance (Prior to start date)
  const openingBalance = useMemo(() => {
    if (!dateBounds.startTime) return 0;
    let priorBal = 0;
    for (let i = 0; i < allChronologicalTxns.length; i++) {
      const t = allChronologicalTxns[i];
      if (t.timestamp < dateBounds.startTime) {
        priorBal += t.netCredit - t.netDebit;
      } else {
        break;
      }
    }
    return Math.round(priorBal * 100) / 100;
  }, [allChronologicalTxns, dateBounds.startTime]);

  // Filter transactions for display
  const filteredTxns = useMemo(() => {
    return allChronologicalTxns.filter((t) => {
      // 1. Date Range
      if (dateBounds.startTime && t.timestamp < dateBounds.startTime) return false;
      if (dateBounds.endTime && t.timestamp > dateBounds.endTime) return false;

      // 2. Type Filter
      if (typeFilter === 'credit' && t.type !== 'credit') return false;
      if (typeFilter === 'debit' && t.type !== 'debit') return false;

      // 3. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'success' && t.status !== 'success' && t.status !== 'approved') return false;
        if (statusFilter === 'pending' && t.status !== 'pending') return false;
        if (statusFilter === 'failed' && t.status !== 'failed' && t.status !== 'refunded') return false;
      }

      // 4. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesRef = t.reference.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesNarr = t.narration.toLowerCase().includes(q);
        const matchesAgent = t.agentName.toLowerCase().includes(q) || t.agentLogin.toLowerCase().includes(q) || t.agentMobile.includes(q);
        const matchesBiller = (t.billerName || '').toLowerCase().includes(q);
        const matchesConsumer = (t.consumerNo || '').toLowerCase().includes(q);
        const matchesBene = (t.beneficiaryName || '').toLowerCase().includes(q);
        const matchesAcc = (t.accountNumber || '').includes(q);
        if (!matchesRef && !matchesTitle && !matchesNarr && !matchesAgent && !matchesBiller && !matchesConsumer && !matchesBene && !matchesAcc) {
          return false;
        }
      }

      return true;
    });
  }, [allChronologicalTxns, dateBounds, typeFilter, statusFilter, searchTerm]);

  // Group into Daily Ledgers
  const dailyLedgers = useMemo(() => {
    const map: Record<string, AdminStatementTxn[]> = {};

    filteredTxns.forEach((t) => {
      const dayKey = format(parseISO(t.date), 'yyyy-MM-dd');
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(t);
    });

    const dayKeys = Object.keys(map).sort((a, b) => b.localeCompare(a)); // Newest date first

    return dayKeys.map((dayKey) => {
      const txns = map[dayKey];
      const parsedDay = parseISO(dayKey);

      let totalCredit = 0;
      let totalDebit = 0;
      txns.forEach((t) => {
        totalCredit += t.netCredit;
        totalDebit += t.netDebit;
      });

      // Opening balance of day = running balance of last transaction before this day
      const dayStart = startOfDay(parsedDay).getTime();
      let dayOpening = 0;
      for (let i = 0; i < allChronologicalTxns.length; i++) {
        if (allChronologicalTxns[i].timestamp < dayStart) {
          dayOpening += allChronologicalTxns[i].netCredit - allChronologicalTxns[i].netDebit;
        } else {
          break;
        }
      }

      const closingBalance = dayOpening + totalCredit - totalDebit;

      return {
        dateKey: dayKey,
        displayDate: format(parsedDay, 'dd MMM yyyy'),
        dayName: format(parsedDay, 'EEEE'),
        openingBalance: Math.round(dayOpening * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        totalDebit: Math.round(totalDebit * 100) / 100,
        closingBalance: Math.round(closingBalance * 100) / 100,
        netChange: Math.round((totalCredit - totalDebit) * 100) / 100,
        txnCount: txns.length,
        txns: [...txns].reverse() // Show newest first inside day
      };
    });
  }, [filteredTxns, allChronologicalTxns]);

  // Summary Metrics calculation for current filtered view
  const summaryMetrics = useMemo(() => {
    let totalCredit = 0;
    let totalDebit = 0;
    let totalCharges = 0;
    let successCount = 0;
    let failedCount = 0;

    filteredTxns.forEach((t) => {
      totalCredit += t.netCredit;
      totalDebit += t.netDebit;
      totalCharges += t.charge;
      if (t.status === 'success' || t.status === 'approved') successCount++;
      if (t.status === 'failed' || t.status === 'refunded') failedCount++;
    });

    const netPeriodChange = totalCredit - totalDebit;
    const closingBal = openingBalance + netPeriodChange;

    // Get live wallet balance for selected agent or sum of all agents
    let liveWalletBalance = 0;
    if (selectedAgentId !== 'all') {
      const ag = agentMap[selectedAgentId];
      if (ag) {
        if (selectedWallet === 'payout') liveWalletBalance = Number(ag.payout_wallet_balance || 0);
        else if (selectedWallet === 'cspl') liveWalletBalance = Number(ag.cspl_wallet_balance || 0);
        else liveWalletBalance = Number(ag.wallet_balance || 0);
      }
    } else {
      // Total wallet balance across all agents
      liveWalletBalance = agents.reduce((acc, curr) => {
        if (selectedWallet === 'payout') return acc + Number(curr.payout_wallet_balance || 0);
        if (selectedWallet === 'cspl') return acc + Number(curr.cspl_wallet_balance || 0);
        return acc + Number(curr.wallet_balance || 0);
      }, 0);
    }

    return {
      openingBalance,
      totalCredit: Math.round(totalCredit * 100) / 100,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCharges: Math.round(totalCharges * 100) / 100,
      netPeriodChange: Math.round(netPeriodChange * 100) / 100,
      closingBalance: Math.round(closingBal * 100) / 100,
      liveWalletBalance: Math.round(liveWalletBalance * 100) / 100,
      txnCount: filteredTxns.length,
      successCount,
      failedCount
    };
  }, [filteredTxns, openingBalance, selectedAgentId, selectedWallet, agentMap, agents]);

  // Reverse transactions for Statement View (newest first)
  const displayTxns = useMemo(() => {
    return [...filteredTxns].reverse();
  }, [filteredTxns]);

  // Paginated transactions
  const paginatedTxns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayTxns.slice(start, start + pageSize);
  }, [displayTxns, currentPage, pageSize]);

  const totalPages = Math.ceil(displayTxns.length / pageSize) || 1;

  // Toggle day expansion
  const toggleDate = (dayKey: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey]
    }));
  };

  // Copy helper
  const copyText = (text: string, label = 'Copied to clipboard') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast?.success?.(label);
  };

  // Export to Excel (XLSX)
  const handleExportExcel = () => {
    if (filteredTxns.length === 0) {
      toast?.warning?.('No records to export in the selected filter.');
      return;
    }

    const selectedAgentObj = selectedAgentId !== 'all' ? agentMap[selectedAgentId] : null;
    const agentLabel = selectedAgentObj 
      ? `${selectedAgentObj.first_name || ''} ${selectedAgentObj.last_name || ''} (${selectedAgentObj.b2b_login_id})` 
      : 'All Agents';

    const sheetData: any[] = [];

    // Header info
    sheetData.push(['B2B ADMIN ACCOUNT STATEMENT']);
    sheetData.push(['Wallet Service', selectedWallet.toUpperCase() + ' STATEMENT']);
    sheetData.push(['Agent Scope', agentLabel]);
    sheetData.push(['Date Filter', dateFilter.toUpperCase()]);
    sheetData.push(['Generated On', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
    sheetData.push([]);

    // Summary Section
    sheetData.push(['FINANCIAL SUMMARY']);
    sheetData.push(['Opening Balance (₹)', summaryMetrics.openingBalance]);
    sheetData.push(['Total Credits (₹)', summaryMetrics.totalCredit]);
    sheetData.push(['Total Debits (₹)', summaryMetrics.totalDebit]);
    sheetData.push(['Total Platform Fee / Charges (₹)', summaryMetrics.totalCharges]);
    sheetData.push(['Closing Balance (₹)', summaryMetrics.closingBalance]);
    sheetData.push(['Current Live Balance (₹)', summaryMetrics.liveWalletBalance]);
    sheetData.push(['Total Transactions', summaryMetrics.txnCount]);
    sheetData.push([]);

    // Table Header
    sheetData.push([
      'Date & Time',
      'Agent Name',
      'Agent Login ID',
      'Agent Mobile',
      'Txn Type',
      'Description / Particulars',
      'Reference / UTR / Order ID',
      'Service / Category',
      'Account / Beneficiary / Consumer No',
      'Amount (₹)',
      'Charge / Fee (₹)',
      'Debit (Dr ₹)',
      'Credit (Cr ₹)',
      'Running Balance (₹)',
      'Status'
    ]);

    // Rows
    displayTxns.forEach((t) => {
      sheetData.push([
        format(parseISO(t.date), 'yyyy-MM-dd HH:mm:ss'),
        t.agentName,
        t.agentLogin,
        t.agentMobile,
        t.type.toUpperCase(),
        t.title + ' - ' + t.narration,
        t.reference,
        t.billerName || (t.walletType === 'payout' ? 'Instant Payout' : 'Bill Service'),
        t.consumerNo || t.accountNumber || 'N/A',
        t.amount,
        t.charge,
        t.netDebit > 0 ? t.netDebit : 0,
        t.netCredit > 0 ? t.netCredit : 0,
        t.runningBalance,
        t.status.toUpperCase()
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');

    // Auto-fit column widths
    const maxCols = 15;
    const colWidths = Array(maxCols).fill({ wch: 18 });
    colWidths[0] = { wch: 20 }; // Date
    colWidths[5] = { wch: 35 }; // Description
    colWidths[6] = { wch: 24 }; // Reference
    worksheet['!cols'] = colWidths;

    const fileName = `B2B_Admin_${selectedWallet.toUpperCase()}_Statement_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast?.success?.(`Statement exported: ${fileName}`);
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  // Helper colors
  const walletBadgeStyle = {
    bbps: 'bg-indigo-600 text-white shadow-indigo-500/20',
    cspl: 'bg-amber-600 text-white shadow-amber-500/20',
    payout: 'bg-emerald-600 text-white shadow-emerald-500/20'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Account Statements
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                B2B Admin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Real-time Ledger Passbook, Opening/Closing Balances & Audit Trail for BBPS, CSPL and Payout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchData()}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700 text-xs sm:text-sm font-medium disabled:opacity-50"
            title="Refresh Ledger Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/20 border border-emerald-500"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs sm:text-sm font-medium border border-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 2. Top Wallet Service Tabs: BBPS, CSPL, Payout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tab 1: BBPS Bill */}
        <button
          onClick={() => setSelectedWallet('bbps')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
            selectedWallet === 'bbps'
              ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl transition ${selectedWallet === 'bbps' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400'}`}>
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">Service 1</div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                BBPS Bill Statement
                {selectedWallet === 'bbps' && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Electricity, Gas, Water & Utility</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedWallet === 'bbps' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'}`}>
              Active Tab
            </span>
          </div>
        </button>

        {/* Tab 2: CSPL Bill */}
        <button
          onClick={() => setSelectedWallet('cspl')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
            selectedWallet === 'cspl'
              ? 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl transition ${selectedWallet === 'cspl' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-amber-400'}`}>
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">Service 2</div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                CSPL Bill Statement
                {selectedWallet === 'cspl' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">CSPL Direct Bill & Mobile API</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedWallet === 'cspl' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
              Active Tab
            </span>
          </div>
        </button>

        {/* Tab 3: Payout */}
        <button
          onClick={() => setSelectedWallet('payout')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
            selectedWallet === 'payout'
              ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl transition ${selectedWallet === 'payout' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-emerald-400'}`}>
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">Service 3</div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                Payout Statement
                {selectedWallet === 'payout' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Instant Bank Transfer & Surcharge</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedWallet === 'payout' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              Active Tab
            </span>
          </div>
        </button>
      </div>

      {/* 3. Filter Bar (Agent, Date, Type, Search) */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Agent Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Select Agent</span>
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="all">⚡ All Agents ({agents.length})</option>
              {agents.map((ag) => {
                const bal = selectedWallet === 'payout' 
                  ? ag.payout_wallet_balance 
                  : selectedWallet === 'cspl' 
                    ? ag.cspl_wallet_balance 
                    : ag.wallet_balance;
                return (
                  <option key={ag.id} value={ag.id}>
                    {ag.first_name || ''} {ag.last_name || ''} - {ag.b2b_login_id} (Bal: ₹{Number(bal || 0).toFixed(2)})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Statement Period</span>
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition"
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

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span>Txn Type</span>
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="all">All Entries (Credit & Debit)</option>
              <option value="credit">Credits Only (Funds & Refunds)</option>
              <option value="debit">Debits Only (Bills & Payouts)</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>Search Ledger</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="UTR, Order ID, Account, Agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-indigo-500 transition placeholder:text-slate-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Range Row */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">From:</span>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">To:</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Financial Summary Cards (Opening, Credits, Debits, Closing, Live Balance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Opening Balance */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Opening Balance</span>
            <Scale className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            ₹{summaryMetrics.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Balance prior to period</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-slate-800/30 rounded-full blur-xl group-hover:bg-slate-800/50 transition-all" />
        </div>

        {/* Card 2: Total Credit (Inflow) */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">Total Credit (Cr)</span>
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-400 tracking-tight">
            +₹{summaryMetrics.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Fund Approvals & Refunds</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
        </div>

        {/* Card 3: Total Debit (Outflow) */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-rose-400">Total Debit (Dr)</span>
            <div className="p-1 rounded bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-400 tracking-tight">
            -₹{summaryMetrics.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Bills Paid & Transfers</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
        </div>

        {/* Card 4: Platform Charges */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400">Total Charges</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-400 tracking-tight">
            ₹{summaryMetrics.totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Platform Fees & GST</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
        </div>

        {/* Card 5: Closing / Current Live Balance */}
        <div className="bg-gradient-to-br from-indigo-950/70 to-slate-900 border border-indigo-500/30 p-4 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between text-indigo-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">
              {selectedAgentId === 'all' ? 'Total Wallet Bal' : 'Live Wallet Bal'}
            </span>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-400 tracking-tight">
            ₹{summaryMetrics.liveWalletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-1">
            <span>Closing: ₹{summaryMetrics.closingBalance.toFixed(2)}</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/30 transition-all" />
        </div>
      </div>

      {/* 5. Statement View Mode (Passbook vs Daily Ledger) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('statement')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'statement'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Passbook Statement ({displayTxns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'daily'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Daily Ledger Summary ({dailyLedgers.length} Days)</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-3">
          <span>Showing: <strong className="text-white">{displayTxns.length}</strong> entries</span>
          {activeTab === 'statement' && (
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 6. Content Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
          <LoadingSpinner />
          <p className="text-sm text-slate-400 mt-4 animate-pulse">Calculating balances & loading transactions...</p>
        </div>
      ) : activeTab === 'statement' ? (
        /* ================== PASSBOOK DETAILED VIEW ================== */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Agent Details</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Particulars / Service</th>
                  <th className="py-3.5 px-4">Reference / UTR</th>
                  <th className="py-3.5 px-4 text-right">Debit (Dr ₹)</th>
                  <th className="py-3.5 px-4 text-right">Credit (Cr ₹)</th>
                  <th className="py-3.5 px-4 text-right">Balance (₹)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {paginatedTxns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="w-10 h-10 text-slate-600" />
                        <p className="text-base font-semibold text-slate-400">No statement records found</p>
                        <p className="text-xs text-slate-500">Try changing the date range, agent, or search filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTxns.map((t) => {
                    const isCredit = t.type === 'credit';
                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition group">
                        
                        {/* Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-white">
                            {format(parseISO(t.date), 'dd MMM yyyy')}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {format(parseISO(t.date), 'hh:mm:ss a')}
                          </div>
                        </td>

                        {/* Agent */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            {t.agentName}
                          </div>
                          <div className="text-[11px] text-indigo-400 font-mono">
                            {t.agentLogin}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isCredit ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <ArrowDownLeft className="w-3 h-3" />
                              Credit (Cr)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <ArrowUpRight className="w-3 h-3" />
                              Debit (Dr)
                            </span>
                          )}
                        </td>

                        {/* Particulars */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-xs font-bold text-white truncate" title={t.title}>
                            {t.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate" title={t.narration}>
                            {t.narration}
                          </div>
                        </td>

                        {/* Reference / UTR */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-mono text-xs text-slate-300">
                            <span className="truncate max-w-[140px]" title={t.reference}>{t.reference}</span>
                            <button
                              onClick={() => copyText(t.reference, 'Reference copied!')}
                              className="text-slate-500 hover:text-slate-300 transition p-1"
                              title="Copy Reference"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Debit Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs font-bold text-rose-400">
                          {t.netDebit > 0 ? `-₹${t.netDebit.toFixed(2)}` : '—'}
                        </td>

                        {/* Credit Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs font-bold text-emerald-400">
                          {t.netCredit > 0 ? `+₹${t.netCredit.toFixed(2)}` : '—'}
                        </td>

                        {/* Running Balance */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs font-bold text-indigo-300">
                          ₹{t.runningBalance.toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {t.status === 'success' || t.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Success
                            </span>
                          ) : t.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          ) : t.status === 'refunded' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <RefreshCw className="w-3 h-3" />
                              Refunded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedTxn(t)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
              <div>
                Showing page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================== DAILY LEDGER SUMMARY VIEW ================== */
        <div className="space-y-3">
          {dailyLedgers.length === 0 ? (
            <div className="py-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-500">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-base font-semibold text-slate-400">No day-wise entries for selected filter</p>
            </div>
          ) : (
            dailyLedgers.map((day) => {
              const isExpanded = !!expandedDates[day.dateKey];
              return (
                <div key={day.dateKey} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition">
                  {/* Day Header Accordion */}
                  <div
                    onClick={() => toggleDate(day.dateKey)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-800 rounded-xl text-indigo-400 font-bold">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{day.displayDate}</span>
                          <span className="text-xs font-normal text-slate-400">({day.dayName})</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {day.txnCount} txns
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Opening: ₹{day.openingBalance.toFixed(2)} → Closing: ₹{day.closingBalance.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Day Financial Breakdown */}
                    <div className="flex items-center gap-4 flex-wrap text-xs font-mono">
                      <div className="text-right">
                        <div className="text-slate-500 text-[10px] uppercase">Credits (Cr)</div>
                        <div className="font-bold text-emerald-400">+₹{day.totalCredit.toFixed(2)}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-slate-500 text-[10px] uppercase">Debits (Dr)</div>
                        <div className="font-bold text-rose-400">-₹{day.totalDebit.toFixed(2)}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-slate-500 text-[10px] uppercase">Net Change</div>
                        <div className={`font-bold ${day.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {day.netChange >= 0 ? `+₹${day.netChange.toFixed(2)}` : `-₹${Math.abs(day.netChange).toFixed(2)}`}
                        </div>
                      </div>

                      <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Transactions for this day */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-950/60 p-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="text-[11px] uppercase text-slate-500 border-b border-slate-800/80">
                            <tr>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Agent</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">Particulars</th>
                              <th className="py-2 px-3">Reference</th>
                              <th className="py-2 px-3 text-right">Debit (Dr)</th>
                              <th className="py-2 px-3 text-right">Credit (Cr)</th>
                              <th className="py-2 px-3 text-right">Running Bal</th>
                              <th className="py-2 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {day.txns.map((t) => (
                              <tr key={t.id} className="hover:bg-slate-800/30">
                                <td className="py-2 px-3 whitespace-nowrap text-slate-400 font-mono">
                                  {format(parseISO(t.date), 'hh:mm:ss a')}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className="font-semibold text-white">{t.agentName}</span>{' '}
                                  <span className="text-[10px] text-indigo-400 font-mono">({t.agentLogin})</span>
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  {t.type === 'credit' ? (
                                    <span className="text-emerald-400 font-bold">Credit</span>
                                  ) : (
                                    <span className="text-rose-400 font-bold">Debit</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 max-w-xs truncate" title={t.narration}>
                                  {t.title}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                                  {t.reference}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-400">
                                  {t.netDebit > 0 ? `₹${t.netDebit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                                  {t.netCredit > 0 ? `₹${t.netCredit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">
                                  ₹{t.runningBalance.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    t.status === 'success' || t.status === 'approved'
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : t.status === 'pending'
                                        ? 'text-amber-400 bg-amber-500/10'
                                        : 'text-rose-400 bg-rose-500/10'
                                  }`}>
                                    {t.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 7. Transaction Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${selectedTxn.type === 'credit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {selectedTxn.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Transaction Breakdown</h3>
                  <p className="text-xs text-slate-400">{selectedTxn.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTxn(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Transaction Status</div>
                  <div className="text-sm font-bold text-white capitalize">{selectedTxn.status}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Net Amount</div>
                  <div className={`text-base font-mono font-bold ${selectedTxn.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedTxn.type === 'credit' ? `+₹${selectedTxn.netCredit.toFixed(2)}` : `-₹${selectedTxn.netDebit.toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* Agent & Wallet Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block mb-1">Agent Name</span>
                  <span className="font-bold text-white block">{selectedTxn.agentName}</span>
                  <span className="text-indigo-400 font-mono text-[11px]">{selectedTxn.agentLogin}</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block mb-1">Wallet & Service</span>
                  <span className="font-bold text-white uppercase block">{selectedTxn.walletType} Wallet</span>
                  <span className="text-slate-400 text-[11px]">Passbook Entry</span>
                </div>
              </div>

              {/* Timing & Reference */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Date & Time</span>
                  <span className="text-white font-mono">{format(parseISO(selectedTxn.date), 'dd MMM yyyy, hh:mm:ss a')}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Reference / UTR</span>
                  <div className="flex items-center gap-1 font-mono text-white">
                    <span>{selectedTxn.reference}</span>
                    <button onClick={() => copyText(selectedTxn.reference)} className="text-slate-400 hover:text-white">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {selectedTxn.billerName && (
                  <div className="flex justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Biller Name</span>
                    <span className="text-white font-medium">{selectedTxn.billerName}</span>
                  </div>
                )}

                {selectedTxn.consumerNo && (
                  <div className="flex justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Consumer / A/C No</span>
                    <span className="text-white font-mono">{selectedTxn.consumerNo}</span>
                  </div>
                )}

                {selectedTxn.beneficiaryName && (
                  <div className="flex justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Beneficiary</span>
                    <span className="text-white font-medium">{selectedTxn.beneficiaryName}</span>
                  </div>
                )}

                {selectedTxn.accountNumber && (
                  <div className="flex justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Bank Account & IFSC</span>
                    <span className="text-white font-mono">{selectedTxn.accountNumber} ({selectedTxn.ifscCode})</span>
                  </div>
                )}

                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Base Amount</span>
                  <span className="text-white font-mono font-bold">₹{selectedTxn.amount.toFixed(2)}</span>
                </div>

                {selectedTxn.charge > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-800/60 text-amber-400">
                    <span>Platform Fee / Charge</span>
                    <span className="font-mono font-bold">₹{selectedTxn.charge.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between py-2 pt-3 text-sm font-bold">
                  <span className="text-indigo-400">Running Balance After Txn</span>
                  <span className="text-indigo-300 font-mono">₹{selectedTxn.runningBalance.toFixed(2)}</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTxn(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
