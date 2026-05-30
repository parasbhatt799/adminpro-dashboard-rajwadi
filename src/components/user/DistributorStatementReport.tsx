import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Loader2,
  User,
  FileSpreadsheet,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { LogoLoader } from '../shared/LoadingSpinner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnifiedRecord {
  id: string;
  type: 'QR' | 'BILL' | 'PAYOUT';
  date: string;
  firm_name: string;
  reference: string;
  amount: number;
  charges: number;
  final_total: number;
  status: string;
  raw_data: any;
  balance: number;
  numericId: string;
}

export default function DistributorStatementReport({ userId }: { userId: string }) {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);

  // Autocomplete state
  const [allFirms, setAllFirms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'QR' | 'BILL' | 'PAYOUT'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [currentUserRole, setCurrentUserRole] = useState<string>('distributor');

  const fetchFirmNames = async (roleOverride?: string) => {
    try {
      const activeRole = roleOverride || currentUserRole;
      let query = supabase.from('users_profiles').select('firm_name').not('firm_name', 'is', null);
      
      if (activeRole === 'super_distributor') {
        const { data: distributors } = await supabase
          .from('users_profiles')
          .select('id')
          .eq('super_distributor_id', userId)
          .eq('role', 'distributor');
        
        const distIds = (distributors || []).map(d => d.id);
        if (distIds.length > 0) {
          query = query.in('distributor_id', distIds);
        } else {
          setAllFirms([]);
          return;
        }
      } else {
        query = query.eq('distributor_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAllFirms(Array.from(new Set(data.map(d => d.firm_name))).sort());
    } catch (err) { console.error('Firm fetch error:', err); }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase
          .from('users_profiles')
          .select('role')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        const role = data?.role || 'distributor';
        setCurrentUserRole(role);
        fetchFirmNames(role);
      } catch (err) {
        console.error('Error fetching role in DistributorStatementReport:', err);
      }
    };
    init();
  }, [userId]);

  useEffect(() => {
    if (firmName.trim()) {
      setSuggestions(allFirms.filter(f => f.toLowerCase().includes(firmName.toLowerCase())).slice(0, 10));
    } else { setSuggestions([]); }
  }, [firmName, allFirms]);

  const fetchStatement = async () => {
    setLoading(true);

    try {
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

      let openingBalance = 0;

      // Calculate Opening Balance if firm and start date are provided
      // Calculate Opening Balance if firm and start date are provided
      if (firmName.trim() && startDate) {
        let profileQuery = supabase
          .from('users_profiles')
          .select('id')
          .ilike('firm_name', firmName.trim());

        if (currentUserRole === 'super_distributor') {
          const { data: distributors } = await supabase
            .from('users_profiles')
            .select('id')
            .eq('super_distributor_id', userId)
            .eq('role', 'distributor');
          
          const distIds = (distributors || []).map(d => d.id);
          if (distIds.length > 0) {
            profileQuery = profileQuery.in('distributor_id', distIds);
          } else {
            profileQuery = profileQuery.eq('id', 'NONE');
          }
        } else {
          profileQuery = profileQuery.eq('distributor_id', userId);
        }

        const { data: userProfile } = await profileQuery.single();

        if (userProfile) {
          const targetUserId = userProfile.id;
          const qrPreQ = supabase.from('payment_submissions').select('amount, charges').eq('user_id', targetUserId).eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);
          const billPreQ = supabase.from('bill_submissions').select('amount, charges').eq('user_id', targetUserId).eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);
          const bbpsPreQ = supabase.from('bbps_submissions').select('amount, charges').eq('user_id', targetUserId).eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);
          const payoutPreQ = supabase.from('payout_submissions').select('amount, charge_amount').eq('user_id', targetUserId).eq('status', 'approved').lt('created_at', `${startDate}T00:00:00`);

          const [qrPre, billPre, bbpsPre, payoutPre] = await Promise.all([
            fetchAll(qrPreQ),
            fetchAll(billPreQ),
            fetchAll(bbpsPreQ),
            fetchAll(payoutPreQ)
          ]);

          const qrTotal = (qrPre || []).reduce((acc, r) => acc + (Number(r.amount) - Number(r.charges || 0)), 0);
          const billTotal = (billPre || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charges || 0)), 0);
          const bbpsTotal = (bbpsPre || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charges || 0)), 0);
          const payoutTotal = (payoutPre || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charge_amount || 0)), 0);

          openingBalance = qrTotal - billTotal - bbpsTotal - payoutTotal;
        }
      }

      let qrMapped: any[] = [];
      let billMapped: any[] = [];
      let payoutMapped: any[] = [];

      let distIds: string[] = [];
      if (currentUserRole === 'super_distributor') {
        const { data: distributors } = await supabase
          .from('users_profiles')
          .select('id')
          .eq('super_distributor_id', userId)
          .eq('role', 'distributor');
        distIds = (distributors || []).map(d => d.id);
      }

      // 1. Fetch QR Payments
      if (typeFilter === 'all' || typeFilter === 'QR') {
        let qrQuery = supabase.from('payment_submissions').select(`
          *, 
          users_profiles!payment_submissions_user_id_fkey!inner(
            firm_name, 
            distributor_id
          ), 
          qr_history(qr_name)
        `)
          .eq('status', 'approved');

        if (currentUserRole === 'super_distributor') {
          if (distIds.length > 0) {
            qrQuery = qrQuery.in('users_profiles.distributor_id', distIds);
          } else {
            qrQuery = qrQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          qrQuery = qrQuery.eq('users_profiles.distributor_id', userId);
        }

        if (firmName) qrQuery = qrQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (startDate) qrQuery = qrQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) qrQuery = qrQuery.lte('created_at', `${endDate}T23:59:59`);

        const qrData = await fetchAll(qrQuery);
        qrMapped = (qrData || []).map(r => ({
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
        let billQuery = supabase.from('bill_submissions').select(`
          *, 
          users_profiles!bill_submissions_user_id_fkey!inner(firm_name, distributor_id)
        `)
          .eq('status', 'approved');

        let bbpsQuery = supabase.from('bbps_submissions').select(`
          *, 
          users_profiles!bbps_submissions_user_id_fkey!inner(firm_name, distributor_id)
        `)
          .eq('status', 'approved');

        if (currentUserRole === 'super_distributor') {
          if (distIds.length > 0) {
            billQuery = billQuery.in('users_profiles.distributor_id', distIds);
            bbpsQuery = bbpsQuery.in('users_profiles.distributor_id', distIds);
          } else {
            billQuery = billQuery.eq('id', '00000000-0000-0000-0000-000000000000');
            bbpsQuery = bbpsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          billQuery = billQuery.eq('users_profiles.distributor_id', userId);
          bbpsQuery = bbpsQuery.eq('users_profiles.distributor_id', userId);
        }

        if (firmName) {
          billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
          bbpsQuery = bbpsQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        }
        if (startDate) {
          billQuery = billQuery.gte('created_at', `${startDate}T00:00:00`);
          bbpsQuery = bbpsQuery.gte('created_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
          billQuery = billQuery.lte('created_at', `${endDate}T23:59:59`);
          bbpsQuery = bbpsQuery.lte('created_at', `${endDate}T23:59:59`);
        }

        const [billData, bbpsData] = await Promise.all([
          fetchAll(billQuery),
          fetchAll(bbpsQuery)
        ]);

        const mappedBills = (billData || []).map((r) => ({
          id: String(r.id || ''),
          numericId: String(r.payment_id || r.id || '').split('-')[0].toUpperCase(),
          type: 'BILL' as const,
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          reference: r.customer_mobile || '0000000000',
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) + Number(r.charges || 0),
          status: r.status,
          raw_data: { ...r, is_bbps: false }
        }));

        const mappedBbps = (bbpsData || []).map((r) => ({
          id: String(r.id || ''),
          numericId: String(r.id || '').split('-')[0].toUpperCase(),
          type: 'BILL' as const,
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          reference: r.consumer_number,
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) + Number(r.charges || 0),
          status: r.status,
          raw_data: { ...r, is_bbps: true }
        }));

        billMapped = [...mappedBills, ...mappedBbps];
      }

      // 3. Fetch Payouts
      if (typeFilter === 'all' || typeFilter === 'PAYOUT') {
        let payoutQuery = supabase.from('payout_submissions').select(`
          *, 
          users_profiles!inner(firm_name, distributor_id)
        `)
          .eq('status', 'approved');

        if (currentUserRole === 'super_distributor') {
          if (distIds.length > 0) {
            payoutQuery = payoutQuery.in('users_profiles.distributor_id', distIds);
          } else {
            payoutQuery = payoutQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          payoutQuery = payoutQuery.eq('users_profiles.distributor_id', userId);
        }

        if (firmName) payoutQuery = payoutQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (startDate) payoutQuery = payoutQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) payoutQuery = payoutQuery.lte('created_at', `${endDate}T23:59:59`);

        const payoutData = await fetchAll(payoutQuery);
        payoutMapped = (payoutData || []).map(r => ({
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
        }));
      }

      // Merge and Sort (Oldest first for running balance)
      const merged = [...qrMapped, ...billMapped, ...payoutMapped].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Compute Running Balance
      let currentBalance = openingBalance;
      const recordsWithBalance: UnifiedRecord[] = merged.map(r => {
        if (r.type === 'QR') {
          currentBalance += r.final_total;
        } else {
          currentBalance -= r.final_total;
        }
        return { ...r, balance: currentBalance };
      });

      // Reverse to Latest first
      setRecords(recordsWithBalance.reverse());

    } catch (err) {
      console.error('Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserRole) {
      fetchStatement();
    }
  }, [startDate, endDate, typeFilter, currentUserRole, userId]);

  const clearFilters = () => {
    setFirmName('');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    fetchStatement();
  };

  const exportToExcel = () => {
    const dataToExport = records.slice(0, displayCount);
    const exportData = dataToExport.map(r => ({
      'Payment Date': new Date(r.date).toLocaleString('en-IN'),
      'PaymentId': r.numericId,
      'Transaction Type': r.type === 'BILL'
        ? (r.raw_data?.is_bbps
            ? (r.raw_data?.service_type === 'Credit Card'
                ? 'BBPS CREDITCARD'
                : `BBPS ${r.raw_data?.service_type?.toUpperCase() || 'UTILITY'}`)
            : 'CCBILLPAY')
        : r.type === 'PAYOUT' ? 'PAYOUT' : 'PAYMENT',
      'Card/Account No': r.type === 'PAYOUT' ? r.raw_data?.account_number : (r.raw_data?.card_number || '****'),
      'Firm Name': r.firm_name,
      'Description': r.type === 'BILL'
        ? (r.raw_data?.is_bbps
            ? (r.raw_data?.service_type === 'Credit Card'
                ? `BBPS CreditCard Mobile:${r.reference} Card:${r.raw_data?.card_number || '0000'}`
                : `BBPS ${r.raw_data?.service_type}:${r.raw_data?.provider} Account:${r.raw_data?.consumer_number} Mobile:${r.reference}`)
            : `CCBILLPAY Mobile:${r.reference} Card:${r.raw_data?.card_number || '0000'}`)
        : r.type === 'PAYOUT'
          ? `PAYOUT: ${r.raw_data?.account_holder_name} (Txn: ${r.reference})`
          : `Txn: ${r.reference} (QR: ${r.raw_data?.qr_history?.qr_name || 'N/A'})`,
      'Credit Amount': r.type === 'QR' ? r.final_total.toFixed(2) : '0.00',
      'Debit Amount': (r.type === 'BILL' || r.type === 'PAYOUT') ? r.final_total.toFixed(2) : '0.00',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    XLSX.writeFile(wb, `Users_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatDateTimeSplit = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return (
        <div className="flex flex-col text-[#4c4c4c] text-[13px]">
          <span>{d.toLocaleDateString()}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase">
            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      );
    } catch {
      return <span>{String(dateString || '')}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {currentUserRole === 'super_distributor' ? 'Distributors Statement Report' : 'Users Statement Report'}
          </h2>
          <p className="text-slate-500 mt-1">
            {currentUserRole === 'super_distributor' ? 'Generate unified transaction statements for all distributors under your network.' : 'Generate unified transaction statements for all your sub-users.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-100">
            <FileSpreadsheet size={16} /> Excel Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">

        <div className="flex-1 min-w-[200px] relative">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search Firm Name..."
              value={firmName}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => { setFirmName(e.target.value); setShowSuggestions(true); }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setFirmName(s); setShowSuggestions(false); fetchStatement(); }} className="w-full px-4 py-2.5 hover:bg-slate-50 text-left text-sm font-medium text-slate-700 flex justify-between items-center group">
                      {s} <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e: any) => setTypeFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        >
          <option value="all">All Types</option>
          <option value="QR">QR Payment</option>
          <option value="BILL">Bill Payment</option>
          <option value="PAYOUT">Payout</option>
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
          </div>
          <div className="w-px h-8 bg-slate-200 mx-2" />
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">End</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
          </div>
        </div>

        <button onClick={fetchStatement} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-indigo-100">
          <Search size={20} />
        </button>

        <button onClick={clearFilters} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Show</span>
            <select
              value={displayCount}
              onChange={(e) => setDisplayCount(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-2 py-1 outline-none font-bold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">ID</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Firm Name</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Credit</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Debit</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <p className="text-slate-400 font-medium">No records found for the selected filters.</p>
                  </td>
                </tr>
              ) : (
                records.slice(0, displayCount).map((r, idx) => (
                  <tr key={`${r.type}-${r.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">{formatDateTimeSplit(r.date)}</td>
                    <td className="px-6 py-4 text-[13px] font-bold text-slate-400">{r.numericId}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${r.type === 'QR' ? 'bg-emerald-50 text-emerald-600' :
                        r.type === 'BILL' ? 'bg-indigo-50 text-indigo-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                        {r.type === 'BILL' ? 'CCBILL' : r.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[13px] font-bold text-slate-900">{r.firm_name}</td>
                    <td className="px-6 py-4">
                      <div className="text-[13px] text-slate-600 leading-relaxed">
                        {r.type === 'BILL' ? (
                          r.raw_data?.is_bbps ? (
                            <>
                              <div>BBPS: <span className="font-bold">{r.raw_data?.service_type} ({r.raw_data?.provider})</span></div>
                              <div className="text-[11px] text-slate-400">Consumer: {r.reference}</div>
                            </>
                          ) : (
                            <>
                              <div>Mobile: <span className="font-bold">{r.reference}</span></div>
                              <div className="text-[11px] text-slate-400">Card: {r.raw_data?.card_number || '****'}</div>
                            </>
                          )
                        ) : r.type === 'PAYOUT' ? (
                          <>
                            <div className="font-bold">{r.raw_data?.account_holder_name}</div>
                            <div className="text-[11px] text-slate-400">Txn: {r.reference}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold">Txn: {r.reference}</div>
                            <div className="text-[11px] text-slate-400">QR: {r.raw_data?.qr_history?.qr_name || 'N/A'}</div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      {r.type === 'QR' ? `₹${r.final_total.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-rose-600">
                      {r.type !== 'QR' ? `₹${r.final_total.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₹{r.balance.toLocaleString()}
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
