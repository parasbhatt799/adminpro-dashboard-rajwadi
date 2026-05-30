import { LogoLoader } from './shared/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  IndianRupee, 
  RotateCcw, 
  Download, 
  Loader2, 
  User,
  ExternalLink,
  Table as TableIcon,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Phone,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BillRequest {
  id: string;
  user_id: string;
  customer_mobile: string;
  card_bank: string;
  card_number: string;
  card_owner_name: string;
  amount: number;
  charges: number;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
  };
  is_bbps?: boolean;
}

export default function BillPaymentReport() {
  const [requests, setRequests] = useState<BillRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [fullTotals, setFullTotals] = useState({ amount: 0, charges: 0, final: 0 });
  const limit = 10;

  // Autocomplete state
  const [allFirms, setAllFirms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [exactAmount, setExactAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchFirmNames = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('firm_name')
        .not('firm_name', 'is', null);
      if (error) throw error;
      const uniqueFirms = Array.from(new Set(data.map(d => d.firm_name))).sort();
      setAllFirms(uniqueFirms);
    } catch (err) {
      console.error('Error fetching firm names:', err);
    }
  };

  useEffect(() => {
    fetchFirmNames();
  }, []);

  useEffect(() => {
    if (firmName.trim().length > 0) {
      const filtered = allFirms.filter(f => 
        f.toLowerCase().includes(firmName.toLowerCase())
      ).slice(0, 10);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [firmName, allFirms]);

  const fetchRequests = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setOffset(0);
    }

    try {
      let billQuery = supabase
        .from('bill_submissions')
        .select('*, users_profiles!bill_submissions_user_id_fkey!inner(name, firm_name)')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      let bbpsQuery = supabase
        .from('bbps_submissions')
        .select('*, users_profiles!bbps_submissions_user_id_fkey!inner(name, firm_name)')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      // Apply Filters
      if (statusFilter !== 'all') {
        billQuery = billQuery.eq('status', statusFilter);
        bbpsQuery = bbpsQuery.eq('status', statusFilter);
      }
      if (firmName) {
        billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        bbpsQuery = bbpsQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
      }
      if (exactAmount) {
        billQuery = billQuery.eq('amount', Number(exactAmount));
        bbpsQuery = bbpsQuery.eq('amount', Number(exactAmount));
      }
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        const startISO = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        billQuery = billQuery.gte('created_at', startISO);
        bbpsQuery = bbpsQuery.gte('created_at', startISO);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endISO = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        billQuery = billQuery.lte('created_at', endISO);
        bbpsQuery = bbpsQuery.lte('created_at', endISO);
      }

      const [billRes, bbpsRes] = await Promise.all([
        billQuery,
        bbpsQuery
      ]);

      if (billRes.error) throw billRes.error;
      if (bbpsRes.error) throw bbpsRes.error;

      const mappedBills: BillRequest[] = (billRes.data || []).map(r => ({
        id: r.id,
        user_id: r.user_id,
        customer_mobile: r.customer_mobile,
        card_bank: r.card_bank,
        card_number: r.card_number,
        card_owner_name: r.card_owner_name,
        amount: Number(r.amount),
        charges: Number(r.charges || 0),
        status: r.status,
        created_at: r.created_at,
        users_profiles: r.users_profiles,
        is_bbps: false
      }));

      const mappedBbps: BillRequest[] = (bbpsRes.data || []).map(r => ({
        id: r.id,
        user_id: r.user_id,
        customer_mobile: r.consumer_number,
        card_bank: r.provider,
        card_number: r.transaction_id || r.service_type || 'BBPS',
        card_owner_name: `BBPS: ${r.service_type}`,
        amount: Number(r.amount),
        charges: Number(r.charges || 0),
        status: r.status,
        created_at: r.created_at,
        users_profiles: r.users_profiles,
        is_bbps: true
      }));

      const combined = [...mappedBills, ...mappedBbps].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const currentOffset = isLoadMore ? offset + limit : 0;
      const paginated = combined.slice(0, currentOffset + limit);

      setRequests(paginated);
      setHasMore(combined.length > currentOffset + limit);
      if (combined.length > currentOffset + limit) {
        setOffset(currentOffset);
      }
    } catch (err) {
      console.error('Error fetching bill report data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchFullTotals = async () => {
    try {
      let selectStr = 'amount, charges';
      let bbpsSelectStr = 'amount, charges';
      if (firmName) {
        selectStr += ', users_profiles!bill_submissions_user_id_fkey!inner(firm_name)';
        bbpsSelectStr += ', users_profiles!bbps_submissions_user_id_fkey!inner(firm_name)';
      } else {
        selectStr += ', users_profiles!bill_submissions_user_id_fkey(firm_name)';
        bbpsSelectStr += ', users_profiles!bbps_submissions_user_id_fkey(firm_name)';
      }

      let billQuery = supabase
        .from('bill_submissions')
        .select(selectStr)
        .neq('status', 'rejected');

      let bbpsQuery = supabase
        .from('bbps_submissions')
        .select(bbpsSelectStr)
        .neq('status', 'rejected');

      if (statusFilter !== 'all') {
        billQuery = billQuery.eq('status', statusFilter);
        bbpsQuery = bbpsQuery.eq('status', statusFilter);
      }
      if (firmName) {
        billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        bbpsQuery = bbpsQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
      }
      if (exactAmount) {
        billQuery = billQuery.eq('amount', Number(exactAmount));
        bbpsQuery = bbpsQuery.eq('amount', Number(exactAmount));
      }
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        const startISO = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        billQuery = billQuery.gte('created_at', startISO);
        bbpsQuery = bbpsQuery.gte('created_at', startISO);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endISO = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        billQuery = billQuery.lte('created_at', endISO);
        bbpsQuery = bbpsQuery.lte('created_at', endISO);
      }

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

      const [billData, bbpsData] = await Promise.all([
        fetchAll(billQuery),
        fetchAll(bbpsQuery)
      ]);

      const combined = [...(billData || []), ...(bbpsData || [])];

      const totals = combined.reduce((acc, curr) => ({
        amount: acc.amount + Number(curr.amount || 0),
        charges: acc.charges + Number(curr.charges || 0),
        final: acc.final + (Number(curr.amount || 0) + Number(curr.charges || 0))
      }), { amount: 0, charges: 0, final: 0 });

      setFullTotals(totals);
    } catch (err) {
      console.error('Error fetching bill totals:', err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchFullTotals();
  }, [statusFilter, startDate, endDate, firmName, exactAmount]);

  const handleSearch = () => {
    fetchRequests();
  };

  const handleReset = () => {
    setFirmName('');
    setExactAmount('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    fetchRequests();
  };

  const calculateTotals = (data: BillRequest[]) => {
    return data.reduce((acc, curr) => ({
      amount: acc.amount + Number(curr.amount || 0),
      charges: acc.charges + Number(curr.charges || 0),
      final: acc.final + (Number(curr.amount || 0) + Number(curr.charges || 0))
    }), { amount: 0, charges: 0, final: 0 });
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);
      let billQuery = supabase
        .from('bill_submissions')
        .select('*, users_profiles!bill_submissions_user_id_fkey(firm_name)')
        .neq('status', 'rejected');

      let bbpsQuery = supabase
        .from('bbps_submissions')
        .select('*, users_profiles!bbps_submissions_user_id_fkey(firm_name)')
        .neq('status', 'rejected');

      if (statusFilter !== 'all') {
        billQuery = billQuery.eq('status', statusFilter);
        bbpsQuery = bbpsQuery.eq('status', statusFilter);
      }
      if (firmName) {
        billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        bbpsQuery = bbpsQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
      }
      if (exactAmount) {
        billQuery = billQuery.eq('amount', Number(exactAmount));
        bbpsQuery = bbpsQuery.eq('amount', Number(exactAmount));
      }
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        const startISO = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        billQuery = billQuery.gte('created_at', startISO);
        bbpsQuery = bbpsQuery.gte('created_at', startISO);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endISO = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        billQuery = billQuery.lte('created_at', endISO);
        bbpsQuery = bbpsQuery.lte('created_at', endISO);
      }

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

      const [billData, bbpsData] = await Promise.all([
        fetchAll(billQuery),
        fetchAll(bbpsQuery)
      ]);

      const mappedBills = (billData || []).map(r => ({
        ...r,
        is_bbps: false
      }));

      const mappedBbps = (bbpsData || []).map(r => ({
        ...r,
        customer_mobile: r.consumer_number,
        card_owner_name: `BBPS: ${r.service_type}`,
        card_number: r.transaction_id || r.service_type || 'BBPS',
        card_bank: r.provider,
        is_bbps: true
      }));

      const allData = [...mappedBills, ...mappedBbps].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const totals = allData.reduce((acc, curr) => ({
        amount: acc.amount + Number(curr.amount || 0),
        charges: acc.charges + Number(curr.charges || 0),
        final: acc.final + (Number(curr.amount || 0) + Number(curr.charges || 0))
      }), { amount: 0, charges: 0, final: 0 });

      const exportData = allData.map(req => ({
        'Date': new Date(req.created_at).toLocaleDateString(),
        'Firm Name': req.users_profiles?.firm_name || 'N/A',
        'Customer Mobile': req.customer_mobile,
        'Card Owner / BBPS': req.card_owner_name,
        'Bank / Provider': req.card_bank,
        'Status': req.status.toUpperCase(),
        'Amount': Number(req.amount),
        'Service Charge': Number(req.charges || 0),
        'Debited Total': Number(req.amount) + Number(req.charges || 0)
      }));

      exportData.push({
        'Date': 'TOTAL',
        'Firm Name': '',
        'Customer Mobile': '',
        'Card Owner / BBPS': '',
        'Bank / Provider': '',
        'Status': '',
        'Amount': Number(totals.amount.toFixed(2)) as any,
        'Service Charge': Number(totals.charges.toFixed(2)) as any,
        'Debited Total': Number(totals.final.toFixed(2)) as any
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bill Payments');
      XLSX.writeFile(wb, `Bill_Payment_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to export data.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setLoading(true);
      let billQuery = supabase
        .from('bill_submissions')
        .select('*, users_profiles!bill_submissions_user_id_fkey(firm_name)')
        .neq('status', 'rejected');

      let bbpsQuery = supabase
        .from('bbps_submissions')
        .select('*, users_profiles!bbps_submissions_user_id_fkey(firm_name)')
        .neq('status', 'rejected');

      if (statusFilter !== 'all') {
        billQuery = billQuery.eq('status', statusFilter);
        bbpsQuery = bbpsQuery.eq('status', statusFilter);
      }
      if (firmName) {
        billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        bbpsQuery = bbpsQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
      }
      if (exactAmount) {
        billQuery = billQuery.eq('amount', Number(exactAmount));
        bbpsQuery = bbpsQuery.eq('amount', Number(exactAmount));
      }
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        const startISO = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        billQuery = billQuery.gte('created_at', startISO);
        bbpsQuery = bbpsQuery.gte('created_at', startISO);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endISO = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        billQuery = billQuery.lte('created_at', endISO);
        bbpsQuery = bbpsQuery.lte('created_at', endISO);
      }

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

      const [billData, bbpsData] = await Promise.all([
        fetchAll(billQuery),
        fetchAll(bbpsQuery)
      ]);

      const mappedBills = (billData || []).map(r => ({
        ...r,
        is_bbps: false
      }));

      const mappedBbps = (bbpsData || []).map(r => ({
        ...r,
        customer_mobile: r.consumer_number,
        card_owner_name: `BBPS: ${r.service_type}`,
        card_number: r.transaction_id || r.service_type || 'BBPS',
        card_bank: r.provider,
        is_bbps: true
      }));

      const allData = [...mappedBills, ...mappedBbps].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const totals = allData.reduce((acc, curr) => ({
        amount: acc.amount + Number(curr.amount || 0),
        charges: acc.charges + Number(curr.charges || 0),
        final: acc.final + (Number(curr.amount || 0) + Number(curr.charges || 0))
      }), { amount: 0, charges: 0, final: 0 });

      const doc = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      const tableData = allData.map(req => [
        new Date(req.created_at).toLocaleDateString(),
        req.users_profiles?.firm_name || 'N/A',
        req.customer_mobile,
        req.is_bbps ? `${req.card_owner_name}\n(${req.card_bank})` : `${req.card_owner_name}\n(${req.card_bank})`,
        req.status.toUpperCase(),
        req.amount.toLocaleString(),
        (req.charges || 0).toLocaleString(),
        (Number(req.amount) + Number(req.charges || 0)).toLocaleString()
      ]);

      const footer = [
        ['TOTAL', '', '', '', '', totals.amount.toLocaleString(), totals.charges.toLocaleString(), totals.final.toLocaleString()]
      ];

      autoTable(doc, {
        head: [['Date', 'Firm Name', 'Mobile / Consumer No', 'Card / Provider Details', 'Status', 'Amount', 'Charges', 'Debited']],
        body: tableData,
        foot: footer,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        margin: { top: 20 },
        didDrawPage: (data: any) => {
          doc.text('Bill Payment Report', data.settings.margin.left, 12);
        }
      });

      doc.save(`Bill_Payment_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bill Payment Report</h2>
          <p className="text-slate-500 mt-1">Detailed analysis of bill payment submissions with custom filters.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-emerald-200"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-rose-200"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Firm Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search firm..."
                value={firmName}
                onChange={(e) => {
                  setFirmName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
            
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden"
                  >
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setFirmName(s);
                            setShowSuggestions(false);
                            setTimeout(() => fetchRequests(), 0);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors group"
                        >
                          <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 truncate">{s}</span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Exact Amount</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="number" 
                placeholder="Enter amount..."
                value={exactAmount}
                onChange={(e) => setExactAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="all">Approved & Pending</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button 
              onClick={handleSearch}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-[38px] rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <Search size={16} />
              Filter
            </button>
            <button 
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white h-[38px]"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Start Date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">End Date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date / Firm</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Card Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Charges</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Debited</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-indigo-600"><LogoLoader size="md" className="mx-auto" /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400"><Receipt className="mx-auto mb-2 opacity-20" size={48} /><p>No data found.</p></td></tr>
              ) : (
                <>
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900">{req.users_profiles?.firm_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Phone size={10} className="text-slate-300" />
                          <span className="text-xs font-bold text-slate-700">{req.customer_mobile}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{req.is_bbps ? 'BBPS Bill Pay' : req.card_owner_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {req.is_bbps ? (
                            <Receipt size={10} className="text-slate-300" />
                          ) : (
                            <CreditCard size={10} className="text-slate-300" />
                          )}
                          <span className="text-xs font-bold text-slate-700">
                            {req.is_bbps ? (req.card_number || 'N/A') : (req.card_number || '').slice(-4)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{req.card_bank}</p>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">₹{req.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">₹{(req.charges || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-indigo-600">₹{(Number(req.amount) + Number(req.charges || 0)).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>{req.status}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <td colSpan={3} className="px-6 py-4 text-slate-900 text-sm">
                      {(firmName || exactAmount || startDate || endDate || statusFilter !== 'all') ? 'FILTERED TOTAL' : 'OVERALL TOTAL'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900 text-sm">₹{fullTotals.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-emerald-700 text-sm">₹{fullTotals.charges.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-indigo-700 text-sm font-black">₹{fullTotals.final.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button onClick={() => fetchRequests(true)} disabled={loadingMore} className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm">
            {loadingMore ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
            Load More Data
          </button>
        </div>
      )}
    </div>
  );
}
