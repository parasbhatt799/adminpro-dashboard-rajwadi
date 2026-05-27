import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface DistributorQRRequestsProps {
  userId: string;
}

export default function DistributorQRRequests({ userId }: DistributorQRRequestsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProof, setSelectedProof] = useState<any>(null);

  const [currentUserRole, setCurrentUserRole] = useState<string>('distributor');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // 0. Get user role
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      const role = profile?.role || 'distributor';
      setCurrentUserRole(role);

      let subUserIds: string[] = [];

      if (role === 'super_distributor') {
        // Get all distributors under this super distributor
        const { data: distributors } = await supabase
          .from('users_profiles')
          .select('id')
          .eq('super_distributor_id', userId)
          .eq('role', 'distributor');

        const distIds = (distributors || []).map(d => d.id);
        if (distIds.length > 0) {
          // Get all users under those distributors
          const { data: subUsers } = await supabase
            .from('users_profiles')
            .select('id')
            .in('distributor_id', distIds);
          subUserIds = (subUsers || []).map(u => u.id);
        }
      } else {
        // Get all users under this distributor
        const { data: subUsers } = await supabase
          .from('users_profiles')
          .select('id')
          .eq('distributor_id', userId);
        subUserIds = (subUsers || []).map(u => u.id);
      }

      if (subUserIds.length === 0) {
        setRequests([]);
        return;
      }

      // 2. Fetch their payment submissions
      let query = supabase
        .from('payment_submissions')
        .select('*, users_profiles!payment_submissions_user_id_fkey(name, firm_name, charge_percentage, admin_base_qr_charge), qr_history(qr_name)')
        .in('user_id', subUserIds)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching distributor QR history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [userId]);

  const filteredRequests = requests.filter(req =>
    req.utr_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.users_profiles?.firm_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = () => {
    const isSD = currentUserRole === 'super_distributor';
    const exportData = filteredRequests.map(req => ({
      'Date': new Date(req.created_at).toLocaleDateString(),
      'Time': new Date(req.created_at).toLocaleTimeString(),
      'Firm Name': req.users_profiles?.firm_name || req.users_profiles?.name || 'N/A',
      'UTR ID': req.utr_id,
      'QR Used': req.qr_history?.qr_name || 'N/A',
      'Amount': Number(req.amount || 0),
      'My Profit': Number((isSD ? req.super_distributor_share : req.distributor_share) || 0),
      'Status': req.status.toUpperCase()
    }));

    // Add totals row
    const totalAmount = filteredRequests.reduce((acc, req) => acc + (Number(req.amount) || 0), 0);
    const totalProfit = filteredRequests.reduce((acc, req) => acc + (Number(isSD ? req.super_distributor_share : req.distributor_share) || 0), 0);

    exportData.push({
      'Date': 'TOTAL',
      'Time': '',
      'Firm Name': '',
      'UTR ID': '',
      'QR Used': '',
      'Amount': Number(totalAmount.toFixed(2)) as any,
      'My Profit': Number(totalProfit.toFixed(2)) as any,
      'Status': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for a perfect layout
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 12 }, // Time
      { wch: 25 }, // Firm Name
      { wch: 20 }, // UTR ID
      { wch: 15 }, // QR Used
      { wch: 15 }, // Amount
      { wch: 15 }, // My Profit
      { wch: 12 }  // Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QR_Requests");
    XLSX.writeFile(wb, `My_Users_QR_Requests_${new Date().toLocaleDateString()}.xlsx`);
  };

  const isSD = currentUserRole === 'super_distributor';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{isSD ? 'Distributors QR Requests' : 'Users QR Requests'}</h2>
          <p className="text-slate-500 mt-1">{isSD ? 'History of QR payments made by distributors under your network.' : 'History of QR payments made by your users.'}</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100 whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Export Excel
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by UTR or Firm Name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">User / Firm</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">UTR ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Amount</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">My Profit</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Proof</th>
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
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    {isSD ? 'No QR requests found from your distributor network.' : 'No QR requests found from your users.'}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{req.users_profiles?.firm_name || req.users_profiles?.name}</p>
                      <p className="text-[10px] text-slate-400">{new Date(req.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{req.utr_id}</code>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-900 flex items-center justify-center">
                        <IndianRupee size={14} className="mr-0.5" />
                        {req.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {req.status === 'approved' ? (
                        <span className="text-sm font-bold text-emerald-600 flex items-center justify-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {Number(isSD ? (req.super_distributor_share || 0) : (req.distributor_share || 0)).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">---</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                          req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                            'bg-amber-50 text-amber-600'
                        }`}>
                        {req.status === 'pending' && <Clock size={10} />}
                        {req.status === 'approved' && <CheckCircle2 size={10} />}
                        {req.status === 'rejected' && <XCircle size={10} />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedProof(req)}
                        className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center justify-end gap-1 ml-auto"
                      >
                        View <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRequests.length > 0 && (
              <tfoot className="bg-indigo-50 border-t-2 border-indigo-100">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-right">
                    <span className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">
                      TOTAL (Filtered Data)
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-black text-slate-900 flex items-center justify-center">
                      <IndianRupee size={14} className="mr-0.5" />
                      {filteredRequests.reduce((acc, req) => acc + (Number(req.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-black text-emerald-700 flex items-center justify-center">
                      <IndianRupee size={14} className="mr-0.5" />
                      {filteredRequests.reduce((acc, req) => acc + (Number(isSD ? req.super_distributor_share : req.distributor_share) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Proof Modal */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Payment Proof - {selectedProof.utr_id}</h3>
                <button onClick={() => setSelectedProof(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 bg-slate-50 flex items-center justify-center">
                <img src={selectedProof.proof_url} alt="Proof" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
