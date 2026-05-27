import { LogoLoader } from './shared/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Loader2,
  User,
  FileSpreadsheet,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Clock,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnifiedRecord {
  id: string;
  type: 'QR' | 'BILL' | 'PAYOUT' | 'ADJUSTMENT';
  date: string;
  firm_name: string;
  user_name: string;
  reference: string;
  amount: number;
  charges: number;
  final_total: number;
  status: string;
  raw_data: any;
  balance: number;
  before_balance: number;
  after_balance: number;
  current_wallet: number;
  numericId: string;
}

export default function AdminStatementReport() {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);
  
  // Stats
  const [currentTotalWallet, setCurrentTotalWallet] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'QR' | 'BILL' | 'PAYOUT'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStatement = async () => {
    setLoading(true);

    try {
      // 1. Get current aggregate wallet balance
      const { data: usersData, error: usersError } = await supabase
        .from('users_profiles')
        .select('id, wallet_balance');
      
      if (usersError) throw usersError;
      
      const userBalanceMap: Record<string, number> = {};
      let totalWallet = 0;
      (usersData || []).forEach(u => {
        const bal = Number(u.wallet_balance) || 0;
        userBalanceMap[u.id] = bal;
        totalWallet += bal;
      });
      setCurrentTotalWallet(totalWallet);

      // 2. Calculate Opening Balance using optimized RPC
      let opBal = 0;
      if (startDate) {
        const { data, error } = await supabase.rpc('get_opening_balance', {
          p_user_id: null,
          p_start_date: `${startDate}T00:00:00`
        });
        if (!error) opBal = Number(data) || 0;
      }

      // 3. Fetch All Transactions
      const fetchAll = async (query: any) => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const { data, error } = await query.range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = [...allData, ...data];
          if (data.length < step) break;
          from += step;
        }
        return allData;
      };

      // QR Payments (Approved & Rejected)
      let qrQuery = supabase.from('payment_submissions').select(`
        *,
        users_profiles!payment_submissions_user_id_fkey!inner(name, firm_name),
        qr_history(qr_name)
      `)
      .in('status', ['approved', 'rejected'])
      .order('created_at', { ascending: false });
      
      // Bill Payments (All statuses)
      let billQuery = supabase.from('bill_submissions').select(`
        *,
        users_profiles!bill_submissions_user_id_fkey!inner(name, firm_name)
      `)
      .in('status', ['approved', 'pending', 'rejected', 'refunded'])
      .order('created_at', { ascending: false });
      
      // Payouts (All statuses)
      let payoutQuery = supabase.from('payout_submissions').select(`
        *,
        users_profiles!inner(name, firm_name)
      `)
      .in('status', ['approved', 'pending', 'processing', 'rejected', 'refunded'])
      .order('created_at', { ascending: false });

      const [qrData, billData, payoutData] = await Promise.all([
        fetchAll(qrQuery),
        fetchAll(billQuery),
        fetchAll(payoutQuery)
      ]);

      // 4. Map into Unified Format
      const qrMapped: UnifiedRecord[] = (qrData || []).map(r => ({
        id: r.id,
        numericId: String(r.id).split('-')[0].toUpperCase(),
        type: 'QR',
        date: r.created_at,
        firm_name: r.users_profiles?.firm_name || 'N/A',
        user_name: r.users_profiles?.name || 'N/A',
        reference: r.utr_id || r.id.split('-')[0],
        amount: Number(r.amount),
        charges: Number(r.charges || 0),
        final_total: Number(r.amount) - Number(r.charges || 0),
        status: r.status,
        raw_data: r,
        balance: 0,
        before_balance: Number(r.before_balance || 0),
        after_balance: Number(r.after_balance || 0),
        current_wallet: 0,
      }));

      const billMapped: UnifiedRecord[] = [];
      (billData || []).forEach(r => {
        billMapped.push({
          id: r.id,
          numericId: String(r.id).split('-')[0].toUpperCase(),
          type: 'BILL',
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          user_name: r.users_profiles?.name || 'N/A',
          reference: r.customer_mobile || '0000000000',
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) + Number(r.charges || 0),
          status: r.status,
          raw_data: r,
          balance: 0,
          before_balance: Number(r.remaining_balance || 0) + (Number(r.amount) + Number(r.charges || 0)),
          after_balance: Number(r.remaining_balance || 0),
          current_wallet: 0,
        });

        if (r.status === 'rejected') {
          billMapped.push({
            id: `${r.id}-refund`,
            numericId: String(r.id).split('-')[0].toUpperCase(),
            type: 'ADJUSTMENT',
            date: r.created_at,
            firm_name: r.users_profiles?.firm_name || 'N/A',
            user_name: r.users_profiles?.name || 'N/A',
            reference: r.customer_mobile || '0000000000',
            amount: Number(r.amount),
            charges: Number(r.charges || 0),
            final_total: Number(r.amount) + Number(r.charges || 0),
            status: 'refunded',
            raw_data: { ...r, is_refund_row: true },
            balance: 0,
            before_balance: 0,
            after_balance: 0,
            current_wallet: 0,
          });
        }
      });

      const payoutMapped: UnifiedRecord[] = [];
      (payoutData || []).forEach(r => {
        payoutMapped.push({
          id: r.id,
          numericId: String(r.id).split('-')[0].toUpperCase(),
          type: 'PAYOUT',
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          user_name: r.users_profiles?.name || 'N/A',
          reference: r.transaction_id || 'N/A',
          amount: Number(r.amount),
          charges: Number(r.charge_amount || 0),
          final_total: Number(r.amount) + Number(r.charge_amount || 0),
          status: r.status,
          raw_data: r,
          balance: 0,
          before_balance: Number(r.before_balance || 0),
          after_balance: Number(r.after_balance || 0),
          current_wallet: 0,
        });

        if (r.status === 'rejected') {
          payoutMapped.push({
            id: `${r.id}-refund`,
            numericId: String(r.id).split('-')[0].toUpperCase(),
            type: 'ADJUSTMENT',
            date: r.created_at,
            firm_name: r.users_profiles?.firm_name || 'N/A',
            user_name: r.users_profiles?.name || 'N/A',
            reference: r.transaction_id || 'N/A',
            amount: Number(r.amount),
            charges: Number(r.charge_amount || 0),
            final_total: Number(r.amount) + Number(r.charge_amount || 0),
            status: 'refunded',
            raw_data: { ...r, is_refund_row: true },
            balance: 0,
            before_balance: 0,
            after_balance: 0,
            current_wallet: 0,
          });
        }
      });

      // 5. Sort all by date (Newest First)
      const allTransactions = [...qrMapped, ...billMapped, ...payoutMapped].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // 6. Apply Backward Running Balances (System-wide AND Per-User)
      let systemRunningBalance = totalWallet;
      const perUserRunningBalance: Record<string, number> = { ...userBalanceMap };

      const transactionsWithBalance = allTransactions.map((tx) => {
        const userId = tx.raw_data.user_id;
        
        // System Balance (Admin Balance)
        const currentSystemBalance = systemRunningBalance;
        if (tx.type === 'QR') {
          if (tx.status === 'approved') {
            systemRunningBalance -= tx.final_total;
          }
        } else if (tx.type === 'ADJUSTMENT') {
          systemRunningBalance -= tx.final_total;
        } else {
          // BILL or PAYOUT: Wallet is deducted initially
          systemRunningBalance += tx.final_total;
        }

        // User Balance (Individual Statement Balance)
        const currentUserBalance = perUserRunningBalance[userId] || 0;
        if (tx.type === 'QR') {
          if (tx.status === 'approved') {
            perUserRunningBalance[userId] = currentUserBalance - tx.final_total;
          }
        } else if (tx.type === 'ADJUSTMENT') {
          perUserRunningBalance[userId] = currentUserBalance - tx.final_total;
        } else {
          perUserRunningBalance[userId] = currentUserBalance + tx.final_total;
        }

        return { 
          ...tx, 
          balance: currentSystemBalance,
          after_balance: currentUserBalance,
          current_wallet: userBalanceMap[userId] || 0
        };
      });

      // The remaining 'systemRunningBalance' represents opening system adjustment
      setOpeningBalance(systemRunningBalance);

      // 7. Apply UI Filters (Optimistic - we do it in JS since we fetched all for the anchor logic)
      let filtered = transactionsWithBalance;

      if (firmName.trim()) {
        filtered = filtered.filter(r => 
          r.firm_name.toLowerCase().includes(firmName.toLowerCase()) || 
          r.user_name.toLowerCase().includes(firmName.toLowerCase())
        );
      }

      if (typeFilter !== 'all') {
        filtered = filtered.filter(r => r.type === typeFilter);
      }

      if (startDate) {
        filtered = filtered.filter(r => new Date(r.date) >= new Date(`${startDate}T00:00:00`));
      }

      if (endDate) {
        filtered = filtered.filter(r => new Date(r.date) <= new Date(`${endDate}T23:59:59`));
      }

      setRecords(filtered);

    } catch (err) {
      console.error('Admin Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, []);

  const exportToExcel = () => {
    const dataToExport = records.slice(0, displayCount);
    const exportData = dataToExport.map(r => ({
      'Date': new Date(r.date).toLocaleString(),
      'Type': r.type,
      'Firm': r.firm_name,
      'User': r.user_name,
      'Reference': r.reference,
      'Description': r.type === 'QR' 
        ? `${r.raw_data?.qr_history?.qr_name || 'QR'} - Ref: ${r.reference}`
        : r.type === 'BILL'
          ? `Card: ${r.raw_data?.card_number || '****'} - Mob: ${r.reference}`
          : `${r.raw_data?.bank_name || 'Payout'} - Txn: ${r.reference}`,
      'Credit': r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
      'Debit': (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
      'Admin Balance': r.balance.toFixed(2),
      'Status': r.status,
      'User Current Wallet': r.current_wallet.toFixed(2),
      'User Closing Balance': r.after_balance.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AdminStatement');
    XLSX.writeFile(wb, `Admin_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const tableData = records.slice(0, displayCount).map(r => [
        new Date(r.date).toLocaleString(),
        r.type,
        r.firm_name,
        r.type === 'QR' 
          ? `${r.raw_data?.qr_history?.qr_name || 'QR'} - Ref: ${r.reference}`
          : r.type === 'BILL'
            ? `Card: ${r.raw_data?.card_number || '****'} - Mob: ${r.reference}`
            : `${r.raw_data?.bank_name || 'Payout'} - Txn: ${r.reference}`,
        r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
        (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
        r.balance.toFixed(2),
        r.status,
        r.current_wallet.toFixed(2),
        r.after_balance.toFixed(2)
      ]);

      autoTable(doc, {
        head: [['Date', 'Type', 'Firm', 'Description', 'Credit', 'Debit', 'Admin Balance', 'Status', 'User Current Wallet', 'User Closing Balance']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 }
      });

      doc.save(`Admin_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error('PDF Error:', err); }
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Statement Report</h2>
          <p className="text-slate-500 mt-1">Consolidated view of all user wallet movements.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchStatement}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button onClick={exportToPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-rose-100 transition-all">
            <FileText size={18} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total User Wallet</p>
              <h3 className="text-2xl font-bold text-slate-900">₹{currentTotalWallet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full w-fit">
             <TrendingUp size={12} />
             Live Balance from DB
          </div>
        </motion.div>


        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 shadow-inner">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transactions</p>
              <h3 className="text-2xl font-bold text-slate-900">{records.length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full w-fit">
             Across All Services
          </div>
        </motion.div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by Firm or User..." 
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-1.5">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="text-xs font-bold text-slate-700 outline-none bg-transparent" 
            />
          </div>
          <div className="w-px h-8 bg-slate-200 mx-2" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="text-xs font-bold text-slate-700 outline-none bg-transparent" 
            />
          </div>
        </div>

        <select 
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
        >
          <option value="all">All Services</option>
          <option value="QR">QR Payments</option>
          <option value="BILL">Bill Payments</option>
          <option value="PAYOUT">Payouts</option>
        </select>

        <button 
          onClick={fetchStatement}
          className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          Apply Filters
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            Show
            <select
              value={displayCount}
              onChange={(e) => setDisplayCount(Number(e.target.value))}
              className="mx-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none focus:border-indigo-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            entries
          </div>
          {records.length > 0 && (
             <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-indigo-100 animate-pulse">
                Showing {Math.min(displayCount, records.length)} of {records.length} transactions
             </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-50">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / ID</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User / Firm</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Description</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit (+)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit (-)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Admin Balance</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">User Current Wallet</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">User Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                    <p className="text-sm text-slate-500 font-medium">Reconstructing wallet history...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                      <Wallet size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">No transactions found for the selected filters.</p>
                  </td>
                </tr>
              ) : (
                records.slice(0, displayCount).map((r, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                    key={r.id} 
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">
                          {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                          {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className={`w-fit px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          r.type === 'QR' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                          r.type === 'BILL' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          r.type === 'ADJUSTMENT' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {r.type === 'QR' ? 'QR Payment' : r.type === 'BILL' ? 'Bill Pay' : r.type === 'ADJUSTMENT' ? 'REFUND' : 'Payout'}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{r.numericId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Link 
                        to={`/users-list?id=${r.raw_data.user_id}`}
                        className="flex flex-col hover:opacity-75 transition-opacity group"
                      >
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{r.firm_name}</span>
                        <span className="text-[10px] text-slate-500 font-medium mt-1">{r.user_name}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-5">
                       <div className="text-[11px] text-slate-600 leading-relaxed max-w-xs">
                          {r.type === 'QR' ? (
                            <>
                              <div className="font-bold text-slate-900">{r.raw_data?.qr_history?.qr_name || 'QR Payment'}</div>
                              <span className="font-medium text-slate-500">Ref:</span> {r.reference}
                              <br />
                              <span className="text-slate-400 italic">({r.amount} - {r.charges} Profit)</span>
                            </>
                          ) : r.type === 'BILL' ? (
                            <>
                              <div className="font-bold text-slate-900">Card No: {r.raw_data?.card_number || '****'}</div>
                              <span className="font-medium text-slate-500">Mob:</span> {r.reference}
                              <br />
                              <span className="text-slate-400 italic">({r.amount} + {r.charges} Txn Fee)</span>
                            </>
                          ) : r.type === 'ADJUSTMENT' ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                              <div className="font-bold text-emerald-700 uppercase text-[10px]">Wallet Refund</div>
                              <div className="text-[10px] text-emerald-600">Refund for {r.raw_data?.card_bank || r.raw_data?.bank_name || 'Bill/Payout'} (#{r.numericId})</div>
                              <div className="text-[10px] text-emerald-500 font-medium">Reason: {r.raw_data?.rejection_reason || 'Rejection'}</div>
                            </div>
                          ) : (
                            <>
                              <div className="font-bold text-slate-900">{r.raw_data?.bank_name || 'Payout'}</div>
                              <span className="font-medium text-slate-500">Txn:</span> {r.reference}
                              <br />
                              <span className="text-slate-400 italic">({r.amount} + {r.charges} Txn Fee)</span>
                            </>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       {(r.type === 'QR' && r.status === 'approved') || r.type === 'ADJUSTMENT' ? (
                         <span className="text-xs font-bold text-emerald-600">+₹{r.final_total.toLocaleString()}</span>
                       ) : <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-6 py-5 text-right">
                       {(r.type === 'BILL' || r.type === 'PAYOUT') ? (
                         <span className="text-xs font-bold text-rose-600">-₹{r.final_total.toLocaleString()}</span>
                       ) : <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-slate-900">₹{r.balance.toLocaleString()}</span>
                          <div className="w-12 h-0.5 bg-slate-100 rounded-full mt-1 group-hover:bg-indigo-200 transition-all" />
                       </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                         r.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                         r.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                         'bg-indigo-50 text-indigo-600 border border-indigo-100'
                       }`}>
                         {r.status === 'pending' ? <Clock size={8} /> : null}
                         {r.status}
                       </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <span className="text-xs font-bold text-slate-900">₹{r.current_wallet.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <span className="text-xs font-bold text-indigo-600">₹{r.after_balance.toLocaleString()}</span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
