import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  IndianRupee, 
  RotateCcw, 
  Download, 
  Loader2, 
  User,
  ExternalLink,
  FileSpreadsheet,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnifiedRecord {
  id: string;
  type: 'QR' | 'BILL';
  date: string;
  firm_name: string;
  reference: string;
  amount: number;
  charges: number;
  final_total: number;
  status: string;
  raw_data: any;
}

export default function StatementReport() {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);
  const limit = 10;

  // Autocomplete state
  const [allFirms, setAllFirms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [exactAmount, setExactAmount] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'QR' | 'BILL'>('all');
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

  const fetchStatement = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else { setLoading(true); setDisplayCount(10); }

    try {
      let qrMapped: UnifiedRecord[] = [];
      let billMapped: UnifiedRecord[] = [];

      // 1. Fetch QR Payments (unless filter is set to BILL only)
      if (typeFilter === 'all' || typeFilter === 'QR') {
        let qrQuery = supabase.from('payment_submissions').select('*, users_profiles!inner(firm_name)').neq('status', 'rejected');
        
        if (firmName) qrQuery = qrQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (exactAmount) qrQuery = qrQuery.eq('amount', Number(exactAmount));
        if (startDate) qrQuery = qrQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) qrQuery = qrQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await qrQuery;
        if (error) throw error;
        qrMapped = (data || []).map(r => ({
          id: r.id,
          type: 'QR',
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          reference: r.utr_id,
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) - Number(r.charges || 0),
          status: r.status,
          raw_data: r
        }));
      }

      // 2. Fetch Bill Payments (unless filter is set to QR only)
      if (typeFilter === 'all' || typeFilter === 'BILL') {
        let billQuery = supabase.from('bill_submissions').select('*, users_profiles!inner(firm_name)').neq('status', 'rejected');
        
        if (firmName) billQuery = billQuery.ilike('users_profiles.firm_name', `%${firmName}%`);
        if (exactAmount) billQuery = billQuery.eq('amount', Number(exactAmount));
        if (startDate) billQuery = billQuery.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) billQuery = billQuery.lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await billQuery;
        if (error) throw error;
        billMapped = (data || []).map(r => ({
          id: r.id,
          type: 'BILL',
          date: r.created_at,
          firm_name: r.users_profiles?.firm_name || 'N/A',
          reference: r.customer_mobile,
          amount: Number(r.amount),
          charges: Number(r.charges || 0),
          final_total: Number(r.amount) + Number(r.charges || 0),
          status: r.status,
          raw_data: r
        }));
      }

      // 4. Merge and Sort
      const merged = [...qrMapped, ...billMapped].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setRecords(merged);
      setHasMore(merged.length > (isLoadMore ? displayCount + limit : limit));
      if (isLoadMore) setDisplayCount(prev => prev + limit);

    } catch (err) {
      console.error('Statement fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [startDate, endDate, typeFilter]);

  const calculateTotals = (data: UnifiedRecord[]) => {
    return data.reduce((acc, curr) => ({
      amount: acc.amount + curr.amount,
      charges: acc.charges + curr.charges,
      final: acc.final + curr.final_total
    }), { amount: 0, charges: 0, final: 0 });
  };

  const exportToExcel = () => {
    const dataToExport = records.slice(0, displayCount);
    const totals = calculateTotals(dataToExport);
    const exportData = dataToExport.map(r => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Type': r.type,
      'Firm Name': r.firm_name,
      'Reference': r.reference,
      'Status': r.status.toUpperCase(),
      'Amount': r.amount,
      'Charges': r.charges,
      'Final Total': r.final_total
    }));

    exportData.push({
      'Date': 'TOTAL', 'Type': '', 'Firm Name': '', 'Reference': '', 'Status': '',
      'Amount': totals.amount, 'Charges': totals.charges, 'Final Total': totals.final
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    XLSX.writeFile(wb, `Statement_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const dataToExport = records.slice(0, displayCount);
      const totals = calculateTotals(dataToExport);
      
      const tableData = dataToExport.map(r => [
        new Date(r.date).toLocaleDateString(),
        r.type,
        r.firm_name,
        r.reference,
        r.status.toUpperCase(),
        r.amount.toLocaleString(),
        r.charges.toLocaleString(),
        r.final_total.toLocaleString()
      ]);

      const footer = [['TOTAL', '', '', '', '', totals.amount.toLocaleString(), totals.charges.toLocaleString(), totals.final.toLocaleString()]];

      autoTable(doc, {
        head: [['Date', 'Type', 'Firm Name', 'Reference', 'Status', 'Amount', 'Charges', 'Final Total']],
        body: tableData,
        foot: footer,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save(`Statement_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error('PDF Error:', err); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Statement Report</h2>
          <p className="text-slate-500 mt-1">Unified view of all QR and Bill transactions across all firms.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl text-sm font-bold border border-emerald-200"><FileSpreadsheet size={18} /> Excel</button>
          <button onClick={exportToPDF} className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-bold border border-rose-200"><FileText size={18} /> PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Firm Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search firm..." value={firmName} onFocus={() => setShowSuggestions(true)} onChange={(e) => { setFirmName(e.target.value); setShowSuggestions(true); }} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            </div>
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => { setFirmName(s); setShowSuggestions(false); fetchStatement(); }} className="w-full px-4 py-3 hover:bg-slate-50 text-left text-sm font-medium text-slate-700 flex justify-between items-center group">
                        {s} <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Exact Amount</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="number" placeholder="Enter amount..." value={exactAmount} onChange={(e) => setExactAmount(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Type</label>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="all">All Types</option>
              <option value="QR">QR Payments</option>
              <option value="BILL">Bill Payments</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button onClick={() => fetchStatement()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-[38px] rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"><Search size={16} /> Filter</button>
            <button onClick={() => { setFirmName(''); setExactAmount(''); setTypeFilter('all'); setStartDate(''); setEndDate(''); fetchStatement(); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white h-[38px]"><RotateCcw size={18} /></button>
          </div>

          <div className="flex items-end">
             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full">
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Start</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
                </div>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">End</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" />
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date / Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Firm Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Reference</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Charges</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Final</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-indigo-600"><Loader2 className="animate-spin mx-auto" size={32} /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No records found.</td></tr>
              ) : (
                <>
                  {records.slice(0, displayCount).map((r) => (
                    <tr key={`${r.type}-${r.id}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           {r.type === 'QR' ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-rose-500" />}
                           <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${r.type === 'QR' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{r.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(r.date).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{r.firm_name}</td>
                      <td className="px-6 py-4">
                        <code className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{r.reference}</code>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">₹{r.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">₹{r.charges.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">₹{r.final_total.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {r.status === 'approved' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Clock size={12} className="text-amber-500" />}
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <td colSpan={3} className="px-6 py-4 text-slate-900 text-sm">SUMMARY (Visible Data)</td>
                    <td className="px-6 py-4 text-right text-slate-900 text-sm">₹{calculateTotals(records.slice(0, displayCount)).amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-slate-400 text-xs">₹{calculateTotals(records.slice(0, displayCount)).charges.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-slate-900 text-sm font-black">₹{calculateTotals(records.slice(0, displayCount)).final.toLocaleString()}</td>
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
          <button onClick={() => fetchStatement(true)} disabled={loadingMore} className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm">
            {loadingMore ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />} Load More Data
          </button>
        </div>
      )}
    </div>
  );
}
