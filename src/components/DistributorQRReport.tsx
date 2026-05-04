import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  IndianRupee, 
  RotateCcw, 
  Download, 
  Loader2,
  TrendingUp,
  Building2,
  Calendar,
  ChevronRight,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DistributorReportData {
  id: string;
  firm_name: string;
  name: string;
  sub_user_count: number;
  qr_profit: number;
  bill_profit: number;
  total_profit: number;
  wallet_balance: number;
}

export default function DistributorQRReport() {
  const [data, setData] = useState<DistributorReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReportData = async () => {
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

      // 1. Fetch all distributors
      const { data: distributors, error: distError } = await supabase
        .from('users_profiles')
        .select('id, firm_name, name, commission_balance')
        .eq('role', 'distributor');

      if (distError) throw distError;

      // 2. Fetch all sub-users to map them to distributors
      const subUserQuery = supabase
        .from('users_profiles')
        .select('id, distributor_id')
        .not('distributor_id', 'is', null);

      const allSubUsers = await fetchAll(subUserQuery);

      // Create a map of distributor_id -> array of sub_user_ids
      const distSubUserMap: Record<string, string[]> = {};
      allSubUsers.forEach(u => {
        if (!distSubUserMap[u.distributor_id!]) distSubUserMap[u.distributor_id!] = [];
        distSubUserMap[u.distributor_id!].push(u.id);
      });

      // 3. Fetch QR profits per distributor
      let qrQuery = supabase
        .from('payment_submissions')
        .select('distributor_share, user_id')
        .eq('status', 'approved');

      if (startDate) qrQuery = qrQuery.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) qrQuery = qrQuery.lte('created_at', `${endDate}T23:59:59`);

      const qrData = await fetchAll(qrQuery);

      // Create a map of user_id -> total qr profit
      const userQrProfitMap: Record<string, number> = {};
      qrData.forEach(q => {
        userQrProfitMap[q.user_id] = (userQrProfitMap[q.user_id] || 0) + Number(q.distributor_share || 0);
      });

      // 4. Fetch Bill profits
      let billQuery = supabase
        .from('bill_submissions')
        .select('distributor_share, user_id')
        .eq('status', 'approved');

      if (startDate) billQuery = billQuery.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) billQuery = billQuery.lte('created_at', `${endDate}T23:59:59`);

      const billData = await fetchAll(billQuery);

      const userBillProfitMap: Record<string, number> = {};
      billData.forEach(b => {
        userBillProfitMap[b.user_id] = (userBillProfitMap[b.user_id] || 0) + Number(b.distributor_share || 0);
      });

      // 5. Assemble final data
      const finalReport: DistributorReportData[] = (distributors || []).map(dist => {
        const subIds = distSubUserMap[dist.id] || [];
        let qrProfit = 0;
        let billProfit = 0;
        
        subIds.forEach(id => {
          qrProfit += userQrProfitMap[id] || 0;
          billProfit += userBillProfitMap[id] || 0;
        });

        return {
          id: dist.id,
          firm_name: dist.firm_name || 'N/A',
          name: dist.name || 'N/A',
          sub_user_count: subIds.length,
          qr_profit: qrProfit,
          bill_profit: billProfit,
          total_profit: qrProfit + billProfit,
          wallet_balance: Number(dist.commission_balance || 0)
        };
      });

      setData(finalReport.sort((a, b) => b.total_profit - a.total_profit));
    } catch (err) {
      console.error('Error generating distributor report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  const filteredData = data.filter(d => 
    d.firm_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = () => {
    const exportData = filteredData.map(d => ({
      'Firm Name': d.firm_name,
      'Distributor Name': d.name,
      'Sub Users': d.sub_user_count,
      'QR Profit': d.qr_profit.toFixed(2),
      'Bill Profit': d.bill_profit.toFixed(2),
      'Total Profit': d.total_profit.toFixed(2),
      'Current Wallet': d.wallet_balance.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Distributor Profit");
    XLSX.writeFile(wb, `Distributor_Profit_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Distributor Profit Report", 14, 15);
    
    const tableData = filteredData.map(d => [
      d.firm_name,
      d.name,
      d.sub_user_count,
      `Rs. ${d.qr_profit.toFixed(2)}`,
      `Rs. ${d.bill_profit.toFixed(2)}`,
      `Rs. ${d.total_profit.toFixed(2)}`,
      `Rs. ${d.wallet_balance.toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [['Firm', 'Name', 'Users', 'QR Profit', 'Bill Profit', 'Total', 'Wallet']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Distributor_Profit_Report_${new Date().toLocaleDateString()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Distributor Profit Report</h2>
          <p className="text-slate-500 mt-1">Summary of earnings across all distributors.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all border border-rose-100"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total QR Profit</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                ₹{data.reduce((acc, curr) => acc + curr.qr_profit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Distributors</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{data.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <IndianRupee size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Wallet Liabilities</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                ₹{data.reduce((acc, curr) => acc + curr.wallet_balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Search Distributor</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by firm or name..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all"
              />
            </div>
          </div>

          <div className="w-full lg:w-48 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Start Date</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <div className="w-full lg:w-48 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">End Date</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <button 
            onClick={() => {
              setSearchTerm('');
              setStartDate('');
              setEndDate('');
            }}
            className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all border border-slate-200"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distributor / Firm</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sub-Users</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">QR Profit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bill Profit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Profit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Wallet Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No distributor data found for selected period.
                  </td>
                </tr>
              ) : (
                filteredData.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                          {d.firm_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{d.firm_name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{d.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                        {d.sub_user_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-slate-900">₹{d.qr_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-slate-500">₹{d.bill_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-indigo-600">₹{d.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-bold text-emerald-600">₹{d.wallet_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-all" />
                      </div>
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
