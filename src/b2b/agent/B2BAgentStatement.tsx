import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FileText, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  AlertCircle,
  HelpCircle,
  Hash,
  Download
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export interface StatementTxn {
  id: string;
  date: string;
  timestamp: number;
  type: 'credit' | 'debit';
  source: 'fund_request' | 'bill_payment' | 'bill_refund';
  title: string;
  narration: string;
  reference: string;
  billerName?: string;
  consumerNo?: string;
  amount: number;
  charge: number;
  netCredit: number;
  netDebit: number;
  runningBalance: number;
  status: 'approved' | 'success' | 'pending' | 'failed' | 'refunded';
  raw: any;
}

export interface DailyLedgerItem {
  dateKey: string; // YYYY-MM-DD
  displayDate: string;
  dayName: string;
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  netChange: number;
  txnCount: number;
  txns: StatementTxn[];
}

export default function B2BAgentStatement() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<any>(null);

  // Tab View: 'statement' | 'daily'
  const [activeTab, setActiveTab] = useState<'statement' | 'daily'>('statement');

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded dates in daily view
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Raw fetched data
  const [allFunds, setAllFunds] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);

  useEffect(() => {
    const id = localStorage.getItem('b2bAgentId');
    if (!id) {
      navigate('/b2b/login');
      return;
    }
    setAgentId(id);
    loadAgentProfile(id);
    fetchData(id);

    // Setup realtime subscription
    const channel1 = supabase
      .channel(`b2b_agent_statement_funds_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_fund_requests', filter: `agent_id=eq.${id}` }, () => {
        fetchData(id, true);
        loadAgentProfile(id);
      })
      .subscribe();

    const channel2 = supabase
      .channel(`b2b_agent_statement_logs_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_api_logs', filter: `agent_id=eq.${id}` }, () => {
        fetchData(id, true);
      })
      .subscribe();

    const channel3 = supabase
      .channel(`b2b_agent_statement_creds_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_api_credentials', filter: `id=eq.${id}` }, (payload: any) => {
        if (payload?.new) {
          setAgentDetails(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
      supabase.removeChannel(channel3);
    };
  }, [navigate]);

  const loadAgentProfile = async (id: string) => {
    try {
      const { data } = await supabase
        .from('b2b_api_credentials')
        .select('*')
        .eq('id', id)
        .single();
      if (data) {
        setAgentDetails(data);
      }
    } catch (e) {
      console.error('Error fetching agent details:', e);
    }
  };

  const fetchData = async (id: string, isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch all fund requests for this agent
      let fundsData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('b2b_fund_requests')
          .select('id, agent_id, amount, status, created_at, updated_at, utr_number, b2b_admin_bank_accounts(account_name, bank_name)')
          .eq('agent_id', id)
          .order('created_at', { ascending: true })
          .range(from, from + step - 1);

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

      // 2. Fetch all pay-bill api logs for this agent
      let logsData: any[] = [];
      let lFrom = 0;
      let lHasMore = true;
      while (lHasMore) {
        const { data, error } = await supabase
          .from('b2b_api_logs')
          .select('id, agent_id, endpoint, status_code, payment_status, charge_deducted, request_payload, response_payload, created_at')
          .eq('agent_id', id)
          .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
          .order('created_at', { ascending: true })
          .range(lFrom, lFrom + step - 1);

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

    } catch (err: any) {
      console.error('Statement fetch error:', err);
      toast.error('Failed to load statement records: ' + (err?.message || ''));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper to determine status and details of bill log
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

    // Determine Status
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

    const billerName = req?.billerName || req?.biller_name || req?.billerId || res?.billerName || 'BBPS Biller';
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

  // Convert raw funds & logs into chronological unified ledger transactions
  const allLedgerTxns = useMemo(() => {
    const list: StatementTxn[] = [];

    // 1. Process Fund Requests
    allFunds.forEach((f) => {
      const isApproved = f.status === 'approved';
      if (!isApproved) return; // Only approved fund requests affect balance

      const amt = Number(f.amount || 0);
      const bankName = f.b2b_admin_bank_accounts?.bank_name || 'Admin Bank';
      const utr = f.utr_number || 'N/A';

      list.push({
        id: `fund_${f.id}`,
        date: f.created_at,
        timestamp: new Date(f.created_at).getTime(),
        type: 'credit',
        source: 'fund_request',
        title: 'Wallet Fund Top-Up',
        narration: `Deposit to ${bankName} | UTR: ${utr}`,
        reference: utr,
        amount: amt,
        charge: 0,
        netCredit: amt,
        netDebit: 0,
        runningBalance: 0, // Calculated later
        status: 'approved',
        raw: f
      });
    });

    // 2. Process Bill Logs
    allLogs.forEach((l) => {
      const parsed = parseBillLog(l);
      // If status is failed and wasn't refunded or had 0 deduction, check if it was deducted
      // In B2B gateway, any pay-bill attempt immediately deducts funds.
      // If success or pending -> Debit stands.
      // If failed/refunded -> There is a debit of (amount + charge) AND a refund credit of (amount + charge).

      if (parsed.status === 'success' || parsed.status === 'pending') {
        list.push({
          id: `bill_${l.id}`,
          date: l.created_at,
          timestamp: new Date(l.created_at).getTime(),
          type: 'debit',
          source: 'bill_payment',
          title: `Bill Payment - ${parsed.billerName}`,
          narration: `Consumer: ${parsed.consumerNo || 'N/A'} | Ref: ${parsed.reference}${parsed.charge > 0 ? ` (Includes ₹${parsed.charge.toFixed(2)} Fee)` : ''}`,
          reference: parsed.reference,
          billerName: parsed.billerName,
          consumerNo: parsed.consumerNo,
          amount: parsed.billAmount,
          charge: parsed.charge,
          netCredit: 0,
          netDebit: parsed.totalDeduction,
          runningBalance: 0,
          status: parsed.status,
          raw: l
        });
      } else if (parsed.status === 'failed' || parsed.status === 'refunded') {
        // Debit entry at request time
        list.push({
          id: `bill_fail_${l.id}`,
          date: l.created_at,
          timestamp: new Date(l.created_at).getTime(),
          type: 'debit',
          source: 'bill_payment',
          title: `Bill Payment (Failed) - ${parsed.billerName}`,
          narration: `Consumer: ${parsed.consumerNo || 'N/A'} | Ref: ${parsed.reference}`,
          reference: parsed.reference,
          billerName: parsed.billerName,
          consumerNo: parsed.consumerNo,
          amount: parsed.billAmount,
          charge: parsed.charge,
          netCredit: 0,
          netDebit: parsed.totalDeduction,
          runningBalance: 0,
          status: 'failed',
          raw: l
        });

        // Instant refund entry
        list.push({
          id: `bill_refund_${l.id}`,
          date: l.created_at,
          timestamp: new Date(l.created_at).getTime() + 10, // slight offset to order after debit
          type: 'credit',
          source: 'bill_refund',
          title: `Refund - Failed Bill Payment`,
          narration: `Auto-refund for ${parsed.billerName} | Consumer: ${parsed.consumerNo || 'N/A'}`,
          reference: parsed.reference,
          billerName: parsed.billerName,
          consumerNo: parsed.consumerNo,
          amount: parsed.totalDeduction,
          charge: 0,
          netCredit: parsed.totalDeduction,
          netDebit: 0,
          runningBalance: 0,
          status: 'refunded',
          raw: l
        });
      }
    });

    // Sort strictly ascending by exact timestamp (chronological real-time order)
    list.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate baseline initial balance from verified live balance
    const liveBal = Number(agentDetails?.wallet_balance ?? 0);
    const sumCredits = list.reduce((s, t) => s + t.netCredit, 0);
    const sumDebits = list.reduce((s, t) => s + t.netDebit, 0);
    const initialBalance = Math.round((liveBal - sumCredits + sumDebits) * 100) / 100;

    // Compute running balance in strict chronological order of events
    let bal = initialBalance;
    for (let i = 0; i < list.length; i++) {
      bal = bal + list[i].netCredit - list[i].netDebit;
      // In prepaid wallets, running balance never dips below 0 (floored at 0 for display)
      list[i].runningBalance = Math.max(0, Math.round(bal * 100) / 100);
    }

    // Anchor latest transaction to current live wallet balance if available
    if (list.length > 0 && liveBal > 0) {
      list[list.length - 1].runningBalance = liveBal;
    }

    return list;
  }, [allFunds, allLogs, agentDetails]);

  // Date Bounds for Filtering
  const dateBounds = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    let start: Date | null = null;
    let end: Date | null = null;

    if (dateFilter === 'today') {
      start = todayStart;
      end = todayEnd;
    } else if (dateFilter === 'yesterday') {
      const y = subDays(todayStart, 1);
      start = y;
      end = endOfDay(y);
    } else if (dateFilter === '7days') {
      start = subDays(todayStart, 7);
      end = todayEnd;
    } else if (dateFilter === '30days') {
      start = subDays(todayStart, 30);
      end = todayEnd;
    } else if (dateFilter === 'thisMonth') {
      start = startOfMonth(now);
      end = todayEnd;
    } else if (dateFilter === 'custom') {
      if (customRange.start) {
        start = startOfDay(parseISO(customRange.start));
      }
      if (customRange.end) {
        end = endOfDay(parseISO(customRange.end));
      }
    }

    return { start, end };
  }, [dateFilter, customRange]);

  // Filtered transactions for the selected range
  const filteredData = useMemo(() => {
    const { start, end } = dateBounds;

    // 1. Calculate Period Opening Balance (running balance right before 'start')
    let openingBalance = 0;
    if (start) {
      const priorTxns = allLedgerTxns.filter((t) => t.timestamp < start.getTime());
      if (priorTxns.length > 0) {
        openingBalance = Math.max(0, priorTxns[priorTxns.length - 1].runningBalance);
      }
    }

    // 2. Transactions in the period
    let periodTxns = allLedgerTxns.filter((t) => {
      if (start && t.timestamp < start.getTime()) return false;
      if (end && t.timestamp > end.getTime()) return false;
      return true;
    });

    // Period Totals before type/search filters
    let periodCredits = 0;
    let periodDebits = 0;
    periodTxns.forEach((t) => {
      periodCredits += t.netCredit;
      periodDebits += t.netDebit;
    });

    const isCurrentPeriod = !end || end.getTime() >= Date.now();
    const liveBal = Number(agentDetails?.wallet_balance || 0);
    let closingBalance = Math.max(0, Math.round((openingBalance + periodCredits - periodDebits) * 100) / 100);
    if (isCurrentPeriod && liveBal > 0) {
      closingBalance = liveBal;
    }

    // Apply Type Filter
    let displayedTxns = periodTxns;
    if (typeFilter === 'credit') {
      displayedTxns = displayedTxns.filter((t) => t.type === 'credit');
    } else if (typeFilter === 'debit') {
      displayedTxns = displayedTxns.filter((t) => t.type === 'debit');
    }

    // Apply Search Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      displayedTxns = displayedTxns.filter((t) => {
        return (
          t.title.toLowerCase().includes(q) ||
          t.narration.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q) ||
          (t.billerName && t.billerName.toLowerCase().includes(q)) ||
          (t.consumerNo && t.consumerNo.toLowerCase().includes(q)) ||
          t.amount.toString().includes(q)
        );
      });
    }

    // Reverse chronological for display (newest first)
    const reversedDisplay = [...displayedTxns].reverse();

    return {
      openingBalance,
      closingBalance,
      periodCredits,
      periodDebits,
      netChange: periodCredits - periodDebits,
      periodTxnCount: periodTxns.length,
      displayedTxns: reversedDisplay,
      rawPeriodTxns: periodTxns // chronological for daily aggregation
    };
  }, [allLedgerTxns, dateBounds, typeFilter, searchTerm, agentDetails]);

  // Aggregate into Daily Balances
  const dailyLedgerList = useMemo(() => {
    const rawTxns = filteredData.rawPeriodTxns;
    const groups: Record<string, StatementTxn[]> = {};

    rawTxns.forEach((t) => {
      const dKey = format(new Date(t.date), 'yyyy-MM-dd');
      if (!groups[dKey]) groups[dKey] = [];
      groups[dKey].push(t);
    });

    const sortedDates = Object.keys(groups).sort();
    const result: DailyLedgerItem[] = [];

    let runningDayBal = filteredData.openingBalance;
    const liveBal = Number(agentDetails?.wallet_balance || 0);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    sortedDates.forEach((dKey) => {
      const dayTxns = groups[dKey];
      const dayOpen = Math.max(0, Math.round(runningDayBal * 100) / 100);
      let dayCredits = 0;
      let dayDebits = 0;

      dayTxns.forEach((t) => {
        dayCredits += t.netCredit;
        dayDebits += t.netDebit;
      });

      let dayClose = Math.max(0, Math.round((dayOpen + dayCredits - dayDebits) * 100) / 100);
      if (dKey === todayStr && liveBal > 0) {
        dayClose = liveBal;
      }
      runningDayBal = dayClose;

      const dateObj = parseISO(dKey);
      result.push({
        dateKey: dKey,
        displayDate: format(dateObj, 'dd MMM yyyy'),
        dayName: format(dateObj, 'EEEE'),
        openingBalance: dayOpen,
        totalCredit: dayCredits,
        totalDebit: dayDebits,
        closingBalance: dayClose,
        netChange: dayCredits - dayDebits,
        txnCount: dayTxns.length,
        txns: [...dayTxns].reverse() // newest on top inside the day
      });
    });

    // Return reversed so latest day is on top
    return result.reverse();
  }, [filteredData, agentDetails]);

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const agentName = `${agentDetails?.first_name || ''} ${agentDetails?.last_name || ''}`.trim() || agentDetails?.b2b_login_id || 'B2B Agent';

      if (activeTab === 'statement') {
        const rows = filteredData.displayedTxns.map((t, index) => ({
          'Sr No': index + 1,
          'Date & Time': format(new Date(t.date), 'dd/MM/yyyy hh:mm a'),
          'Description / Narration': t.narration,
          'Type': t.type.toUpperCase(),
          'Reference / UTR / Txn ID': t.reference,
          'Amount (₹)': t.amount,
          'Fee / Charge (₹)': t.charge,
          'Credit (+) (₹)': t.netCredit > 0 ? t.netCredit : '',
          'Debit (-) (₹)': t.netDebit > 0 ? t.netDebit : '',
          'Running Balance (₹)': t.runningBalance,
          'Status': t.status.toUpperCase()
        }));

        // Add summary row
        rows.push({
          'Sr No': '' as any,
          'Date & Time': 'TOTALS',
          'Description / Narration': `Opening Bal: ₹${filteredData.openingBalance.toFixed(2)} | Closing Bal: ₹${filteredData.closingBalance.toFixed(2)}`,
          'Type': '',
          'Reference / UTR / Txn ID': '',
          'Amount (₹)': '' as any,
          'Fee / Charge (₹)': '' as any,
          'Credit (+) (₹)': filteredData.periodCredits as any,
          'Debit (-) (₹)': filteredData.periodDebits as any,
          'Running Balance (₹)': filteredData.closingBalance as any,
          'Status': ''
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Account Statement');
        XLSX.writeFile(wb, `B2B_Statement_${agentDetails?.b2b_login_id || 'Agent'}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        toast.success('Detailed statement exported to Excel!');
      } else {
        // Daily Ledger Export
        const rows = dailyLedgerList.map((d, index) => ({
          'Sr No': index + 1,
          'Date': d.displayDate,
          'Day': d.dayName,
          'Opening Balance (₹)': d.openingBalance,
          'Total Credits (+) (₹)': d.totalCredit,
          'Total Debits (-) (₹)': d.totalDebit,
          'Net Change (₹)': d.netChange,
          'Closing Balance (₹)': d.closingBalance,
          'Total Transactions': d.txnCount
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daily Balance Summary');
        XLSX.writeFile(wb, `B2B_Daily_Balance_${agentDetails?.b2b_login_id || 'Agent'}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        toast.success('Daily balance summary exported to Excel!');
      }
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      toast.error('Failed to export Excel file');
    }
  };

  // Export / Print PDF (Bank Statement Look)
  const handleExportPDF = async () => {
    try {
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule;

      const doc = new JsPDFClass({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const agentName = `${agentDetails?.first_name || ''} ${agentDetails?.last_name || ''}`.trim() || agentDetails?.b2b_login_id || 'B2B Agent';
      const liveBal = Number(agentDetails?.wallet_balance || 0);

      // --- Header Design ---
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, 'F');

      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('B2B AGENT ACCOUNT STATEMENT', 14, 16);

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.text(`Official Passbook & Transaction Ledger`, 14, 22);
      doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 27);
      doc.text(`Statement Period: ${dateFilter.toUpperCase()} (${filteredData.displayedTxns.length} records)`, 14, 32);

      // Right Header - Agent Info Box
      doc.setFontSize(9);
      doc.setTextColor(226, 232, 240);
      doc.setFont('helvetica', 'bold');
      doc.text(`Agent: ${agentName}`, 140, 16);
      doc.setFont('helvetica', 'normal');
      doc.text(`Login ID: ${agentDetails?.b2b_login_id || 'N/A'}`, 140, 21);
      doc.text(`Mobile: ${agentDetails?.mobile || 'N/A'}`, 140, 26);
      doc.setTextColor(52, 211, 153); // emerald-400
      doc.setFont('helvetica', 'bold');
      doc.text(`Live Balance: Rs. ${liveBal.toFixed(2)}`, 140, 32);

      // --- Summary Metrics Box ---
      let startY = 48;
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(14, startY, 182, 18, 2, 2, 'F');

      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('OPENING BALANCE', 18, startY + 6);
      doc.text('TOTAL CREDITS (+)', 64, startY + 6);
      doc.text('TOTAL DEBITS (-)', 110, startY + 6);
      doc.text('CLOSING BALANCE', 156, startY + 6);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${filteredData.openingBalance.toFixed(2)}`, 18, startY + 13);
      doc.setTextColor(16, 185, 129); // green
      doc.text(`Rs. ${filteredData.periodCredits.toFixed(2)}`, 64, startY + 13);
      doc.setTextColor(239, 68, 68); // red
      doc.text(`Rs. ${filteredData.periodDebits.toFixed(2)}`, 110, startY + 13);
      doc.setTextColor(30, 41, 59);
      doc.text(`Rs. ${filteredData.closingBalance.toFixed(2)}`, 156, startY + 13);

      if (activeTab === 'statement') {
        // Table for Detailed Statement
        const bodyData = filteredData.displayedTxns.map((t, idx) => [
          (idx + 1).toString(),
          format(new Date(t.date), 'dd/MM/yy\nhh:mm a'),
          `${t.title}\n${t.narration}`,
          t.reference || '-',
          t.netCredit > 0 ? `+${t.netCredit.toFixed(2)}` : '-',
          t.netDebit > 0 ? `-${t.netDebit.toFixed(2)}` : '-',
          `${t.runningBalance.toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: startY + 24,
          head: [['#', 'Date & Time', 'Narration / Description', 'Reference ID', 'Credit (+)', 'Debit (-)', 'Balance']],
          body: bodyData,
          theme: 'striped',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 7.5,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 22 },
            2: { cellWidth: 70 },
            3: { cellWidth: 28 },
            4: { cellWidth: 20, halign: 'right', textColor: [16, 185, 129] },
            5: { cellWidth: 20, halign: 'right', textColor: [239, 68, 68] },
            6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
          },
          foot: [[
            'TOTAL',
            '',
            `Opening: Rs. ${filteredData.openingBalance.toFixed(2)}`,
            '',
            `+${filteredData.periodCredits.toFixed(2)}`,
            `-${filteredData.periodDebits.toFixed(2)}`,
            `${filteredData.closingBalance.toFixed(2)}`
          ]],
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8
          },
          margin: { left: 14, right: 14, bottom: 15 }
        });
      } else {
        // Table for Daily Balance
        const bodyData = dailyLedgerList.map((d, idx) => [
          (idx + 1).toString(),
          `${d.displayDate} (${d.dayName})`,
          `Rs. ${d.openingBalance.toFixed(2)}`,
          `+Rs. ${d.totalCredit.toFixed(2)}`,
          `-Rs. ${d.totalDebit.toFixed(2)}`,
          `${d.netChange >= 0 ? '+' : ''}Rs. ${d.netChange.toFixed(2)}`,
          `Rs. ${d.closingBalance.toFixed(2)}`,
          `${d.txnCount} Txns`
        ]);

        autoTable(doc, {
          startY: startY + 24,
          head: [['#', 'Date & Day', 'Opening Balance', 'Credit (+)', 'Debit (-)', 'Net Flow', 'Closing Balance', 'Txns']],
          body: bodyData,
          theme: 'striped',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 2.5
          },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 24, halign: 'right', textColor: [16, 185, 129] },
            4: { cellWidth: 24, halign: 'right', textColor: [239, 68, 68] },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
            7: { cellWidth: 20, halign: 'center' }
          },
          foot: [[
            'TOTAL',
            `Summary Period`,
            `Rs. ${filteredData.openingBalance.toFixed(2)}`,
            `+Rs. ${filteredData.periodCredits.toFixed(2)}`,
            `-Rs. ${filteredData.periodDebits.toFixed(2)}`,
            `${filteredData.netChange >= 0 ? '+' : ''}Rs. ${filteredData.netChange.toFixed(2)}`,
            `Rs. ${filteredData.closingBalance.toFixed(2)}`,
            `${filteredData.periodTxnCount} Txns`
          ]],
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8
          },
          margin: { left: 14, right: 14, bottom: 15 }
        });
      }

      doc.save(`B2B_Statement_${agentDetails?.b2b_login_id || 'Agent'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('Official PDF Statement downloaded!');
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast.error('Failed to generate PDF statement');
    }
  };

  const liveWalletBalance = Number(agentDetails?.wallet_balance || 0);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-slate-400 text-sm animate-pulse">Loading Account Statement & Passbook...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Banner / Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <Receipt className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Account Statement & Passbook</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                B2B Live Ledger
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Live bank-style passbook statement with daily opening and closing balances.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 relative z-10 flex-wrap">
          <button
            onClick={() => agentId && fetchData(agentId, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Export</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Primary Balance Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Live Current Balance */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Wallet Balance</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 tracking-tight">
            ₹ {liveWalletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Real-time available account balance
          </p>
        </div>

        {/* Card 2: Period Total Inward (Credit) */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Inward (Credit)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-300 tracking-tight">
            + ₹ {filteredData.periodCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total credited funds & refunds in period
          </p>
        </div>

        {/* Card 3: Period Total Outward (Debit) */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Outward (Debit)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            - ₹ {filteredData.periodDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total bill payments & fee charges in period
          </p>
        </div>

        {/* Card 4: Net Flow & Opening/Closing */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Period Balance Summary</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-slate-400">Opening: <span className="font-bold text-white font-mono">₹{filteredData.openingBalance.toFixed(2)}</span></div>
            <div className="text-xs text-slate-400">Closing: <span className="font-bold text-indigo-300 font-mono">₹{filteredData.closingBalance.toFixed(2)}</span></div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Net Flow:</span>
            <span className={`font-black font-mono ${filteredData.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {filteredData.netChange >= 0 ? '+' : ''}₹ {filteredData.netChange.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Filter & Navigation Tabs Bar */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 shadow-xl space-y-4">
        {/* Tab Selection */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-700 pb-3">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('statement')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'statement'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Detailed Statement (Passbook)</span>
              <span className="ml-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {filteredData.displayedTxns.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('daily')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Daily Balance Summary (Day Ledger)</span>
              <span className="ml-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {dailyLedgerList.length} Days
              </span>
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
            {(['today', 'yesterday', '7days', '30days', 'thisMonth', 'custom', 'all'] as const).map((filter) => {
              const labels: Record<string, string> = {
                today: 'Today',
                yesterday: 'Yesterday',
                '7days': 'Last 7 Days',
                '30days': 'Last 30 Days',
                thisMonth: 'This Month',
                custom: 'Custom Range',
                all: 'All Time'
              };
              return (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dateFilter === filter
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {labels[filter]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Range Picker row if selected */}
        {dateFilter === 'custom' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-indigo-500/20">
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-bold uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              <span>Custom Date Range:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500 text-xs font-bold">to</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Sub-Filters: Search and Credit/Debit Type Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by UTR, Txn Ref ID, Consumer No, Biller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Type Filter Buttons (Only shown for Statement view) */}
          {activeTab === 'statement' && (
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 w-full sm:w-auto justify-end">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  typeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('credit')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                  typeFilter === 'credit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Credit (+)
              </button>
              <button
                onClick={() => setTypeFilter('debit')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                  typeFilter === 'debit' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Debit (-)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- */}
      {/* TAB 1: DETAILED BANK STATEMENT PASSBOOK                   */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'statement' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          {/* Header Info Bar */}
          <div className="bg-slate-900/90 px-6 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div>
              Showing <span className="text-white font-bold">{filteredData.displayedTxns.length}</span> transactions in selected period
            </div>
            <div className="flex items-center gap-4">
              <span>Opening Bal: <strong className="text-white font-mono">₹{filteredData.openingBalance.toFixed(2)}</strong></span>
              <span>Closing Bal: <strong className="text-emerald-400 font-mono">₹{filteredData.closingBalance.toFixed(2)}</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredData.displayedTxns.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Receipt className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-300">No Transactions Found</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                  No records match your selected date range or search filter.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-700">
                  <tr>
                    <th className="px-5 py-3.5 text-center w-12">#</th>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-5 py-3.5">Transaction Narration / Description</th>
                    <th className="px-5 py-3.5">Reference / Txn ID</th>
                    <th className="px-5 py-3.5 text-right text-emerald-400">Credit (+)</th>
                    <th className="px-5 py-3.5 text-right text-rose-400">Debit (-)</th>
                    <th className="px-5 py-3.5 text-right text-indigo-300">Running Balance</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredData.displayedTxns.map((t, idx) => {
                    const isCredit = t.type === 'credit';
                    return (
                      <tr 
                        key={t.id} 
                        className={`hover:bg-slate-750 transition-colors ${
                          t.status === 'refunded' ? 'bg-amber-950/10' : ''
                        }`}
                      >
                        <td className="px-5 py-3 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-200">
                            {format(new Date(t.date), 'dd MMM yyyy')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {format(new Date(t.date), 'hh:mm:ss a')}
                          </div>
                        </td>
                        <td className="px-5 py-3 max-w-xs sm:max-w-md truncate">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isCredit ? 'bg-emerald-400' : 'bg-rose-400'
                            }`} />
                            <span className="font-bold text-white text-xs truncate">
                              {t.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 pl-4">
                            {t.narration}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px]">
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                            {t.reference || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-sm">
                          {isCredit ? (
                            <span className="text-emerald-400">
                              +₹ {t.netCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-sm">
                          {!isCredit ? (
                            <span className="text-rose-400">
                              -₹ {t.netDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-extrabold text-sm text-indigo-300">
                          ₹ {t.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            t.status === 'approved' || t.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : t.status === 'refunded'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : t.status === 'pending'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Table Footer Summary */}
                <tfoot className="bg-slate-900 text-slate-200 font-bold border-t-2 border-slate-700">
                  <tr>
                    <td colSpan={4} className="px-5 py-4 text-left">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Total Period Summary:</span>{' '}
                      <span className="text-xs font-normal text-slate-300">
                        Opening Bal: ₹{filteredData.openingBalance.toFixed(2)} → Closing Bal: ₹{filteredData.closingBalance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm text-emerald-400">
                      +₹ {filteredData.periodCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm text-rose-400">
                      -₹ {filteredData.periodDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm text-indigo-300">
                      ₹ {filteredData.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* TAB 2: DAILY BALANCE LEDGER                               */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>
                Day-by-day <strong>Opening Balance</strong>, total <strong>Credits / Debits</strong>, and end-of-day <strong>Closing Balance</strong>.
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Click on any day row to expand all transactions for that date.
            </span>
          </div>

          {dailyLedgerList.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No Daily Balance Records Found</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                No transactions recorded within the selected date period.
              </p>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-900/70 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-700">
                  <tr>
                    <th className="px-5 py-3.5">Date & Day</th>
                    <th className="px-5 py-3.5 text-right">Opening Balance</th>
                    <th className="px-5 py-3.5 text-right text-emerald-400">Total Credit (+)</th>
                    <th className="px-5 py-3.5 text-right text-rose-400">Total Debit (-)</th>
                    <th className="px-5 py-3.5 text-right text-cyan-300">Net Flow</th>
                    <th className="px-5 py-3.5 text-right text-indigo-300">Closing Balance</th>
                    <th className="px-5 py-3.5 text-center">Transactions</th>
                    <th className="px-5 py-3.5 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {dailyLedgerList.map((day) => {
                    const isExpanded = !!expandedDates[day.dateKey];
                    return (
                      <React.Fragment key={day.dateKey}>
                        {/* Summary Day Row */}
                        <tr
                          onClick={() => toggleDateExpand(day.dateKey)}
                          className="hover:bg-slate-750 transition-colors cursor-pointer select-none"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              {day.displayDate}
                              <span className="text-[10px] font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                {day.dayName}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-300 text-sm">
                            ₹ {day.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                            {day.totalCredit > 0 ? `+₹ ${day.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-400 text-sm">
                            {day.totalDebit > 0 ? `-₹ ${day.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-sm">
                            <span className={day.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {day.netChange >= 0 ? '+' : ''}₹ {day.netChange.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-extrabold text-indigo-300 text-base">
                            ₹ {day.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
                              {day.txnCount} Txns
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 mx-auto text-indigo-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 mx-auto text-slate-500 hover:text-slate-300" />
                            )}
                          </td>
                        </tr>

                        {/* Expanded Day Transactions Accordion */}
                        {isExpanded && (
                          <tr className="bg-slate-900/80">
                            <td colSpan={8} className="p-4 border-y border-slate-700">
                              <div className="bg-slate-950 rounded-xl border border-slate-700/80 p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                                  <span className="font-bold text-indigo-300">
                                    All Transactions on {day.displayDate} ({day.txns.length})
                                  </span>
                                  <span>
                                    Day Opening: <strong>₹{day.openingBalance.toFixed(2)}</strong> → Day Closing: <strong>₹{day.closingBalance.toFixed(2)}</strong>
                                  </span>
                                </div>

                                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                                  {day.txns.map((dt) => (
                                    <div
                                      key={dt.id}
                                      className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${
                                          dt.type === 'credit'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-rose-500/10 text-rose-400'
                                        }`}>
                                          {dt.type === 'credit' ? (
                                            <ArrowDownLeft className="w-4 h-4" />
                                          ) : (
                                            <ArrowUpRight className="w-4 h-4" />
                                          )}
                                        </div>
                                        <div>
                                          <div className="font-bold text-white text-xs">{dt.title}</div>
                                          <div className="text-[11px] text-slate-400">{dt.narration}</div>
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <div className={`font-mono font-bold text-sm ${
                                          dt.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                          {dt.type === 'credit' ? '+' : '-'}₹ {(dt.type === 'credit' ? dt.netCredit : dt.netDebit).toFixed(2)}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          Bal: ₹{dt.runningBalance.toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
