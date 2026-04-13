import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Search,
  Filter,
  IndianRupee,
  Clock,
  User,
  X,
  Download,
  Hash,
  AlertCircle,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface QRPaymentRequest {
  id: string;
  user_id: string;
  utr_id: string;
  amount: number;
  proof_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
  };
}

export default function QRPaymentRequests() {
  const [requests, setRequests] = useState<QRPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionRowId, setRejectionRowId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);
  const [charges, setCharges] = useState('0');
  const [reason, setReason] = useState('');
  const [selectedProof, setSelectedProof] = useState<QRPaymentRequest | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const itemsPerPage = 10;

  const clearFilters = () => {
    setSearchQuery('');
    setFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payment_submissions')
        .select('*, users_profiles(name, firm_name)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching QR requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReasons = async () => {
    try {
      const { data, error } = await supabase
        .from('rejection_reasons')
        .select('*, rejection_categories!inner(show_in_qr)')
        .eq('is_active', true)
        .eq('rejection_categories.show_in_qr', true)
        .order('reason_text');
      if (error) throw error;
      setRejectionReasons(data || []);
    } catch (err) {
      console.error('Error fetching reasons:', err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchReasons();
  }, [filter]);

  const handleStatusUpdate = async (id: string, type: 'approved' | 'rejected', customReason?: string) => {
    const targetId = id;
    const targetType = type;
    const targetReason = customReason || reason;

    if (!targetId) return;
    
    setProcessingId(targetId);
    try {
      // 1. Fetch user profile for charge percentage and current balance
      const { data: userData, error: userFetchError } = await supabase
        .from('users_profiles')
        .select('charge_percentage, wallet_balance')
        .eq('id', requests.find(r => r.id === targetId)?.user_id)
        .single();
      
      if (userFetchError) throw userFetchError;

      const updateData: any = { status: targetType };
      const amount = requests.find(r => r.id === targetId)?.amount || 0;

      if (targetType === 'approved') {
        const percentage = Number(userData.charge_percentage) || 0;
        const calculatedCharges = (amount * percentage) / 100;
        updateData.charges = calculatedCharges;

        // Update Admin Wallet (qr_settings.admin_balance)
        const { data: qrSettings } = await supabase.from('qr_settings').select('admin_balance').eq('id', 1).single();
        const currentAdminBalance = Number(qrSettings?.admin_balance) || 0;
        
        await supabase
          .from('qr_settings')
          .update({ admin_balance: currentAdminBalance + calculatedCharges })
          .eq('id', 1);

        // Update User Wallet (Add back amount - charges)
        const currentUserBalance = Number(userData.wallet_balance) || 0;
        await supabase
          .from('users_profiles')
          .update({ wallet_balance: currentUserBalance + (amount - calculatedCharges) })
          .eq('id', requests.find(r => r.id === targetId)?.user_id);

      } else {
        updateData.rejection_reason = targetReason;
        // No wallet update needed for rejection as no deduction happened on submission
      }

      const { error } = await supabase
        .from('payment_submissions')
        .update(updateData)
        .eq('id', targetId);

      if (error) throw error;
      setRequests(prev => prev.map(req => req.id === targetId ? { ...req, ...updateData } : req));
      setRejectionRowId(null);
      setCharges('0');
      setReason('');
      if (selectedProof?.id === targetId) setSelectedProof(null);
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.utr_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.users_profiles?.firm_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const reqDate = new Date(req.created_at);
    reqDate.setHours(0, 0, 0, 0);
    
    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(0, 0, 0, 0);
    
    const matchesStartDate = !start || reqDate >= start;
    const matchesEndDate = !end || reqDate <= end;
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter, startDate, endDate]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Payment Requests</h2>
          <p className="text-slate-500 mt-1">Review and approve user QR payment submissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Start</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none bg-transparent"
              />
            </div>
            <div className="w-px h-6 bg-slate-100 mx-1"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">End</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none bg-transparent"
              />
            </div>
          </div>
          <button 
            onClick={clearFilters}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white"
            title="Clear All Filters"
          >
            <RotateCcw size={18} />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search Firm or UTR..."
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
            <option value="all">All Status</option>
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
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Firm / Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">UTR ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Service Charge</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Credited Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Proof</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status / Reason</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />
                    <p className="text-sm text-slate-500 font-medium">Loading requests...</p>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <QrCode className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No payment requests found</p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr 
                      onClick={() => {
                        if (req.status === 'rejected') {
                          setRejectionRowId(rejectionRowId === req.id ? null : req.id);
                        }
                      }}
                      className={`hover:bg-slate-50/50 transition-colors ${rejectionRowId === req.id ? 'bg-rose-50/30' : ''} ${req.status === 'rejected' ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {req.users_profiles?.firm_name || req.users_profiles?.name || `User #${req.user_id.slice(0, 8)}`}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              {new Date(req.created_at).toLocaleDateString()} • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                          {req.utr_id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900 flex items-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {req.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-indigo-600 flex items-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {(req as any).charges || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-emerald-600 flex items-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {(Number(req.amount) - Number((req as any).charges || 0)).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedProof(req)}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors group"
                        >
                          View Proof
                          <ExternalLink size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                            req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {req.status === 'pending' && <Clock size={10} />}
                            {req.status === 'approved' && <CheckCircle2 size={10} />}
                            {req.status === 'rejected' && <XCircle size={10} />}
                            {req.status}
                          </span>
                          {req.status === 'rejected' && (req as any).rejection_reason && (
                            <div className="flex flex-col gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectionRowId(rejectionRowId === req.id ? null : req.id);
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 text-left"
                              >
                                {rejectionRowId === req.id ? 'Hide Reason' : 'View Reason'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setRejectionRowId(rejectionRowId === req.id ? null : req.id)}
                              disabled={processingId === req.id}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${rejectionRowId === req.id ? 'bg-rose-100 text-rose-600' : 'text-rose-500 hover:bg-rose-50'}`}
                              title="Reject"
                            >
                              <XCircle size={20} />
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(req.id, 'approved')}
                              disabled={processingId === req.id}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {rejectionRowId === req.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-rose-50/30 border-y border-rose-100/50">
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col md:flex-row items-end gap-4"
                          >
                            {req.status === 'pending' ? (
                              <>
                                <div className="flex-1 w-full">
                                  <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Select Rejection Reason</label>
                                  <div className="flex gap-2">
                                    <select 
                                      value={reason}
                                      onChange={(e) => setReason(e.target.value)}
                                      className="flex-1 px-4 py-2.5 bg-white border border-rose-100 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                    >
                                      <option value="">-- Choose a reason --</option>
                                      {rejectionReasons.map(r => (
                                        <option key={r.id} value={r.reason_text}>{r.reason_text}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                      setRejectionRowId(null);
                                      setReason('');
                                    }}
                                    className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleStatusUpdate(req.id, 'rejected')}
                                    disabled={!reason || processingId === req.id}
                                    className="px-6 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {processingId === req.id ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                                    Confirm Rejection
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                                    <AlertCircle size={20} />
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Rejection Reason</p>
                                    <p className="text-sm font-bold text-slate-900">{(req as any).rejection_reason || 'No reason provided'}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => setRejectionRowId(null)}
                                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                                  title="Shrink"
                                >
                                  <ChevronUp size={16} />
                                </button>
                              </div>
                            )}
                          </motion.div>
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

      {/* Pagination */}
      {!loading && filteredRequests.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <p className="text-sm text-slate-500 font-medium">
            Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</span> of <span className="text-slate-900 font-bold">{filteredRequests.length}</span> requests
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                    currentPage === i + 1 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Proof Preview Modal */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => {
                    setSelectedProof(null);
                    setReason('');
                  }}
                  className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 bg-slate-50 flex items-center justify-center overflow-hidden p-2 md:p-4">
                <img 
                  src={selectedProof.proof_url} 
                  alt="Payment Proof" 
                  className="max-w-full max-h-[calc(95vh-200px)] object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-6 bg-white border-t border-slate-100 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                      <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <Hash size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verification UTR</p>
                        <p className="text-sm font-bold text-slate-900">{selectedProof.utr_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                        <IndianRupee size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Amount</p>
                        <p className="text-sm font-bold text-emerald-900">₹{selectedProof.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={async () => {
                        try {
                          const response = await fetch(selectedProof.proof_url);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `proof-${selectedProof.utr_id}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error('Download failed:', err);
                          window.open(selectedProof.proof_url, '_blank');
                        }
                      }}
                      className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shadow-sm"
                      title="Download Proof"
                    >
                      <Download size={20} />
                    </button>
                    
                    {selectedProof.status === 'pending' && (
                      <div className="flex items-center gap-3 border-l border-slate-100 pl-3">
                        <div className="flex flex-col gap-1 min-w-[200px]">
                          <select 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                          >
                            <option value="">-- Rejection Reason --</option>
                            {rejectionReasons.map(r => (
                              <option key={r.id} value={r.reason_text}>{r.reason_text}</option>
                            ))}
                          </select>
                        </div>
                        <button 
                          onClick={() => handleStatusUpdate(selectedProof.id, 'rejected')}
                          disabled={!reason || processingId === selectedProof.id}
                          className="px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center gap-2 disabled:opacity-50"
                        >
                          {processingId === selectedProof.id ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                          Reject
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(selectedProof.id, 'approved')}
                          disabled={processingId === selectedProof.id}
                          className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
                        >
                          {processingId === selectedProof.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
