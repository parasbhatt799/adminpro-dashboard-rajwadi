import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  Search,
  ChevronRight,
  IndianRupee,
  Loader2,
  TrendingUp,
  Activity,
  CreditCard,
  BarChart3,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  RotateCcw,
  FileSpreadsheet,
  FileDown,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, getHours } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface UserReportsProps {
  userId: string;
}

type ReportType = 'master' | 'daily' | 'service';

export default function UserReports({ userId }: UserReportsProps) {
  const [loading, setLoading] = useState(true);
  const [qrRequests, setQrRequests] = useState<any[]>([]);
  const [billRequests, setBillRequests] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<ReportType>('master');
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [transType, setTransType] = useState<'all' | 'QR' | 'BILL'>('all');
  const [bankFilter, setBankFilter] = useState('');
  const [banks, setBanks] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch QR Payments
        const { data: qrData } = await supabase
          .from('payment_submissions')
          .select('*, qr_history(qr_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        // Fetch Bill Payments
        const { data: billData } = await supabase
          .from('bill_submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        setQrRequests(qrData || []);
        setBillRequests(billData || []);

        // Extract unique banks for filter
        if (billData) {
          const uniqueBanks = Array.from(new Set(billData.map(b => b.card_bank))).filter(Boolean);
          setBanks(uniqueBanks as string[]);
        }
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setTransType('all');
    setBankFilter('');
  };

  // Processed Data
  const filteredData = useMemo(() => {
    let combined: any[] = [
      ...qrRequests.map(r => ({ 
        ...r, 
        type: 'QR', 
        reference: r.utr_id, 
        net: Number(r.amount) - Number(r.charges || 0), 
        remaining_balance: '-',
        qr_name: r.qr_history?.qr_name || 'N/A',
        card_number: r.card_number || '****'
      })),
      ...billRequests.map(r => ({ 
        ...r, 
        type: 'BILL', 
        reference: r.card_number, 
        net: -(Number(r.amount) + Number(r.charges || 0)), 
        remaining_balance: r.remaining_balance || '-',
        qr_name: '-',
        card_number: r.card_number || '****'
      }))
    ];

    return combined.filter(item => {
      const date = parseISO(item.created_at);
      const amount = Number(item.amount);
      
      const matchesDate = (!startDate || date >= startOfDay(parseISO(startDate))) && 
                          (!endDate || date <= endOfDay(parseISO(endDate)));
      const matchesAmount = (!minAmount || amount >= Number(minAmount)) && 
                            (!maxAmount || amount <= Number(maxAmount));
      const matchesType = transType === 'all' || item.type === transType;
      const matchesBank = !bankFilter || (item.type === 'BILL' && item.card_bank === bankFilter);

      return matchesDate && matchesAmount && matchesType && matchesBank;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [qrRequests, billRequests, startDate, endDate, minAmount, maxAmount, transType, bankFilter]);

  // Summary Stats
  const stats = useMemo(() => {
    const totalTransactions = filteredData.length;
    const totalAmount = filteredData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalCharges = filteredData.reduce((acc, curr) => acc + Number(curr.charges || 0), 0);
    
    return { totalTransactions, totalAmount, totalCharges };
  }, [filteredData]);

  // Report Specific Data
  const dailySummary = useMemo(() => {
    const groups: { [key: string]: any } = {};
    filteredData.forEach(item => {
      const date = format(parseISO(item.created_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = { date, qr: 0, bill: 0, charges: 0, net: 0 };
      }
      if (item.type === 'QR') {
        groups[date].qr += Number(item.amount);
        groups[date].net += (Number(item.amount) - Number(item.charges || 0));
      } else {
        groups[date].bill += Number(item.amount);
        groups[date].net -= (Number(item.amount) + Number(item.charges || 0));
      }
      groups[date].charges += Number(item.charges || 0);
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredData]);

  const timeBasedData = useMemo(() => {
    const slots: { [key: number]: any } = {};
    for (let i = 0; i < 24; i++) {
      slots[i] = { hour: i, count: 0, amount: 0 };
    }
    filteredData.forEach(item => {
      const hour = getHours(parseISO(item.created_at));
      slots[hour].count += 1;
      slots[hour].amount += Number(item.amount);
    });
    return Object.values(slots);
  }, [filteredData]);

  const volumeData = useMemo(() => {
    const qrCount = filteredData.filter(i => i.type === 'QR').length;
    const billCount = filteredData.filter(i => i.type === 'BILL').length;
    return { qrCount, billCount, total: qrCount + billCount };
  }, [filteredData]);

  const settlementData = useMemo(() => {
    const qrCredited = filteredData.filter(i => i.type === 'QR').reduce((acc, curr) => acc + (Number(curr.amount) - Number(curr.charges || 0)), 0);
    const billDebited = filteredData.filter(i => i.type === 'BILL').reduce((acc, curr) => acc + (Number(curr.amount) + Number(curr.charges || 0)), 0);
    return { qrCredited, billDebited, balance: qrCredited - billDebited };
  }, [filteredData]);

  const serviceChargeData = useMemo(() => {
    const qrCharges = filteredData.filter(i => i.type === 'QR').reduce((acc, curr) => acc + Number(curr.charges || 0), 0);
    const billCharges = filteredData.filter(i => i.type === 'BILL').reduce((acc, curr) => acc + Number(curr.charges || 0), 0);
    return { qrCharges, billCharges, total: qrCharges + billCharges };
  }, [filteredData]);

  // Export Functions
  const exportToExcel = () => {
    let dataToExport: any[] = [];
    let fileName = `Report_${activeReport}_${format(new Date(), 'yyyyMMdd')}.xlsx`;

    switch (activeReport) {
      case 'master':
        dataToExport = filteredData.map(i => ({
          'Date/Time': format(parseISO(i.created_at), 'yyyy-MM-dd hh:mm a'),
          'Type': i.type,
          'Reference': i.reference,
          'QR Name': i.qr_name,
          'Card No': i.card_number,
          'Amount': i.amount,
          'Service Charge': i.charges || 0,
          'Net Amount': i.net,
          'Remaining Balance': i.remaining_balance
        }));
        break;
      case 'daily':
        dataToExport = dailySummary.map(i => ({
          'Date': i.date,
          'QR Amount': i.qr,
          'Bill Amount': i.bill,
          'Charges': i.charges,
          'Net Total': i.net
        }));
        break;
      case 'service':
        dataToExport = [
          { 'Category': 'QR Service Charges', 'Amount': serviceChargeData.qrCharges },
          { 'Category': 'Bill Service Charges', 'Amount': serviceChargeData.billCharges },
          { 'Category': 'Combined Total', 'Amount': serviceChargeData.total }
        ];
        break;
      case 'settlement':
        dataToExport = [
          { 'Label': 'Total QR Credited', 'Amount': settlementData.qrCredited },
          { 'Label': 'Total Bill Debited', 'Amount': settlementData.billDebited },
          { 'Label': 'Final Balance', 'Amount': settlementData.balance }
        ];
        break;
      case 'time':
        dataToExport = timeBasedData.map(i => ({
          'Time Slot': `${i.hour}:00 - ${i.hour}:59`,
          'Transaction Count': i.count,
          'Total Amount': i.amount
        }));
        break;
      case 'volume':
        dataToExport = [
          { 'Type': 'QR Transactions', 'Count': volumeData.qrCount },
          { 'Type': 'Bill Transactions', 'Count': volumeData.billCount },
          { 'Type': 'Combined Total', 'Count': volumeData.total }
        ];
        break;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, fileName);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `Master Report - ${activeReport.toUpperCase()}`;
    const dateRange = `Date Range: ${startDate || 'All Time'} to ${endDate || 'Present'}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 28);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd hh:mm a')}`, 14, 34);

    let columns: string[] = [];
    let body: any[] = [];

    switch (activeReport) {
      case 'master':
        columns = ['Date/Time', 'Type', 'Reference', 'QR Name', 'Card No', 'Amount', 'Service Charge', 'Net Amount', 'Remaining Balance'];
        body = filteredData.map(i => [
          format(parseISO(i.created_at), 'yyyy-MM-dd hh:mm a'),
          i.type,
          i.reference,
          i.qr_name,
          i.card_number,
          `INR ${i.amount}`,
          `INR ${i.charges || 0}`,
          `INR ${i.net}`,
          i.remaining_balance === '-' ? '-' : `INR ${Number(i.remaining_balance).toLocaleString()}`
        ]);
        break;
      case 'daily':
        columns = ['Date', 'QR Amount', 'Bill Amount', 'Charges', 'Net Total'];
        body = dailySummary.map(i => [
          i.date,
          `INR ${i.qr}`,
          `INR ${i.bill}`,
          `INR ${i.charges}`,
          `INR ${i.net}`
        ]);
        break;
      case 'service':
        columns = ['Category', 'Amount'];
        body = [
          ['QR Service Charges', `INR ${serviceChargeData.qrCharges}`],
          ['Bill Service Charges', `INR ${serviceChargeData.billCharges}`],
          ['Combined Total', `INR ${serviceChargeData.total}`]
        ];
        break;
      case 'settlement':
        columns = ['Label', 'Amount'];
        body = [
          ['Total QR Credited', `INR ${settlementData.qrCredited}`],
          ['Total Bill Debited', `INR ${settlementData.billDebited}`],
          ['Final Balance', `INR ${settlementData.balance}`]
        ];
        break;
      case 'time':
        columns = ['Time Slot', 'Transaction Count', 'Total Amount'];
        body = timeBasedData.map(i => [
          `${i.hour}:00 - ${i.hour}:59`,
          i.count,
          `INR ${i.amount}`
        ]);
        break;
      case 'volume':
        columns = ['Type', 'Count'];
        body = [
          ['QR Transactions', volumeData.qrCount],
          ['Bill Transactions', volumeData.billCount],
          ['Combined Total', volumeData.total]
        ];
        break;
    }

    autoTable(doc, {
      head: [columns],
      body: body,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    doc.save(`Report_${activeReport}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-slate-500 font-medium">Generating your reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Master Reports</h2>
          <p className="text-slate-500 mt-1">Analyze your transaction data with advanced reporting tools.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={18} className="text-emerald-600" />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
          >
            <FileDown size={18} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Transactions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalTransactions}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
            <p className="text-2xl font-bold text-slate-900">₹{stats.totalAmount.toFixed(2)}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Charges</p>
            <p className="text-2xl font-bold text-slate-900">₹{stats.totalCharges.toFixed(2)}</p>
          </div>
        </motion.div>
      </div>

      {/* Filters & Report Selector */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Date Range */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Amount Range */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Min Amount</label>
                <input 
                  type="number" 
                  placeholder="₹ 0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Max Amount</label>
                <input 
                  type="number" 
                  placeholder="₹ 99999"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* Type & Bank */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type</label>
                <select 
                  value={transType}
                  onChange={(e) => setTransType(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none"
                >
                  <option value="all">All Types</option>
                  <option value="QR">QR Payment</option>
                  <option value="BILL">Bill Payment</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bank</label>
                <select 
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none"
                >
                  <option value="">All Banks</option>
                  {banks.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear */}
            <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white"
                title="Clear Filters"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto no-scrollbar">
          {[
            { id: 'master', label: 'Master Table', icon: TableIcon },
            { id: 'daily', label: 'Daily Summary', icon: LayoutGrid },
            { id: 'service', label: 'Service Charges', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              className={`flex items-center gap-2 px-6 py-4 font-bold text-xs whitespace-nowrap transition-all border-b-2 ${
                activeReport === tab.id 
                  ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' 
                  : 'text-slate-500 border-transparent hover:bg-slate-50'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Report Content */}
        <div className="p-0 overflow-x-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeReport}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="min-w-full"
            >
              {activeReport === 'master' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-center">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date / Time</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">QR</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Card No</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Charge</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-slate-900">{format(parseISO(item.created_at), 'dd MMM yyyy')}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{format(parseISO(item.created_at), 'hh:mm a')}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                            item.type === 'QR' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-slate-600">{item.reference}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-slate-600">{item.qr_name}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-slate-600">{item.card_number || '****'}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-slate-900">₹{Number(item.amount).toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-rose-500">₹{Number(item.charges || 0).toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className={`text-xs font-bold ${item.net > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.net > 0 ? '+' : ''}₹{item.net.toFixed(2)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-xs font-bold text-slate-900">
                            {item.remaining_balance === '-' ? '-' : `₹${Number(item.remaining_balance).toFixed(2)}`}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeReport === 'daily' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">QR Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Bill Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total Charges</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Net Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dailySummary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-900">{format(parseISO(item.date), 'dd MMM yyyy')}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-emerald-600">₹{item.qr.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-indigo-600">₹{item.bill.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-rose-500">₹{item.charges.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-900">₹{item.net.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeReport === 'service' && (
                <div className="p-12 flex flex-col items-center">
                  <div className="w-full max-w-md space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Earnings Breakdown</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">QR Service Charges</span>
                          <span className="text-sm font-bold text-slate-900">₹{serviceChargeData.qrCharges.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">Bill Service Charges</span>
                          <span className="text-sm font-bold text-slate-900">₹{serviceChargeData.billCharges.toFixed(2)}</span>
                        </div>
                        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-base font-bold text-slate-900">Combined Total</span>
                          <span className="text-xl font-bold text-indigo-600">₹{serviceChargeData.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeReport === 'settlement' && (
                <div className="p-12 flex flex-col items-center">
                  <div className="w-full max-w-md space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Net Settlement</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">Total QR Credited</span>
                          <span className="text-sm font-bold text-emerald-600">+ ₹{settlementData.qrCredited.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">Total Bill Debited</span>
                          <span className="text-sm font-bold text-rose-600">- ₹{settlementData.billDebited.toFixed(2)}</span>
                        </div>
                        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-base font-bold text-slate-900">Final Balance</span>
                          <span className={`text-xl font-bold ${settlementData.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ₹{settlementData.balance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeReport === 'time' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Slot</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Activity Count</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {timeBasedData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-900">{item.hour}:00 - {item.hour}:59</td>
                        <td className="px-6 py-4 text-center text-xs font-bold text-indigo-600">{item.count}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-900">₹{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeReport === 'volume' && (
                <div className="p-12 flex flex-col items-center">
                  <div className="w-full max-w-md space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Transaction Volume</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">QR Transactions</span>
                          <span className="text-sm font-bold text-slate-900">{volumeData.qrCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">Bill Transactions</span>
                          <span className="text-sm font-bold text-slate-900">{volumeData.billCount}</span>
                        </div>
                        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-base font-bold text-slate-900">Combined Total</span>
                          <span className="text-xl font-bold text-indigo-600">{volumeData.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
