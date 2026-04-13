import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search,
  User,
  FileText,
  Eye,
  X,
  AlertCircle,
  Clock,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface KYCSubmission {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string;
  aadhaar_front_url: string;
  aadhaar_back_url: string;
  pan_card_url: string;
  cheque_photo_url: string;
  selfie_url: string;
  firm_photo_url: string;
  created_at: string;
  users_profiles: {
    name: string;
    mobile_number: string;
    email: string;
  };
}

export default function KYCVerificationRequests() {
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('kyc_submissions')
        .select('*, users_profiles(name, mobile_number, email)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching KYC submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const handleStatusUpdate = async (submissionId: string, userId: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(submissionId);
    try {
      // 1. Update submission status
      const { error: subError } = await supabase
        .from('kyc_submissions')
        .update({ 
          status: newStatus,
          rejection_reason: newStatus === 'rejected' ? rejectionReason : null
        })
        .eq('id', submissionId);

      if (subError) throw subError;

      // 2. Update user profile status
      const { error: profileError } = await supabase
        .from('users_profiles')
        .update({ 
          kyc_status: newStatus === 'approved' ? 'verified' : 'rejected',
          kyc_rejection_reason: newStatus === 'rejected' ? rejectionReason : null
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: newStatus, rejection_reason: rejectionReason } : s));
      setShowRejectModal(null);
      setRejectionReason('');
      if (selectedSubmission?.id === submissionId) setSelectedSubmission(null);
    } catch (err) {
      console.error('Error updating KYC status:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSubmissions = submissions.filter(s => 
    s.users_profiles?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.users_profiles?.mobile_number.includes(searchQuery)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">KYC Verification Requests</h2>
          <p className="text-slate-500 mt-1">Review and verify user identity documents.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or mobile..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={filter}
            onChange={(e: any) => setFilter(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
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
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">User Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Submitted Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />
                    <p className="text-sm text-slate-500 font-medium">Loading submissions...</p>
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <ShieldCheck className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No KYC requests found</p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{sub.users_profiles?.name}</p>
                          <p className="text-xs text-slate-500">{sub.users_profiles?.mobile_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        {new Date(sub.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sub.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        sub.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setSelectedSubmission(sub)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Documents"
                        >
                          <Eye size={20} />
                        </button>
                        {sub.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleStatusUpdate(sub.id, sub.user_id, 'approved')}
                              disabled={processingId === sub.id}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                            <button 
                              onClick={() => setShowRejectModal(sub.id)}
                              disabled={processingId === sub.id}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle size={20} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-5xl my-8 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">KYC Documents: {selectedSubmission.users_profiles?.name}</h3>
                  <p className="text-sm text-slate-500">Review all uploaded files carefully</p>
                </div>
                <button onClick={() => setSelectedSubmission(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[
                    { label: 'Aadhaar Front', url: selectedSubmission.aadhaar_front_url },
                    { label: 'Aadhaar Back', url: selectedSubmission.aadhaar_back_url },
                    { label: 'PAN Card', url: selectedSubmission.pan_card_url },
                    { label: 'Blank Cheque', url: selectedSubmission.cheque_photo_url },
                    { label: 'User Selfie', url: selectedSubmission.selfie_url },
                    { label: 'Firm Photo', url: selectedSubmission.firm_photo_url }
                  ].map((doc, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{doc.label}</span>
                        <a href={doc.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs font-bold flex items-center gap-1">
                          <Download size={12} /> Full View
                        </a>
                      </div>
                      <div className="aspect-video rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 group relative">
                        <img src={doc.url} alt={doc.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSubmission.status === 'pending' && (
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
                  <button 
                    onClick={() => setShowRejectModal(selectedSubmission.id)}
                    className="px-8 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold hover:bg-rose-50 transition-all"
                  >
                    Reject KYC
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate(selectedSubmission.id, selectedSubmission.user_id, 'approved')}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    Approve KYC
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Reject KYC Verification</h3>
              <p className="text-slate-500 text-center mb-6 text-sm">Please provide a reason for rejection. This will be shown to the user.</p>
              
              <textarea 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-rose-500/20 outline-none min-h-[120px]"
                placeholder="e.g. Aadhaar card photo is blurry..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />

              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const sub = submissions.find(s => s.id === showRejectModal);
                    if (sub) handleStatusUpdate(sub.id, sub.user_id, 'rejected');
                  }}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
