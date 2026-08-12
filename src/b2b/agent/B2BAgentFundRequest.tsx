import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Upload, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Filter, Search, Hash, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { sendAdminPushNotification } from '../../lib/notifications';
import { format } from 'date-fns';

export default function B2BAgentFundRequest() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingRequests, setFetchingRequests] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>('B2B Agent');

  // Filter States
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    amount: '',
    utrNumber: '',
    proofUrl: ''
  });
  
  useEffect(() => {
    const id = localStorage.getItem('b2bAgentId');
    if (id) {
      setAgentId(id);
      fetchRequests(id);

      const channel = supabase
        .channel(`b2b_agent_fund_requests_${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'b2b_fund_requests', filter: `agent_id=eq.${id}` },
          () => {
            fetchRequests(id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const fetchRequests = async (id: string) => {
    setFetchingRequests(true);
    try {
      let allReqs: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      let safetyCounter = 0;

      while (hasMore && safetyCounter < 100) {
        safetyCounter++;
        const reqRes = await supabase
          .from('b2b_fund_requests')
          .select('*')
          .eq('agent_id', id)
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (reqRes.error) throw reqRes.error;
        if (reqRes.data && reqRes.data.length > 0) {
          allReqs = allReqs.concat(reqRes.data);
          if (reqRes.data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      setRequests(allReqs);

      const agentRes = await supabase
        .from('b2b_api_credentials')
        .select('client_id, company_name, name')
        .eq('id', id)
        .maybeSingle();

      if (agentRes.data) {
        setAgentName(agentRes.data.company_name || agentRes.data.name || agentRes.data.client_id || 'B2B Agent');
      }
    } catch (err) {
      console.error('Error fetching fund requests:', err);
      toast.error('Failed to load request history');
    } finally {
      setFetchingRequests(false);
    }
  };

  const checkDateFilter = (createdAtStr: string, filter: string) => {
    if (filter === 'all') return true;
    
    const createdDate = new Date(createdAtStr);
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    if (filter === 'today') {
      return createdDate >= todayStart && createdDate <= todayEnd;
    }
    
    if (filter === 'yesterday') {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      return createdDate >= yesterdayStart && createdDate <= yesterdayEnd;
    }
    
    if (filter === '7days') {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return createdDate >= sevenDaysAgo && createdDate <= todayEnd;
    }
    
    if (filter === '30days') {
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate >= thirtyDaysAgo && createdDate <= todayEnd;
    }
    
    if (filter === 'thisMonth') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdDate >= firstDayOfMonth && createdDate <= todayEnd;
    }

    if (filter === 'custom') {
      if (!customRange.start && !customRange.end) return true;
      const start = customRange.start ? new Date(`${customRange.start}T00:00:00`) : new Date(0);
      const end = customRange.end ? new Date(`${customRange.end}T23:59:59.999`) : new Date();
      return createdDate >= start && createdDate <= end;
    }
    
    return true;
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Date Filter
      const matchesDate = checkDateFilter(req.created_at, dateFilter);

      // Status Filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = req.status === statusFilter;
      }

      // Search Filter (UTR or Amount)
      let matchesSearch = true;
      const searchTrim = searchTerm.trim().toLowerCase();
      if (searchTrim) {
        const utrStr = (req.utr_number || '').toLowerCase();
        const amtStr = String(req.amount || '');
        matchesSearch = utrStr.includes(searchTrim) || amtStr.includes(searchTrim);
      }

      return matchesDate && matchesStatus && matchesSearch;
    });
  }, [requests, dateFilter, customRange, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    let approvedCount = 0;
    let approvedAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let rejectedCount = 0;
    let rejectedAmount = 0;

    filteredRequests.forEach(req => {
      const amt = Number(req.amount || 0);
      if (req.status === 'approved') {
        approvedCount++;
        approvedAmount += amt;
      } else if (req.status === 'pending') {
        pendingCount++;
        pendingAmount += amt;
      } else if (req.status === 'rejected') {
        rejectedCount++;
        rejectedAmount += amt;
      }
    });

    const totalCount = filteredRequests.length;
    const totalAmount = approvedAmount + pendingAmount + rejectedAmount;

    return {
      approvedCount,
      approvedAmount,
      pendingCount,
      pendingAmount,
      rejectedCount,
      rejectedAmount,
      totalCount,
      totalAmount
    };
  }, [filteredRequests]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    try {
      setLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `b2b-proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('b2b_proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('b2b_proofs')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, proofUrl: publicUrl }));
      toast.success('Screenshot uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload screenshot');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) return;

    if (!formData.amount || !formData.utrNumber || !formData.proofUrl) {
      toast.error('Please fill all fields and upload payment proof');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('b2b_fund_requests')
        .insert({
          agent_id: agentId,
          amount: parseFloat(formData.amount),
          utr_number: formData.utrNumber,
          proof_url: formData.proofUrl,
          status: 'pending'
        });

      if (error) throw error;

      // 🔔 Send OneSignal Push Notification to Admins
      sendAdminPushNotification(
        '💰 New B2B Fund Request',
        `${agentName} requested wallet top-up of ₹${formData.amount} (UTR: ${formData.utrNumber})`,
        '/b2b/admin/fund-requests'
      );

      toast.success('Fund request submitted successfully');
      setFormData({ amount: '', utrNumber: '', proofUrl: '' });
      if (agentId) fetchRequests(agentId);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-400" />
            Fund Request
          </h2>
          <p className="text-slate-400 text-sm">Request wallet top-up by providing transfer details and view status history.</p>
        </div>
        {agentId && (
          <button
            onClick={() => fetchRequests(agentId)}
            className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-medium transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </div>

      {/* Top Summary Cards (Success, Pending, Fail, Total) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved / Success Card */}
        <div className="bg-slate-800/90 border border-emerald-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Success / Approved</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.approvedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Approved Count</span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {stats.approvedCount} Requests
            </span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-slate-800/90 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Requests</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Pending Count</span>
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {stats.pendingCount} Requests
            </span>
          </div>
        </div>

        {/* Fail / Rejected Card */}
        <div className="bg-slate-800/90 border border-rose-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Fail / Rejected</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.rejectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Rejected Count</span>
            <span className="font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              {stats.rejectedCount} Requests
            </span>
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-slate-800/90 border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Requested</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight mb-1">
            ₹ {stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Total Requests</span>
            <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {stats.totalCount} Requests
            </span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-700 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Date Filter Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer outline-none"
            >
              <option value="all">All Status</option>
              <option value="approved">Success / Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Fail / Rejected</option>
            </select>
          </div>

          {/* Search Filter (UTR or Amount) */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              Search UTR / Amount
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search UTR Number or Amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Range Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/80 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase block">From Date</label>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase block">To Date</label>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Request Form */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
              <Wallet className="h-5 w-5 text-indigo-400" />
              New Top-up Request
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  UTR / Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.utrNumber}
                  onChange={e => setFormData({ ...formData, utrNumber: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter 12-digit UTR"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Payment Screenshot
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-700 border-dashed rounded-xl bg-slate-900/50 hover:bg-slate-900 transition-colors">
                  <div className="space-y-1 text-center">
                    {formData.proofUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                        <span className="text-sm text-emerald-400 font-medium">Screenshot Uploaded</span>
                        <img src={formData.proofUrl} alt="Proof" className="h-20 w-auto rounded mt-2 opacity-80" />
                        <button type="button" onClick={() => setFormData({ ...formData, proofUrl: '' })} className="text-xs text-red-400 hover:text-red-300 mt-2">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                        <div className="flex text-sm text-slate-400 justify-center">
                          <label className="relative cursor-pointer rounded-md font-medium text-indigo-400 hover:text-indigo-300">
                            <span>Upload a file</span>
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={handleFileUpload}
                              disabled={loading}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-slate-500">PNG, JPG up to 2MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20 flex gap-3 mt-4">
                <AlertCircle className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                <p className="text-xs text-indigo-200/70">
                  Requests are usually processed within 15-30 minutes during business hours.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !formData.amount || !formData.utrNumber || !formData.proofUrl}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                   <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Processing</span>
                ) : (
                  'Submit Request'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Request History */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-400" />
                Request History
              </h3>
              <span className="text-xs font-semibold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                Showing {filteredRequests.length} of {requests.length}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date & Time</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">UTR Number</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {fetchingRequests ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                        Loading requests...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400 flex flex-col items-center">
                        <Wallet className="h-8 w-8 mb-2 opacity-50" />
                        No fund requests found matching your filters
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4 text-slate-300">
                          {format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-white">₹{req.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400 font-mono text-xs bg-slate-900 px-2 py-1 rounded">
                            {req.utr_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(req.status)}
                            <span className={`capitalize font-medium ${
                              req.status === 'approved' ? 'text-emerald-400' : 
                              req.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
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

      </div>
    </div>
  );
}

