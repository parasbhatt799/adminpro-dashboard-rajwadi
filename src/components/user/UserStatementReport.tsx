import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LogoLoader } from '../shared/LoadingSpinner';

interface UserStatementReportProps {
  userId: string;
}

interface UnifiedRecord {
  id: string;
  type: 'QR' | 'BILL' | 'PAYOUT' | 'REFUND';
  date: string;
  reference: string;
  amount: number;
  charges: number;
  final_total: number;
  status: string;
  raw_data: any;
  balance: number;
  numericId: string;
}

export default function UserStatementReport({ userId }: UserStatementReportProps) {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStatement = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let openingBalance = 0;

      // 1. Calculate Opening Balance Forward (from beginning of time until startDate)
      if (startDate) {
        const startDateTime = `${startDate}T00:00:00`;
        
        const [qrPre, billPre, bbpsPre, payoutPre] = await Promise.all([
          supabase.from('payment_submissions').select('amount, charges').eq('user_id', userId).eq('status', 'approved').lt('created_at', startDateTime),
          supabase.from('bill_submissions').select('amount, charges, status').eq('user_id', userId).in('status', ['approved', 'pending', 'rejected', 'refunded']).lt('created_at', startDateTime),
          supabase.from('bbps_submissions').select('amount, charges, status').eq('user_id', userId).in('status', ['approved', 'pending', 'rejected', 'refunded']).lt('created_at', startDateTime),
          supabase.from('payout_submissions').select('amount, charge_amount, status').eq('user_id', userId).in('status', ['approved', 'pending', 'processing', 'rejected', 'refunded']).lt('created_at', startDateTime)
        ]);

        const qrTotal = (qrPre.data || []).reduce((acc, r) => acc + (Number(r.amount) - Number(r.charges || 0)), 0);
        
        // Bills/Payouts are complicated because they have two entries for rejected/refunded in my new logic.
        // But for opening balance, we just need the net effect.
        // Net effect of 'rejected' or 'refunded' bill is 0.
        // Net effect of 'approved' or 'pending' bill is -(amount + charges).
        
        const billNet = (billPre.data || []).reduce((acc, r) => {
          if (r.status === 'approved' || r.status === 'pending') {
            return acc + (Number(r.amount) + Number(r.charges || 0));
          }
          return acc; // rejected/refunded net effect is 0
        }, 0) + (bbpsPre.data || []).reduce((acc, r) => {
          if (r.status === 'approved' || r.status === 'pending') {
            return acc + (Number(r.amount) + Number(r.charges || 0));
          }
          return acc; 
        }, 0);

        const payoutNet = (payoutPre.data || []).reduce((acc, r) => {
          if (r.status === 'approved' || r.status === 'pending' || r.status === 'processing') {
            return acc + (Number(r.amount) + Number(r.charge_amount || 0));
          }
          return acc; 
        }, 0);

        openingBalance = qrTotal - billNet - payoutNet;
      }

      let qrMapped: any[] = [];
      let billMapped: any[] = [];
      let payoutMapped: any[] = [];

      // 1. Fetch QR Payments for this user (approved only)
      {
        let qrQuery = supabase
          .from('payment_submissions')
          .select('*, qr_history(qr_name)')
          .eq('user_id', userId)
          .eq('status', 'approved');

        if (startDate) qrQuery = qrQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) qrQuery = qrQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await qrQuery;
        if (error) throw error;
        qrMapped = (data || []).map(r => ({
          id: String(r.id || ''),
          numericId: String(r.payment_id || r.id || '').split('-')[0].toUpperCase(),
          type: 'QR',
          date: r.created_at,
          reference: r.utr_id || String(r.id || '').split('-')[0],
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) - Number(r.charges || 0),
          status: r.status,
          raw_data: { ...r, qr_name: r.qr_history?.qr_name, card_number: r.card_number }
        }));
      }

      // 2. Fetch Bill Payments for this user (All statuses)
      {
        let billQuery = supabase
          .from('bill_submissions')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['approved', 'pending', 'rejected', 'refunded']);

        let bbpsQuery = supabase
          .from('bbps_submissions')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['approved', 'pending', 'rejected', 'refunded']);

        if (startDate) {
          billQuery = billQuery.gte('created_at', `${startDate}T00:00:00`);
          bbpsQuery = bbpsQuery.gte('created_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
          billQuery = billQuery.lte('created_at', `${endDate}T23:59:59`);
          bbpsQuery = bbpsQuery.lte('created_at', `${endDate}T23:59:59`);
        }

        const [billRes, bbpsRes] = await Promise.all([billQuery, bbpsQuery]);
        if (billRes.error) throw billRes.error;
        if (bbpsRes.error) throw bbpsRes.error;
        
        const combinedBills = [
          ...(billRes.data || []).map(b => ({ ...b, is_bbps: false })),
          ...(bbpsRes.data || []).map(b => ({ ...b, is_bbps: true }))
        ];
        
        combinedBills.forEach(r => {
          const isBbps = r.is_bbps;
          let mobile = '0000000000';
          if (isBbps) {
            const details = r.metadata?.consumerDetails || {};
            mobile = details["Registered Mobile Number"] || details["Mobile Number"] || details["Mobile"] || 'BBPS';
          } else {
            mobile = r.customer_mobile;
          }

          const cardNo = isBbps ? r.consumer_number : r.card_number;

          // Deduction
          billMapped.push({
            id: String(r.id || ''),
            numericId: String(r.id || '').split('-')[0].toUpperCase(),
            type: 'BILL',
            date: r.created_at,
            reference: mobile || '0000000000',
            amount: Number(r.amount),
            charges: Number(r.charges || 0),
            final_total: Number(r.amount) + Number(r.charges || 0),
            status: r.status,
            raw_data: { ...r, card_number: cardNo }
          });

          // Refund synthesis
          if (r.status === 'rejected') {
            billMapped.push({
              id: `${r.id}-refund`,
              numericId: String(r.id || '').split('-')[0].toUpperCase(),
              type: 'REFUND',
              date: r.created_at,
              reference: mobile || '0000000000',
              amount: Number(r.amount),
              charges: Number(r.charges || 0),
              final_total: Number(r.amount) + Number(r.charges || 0),
              status: 'refunded',
              raw_data: { ...r, card_number: cardNo, is_refund_row: true }
            });
          }
        });
      }

      // 3. Fetch Payouts for this user (All statuses)
      {
        let payoutQuery = supabase
          .from('payout_submissions')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['approved', 'pending', 'processing', 'rejected', 'refunded']);

        if (startDate) payoutQuery = payoutQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) payoutQuery = payoutQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await payoutQuery;
        if (error) throw error;
        
        (data || []).forEach(r => {
          // Deduction
          payoutMapped.push({
            id: String(r.id || ''),
            numericId: String(r.id || '').split('-')[0].toUpperCase(),
            type: 'PAYOUT',
            date: r.created_at,
            reference: r.transaction_id || 'N/A',
            amount: Number(r.amount),
            charges: Number(r.charge_amount || 0),
            final_total: Number(r.amount) + Number(r.charge_amount || 0),
            status: r.status,
            raw_data: r
          });

          // Refund synthesis
          if (r.status === 'rejected') {
            payoutMapped.push({
              id: `${r.id}-refund`,
              numericId: String(r.id || '').split('-')[0].toUpperCase(),
              type: 'REFUND',
              date: r.created_at,
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

      // Merge oldest first for running balance calculation
      const merged = [...qrMapped, ...billMapped, ...payoutMapped].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Running Balance
      let currentBalance = openingBalance;
      const recordsWithBalance: UnifiedRecord[] = merged.map(r => {
        if (r.type === 'QR') {
          currentBalance += r.final_total;
        } else if (r.type === 'REFUND') {
          currentBalance += r.final_total;
        } else {
          // BILL or PAYOUT: Wallet is deducted initially
          currentBalance -= r.final_total;
        }
        return { ...r, balance: currentBalance };
      });

      setRecords(recordsWithBalance.reverse());
    } catch (err) {
      console.error('User Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchStatement();
  }, [userId, startDate, endDate]);

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
      'QR / Bank': r.type === 'QR' ? (r.raw_data?.qr_name || 'N/A') : r.type === 'PAYOUT' ? r.raw_data?.bank_name : '-',
      'Card / Account No': r.type === 'PAYOUT' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****'),
      'Credit Amount': r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
      'Debit Amount': (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
      'Balance': r.balance.toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    XLSX.writeFile(wb, `My_Account_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        r.type === 'QR' ? (r.raw_data?.qr_name || 'N/A') : r.type === 'PAYOUT' ? r.raw_data?.bank_name : '-',
        r.type === 'PAYOUT' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****'),
        r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
        (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
        r.balance.toFixed(2),
      ]);
      autoTable(doc, {
        head: [['Payment Date', 'PaymentId', 'Transaction Type', 'QR Name', 'Card No', 'Credit Amount', 'Debit Amount', 'Balance']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 8 }
      });
      doc.save(`My_Account_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border border-[#e0e0e0] shadow-sm">
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

        <button onClick={fetchStatement} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Search size={15} /> Filter
        </button>
        <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <FileSpreadsheet size={15} /> Excel
        </button>
        <button onClick={exportToPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <FileText size={15} /> PDF
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#e0e0e0] shadow-sm overflow-hidden font-sans">
        {/* Show entries selector */}
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
            <option value={9999}>All</option>
          </select>
          <span>entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-[#ddd] bg-slate-50">
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Payment Date</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">PaymentId</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Transaction<br />Type</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">QR / Bank</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] whitespace-nowrap">Card / A/c No</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] min-w-[280px]">Description</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] text-right whitespace-nowrap">Credit<br />Amount</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] text-right whitespace-nowrap">Debit<br />Amount</th>
                <th className="px-4 py-3 text-[13px] font-bold text-[#333] text-right whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[#666] text-[13px]">
                    No approved transactions found
                  </td>
                </tr>
              ) : (
                records.slice(0, displayCount).map((r, idx) => (
                  <tr
                    key={`${r.type}-${r.id}-${idx}`}
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'} border-b border-[#eee] hover:bg-[#ebebeb] transition-colors`}
                  >
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {formatDateTimeSplit(r.date)}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c]">{r.numericId}</td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c]">
                      {r.type === 'BILL'
                        ? (r.raw_data?.is_bbps
                            ? (r.raw_data?.service_type === 'Credit Card' ? 'CCBILLPAY' : 'BBPS')
                            : 'CCBILLPAY')
                        : r.type === 'PAYOUT'
                          ? 'PAYOUT'
                          : 'PAYMENT'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] font-bold text-slate-600">
                      {r.type === 'QR' ? (r.raw_data?.qr_name || 'N/A') : r.type === 'PAYOUT' ? r.raw_data?.bank_name : r.raw_data?.card_bank || '-'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] font-bold text-slate-600 text-center">
                      {r.type === 'PAYOUT' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****')}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c] leading-relaxed">
                      {r.type === 'BILL' ? (
                        r.raw_data?.is_bbps ? (
                          r.raw_data?.service_type === 'Credit Card' ? (
                            <>
                              <div>CCBILLPAY Mobile: <span className='text-amber-600 font-bold'>{r.reference}</span> CardNo: <span className='text-amber-600 font-bold'>{r.raw_data?.card_number || '0000'}</span></div>
                              <div>Credit Card BILL ({r.amount} + {r.charges} Txn Charge)</div>
                              <div className={`text-[10px] font-bold uppercase ${r.status === 'rejected' ? 'text-rose-500' : r.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>Status: {r.status}</div>
                            </>
                          ) : (
                            <>
                              <div>BBPS {r.raw_data?.service_type}: <span className='text-amber-600 font-bold'>{r.raw_data?.provider}</span> Account: <span className='text-amber-600 font-bold'>{r.raw_data?.consumer_number}</span> Mobile: <span className='text-amber-600 font-bold'>{r.reference}</span></div>
                              <div>Utility Bill Payment ({r.amount} + {r.charges} Txn Charge)</div>
                              <div className={`text-[10px] font-bold uppercase ${r.status === 'rejected' ? 'text-rose-500' : r.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>Status: {r.status}</div>
                            </>
                          )
                        ) : (
                          <>
                            <div>CCBILLPAY Mobile: <span className='text-amber-600 font-bold'>{r.reference}</span> CardNo: <span className='text-amber-600 font-bold'>{r.raw_data?.card_number || '0000'}</span></div>
                            <div>Credit Card BILL ({r.amount} + {r.charges} Txn Charge)</div>
                            <div className={`text-[10px] font-bold uppercase ${r.status === 'rejected' ? 'text-rose-500' : r.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>Status: {r.status}</div>
                          </>
                        )
                      ) : r.type === 'PAYOUT' ? (
                        <>
                          <div className="font-bold text-slate-900">PAYOUT FOR: {r.raw_data?.account_holder_name}</div>
                          <div className="text-[12px] text-slate-800">Bank: {r.raw_data?.bank_name} | IFSC: {r.raw_data?.ifsc_code}</div>
                          <div className="text-amber-600 font-bold mt-1">Txn: {r.reference}</div>
                          <div>({r.amount} + {r.charges} Txn Charge)</div>
                          <div className={`text-[10px] font-bold uppercase ${r.status === 'rejected' ? 'text-rose-500' : r.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>Status: {r.status}</div>
                        </>
                      ) : r.type === 'REFUND' ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-2 rounded">
                          <div className="font-bold text-emerald-700 uppercase text-[11px]">Wallet Refund</div>
                          <div className="text-[10px] text-emerald-600">Refund for {r.raw_data?.card_bank || r.raw_data?.bank_name || 'Bill/Payout'} (#{r.numericId})</div>
                          <div className="text-[10px] text-emerald-500 font-medium">Reason: {r.raw_data?.rejection_reason || 'Rejection'}</div>
                        </div>
                      ) : (
                        <>
                          <div className="break-all text-slate-600">PAYMENT <span className='text-amber-600  font-bold'>TxnId: {r.reference}</span></div>
                          <div>({r.amount} - {r.charges} Txn Charge)</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c] text-right font-medium">
                      {r.type === 'QR' || r.type === 'REFUND'
                        ? r.final_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#4c4c4c] text-right font-medium">
                      {(r.type === 'BILL' || r.type === 'PAYOUT')
                        ? r.final_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0'}
                    </td>
                    <td className="px-4 py-3 align-top text-[13px] text-[#333] font-bold text-right">
                      {r.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
