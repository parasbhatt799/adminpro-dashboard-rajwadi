import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  User,
  CreditCard,
  AlertCircle,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface BillSubmission {
  id: string;
  user_id: string;
  customer_mobile: string;
  card_bank: string;
  card_number: string;
  card_owner_name: string;
  amount: number;
  charges: number;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  rejection_reason?: string;
  created_at: string;
  users_profiles: {
    name: string;
    firm_name: string;
  };
}

export default function DistributorBillPayments({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<BillSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bill_submissions')
        .select(`
          *,
          users_profiles!inner(name, firm_name, distributor_id)
        `)
        .eq('users_profiles.distributor_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching distributor bill payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [userId]);

  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = 
      s.customer_mobile.includes(searchQuery) || 
      s.users_profiles.firm_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.card_owner_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Users Bill Payment History</h2>
        <p className="text-slate-500 mt-1">Review bill payment requests submitted by your users.</p>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by customer mobile, firm name..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="refunded">Refund Policy</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />
            <p className="text-sm text-slate-500 font-medium">Loading history...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Receipt className="text-slate-200 mx-auto mb-4" size={48} />
            <p className="text-slate-500 font-medium">No bill payments found</p>
          </div>
        ) : (
          filteredSubmissions.map((req) => (
            <div key={req.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-center">
                {/* Firm / Date */}
                <div className="col-span-1 md:col-span-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{req.users_profiles.firm_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="text-center md:text-left">
                  <p className="text-[11px] font-bold text-slate-900">{req.card_bank}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{req.customer_mobile}</p>
                </div>

                {/* Card Info */}
                <div className="text-center">
                  <p className="text-[11px] font-bold text-slate-900 flex items-center justify-center gap-1.5">
                    <CreditCard size={12} className="text-slate-400" />
                    {req.card_number}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium truncate">{req.card_owner_name}</p>
                </div>

                {/* Amount Details */}
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bill Amount</p>
                  <p className="text-sm font-bold text-slate-900">₹{Number(req.amount).toFixed(2)}</p>
                </div>

                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Debited</p>
                  <p className="text-sm font-bold text-indigo-600">₹{(Number(req.amount) + Number(req.charges || 0)).toFixed(2)}</p>
                </div>

                {/* Status */}
                <div className="flex md:justify-center items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-500' :
                    req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                    req.status === 'refunded' ? 'bg-indigo-50 text-indigo-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {req.status === 'pending' && <Clock size={10} className="inline mr-1" />}
                    {req.status === 'approved' && <CheckCircle2 size={10} className="inline mr-1" />}
                    {req.status === 'rejected' && <XCircle size={10} className="inline mr-1" />}
                    {req.status === 'refunded' && <RotateCcw size={10} className="inline mr-1" />}
                    {req.status === 'refunded' ? 'Refund Policy' : req.status}
                  </span>
                  {req.status === 'rejected' && (
                    <button 
                      onClick={() => setExpandedRowId(expandedRowId === req.id ? null : req.id)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      {expandedRowId === req.id ? 'Hide' : 'View Reason'}
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {expandedRowId === req.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                          <AlertCircle size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Rejection Reason</p>
                          <p className="text-sm font-bold text-slate-900">{req.rejection_reason || 'No reason provided'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setExpandedRowId(null)}
                        className="p-2 bg-white border border-rose-100 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shadow-sm"
                      >
                        <ChevronUp size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
