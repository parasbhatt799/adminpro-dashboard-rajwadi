import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Wallet, Check, X, Search, Clock, ExternalLink } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { format } from 'date-fns';

export default function B2BAdminFundRequests() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    const cred = req.b2b_api_credentials;
    return (
      req.utr_number?.toLowerCase().includes(term) ||
      cred?.b2b_login_id?.toLowerCase().includes(term) ||
      cred?.first_name?.toLowerCase().includes(term) ||
      cred?.mobile?.includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-600" />
            Fund Load Requests
          </h2>
          <p className="text-slate-600">Approve or reject B2B API agent top-ups.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Agent ID, Name, UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
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
                          <a href={req.proof_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-medium">
                            <ExternalLink className="h-3 w-3" /> View Proof
                          </a>
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
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(req.id, req.agent_id, req.amount, 'reject')}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
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
    </div>
  );
}
