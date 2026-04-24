import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface DistributorBillPaymentsProps {
  userId: string;
}

export default function DistributorBillPayments({ userId }: DistributorBillPaymentsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // 1. Get IDs of all users belonging to this distributor
      const { data: subUsers } = await supabase
        .from('users_profiles')
        .select('id')
        .eq('distributor_id', userId);
      
      const subUserIds = (subUsers || []).map(u => u.id);

      if (subUserIds.length === 0) {
        setRequests([]);
        return;
      }

      // 2. Fetch their bill submissions
      let query = supabase
        .from('bill_submissions')
        .select('*, users_profiles(name, firm_name)')
        .in('user_id', subUserIds)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching distributor bill history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [userId, statusFilter]);

  const filteredRequests = requests.filter(req => 
    (req.customer_mobile || '').includes(searchTerm) ||
    (req.bill_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.users_profiles?.firm_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users Bill Payment</h2>
          <p className="text-slate-500 mt-1">History of bill payments made by your users.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Mobile, Bill No or Firm Name..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-slate-400 ml-2 hidden md:block" />
          <select 
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">User / Firm</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bill Details</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Amount</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-emerald-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                      <Receipt size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">No bill payments found from your users.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors text-xs">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{req.users_profiles?.firm_name || req.users_profiles?.name}</p>
                      <p className="text-[10px] text-slate-400">Retailer Account</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-700">{req.service_name}</p>
                      <p className="text-slate-400 font-medium">Mob: {req.customer_mobile}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-900 flex items-center justify-center">
                        <IndianRupee size={14} className="mr-0.5" />
                        {Number(req.amount).toLocaleString()}
                      </span>
                      <p className="text-[10px] text-slate-400">Charges: ₹{req.charges}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        req.status === 'refunded' ? 'bg-blue-50 text-blue-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {req.status === 'pending' && <Clock size={10} />}
                        {req.status === 'approved' && <CheckCircle2 size={10} />}
                        {req.status === 'rejected' && <XCircle size={10} />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
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
