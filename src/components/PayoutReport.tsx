import React, { useState, useEffect } from 'react';
import { 
  History, 
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
  X,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PayoutRequest {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  amount: number;
  charge_amount: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  transaction_id: string;
  proof_url: string;
  created_at: string;
  users_profiles?: {
    firm_name: string;
  };
}

export default function PayoutReport() {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedProof, setSelectedProof] = useState<PayoutRequest | null>(null);
  const [fullTotals, setFullTotals] = useState({ amount: 0, charges: 0 });
  const limit = 10;

  // Autocomplete state
  const [allFirms, setAllFirms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [firmName, setFirmName] = useState('');
  const [exactAmount, setExactAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'approved' | 'rejected'>('all');
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
      let query = supabase
        .from('payout_submissions')
        .select('*, users_profiles!inner(firm_name)')
        .order('created_at', { ascending: false });

      // Apply Filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (firmName) {
        query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      }
      if (exactAmount) {
        query = query.eq('amount', Number(exactAmount));
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const currentOffset = isLoadMore ? offset + limit : 0;
      const { data, error } = await query.range(currentOffset, currentOffset + limit - 1);

      if (error) throw error;

      if (isLoadMore) {
        setRequests(prev => [...prev, ...(data || [])]);
      } else {
        setRequests(data || []);
      }

      setHasMore(data?.length === limit);
      if (data?.length === limit) {
        setOffset(currentOffset);
      }
    } catch (err) {
      console.error('Error fetching payout report:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchFullTotals = async () => {
    try {
      let selectStr = 'amount, charge_amount';
      if (firmName) selectStr += ', users_profiles!inner(firm_name)';
      else selectStr += ', users_profiles(firm_name)';

      let query = supabase
        .from('payout_submissions')
        .select(selectStr);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (firmName) query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      if (exactAmount) query = query.eq('amount', Number(exactAmount));
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

      // Recursive fetch for totals
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

      const totals = allData.reduce((acc, curr) => ({
        amount: acc.amount + Number(curr.amount || 0),
        charges: acc.charges + Number(curr.charge_amount || 0)
      }), { amount: 0, charges: 0 });

      setFullTotals(totals);
    } catch (err) {
      console.error('Error fetching payout totals:', err);
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

  const calculateTotals = (data: PayoutRequest[]) => {
    return data.reduce((acc, curr) => ({
      amount: acc.amount + Number(curr.amount || 0),
      charges: acc.charges + Number(curr.charge_amount || 0),
      total: acc.total + (Number(curr.amount || 0) + Number(curr.charge_amount || 0))
    }), { amount: 0, charges: 0, total: 0 });
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payout_submissions')
        .select('*, users_profiles(firm_name)');

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (firmName) query = query.ilike('users_profiles.firm_name', `%${firmName}%`);
      if (exactAmount) query = query.eq('amount', Number(exactAmount));
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

      // Recursive fetch for full export
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

      const totals = allData.reduce((acc, curr) => ({
        amount: acc.amount + Number(curr.amount || 0),
        charges: acc.charges + Number(curr.charge_amount || 0),
        total: acc.total + (Number(curr.amount || 0) + Number(curr.charge_amount || 0))
      }), { amount: 0, charges: 0, total: 0 });

      const exportData = allData.map(req => ({
        'Date': new Date(req.created_at).toLocaleString(),
        'Firm Name': req.users_profiles?.firm_name || 'N/A',
        'Holder Name': req.account_holder_name,
        'Bank Name': req.bank_name,
        'A/c Number': req.account_number,
        'IFSC Code': req.ifsc_code,
        'Amount': Number(req.amount),
        'Charge': Number(req.charge_amount),
        'Total Debit': Number(req.amount) + Number(req.charge_amount),
        'Status': req.status.toUpperCase(),
        'Txn ID': req.transaction_id || '-'
      }));

      exportData.push({
        'Date': 'TOTAL',
        'Firm Name': '',
        'Holder Name': '',
        'Bank Name': '',
        'A/c Number': '',
        'IFSC Code': '',
        'Amount': Number(totals.amount.toFixed(2)) as any,
        'Charge': Number(totals.charges.toFixed(2)) as any,
        'Total Debit': Number(totals.total.toFixed(2)) as any,
        'Status': '',
        'Txn ID': ''
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, 
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payout Report');
      XLSX.writeFile(wb, `Payout_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to export data.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const totals = calculateTotals(requests);
      const tableData = requests.map(req => [
        new Date(req.created_at).toLocaleDateString(),
        req.users_profiles?.firm_name || 'N/A',
        req.account_holder_name,
        `${req.bank_name}\n${req.account_number}`,
        req.amount.toLocaleString(),
        req.charge_amount.toLocaleString(),
        (Number(req.amount) + Number(req.charge_amount)).toLocaleString(),
        req.status.toUpperCase(),
        req.transaction_id || '-'
      ]);

      autoTable(doc, {
        head: [['Date', 'Firm', 'Holder', 'Bank/Account', 'Amount', 'Charge', 'Total', 'Status', 'Txn ID']],
        body: tableData,
        foot: [['TOTAL', '', '', '', totals.amount.toLocaleString(), totals.charges.toLocaleString(), totals.total.toLocaleString(), '', '']],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      doc.save(`Payout_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error('PDF Error:', err); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-sans">Payout Report</h2>
          <p className="text-slate-500 mt-1">Detailed history of all wallet payout requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-emerald-200">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button onClick={exportToPDF} className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-rose-200">
            <FileText size={18} /> PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 relative text-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Firm Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" placeholder="Search firm..." value={firmName}
                onChange={(e) => { setFirmName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
              />
            </div>
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => { setFirmName(s); setShowSuggestions(false); fetchRequests(); }} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors group">
                        <span className="text-sm font-medium text-slate-700 truncate">{s}</span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-amber-400 transition-all" />
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Status</label>
            <select 
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="space-y-1.5 text-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date Range</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent w-full" />
              <span className="text-slate-300">-</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent w-full" />
            </div>
          </div>

          <div className="flex items-end gap-2 text-sans">
            <button onClick={handleSearch} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white h-[38px] rounded-xl text-sm font-bold shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2">
              <Search size={16} /> Filter
            </button>
            <button onClick={handleReset} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white h-[38px]" title="Reset">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date / Firm</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Bank Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Charge</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Total Debit</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status / Txn ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 className="animate-spin text-amber-600 mx-auto" size={32} /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">No payouts found</td></tr>
              ) : (
                <>
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900">{req.users_profiles?.firm_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-800">{req.account_holder_name}</p>
                        <p className="text-[11px] text-slate-500">{req.bank_name} | {req.account_number}</p>
                        <p className="text-[10px] text-slate-400 font-medium">IFSC: {req.ifsc_code}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 text-sm">₹{req.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-rose-500 text-sm">+₹{req.charge_amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 text-sm bg-slate-50/30">₹{(Number(req.amount) + Number(req.charge_amount)).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                          req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                          req.status === 'processing' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {req.status}
                        </span>
                        {req.transaction_id && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">ID: {req.transaction_id}</p>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {req.proof_url ? (
                          <button onClick={() => setSelectedProof(req)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-block transition-colors"><ExternalLink size={16} /></button>
                        ) : <span className="text-slate-200">-</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                    <td colSpan={2} className="px-6 py-4 text-slate-900 text-sm uppercase tracking-wider">
                      {(firmName || exactAmount || startDate || endDate || statusFilter !== 'all') ? 'Filtered Summary' : 'Overall Summary'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900 text-sm font-black">₹{fullTotals.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-rose-600 text-sm font-black">₹{fullTotals.charges.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-slate-900 text-sm font-black">₹{(fullTotals.amount + fullTotals.charges).toLocaleString()}</td>
                    <td colSpan={2}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button onClick={() => fetchRequests(true)} disabled={loadingMore} className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-amber-600 hover:bg-amber-50 transition-all shadow-sm">
            {loadingMore ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />} Load More
          </button>
        </div>
      )}

      {/* Proof Modal */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              <button onClick={() => setSelectedProof(null)} className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg z-10"><X size={20} /></button>
              <div className="flex-1 bg-slate-50 flex items-center justify-center overflow-hidden p-4">
                <img src={selectedProof.proof_url} alt="Payout Proof" className="max-w-full max-h-[calc(95vh-150px)] object-contain rounded-xl" referrerPolicy="no-referrer" />
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transaction ID</p>
                  <p className="text-sm font-bold text-slate-900">{selectedProof.transaction_id || 'N/A'}</p>
                </div>
                <button onClick={() => window.open(selectedProof.proof_url, '_blank')} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
                  <Download size={18} /> Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}