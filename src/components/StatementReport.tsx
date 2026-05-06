import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Loader2,
  User,
  FileSpreadsheet,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnifiedRecord {
  id: string;
  type: 'QR' | 'BILL' | 'PAYOUT' | 'REFUND';
  date: string;
  firm_name: string;
  reference: string; // UTR for QR, Mobile for BILL, Transaction ID for PAYOUT
  amount: number;
  charges: number;
  final_total: number;
  status: string;
  raw_data: any;
  balance: number;
  numericId: string;
}

export default function StatementReport() {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);

  // Autocomplete state
  const [allFirms, setAllFirms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [exactAmount, setExactAmount] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'QR' | 'BILL' | 'PAYOUT'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchFirmNames = async () => {
    try {
      const { data, error } = await supabase.from('users_profiles').select('firm_name').not('firm_name', 'is', null);
      if (error) throw error;
      setAllFirms(Array.from(new Set(data.map(d => d.firm_name))).sort());
    } catch (err) { console.error('Firm fetch error:', err); }
  };

  useEffect(() => {
    fetchFirmNames();
  }, []);

  useEffect(() => {
    if (firmName.trim()) {
      setSuggestions(allFirms.filter(f => f.toLowerCase().includes(firmName.toLowerCase())).slice(0, 10));
    } else { setSuggestions([]); }
  }, [firmName, allFirms]);

  const fetchStatement = async () => {
    setLoading(true);

    try {
      let openingBalance = 0;

      // Calculate Opening Balance if start date is provided
      if (startDate) {
        let queryQr = supabase.from('payment_submissions').select('amount, charges').eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);
        let queryBill = supabase.from('bill_submissions').select('amount, charges').eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);
        let queryPayout = supabase.from('payout_submissions').select('amount, charge_amount').eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);

        // If a specific firm is searched, filter pre-balance by that firm
        if (firmName.trim()) {
          const { data: userProfile } = await supabase
            .from('users_profiles')
            .select('id')
            .ilike('firm_name', firmName.trim())
            .single();

          if (userProfile) {
            const userId = userProfile.id;
            queryQr = queryQr.eq('user_id', userId);
            queryBill = queryBill.eq('user_id', userId);
            queryPayout = queryPayout.eq('user_id', userId);
          }
        }

        const [qrPre, billPre, payoutPre] = await Promise.all([queryQr, queryBill, queryPayout]);

        const qrTotal = (qrPre.data || []).reduce((acc, r) => acc + (Number(r.amount) - Number(r.charges || 0)), 0);
        const billTotal = (billPre.data || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charges || 0)), 0);
        const payoutTotal = (payoutPre.data || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charge_amount || 0)), 0);

        openingBalance = qrTotal - billTotal - payoutTotal;
      }

      let qrMapped: any[] = [];
      let billMapped: any[] = [];
      let payoutMapped: any[] = [];

      // 1. Fetch QR Payments
      if (typeFilter === 'all' || typeFilter === 'QR') {
        let qrQuery = supabase.from('payment_submissions').select(`
          *, 
          users_profiles!inner(
            firm_name, 
            distributor_id, 
            admin_base_qr_charge, 
            charge_percentage
          ), 
          qr_history(qr_name)
        `).in('status', ['approved', 'rejected']); 

        if (firmName) qrQuery = qrQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (exactAmount) qrQuery = qrQuery.eq('amount', Number(exactAmount));
        if (startDate) qrQuery = qrQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) qrQuery = qrQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await qrQuery;
        if (error) throw error;
        qrMapped = (data || []).map(r => ({
          id: String(r.id || ''),
          numericId: String(r.payment_id || r.id || '').split('-')[0].toUpperCase(),
          type: 'QR',
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          reference: r.utr_id || String(r.id || '').split('-')[0],
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) - Number(r.charges || 0),
          status: r.status,
          raw_data: r
        }));
      }

      // 2. Fetch Bill Payments
      if (typeFilter === 'all' || typeFilter === 'BILL') {
        let billQuery = supabase.from('bill_submissions').select('*, users_profiles!inner(firm_name)').in('status', ['approved', 'pending', 'rejected', 'refunded']);

        if (firmName) billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (exactAmount) billQuery = billQuery.eq('amount', Number(exactAmount));
        if (startDate) billQuery = billQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) billQuery = billQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await billQuery;
        if (error) throw error;
        
        (data || []).forEach(r => {
          billMapped.push({
            id: String(r.id || ''),
            numericId: String(r.id || '').split('-')[0].toUpperCase(),
            type: 'BILL',
            date: r.created_at,
            firm_name: r.users_profiles?.firm_name || 'N/A',
            reference: r.customer_mobile || '0000000000',
            amount: Number(r.amount),
            charges: Number(r.charges || 0),
            final_total: Number(r.amount) + Number(r.charges || 0),
            status: r.status,
            raw_data: r
          });

          if (r.status === 'rejected') {
            billMapped.push({
              id: `${r.id}-refund`,
              numericId: String(r.id || '').split('-')[0].toUpperCase(),
              type: 'REFUND',
              date: r.created_at,
              firm_name: r.users_profiles?.firm_name || 'N/A',
              reference: r.customer_mobile || '0000000000',
              amount: Number(r.amount),
              charges: Number(r.charges || 0),
              final_total: Number(r.amount) + Number(r.charges || 0),
              status: 'refunded',
              raw_data: { ...r, is_refund_row: true }
            });
          }
        });
      }

      // 3. Fetch Payouts
      if (typeFilter === 'all' || typeFilter === 'PAYOUT') {
        let payoutQuery = supabase.from('payout_submissions').select('*, users_profiles!inner(firm_name)').in('status', ['approved', 'pending', 'processing', 'rejected', 'refunded']);

        if (firmName) payoutQuery = payoutQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (exactAmount) payoutQuery = payoutQuery.eq('amount', Number(exactAmount));
        if (startDate) payoutQuery = payoutQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) payoutQuery = payoutQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await payoutQuery;
        if (error) throw error;

        (data || []).forEach(r => {
          payoutMapped.push({
            id: String(r.id || ''),
            numericId: String(r.id || '').split('-')[0].toUpperCase(),
            type: 'PAYOUT',
            date: r.created_at,
            firm_name: r.users_profiles?.firm_name || 'N/A',
            reference: r.transaction_id || 'N/A',
            amount: Number(r.amount),
            charges: Number(r.charge_amount || 0),
            final_total: Number(r.amount) + Number(r.charge_amount || 0),
            status: r.status,
            raw_data: r
          });

          if (r.status === 'rejected') {
            payoutMapped.push({
              id: `${r.id}-refund`,
              numericId: String(r.id || '').split('-')[0].toUpperCase(),
              type: 'REFUND',
              date: r.created_at, 
              firm_name: r.users_profiles?.firm_name || 'N/A',
              reference: r.transaction_id || 'N/A',
              amount: Number(r.amount),
              charges: Number(r.charge_amount || 0),
              final_total: Number(r.amount) + Number(r.charge_amount || 0),
              status: 'refunded',
              raw_data: { ...r, is_refund_row: true }
            });
          }
        });
      }

      // Fetch Distributor Firm Names for QR records that have a distributor_id
      const distributorIds = Array.from(new Set(qrMapped.filter(r => r.raw_data.users_profiles?.distributor_id).map(r => r.raw_data.users_profiles.distributor_id)));

      let distributorMap: Record<string, string> = {};
      if (distributorIds.length > 0) {
        const { data: distData } = await supabase
          .from('users_profiles')
          .select('id, firm_name')
          .in('id', distributorIds);

        if (distData) {
          distData.forEach(d => {
            distributorMap[d.id] = d.firm_name;
          });
        }
      }

      // Final mapping with distributor firm names
      const finalQrMapped = qrMapped.map(r => {
        const distId = r.raw_data.users_profiles?.distributor_id;
        if (distId && distributorMap[distId]) {
          return { ...r, distributor_firm: distributorMap[distId] };
        }
        return r;
      });

      // Merge and Sort (Oldest first for running balance)
      const merged = [...finalQrMapped, ...billMapped, ...payoutMapped].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Compute Running Balance
      let currentBalance = openingBalance;
      const recordsWithBalance: UnifiedRecord[] = merged.map(r => {
        if (r.type === 'QR') {
          if (r.status === 'approved') {
            currentBalance += r.final_total;
          }
        } else if (r.type === 'REFUND') {
          currentBalance += r.final_total;
        } else {
          currentBalance -= r.final_total;
        }
        return { ...r, balance: currentBalance };
      });

      // Reverse to Latest first
      // Sync with DB if discrepancy detected AND a specific firm is being viewed
      if (firmName.trim() && recordsWithBalance.length > 0) {
        const { data: latestProfile } = await supabase.from('users_profiles').select('id, wallet_balance').ilike('firm_name', firmName.trim()).single();
        if (latestProfile && Math.abs(Number(latestProfile.wallet_balance) - currentBalance) > 0.01) {
          console.log(`Discrepancy detected for ${firmName}. DB: ${latestProfile.wallet_balance}, Statement: ${currentBalance}. Syncing...`);
          await supabase.from('users_profiles').update({ wallet_balance: currentBalance }).eq('id', latestProfile.id);
        }
      }

      setRecords(recordsWithBalance.reverse());

    } catch (err) {
      console.error('Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [startDate, endDate, typeFilter]);

  const exportToExcel = () => {
    const dataToExport = records.slice(0, displayCount);
    const exportData = dataToExport.map(r => ({
      'Payment Date': new Date(r.date).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      'PaymentId': r.numericId,
      'Transaction Type': r.type === 'BILL' ? 'CCBILLPAY' : r.type === 'PAYOUT' ? 'PAYOUT' : 'PAYMENT',
      'Card No': r.type === 'PAYOUT' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****'),
      'Description': r.type === 'BILL'
        ? `CCBILLPAY Mobile:${r.reference} CardNo:${r.raw_data?.card_number || '0000'}\nCredit Card BILL (${r.amount} + ${r.charges} Txn Charge)`
        : r.type === 'PAYOUT'
          ? `PAYOUT to ${r.raw_data?.account_holder_name} (${r.raw_data?.bank_name} A/c:${r.raw_data?.account_number})\nTxnId: ${r.reference}\n(${r.amount} + ${r.charges} Txn Charge)`
          : `TxnId: ${r.reference},\n(${r.amount} - ${r.charges} Txn Charge)\n PAYMENT QR ${r.raw_data?.qr_history?.qr_name}`,
      'Credit Amount': r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
      'Debit Amount': (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
      'Balance': r.balance.toFixed(2),
      'Payment From': r.type === 'QR' ? 'Admin' : '',
      'Payment To': r.firm_name
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    XLSX.writeFile(wb, `Account_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const dataToExport = records.slice(0, displayCount);

      const tableData = dataToExport.map(r => [
        new Date(r.date).toLocaleString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        r.numericId,
        r.type === 'BILL' ? 'CCBILLPAY' : r.type === 'PAYOUT' ? 'PAYOUT' : 'PAYMENT',
        r.type === 'PAYOUT' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****'),
        r.type === 'BILL'
          ? `Mobile:${r.reference} Card:${r.raw_data?.card_number || '0000'}`
          : r.type === 'PAYOUT'
            ? `PAYOUT: ${r.raw_data?.account_holder_name} (${r.raw_data?.bank_name})`
            : `Txn:${r.reference} QR:${r.raw_data?.qr_history?.qr_name || 'CashFree'}`,
        r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
        (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
        r.balance.toFixed(2),
        r.type === 'QR' ? 'Admin' : '',
        r.firm_name
      ]);

      autoTable(doc, {
        head: [['Payment Date', 'PaymentId', 'Transaction Type', 'Card No', 'Description', 'Credit Amount', 'Debit Amount', 'Balance', 'Payment From', 'Payment To']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 8 }
      });

      doc.save(`Account_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error('PDF Error:', err); }
  };

  const formatDateTimeSplit = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const datePart = d.toLocaleDateString();
      const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return (
        <div className="flex flex-col text-[#4c4c4c] text-[13px]">
          <span>{datePart}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase">{timePart}</span>
        </div>
      );
    } catch {
      return <span>{String(dateString || '')}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Filters & Actions matching previous theme slightly adapted */}
      <div className="flex flex-wrap gap-4 items-center mb-6 bg-white p-4 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-[#e0e0e0]">

        <div className="flex-1 min-w-[200px] relative">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Filter by Firm Name..."
              value={firmName}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => { setFirmName(e.target.value); setShowSuggestions(true); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setFirmName(s); setShowSuggestions(false); fetchStatement(); }} className="w-full px-4 py-2 hover:bg-slate-50 text-left text-sm font-medium text-slate-700 flex justify-between items-center group">
                      {s} <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
          </div>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">End</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
          </div>
        </div>

        <button onClick={fetchStatement} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Search size={16} /> Filter
        </button>
        <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button onClick={exportToPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <FileText size={16} /> PDF
        </button>
      </div>

      {/* Main Table mimicking the screenshot completely */}
      <div className="bg-white rounded-[4px] border border-[#e0e0e0] shadow-sm overflow-hidden font-sans">

        {/* 'Show 10 entries' */}
        <div className="px-4 py-3 flex items-center gap-2 text-[13px] text-[#333]">
          <span>Show</span>
          <select
            value={displayCount}
            onChange={(e) => setDisplayCount(Number(e.target.value))}
            className="border border-[#ccc] rounded px-2 py-1 outline-none text-[#333]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>All</option>
          </select>
          <span>entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-[#ddd]">
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Payment Date</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">PaymentId</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Transaction<br />Type</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap text-center">Bank / QR</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap text-center">Card / Account No</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] min-w-[300px]">Description</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] text-right whitespace-nowrap">Credit<br />Amount</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] text-right whitespace-nowrap">Debit<br />Amount</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] text-right whitespace-nowrap">Balance</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Payment<br />From</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Payment To</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-indigo-600"><Loader2 className="animate-spin mx-auto" size={32} /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-[#666] text-[13px]">No matching records found</td></tr>
              ) : (
                records.slice(0, displayCount).map((r, idx) => (
                  <tr key={`${r.type}-${r.id}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'} border-b border-[#eee] hover:bg-[#ebebeb] transition-colors`}>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {formatDateTimeSplit(r.date)}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c]">{r.numericId}</td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c]">{r.type === 'BILL' ? 'CCBILLPAY' : r.type === 'PAYOUT' ? 'PAYOUT' : r.type === 'REFUND' ? 'REFUND' : 'PAYMENT'}</td>
                    <td className="px-4 py-3 align-top text-[13px] font-bold text-slate-600 text-center uppercase">
                      {r.type === 'QR' ? (r.raw_data?.qr_history?.qr_name || 'N/A') : r.type === 'PAYOUT' || r.type === 'REFUND' ? r.raw_data?.bank_name : r.raw_data?.card_bank || '-'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] font-bold text-slate-600 text-center">
                      {r.type === 'PAYOUT' || r.type === 'REFUND' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****')}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c] leading-relaxed">
                      {r.type === 'BILL' ? (
                        <>
                          <div>CCBILLPAY Mobile: <span className="text-amber-600 font-bold">{r.reference}</span> <br /> CardNo: <span className="text-amber-600 font-bold">{r.raw_data?.card_number || '0000'}</span></div>
                          <div>Credit Card BILL ({r.amount} + {r.charges} Txn Charge)</div>
                          <div className={`text-[10px] font-bold uppercase ${r.status === 'rejected' ? 'text-rose-500' : r.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>Status: {r.status}</div>
                        </>
                      ) : r.type === 'PAYOUT' ? (
                        <>
                          <div className="font-bold text-slate-900">{r.raw_data?.account_holder_name}</div>
                          <div className="text-[11px] text-slate-500">{r.raw_data?.bank_name} | IFSC: {r.raw_data?.ifsc_code}</div>
                          <div className="text-amber-600 font-bold mt-1">Txn: {r.reference}</div>
                          <div>({r.amount} + {r.charges} Txn Charge)</div>
                          <div className={`text-[10px] font-bold uppercase ${r.status === 'rejected' ? 'text-rose-500' : r.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>Status: {r.status}</div>
                        </>
                      ) : r.type === 'REFUND' ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-2 rounded">
                          <div className="font-bold text-emerald-700 uppercase text-[11px]">Wallet Refund</div>
                          <div className="text-[10px] text-emerald-600">Refund for {r.raw_data?.card_bank || r.raw_data?.bank_name || 'Bill/Payout'} (#{r.numericId})</div>
                          <div className="text-[10px] text-emerald-500 font-medium">Rejection Reason: {r.raw_data?.rejection_reason || 'Admin Rejection'}</div>
                        </div>
                      ) : (
                        <>
                          <div className="break-all text-amber-600 font-bold">TxnId: {r.reference}</div>
                          {r.raw_data.users_profiles?.distributor_id ? (
                            <div className="bg-slate-50/50 border border-slate-100 rounded p-2 my-1 max-w-[200px]">
                              <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-slate-500">Admin Profit:</span>
                                <span className="font-bold text-rose-600">
                                  ₹{((r.amount * Number(r.raw_data.users_profiles.admin_base_qr_charge || 0)) / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-slate-500">Dist. Profit:</span>
                                <span className="font-bold text-amber-600">
                                  ₹{(Number(r.charges || 0) - ((r.amount * Number(r.raw_data.users_profiles.admin_base_qr_charge || 0)) / 100)).toFixed(2)}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 uppercase font-black border-t border-slate-100 pt-1 mt-1 leading-tight">
                                Recipient: {(r as any).distributor_firm || 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-slate-500 text-[11px]">({r.amount} - {r.charges} Txn Charge)</div>
                          )}
                          <div className="text-slate-600 font-bold">PAYMENT QR <span className="text-amber-600">{r.raw_data?.qr_history?.qr_name}</span></div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c] text-right font-medium">
                      {(r.type === 'QR' && r.status === 'approved') || r.type === 'REFUND' ? r.final_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c] text-right font-medium">
                      {(r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#333] font-bold text-right">
                      {r.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c]">
                      {r.type === 'QR' ? 'Admin' : r.type === 'PAYOUT' ? 'Bank' : ''}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c]">
                      {r.firm_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
