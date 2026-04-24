import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search, 
  IndianRupee, 
  Clock, 
  User, 
  Building2, 
  Hash,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  ChevronUp,
  Eye,
  Copy,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function AdminDistributorWithdrawals() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionRowId, setRejectionRowId] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingRequest, setViewingRequest] = useState<any>(null);
  const itemsPerPage = 10;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('distributor_withdrawals')
        .select('*, users_profiles(name, firm_name, commission_balance)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching withdrawal requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Real-time subscription
    const channel = supabase
      .channel('admin_distributor_withdrawals')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'distributor_withdrawals' 
      }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const handleStatusUpdate = async (id: string, type: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const req = requests.find(r => r.id === id);
      if (!req) throw new Error('Request not found');

      if (type === 'approved') {
        // 1. Deduct from commission_balance
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('commission_balance')
          .eq('id', req.distributor_id)
          .single();
        
        const currentBalance = Number(profile?.commission_balance) || 0;
        if (currentBalance < req.amount) {
          throw new Error('Distributor has insufficient balance now.');
        }

        const { error: balanceError } = await supabase
          .from('users_profiles')
          .update({ commission_balance: currentBalance - req.amount })
          .eq('id', req.distributor_id);

        if (balanceError) throw balanceError;
      }

      // 2. Update status
      const { error: statusError } = await supabase
        .from('distributor_withdrawals')
        .update({ 
          status: type,
          remark: type === 'rejected' ? remark : 'Withdrawal processed successfully'
        })
        .eq('id', id);

      if (statusError) throw statusError;

      // 3. Notify Distributor
      await supabase.from('notifications').insert([{
        user_id: req.distributor_id,
        target_role: 'user',
        title: `Withdrawal ${type === 'approved' ? 'Approved' : 'Rejected'}`,
        message: type === 'approved' 
          ? `Your withdrawal of ₹${req.amount.toLocaleString()} has been approved and processed!`
          : `Your withdrawal of ₹${req.amount.toLocaleString()} was rejected. Reason: ${remark}`,
        link: '/user/withdrawal'
      }]);

      setRejectionRowId(null);
      setRemark('');
      fetchRequests();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(err.message || 'Failed to update status');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      (req.users_profiles?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.users_profiles?.firm_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.bank_details?.bankName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Distributor Withdrawals</h2>
          <p className="text-slate-500 mt-1">Review and approve commission payout requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchRequests}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 bg-white"
            title="Refresh"
          >
            <RotateCcw size={18} />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search Dist. or Bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-64"
            />
          </div>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distributor</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Amount</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Wallet Balance</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bank Details</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />
                    <p className="text-sm text-slate-500 font-medium">Loading requests...</p>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Wallet className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No withdrawal requests found</p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{req.users_profiles?.firm_name || req.users_profiles?.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className="text-lg font-black text-slate-900 flex items-center justify-center gap-1">
                          <IndianRupee size={16} className="text-slate-400" />
                          {req.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className="text-xs font-bold text-emerald-600">
                          ₹{(req.users_profiles?.commission_balance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => setViewingRequest(req)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                          >
                            <Eye size={12} />
                            View Detail
                          </button>
                          <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{req.bank_details?.bankName}</p>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
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
                      <td className="px-8 py-4 text-right">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setRejectionRowId(rejectionRowId === req.id ? null : req.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                              title="Reject"
                            >
                              <XCircle size={20} />
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(req.id, 'approved')}
                              disabled={processingId === req.id}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {rejectionRowId === req.id && (
                      <tr className="bg-rose-50/30">
                        <td colSpan={6} className="px-8 py-4 border-y border-rose-100/50">
                          <div className="flex items-end gap-4">
                            <div className="flex-1">
                              <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 ml-1">Rejection Remark</label>
                              <input 
                                type="text"
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                placeholder="Enter reason for rejection..."
                                className="w-full bg-white border border-rose-100 rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                              />
                            </div>
                            <button 
                              onClick={() => handleStatusUpdate(req.id, 'rejected')}
                              disabled={!remark || processingId === req.id}
                              className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
                            >
                              {processingId === req.id ? <Loader2 className="animate-spin" size={18} /> : 'Confirm Rejection'}
                            </button>
                            <button 
                              onClick={() => setRejectionRowId(null)}
                              className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"
                            >
                              <ChevronUp size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AnimatePresence>
        {viewingRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingRequest(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-none">Bank Details</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Payout Information</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingRequest(null)}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank Name</p>
                    <p className="text-sm font-bold text-slate-900">{viewingRequest.bank_details?.bankName}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Holder</p>
                    <p className="text-sm font-bold text-slate-900">{viewingRequest.bank_details?.accountHolder}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Number</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono font-bold text-indigo-600">{viewingRequest.bank_details?.accountNumber}</p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(viewingRequest.bank_details?.accountNumber);
                          alert('Copied!');
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IFSC Code</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono font-bold text-slate-900">{viewingRequest.bank_details?.ifscCode}</p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(viewingRequest.bank_details?.ifscCode);
                          alert('Copied!');
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const text = `Bank: ${viewingRequest.bank_details?.bankName}\nHolder: ${viewingRequest.bank_details?.accountHolder}\nAcc: ${viewingRequest.bank_details?.accountNumber}\nIFSC: ${viewingRequest.bank_details?.ifscCode}`;
                    navigator.clipboard.writeText(text);
                    alert('All details copied!');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Copy size={18} />
                  Copy All Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
