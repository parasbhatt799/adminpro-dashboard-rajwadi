import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Wallet, Check, X, Search, Clock, ExternalLink, Calendar, CheckCircle2, XCircle, Eye } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';
import { format } from 'date-fns';

export default function B2BAdminFundRequests() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedProofReq, setSelectedProofReq] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('b2b_fund_requests')
        .select(`
          *,
          b2b_api_credentials(first_name, last_name, b2b_login_id, mobile, wallet_balance)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load fund requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, agentId: string, amount: number, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this fund request of ₹${amount}?`)) return;

    try {
      if (action === 'approve') {
        // Atomic balance update
        const { data: success, error: rpcError } = await supabase.rpc('add_b2b_wallet_balance', {
          p_agent_id: agentId,
          p_amount: amount
        });

        if (rpcError || !success) throw rpcError || new Error('Failed to update balance');
        
        await supabase.from('b2b_fund_requests').update({ status: 'approved' }).eq('id', requestId);
        toast.success('Request approved and balance added');
      } else {
        await supabase.from('b2b_fund_requests').update({ status: 'rejected' }).eq('id', requestId);
        toast.success('Request rejected');
      }
      
      fetchRequests();
    } catch (err) {
      console.error('Error processing request:', err);
      toast.error('Failed to process request');
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
      return createdDate >= sevenDaysAgo;
    }
    
    if (filter === '30days') {
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate >= thirtyDaysAgo;
    }
    
    if (filter === 'thisMonth') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdDate >= firstDayOfMonth;
    }

    if (filter === 'custom') {
      if (!customRange.start && !customRange.end) return true;
      const start = customRange.start ? new Date(`${customRange.start}T00:00:00`) : new Date(0);
      const end = customRange.end ? new Date(`${customRange.end}T23:59:59.999`) : new Date();
      return createdDate >= start && createdDate <= end;
    }
    
    return true;
  };

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    const cred = req.b2b_api_credentials;
    const matchesSearch = (
      req.utr_number?.toLowerCase().includes(term) ||
      cred?.b2b_login_id?.toLowerCase().includes(term) ||
      cred?.first_name?.toLowerCase().includes(term) ||
      cred?.mobile?.includes(term)
    );

    const matchesDate = checkDateFilter(req.created_at, dateFilter);

    return matchesSearch && matchesDate;
  });

  // Calculate summary metrics
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-600" />
            Fund Load Requests
          </h2>
          <p className="text-slate-600">Approve or reject B2B API agent top-ups.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved Card */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Approved Amount</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            ₹ {stats.approvedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Approved Count</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {stats.approvedCount} Requests
            </span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Amount</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            ₹ {stats.pendingAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Pending Count</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              {stats.pendingCount} Requests
            </span>
          </div>
        </div>

        {/* Rejected Card */}
        <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-red-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Rejected Amount</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            ₹ {stats.rejectedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Rejected Count</span>
            <span className="font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
              {stats.rejectedCount} Requests
            </span>
          </div>
        </div>

        {/* Total Volume Card */}
        <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Total Requested</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            ₹ {stats.totalAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Total Requests</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              {stats.totalCount} Requests
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Agent ID, Name, UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Date Range Dropdown Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full sm:w-auto border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-medium text-slate-700 cursor-pointer"
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Custom Date Range Inputs */}
          {dateFilter === 'custom' && (
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-200">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">From Date</label>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">To Date</label>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8">
              <LoadingSpinner />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              No fund requests found.
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">UTR Details</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                          <Wallet className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {req.b2b_api_credentials?.first_name} {req.b2b_api_credentials?.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{req.b2b_api_credentials?.b2b_login_id}</div>
                          <div className="text-xs text-emerald-600 font-medium">Bal: ₹{req.b2b_api_credentials?.wallet_balance?.toFixed(2)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 text-base">₹{req.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
                        {req.utr_number}
                      </div>
                      {req.proof_url && (
                        <div className="mt-1">
                          <button
                            onClick={() => setSelectedProofReq(req)}
                            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Proof
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(req.id, req.agent_id, req.amount, 'approve')}
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(req.id, req.agent_id, req.amount, 'reject')}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Proof & Fund Request Detail Modal */}
      {selectedProofReq && (
        <Modal
          isOpen={!!selectedProofReq}
          onClose={() => setSelectedProofReq(null)}
          title="Payment Proof & Request Details"
          size="2xl"
        >
          <div className="space-y-6">
            {/* Details Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase block">Agent Name</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {selectedProofReq.b2b_api_credentials?.first_name} {selectedProofReq.b2b_api_credentials?.last_name}
                </span>
                <span className="block text-[11px] text-slate-500 font-mono mt-0.5">{selectedProofReq.b2b_api_credentials?.b2b_login_id}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase block">Requested Amount</span>
                <span className="font-bold text-indigo-600 text-base block mt-0.5">₹{Number(selectedProofReq.amount).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase block">UTR Number</span>
                <span className="font-bold font-mono text-slate-800 text-xs bg-white px-2 py-1 rounded border border-slate-200 inline-block mt-1">
                  {selectedProofReq.utr_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase block">Status</span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full inline-block mt-1 ${
                  selectedProofReq.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                  selectedProofReq.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-300' :
                  'bg-amber-100 text-amber-700 border border-amber-300'
                }`}>
                  {selectedProofReq.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Proof Preview Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Screenshot / Receipt</span>
                {selectedProofReq.proof_url && (
                  <a
                    href={selectedProofReq.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Full Image
                  </a>
                )}
              </div>
              
              <div className="bg-slate-900 rounded-2xl p-3 border border-slate-700 flex items-center justify-center min-h-[250px] max-h-[450px] overflow-hidden">
                {selectedProofReq.proof_url ? (
                  <img
                    src={selectedProofReq.proof_url}
                    alt="Payment Proof"
                    className="max-h-[420px] w-auto object-contain rounded-xl shadow-lg"
                  />
                ) : (
                  <div className="text-slate-400 text-sm py-12">No proof image uploaded for this request</div>
                )}
              </div>
            </div>

            {/* Bottom Actions inside Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 font-medium">
                Requested On: {format(new Date(selectedProofReq.created_at), 'dd MMM yyyy, hh:mm a')}
              </div>

              <div className="flex items-center gap-3">
                {selectedProofReq.status === 'pending' ? (
                  <>
                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        await handleAction(selectedProofReq.id, selectedProofReq.agent_id, selectedProofReq.amount, 'reject');
                        setActionLoading(false);
                        setSelectedProofReq(null);
                      }}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <X className="w-4 h-4" /> Reject Request
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        await handleAction(selectedProofReq.id, selectedProofReq.agent_id, selectedProofReq.amount, 'approve');
                        setActionLoading(false);
                        setSelectedProofReq(null);
                      }}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Check className="w-4 h-4" /> Approve & Credit Balance
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedProofReq(null)}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
