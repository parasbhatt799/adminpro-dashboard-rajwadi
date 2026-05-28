import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  IndianRupee, 
  RotateCcw, 
  Download, 
  Loader2,
  Calendar,
  Building2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  QrCode,
  User as UserIcon,
  ChevronDown,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { LogoLoader } from '../shared/LoadingSpinner';
import * as XLSX from 'xlsx';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  emptyMessage?: string;
}

function SearchableSelect({ options, value, onChange, placeholder, emptyMessage = "No options found" }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/50 transition-all select-none h-[42px]"
      >
        <span className={`truncate mr-2 ${selectedOption ? "text-slate-900" : "text-slate-400"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {value && (
            <button 
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-60 flex flex-col">
          <div className="p-2 border-b border-slate-50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 transition-all"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 font-medium text-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${
                    opt.value === value 
                      ? 'bg-emerald-50 text-emerald-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface QRDistributorReportProps {
  userId: string;
}

export default function QRDistributorReport({ userId }: QRDistributorReportProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  
  // Lists for dropdown options
  const [distributorsList, setDistributorsList] = useState<any[]>([]);
  const [subUsersList, setSubUsersList] = useState<any[]>([]);

  // Selected dropdown filter values
  const [selectedDistId, setSelectedDistId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const [utrSearch, setUtrSearch] = useState('');
  const [amountSearch, setAmountSearch] = useState('');

  const getDateRange = (filter: string) => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (filter) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thismonth':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'lastmonth':
        start.setMonth(now.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'alltime':
      default:
        return null;
    }
    return { start, end };
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // 1. Fetch distributors under this Super Distributor
      const { data: distributors } = await supabase
        .from('users_profiles')
        .select('id, name, firm_name')
        .eq('super_distributor_id', userId)
        .eq('role', 'distributor');

      const distIds = (distributors || []).map(d => d.id);
      const distMap = new Map((distributors || []).map(d => [d.id, d]));
      setDistributorsList(distributors || []);

      if (distIds.length === 0) {
        setRequests([]);
        setSubUsersList([]);
        return;
      }

      // 2. Fetch users under these distributors
      const { data: subUsers } = await supabase
        .from('users_profiles')
        .select('id, name, firm_name, distributor_id')
        .in('distributor_id', distIds)
        .eq('role', 'user');

      const userIds = (subUsers || []).map(u => u.id);
      setSubUsersList(subUsers || []);

      if (userIds.length === 0) {
        setRequests([]);
        return;
      }

      // 3. Query QR payments
      const range = getDateRange(dateFilter);
      let query = supabase
        .from('payment_submissions')
        .select(`
          *,
          users_profiles!payment_submissions_user_id_fkey(id, name, firm_name, distributor_id),
          qr_history(qr_name)
        `)
        .in('user_id', userIds);

      if (range) {
        query = query
          .gte('created_at', range.start.toISOString())
          .lte('created_at', range.end.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // 4. Map distributor details to the requests
      const processed = (data || []).map(req => {
        const userProfile = req.users_profiles;
        const distId = userProfile?.distributor_id;
        const distInfo = distId ? distMap.get(distId) : null;

        return {
          ...req,
          user_name: userProfile?.name || 'N/A',
          user_firm: userProfile?.firm_name || 'N/A',
          dist_name: distInfo?.name || 'N/A',
          dist_firm: distInfo?.firm_name || 'N/A'
        };
      });

      setRequests(processed);
    } catch (err) {
      console.error('Error fetching QR distributor report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [userId, dateFilter]);

  // Handle distributor selection change and reset user filter
  const handleDistributorChange = (distId: string) => {
    setSelectedDistId(distId);
    setSelectedUserId('');
  };

  // Filter users list based on selected distributor
  const filteredUserOptions = selectedDistId 
    ? subUsersList.filter(u => u.distributor_id === selectedDistId)
    : subUsersList;

  // Convert lists to Option formats for SearchableSelect
  const distributorOptions = distributorsList.map(dist => ({
    value: dist.id,
    label: dist.firm_name || dist.name
  }));

  const userOptions = filteredUserOptions.map(user => ({
    value: user.id,
    label: user.firm_name || user.name
  }));

  // Client-side auto-search filtering for filters
  const filteredRequests = requests.filter(req => {
    const matchesDist = !selectedDistId || req.users_profiles?.distributor_id === selectedDistId;
    const matchesUser = !selectedUserId || req.user_id === selectedUserId;
    
    const matchesUtr = !utrSearch || 
      req.utr_id.toLowerCase().includes(utrSearch.toLowerCase());
    
    const matchesAmount = !amountSearch || 
      req.amount.toString().includes(amountSearch);

    return matchesDist && matchesUser && matchesUtr && matchesAmount;
  });

  // Calculate total approved request amount
  const totalApprovedAmount = filteredRequests
    .filter(req => req.status === 'approved')
    .reduce((sum, req) => sum + (Number(req.amount) || 0), 0);

  const handleReset = () => {
    setDateFilter('today');
    setSelectedDistId('');
    setSelectedUserId('');
    setUtrSearch('');
    setAmountSearch('');
  };

  const exportToExcel = () => {
    const exportData = filteredRequests.map(req => ({
      'Date': new Date(req.created_at).toLocaleDateString(),
      'Time': new Date(req.created_at).toLocaleTimeString(),
      'User / Firm': `${req.user_name} (${req.user_firm})`,
      'Distributor / Firm': `${req.dist_name} (${req.dist_firm})`,
      'UTR ID': req.utr_id,
      'QR Code Used': req.qr_history?.qr_name || 'N/A',
      'Amount (Rs)': Number(req.amount || 0),
      'Profit Share (Rs)': req.status === 'approved' ? Number(req.super_distributor_share || 0) : 0,
      'Status': req.status.toUpperCase()
    }));

    // Add totals row
    const totalFilteredAmount = filteredRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalFilteredProfit = filteredRequests.reduce((sum, r) => sum + (r.status === 'approved' ? Number(r.super_distributor_share || 0) : 0), 0);

    exportData.push({
      'Date': 'TOTAL',
      'Time': '',
      'User / Firm': '',
      'Distributor / Firm': '',
      'UTR ID': '',
      'QR Code Used': '',
      'Amount (Rs)': Number(totalFilteredAmount.toFixed(2)) as any,
      'Profit Share (Rs)': Number(totalFilteredProfit.toFixed(2)) as any,
      'Status': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 12 }, // Time
      { wch: 30 }, // User / Firm
      { wch: 30 }, // Distributor / Firm
      { wch: 20 }, // UTR ID
      { wch: 15 }, // QR Used
      { wch: 15 }, // Amount
      { wch: 15 }, // Profit
      { wch: 12 }  // Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QR Distributor Report");
    XLSX.writeFile(wb, `QR_Distributor_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Distributor Report</h2>
          <p className="text-slate-500 mt-1">QR payment request reports of users under your distributor network.</p>
        </div>
        <button 
          onClick={exportToExcel}
          disabled={filteredRequests.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100 disabled:opacity-50 whitespace-nowrap"
        >
          <FileSpreadsheet size={18} />
          Export Excel
        </button>
      </div>

      {/* Top Stats - Approved Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Approved Requests</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              ₹{totalApprovedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filtered Requests Count</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {filteredRequests.length}
            </p>
          </div>
        </div>
      </div>

      {/* Auto Search Filters Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          
          {/* Date Filter */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date Period</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer appearance-none h-[42px]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="thismonth">This Month</option>
              <option value="lastmonth">Last Month</option>
              <option value="alltime">All Time</option>
            </select>
          </div>

          {/* Distributor Firm Dropdown */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Distributor Firm</label>
            <SearchableSelect
              options={distributorOptions}
              value={selectedDistId}
              onChange={handleDistributorChange}
              placeholder="All Distributors"
              emptyMessage="No distributors found"
            />
          </div>

          {/* User Firm Dropdown */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">User Firm</label>
            <SearchableSelect
              options={userOptions}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="All Users"
              emptyMessage="No users found"
            />
          </div>

          {/* UTR Search */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">UTR ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={utrSearch}
                onChange={(e) => setUtrSearch(e.target.value)}
                placeholder="Search UTR..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all h-[42px]"
              />
            </div>
          </div>

          {/* Amount Search */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="number"
                value={amountSearch}
                onChange={(e) => setAmountSearch(e.target.value)}
                placeholder="Search amount..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all h-[42px]"
              />
            </div>
          </div>

          {/* Reset button */}
          <div className="lg:col-span-1 flex justify-end">
            <button 
              onClick={handleReset}
              className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 h-[42px] w-[42px] flex items-center justify-center shrink-0"
              title="Reset Filters"
            >
              <RotateCcw size={18} />
            </button>
          </div>

        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User / Firm</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distributor / Firm</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">UTR ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">QR Used</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Profit Share</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No requests found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{req.user_name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{req.user_firm}</p>
                      <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(req.created_at).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">{req.dist_name}</p>
                      <p className="text-[10px] text-slate-400">{req.dist_firm}</p>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">{req.utr_id}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                        <QrCode size={14} className="text-emerald-500" />
                        {req.qr_history?.qr_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-900 flex items-center justify-center">
                        <IndianRupee size={14} className="mr-0.5" />
                        {Number(req.amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {req.status === 'approved' ? (
                        <span className="text-sm font-bold text-emerald-600 flex items-center justify-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {Number(req.super_distributor_share || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">---</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {req.status === 'pending' && <Clock size={10} />}
                        {req.status === 'approved' && <CheckCircle2 size={10} />}
                        {req.status === 'rejected' && <XCircle size={10} />}
                        {req.status}
                      </span>
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
