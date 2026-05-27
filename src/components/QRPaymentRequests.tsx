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
  ChevronUp,
  RotateCcw,
  Pencil,
  Shield,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

interface QRPaymentRequest {
  id: string;
  user_id: string;
  utr_id: string;
  amount: number;
  charges?: number;
  admin_share?: number;
  distributor_share?: number;
  super_distributor_share?: number;
  proof_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
    profile_photo_url?: string;
    distributor_id?: string;
    admin_base_qr_charge?: number;
    charge_percentage?: number;
  };
  card_number: string;
  qr_id?: string;
  qr_history?: {
    qr_name: string;
    whatsapp_number?: string;
  };
  actioned_by?: string;
  actioned_at?: string;
}

interface AdminProfile {
  mobile_number: string;
  name: string;
}

const getTodayStr = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export default function QRPaymentRequests() {
  const toast = useToast();
  const [requests, setRequests] = useState<QRPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionRowId, setRejectionRowId] = useState<string | null>(null);
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);
  const [charges, setCharges] = useState('0');
  const [reason, setReason] = useState('');
  const [selectedProof, setSelectedProof] = useState<QRPaymentRequest | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amountFilter, setAmountFilter] = useState('');
  const [reversalId, setReversalId] = useState<string | null>(null);
  const [reversalTarget, setReversalTarget] = useState<'pending' | 'rejected'>('pending');
  const [allQRs, setAllQRs] = useState<any[]>([]);
  const [editingQRRowId, setEditingQRRowId] = useState<string | null>(null);
  const [qrSearchQuery, setQrSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const currentUserId = localStorage.getItem('userId');
  const isDeveloper = currentUserId === '9999099999';
  const isGodAdmin = currentUserId === '7777077377';
  const canEditQR = isDeveloper || isGodAdmin;
  const itemsPerPage = 10;

  const clearFilters = () => {
    setSearchQuery('');
    setFilter('all');
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    setAmountFilter('');
    setCurrentPage(1);
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    const today = new Date();
    
    const formatDate = (date: Date) => {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };

    if (value === 'today') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (value === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (value === 'last7') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (value === 'last30') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (value === 'all' || value === 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchRequests = async (silent = false) => {
    if (!silent) setLoading(true);
    else setFetchingHistory(true);
    try {
      let query = supabase
        .from('payment_submissions')
        .select('*, users_profiles!payment_submissions_user_id_fkey!inner(name, firm_name, profile_photo_url, distributor_id, charge_percentage, admin_base_qr_charge), qr_history(qr_name, whatsapp_number)', { count: 'exact' });

      // Apply Filters
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (searchQuery) {
        query = query.or(`utr_id.ilike.%${searchQuery}%,users_profiles.firm_name.ilike.%${searchQuery}%,users_profiles.name.ilike.%${searchQuery}%`);
      }

      if (amountFilter) {
        query = query.eq('amount', parseFloat(amountFilter));
      }

      if (startDate) {
        query = query.gte('created_at', new Date(`${startDate}T00:00:00`).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', new Date(`${endDate}T23:59:59.999`).toISOString());
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch Admins for mapping (only once or cache it)
      if (Object.keys(adminMap).length === 0) {
        const { data: admins } = await supabase.from('admin_profiles').select('mobile_number, name');
        const map: Record<string, string> = {};
        admins?.forEach(a => {
          map[a.mobile_number] = a.name || a.mobile_number;
        });
        setAdminMap(map);
      }

      setRequests(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching QR requests:', err);
    } finally {
      setLoading(false);
      setFetchingHistory(false);
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

  const fetchQRs = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_history')
        .select('id, qr_name, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllQRs(data || []);
    } catch (err) {
      console.error('Error fetching QRs:', err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchReasons();
    fetchQRs();

    const channel = supabase
      .channel('admin_qr_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_submissions'
      }, () => {
        fetchRequests(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, currentPage, searchQuery, startDate, endDate, amountFilter]);

  const handleStatusUpdate = async (id: string, type: 'approved' | 'rejected', customReason?: string) => {
    const targetId = id;
    const targetType = type;
    const targetReason = customReason || reason;

    if (!targetId) return;

    setProcessingId(targetId);
    try {
      const { data: currentReq, error: fetchError } = await supabase
        .from('payment_submissions')
        .select('status, amount, user_id, proof_url')
        .eq('id', targetId)
        .single();

      if (fetchError || !currentReq) throw new Error('Request not found');
      if (currentReq.status !== 'pending') throw new Error('This request has already been processed');

      const amount = currentReq.amount || 0;
      const updateData: any = { status: targetType };

      if (targetType === 'approved') {
        const { data: rpcData, error: rpcError } = await supabase.rpc('approve_qr_payment', {
          p_payment_id: targetId,
          p_admin_id: currentUserId // This is the mobile number from localStorage
        });

        if (rpcError) throw rpcError;
        if (!rpcData.success) throw new Error(rpcData.message);

        // Update local state with the results from RPC
        const result = rpcData.data;
        updateData.charges = result.total_charges;
        updateData.admin_share = result.admin_share;
        updateData.distributor_share = result.distributor_share;
        updateData.super_distributor_share = result.super_distributor_share;

      } else {
        updateData.rejection_reason = targetReason;
        updateData.actioned_by = currentUserId;
        updateData.actioned_at = new Date().toISOString();
        const { error: statusError } = await supabase
          .from('payment_submissions')
          .update(updateData)
          .eq('id', targetId)
          .eq('status', 'pending');

        if (statusError) throw statusError;
      }

      // 3. Notify User (In-app)
      const { error: nError } = await supabase
        .from('notifications')
        .insert([{
          user_id: currentReq.user_id,
          target_role: 'user',
          title: `QR Payment ${targetType === 'approved' ? 'Approved' : 'Rejected'}`,
          message: targetType === 'approved'
            ? `Your QR payment of ₹${amount.toLocaleString()} has been approved!`
            : `Your QR payment of ₹${amount.toLocaleString()} was rejected. Reason: ${targetReason}`,
          link: '/user/payment'
        }]);

      if (nError) console.error('QR Status Notification Error:', nError);

      // 3.5 Trigger Push Notification
      try {
        const { data: userProfile } = await supabase
          .from('users_profiles')
          .select('onesignal_id')
          .eq('id', currentReq.user_id)
          .single();

        const { data: osSettings } = await supabase.from('onesignal_settings').select('app_id, rest_api_key').eq('id', 1).single();
        if (osSettings?.app_id && osSettings?.rest_api_key) {
          await fetch('/api/send-push-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `QR Payment ${targetType === 'approved' ? 'Approved' : 'Rejected'}`,
              message: targetType === 'approved'
                ? `Your QR payment of ₹${amount.toLocaleString()} has been approved!`
                : `Your QR payment of ₹${amount.toLocaleString()} was rejected. Reason: ${targetReason}`,
              external_user_ids: [currentReq.user_id],
              link: '/user/payment',
              credentials: {
                app_id: osSettings.app_id,
                rest_api_key: osSettings.rest_api_key
              }
            })
          });
        }
      } catch (pushErr) {
        console.error('Push Notification Error:', pushErr);
      }

      // 4. Send WhatsApp Notification if enabled (Approved only)
      if (targetType === 'approved') {
        try {
          const { data: ws } = await supabase.from('whatsapp_api_settings').select('*').eq('id', 1).single();
          if (ws?.is_active) {
            const currentReqData = requests.find(r => r.id === targetId);
            const targetMobile = currentReqData?.qr_history?.whatsapp_number;
            if (targetMobile) {
              let cleanNumber = targetMobile.replace(/\D/g, '');
              if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;
              await fetch('/api/send-whatsapp-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  whatsapp_number: cleanNumber,
                  proof_url: currentReq.proof_url,
                  credentials: ws
                })
              });
            }
          }
        } catch (wsErr) {
          console.error('WhatsApp Notification Error:', wsErr);
        }
      }

      setRequests(prev => prev.map(req => req.id === targetId ? { ...req, ...updateData } : req));
      setRejectionRowId(null);
      setCharges('0');
      setReason('');
      if (selectedProof?.id === targetId) setSelectedProof(null);
      // No page reload needed — optimistic update + realtime subscription handles refresh
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleQRUpdate = async (submissionId: string, newQRId: string) => {
    if (!submissionId || !newQRId) return;
    setProcessingId(submissionId);
    try {
      const { error } = await supabase
        .from('payment_submissions')
        .update({ qr_id: newQRId })
        .eq('id', submissionId);

      if (error) throw error;
      toast.success('QR Updated Successfully');
      setEditingQRRowId(null);
      fetchRequests(true);
    } catch (err: any) {
      console.error('Error updating QR:', err);
      toast.error('Failed to update QR');
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatusReversal = async (id: string, newStatus: 'pending' | 'rejected', customReason?: string) => {
    if (!id) return;
    setProcessingId(id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('revert_qr_payment_status', {
        p_payment_id: id,
        p_new_status: newStatus,
        p_rejection_reason: customReason || reason
      });

      if (rpcError) throw rpcError;
      if (!rpcData.success) {
        // Handle the specific block message from RPC
        toast.error(rpcData.message);
        return;
      }

      toast.success(`Request status updated to ${newStatus}`);
      setReversalId(null);
      setReason('');
      fetchRequests(true);
    } catch (err: any) {
      console.error('Error reverting status:', err);
      toast.error('Failed to revert status: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter, startDate, endDate, amountFilter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Payment Requests</h2>
          <p className="text-slate-500 mt-1">Review and approve user QR payment submissions.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="custom">Custom</option>
          </select>

          {dateFilter === 'custom' && (
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
          )}
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
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-48"
            />
          </div>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="number"
              placeholder="Amount..."
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-32"
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        {fetchingHistory && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2">
              <Loader2 className="animate-spin text-indigo-600" size={16} />
              <span className="text-xs font-bold text-slate-600">Updating History...</span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left">Firm / Date</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">UTR ID</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Card No</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">QR Used</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Amount</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Admin Profit</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Dist. Profit</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">S.Dist. Profit</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Credited</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Proof</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />
                    <p className="text-sm text-slate-500 font-medium">Loading requests...</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <QrCode className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No payment requests found</p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr
                      onClick={() => {
                        setSelectedRowId(selectedRowId === req.id ? null : req.id);
                        if (req.status === 'rejected') {
                          setRejectionRowId(rejectionRowId === req.id ? null : req.id);
                        }
                      }}
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedRowId === req.id ? 'bg-emerald-50/50' : rejectionRowId === req.id || reversalId === req.id ? 'bg-indigo-50/30' : req.status === 'approved' ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-3 py-4">
                        <Link
                          to={`/users-list?id=${req.user_id}`}
                          className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity group"
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors overflow-hidden">
                            {req.users_profiles?.profile_photo_url ? (
                              <img src={req.users_profiles.profile_photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User size={16} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 whitespace-nowrap group-hover:text-indigo-600 transition-colors">
                              {req.users_profiles?.firm_name || req.users_profiles?.name || `User #${req.user_id.slice(0, 8)}`}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              {new Date(req.created_at).toLocaleDateString()} • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                            {req.actioned_by && (
                              <div className="mt-1 flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md w-fit">
                                <Shield size={8} className="text-slate-400" />
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight">
                                  {req.status === 'approved' ? 'Approved' : 'Rejected'} by: <span className="text-indigo-600">{adminMap[req.actioned_by] || req.actioned_by}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <code className="text-[12px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {req.utr_id}
                        </code>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[12px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
                          {req.card_number || '****'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 group/qr relative">
                          {editingQRRowId === req.id ? (
                            <div className="absolute z-[100] top-0 left-1/2 -translate-x-1/2 bg-white border border-indigo-200 rounded-xl shadow-2xl p-2 w-48 animate-in fade-in zoom-in duration-200">
                              <div className="relative mb-2">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search QR..."
                                  value={qrSearchQuery}
                                  onChange={(e) => setQrSearchQuery(e.target.value)}
                                  className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                {allQRs.filter(qr => qr.qr_name.toLowerCase().includes(qrSearchQuery.toLowerCase())).length === 0 ? (
                                  <p className="text-[10px] text-slate-400 text-center py-2">No QR found</p>
                                ) : (
                                  allQRs
                                    .filter(qr => qr.qr_name.toLowerCase().includes(qrSearchQuery.toLowerCase()))
                                    .map(qr => (
                                      <button
                                        key={qr.id}
                                        onClick={() => {
                                          handleQRUpdate(req.id, qr.id);
                                          setQrSearchQuery('');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-colors flex flex-col gap-0.5 ${req.qr_id === qr.id
                                            ? 'bg-indigo-50 text-indigo-600'
                                            : 'hover:bg-slate-50 text-slate-600'
                                          }`}
                                      >
                                        <span>{qr.qr_name}</span>
                                        <span className="text-[8px] text-slate-400 font-medium italic">
                                          {new Date(qr.created_at).toLocaleString('en-IN', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric', 
                                            hour: '2-digit', 
                                            minute: '2-digit', 
                                            hour12: true 
                                          })}
                                        </span>
                                      </button>
                                    ))
                                )}
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-50 flex justify-end">
                                <button
                                  onClick={() => {
                                    setEditingQRRowId(null);
                                    setQrSearchQuery('');
                                  }}
                                  className="text-[9px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                {req.qr_history?.qr_name || 'Legacy QR'}
                              </span>
                              {canEditQR && (
                                <button
                                  onClick={() => {
                                    setEditingQRRowId(req.id);
                                    setQrSearchQuery('');
                                  }}
                                  className="p-1 text-indigo-400 hover:text-indigo-600 transition-all"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-xs font-bold text-slate-900 flex items-center justify-center">
                          <IndianRupee size={12} className="mr-0.5" />
                          {req.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-xs font-bold text-rose-600 flex items-center justify-center">
                          <IndianRupee size={12} className="mr-0.5" />
                          {req.status === 'pending' ? '0.00' : (req.admin_share !== null && req.admin_share !== undefined ?
                            Number(req.admin_share).toFixed(2) :
                            (req.users_profiles?.distributor_id ?
                              ((req.amount * Number(req.users_profiles?.admin_base_qr_charge || 0)) / 100).toFixed(2) :
                              Number(req.charges || 0).toFixed(2)
                            ))
                          }
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        {req.status === 'pending' ? (
                          <span className="text-xs font-bold text-amber-600 flex items-center justify-center">
                            <IndianRupee size={12} className="mr-0.5" />
                            0.00
                          </span>
                        ) : req.distributor_share !== null && req.distributor_share !== undefined ? (
                          <span className="text-xs font-bold text-amber-600 flex items-center justify-center">
                            <IndianRupee size={12} className="mr-0.5" />
                            {Number(req.distributor_share).toFixed(2)}
                          </span>
                        ) : req.users_profiles?.distributor_id ? (
                          <span className="text-xs font-bold text-amber-600 flex items-center justify-center">
                            <IndianRupee size={12} className="mr-0.5" />
                            {Math.max(0, (req.amount * (Number(req.users_profiles?.charge_percentage || 0) - Number(req.users_profiles?.admin_base_qr_charge || 0))) / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">N/A</span>
                        )}

                      </td>
                      <td className="px-3 py-4 text-center">
                        {req.status === 'pending' ? (
                          <span className="text-xs font-bold text-pink-600 flex items-center justify-center">
                            <IndianRupee size={12} className="mr-0.5" />
                            0.00
                          </span>
                        ) : req.super_distributor_share !== null && req.super_distributor_share !== undefined ? (
                          <span className="text-xs font-bold text-pink-600 flex items-center justify-center">
                            <IndianRupee size={12} className="mr-0.5" />
                            {Number(req.super_distributor_share).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-xs font-bold text-emerald-600 flex items-center justify-center">
                          <IndianRupee size={12} className="mr-0.5" />
                          {(Number(req.amount) - Number(req.charges || 0)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => setSelectedProof(req)}
                          className="flex items-center justify-center gap-1 mx-auto text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors group"
                        >
                          View
                          <ExternalLink size={10} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                            req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>
                            {req.status === 'pending' && <Clock size={8} />}
                            {req.status === 'approved' && <CheckCircle2 size={8} />}
                            {req.status === 'rejected' && <XCircle size={8} />}
                            {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right whitespace-nowrap">
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
                        {(req.status === 'approved' || req.status === 'rejected') && isDeveloper && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setReversalId(reversalId === req.id ? null : req.id);
                                setReversalTarget(req.status === 'approved' ? 'pending' : 'pending');
                              }}
                              disabled={processingId === req.id}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${reversalId === req.id ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              title="Reset Status"
                            >
                              <RotateCcw size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {reversalId === req.id && (
                      <tr>
                        <td colSpan={11} className="px-6 py-4 bg-indigo-50/30 border-y border-indigo-100/50">
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col md:flex-row items-end gap-4"
                          >
                            <div className="flex-1 w-full">
                              <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Change Status To</label>
                              <div className="flex gap-2">
                                <select
                                  value={reversalTarget}
                                  onChange={(e) => setReversalTarget(e.target.value as any)}
                                  className="flex-1 px-4 py-2.5 bg-white border border-indigo-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                >
                                  <option value="pending">Move to Pending</option>
                                  {req.status === 'approved' && <option value="rejected">Move to Rejected</option>}
                                </select>
                              </div>
                            </div>

                            {reversalTarget === 'rejected' && (
                              <div className="flex-1 w-full">
                                <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Rejection Reason</label>
                                <select
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                  className="w-full px-4 py-2.5 bg-white border border-rose-100 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                >
                                  <option value="">-- Choose a reason --</option>
                                  {rejectionReasons.map(r => (
                                    <option key={r.id} value={r.reason_text}>{r.reason_text}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setReversalId(null);
                                  setReason('');
                                }}
                                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleStatusReversal(req.id, reversalTarget)}
                                disabled={processingId === req.id || (reversalTarget === 'rejected' && !reason)}
                                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                              >
                                {processingId === req.id ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                                Confirm Reset
                              </button>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
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
      {!loading && requests.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <p className="text-sm text-slate-500 font-medium">
            Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="text-slate-900 font-bold">{totalCount}</span> requests
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
              {(() => {
                const pages = [];
                const maxVisible = 5;
                let start = Math.max(1, currentPage - 2);
                let end = Math.min(totalPages, start + maxVisible - 1);

                if (end - start + 1 < maxVisible) {
                  start = Math.max(1, end - maxVisible + 1);
                }

                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${currentPage === i
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                        }`}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}
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
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                  onClick={() => setImgScale(1)}
                  className="px-3 py-1 bg-white/90 hover:bg-white text-[10px] font-bold text-indigo-600 rounded-full shadow-lg transition-all border border-indigo-50"
                >
                  Reset Zoom
                </button>
                <button
                  onClick={() => {
                    setSelectedProof(null);
                    setReason('');
                    setImgScale(1);
                  }}
                  className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className="flex-1 bg-slate-50 flex items-center justify-center overflow-hidden p-2 md:p-4 cursor-zoom-in"
                onWheel={(e) => {
                  if (e.deltaY < 0) {
                    setImgScale(prev => Math.min(prev + 0.2, 5));
                  } else {
                    setImgScale(prev => Math.max(prev - 0.2, 0.5));
                  }
                }}
              >
                <motion.img
                  src={selectedProof.proof_url}
                  alt="Payment Proof"
                  drag
                  dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                  dragElastic={0.1}
                  dragMomentum={false}
                  animate={{
                    scale: imgScale,
                    x: imgScale === 1 ? 0 : undefined,
                    y: imgScale === 1 ? 0 : undefined
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="max-w-full max-h-[calc(95vh-200px)] object-contain rounded-xl shadow-lg cursor-grab active:cursor-grabbing"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-6 bg-white border-t border-slate-100 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                        <Hash size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">UTR</p>
                        <p className="text-[11px] font-bold text-slate-900 leading-tight">{selectedProof.utr_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                      <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                        <IndianRupee size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider leading-tight">Amount</p>
                        <p className="text-[11px] font-bold text-emerald-900 leading-tight">₹{selectedProof.amount.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                      <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider leading-tight">Firm Name</p>
                        <p className="text-[11px] font-bold text-slate-900 leading-tight">{selectedProof.users_profiles?.firm_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                        <QrCode size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">QR Used</p>
                        <div className="flex items-center gap-1 group/modal-qr relative">
                          <p className="text-[11px] font-bold text-slate-900 leading-tight">
                            {selectedProof.qr_history?.qr_name || 'Legacy'}
                          </p>
                          {canEditQR && (
                            <button
                              onClick={() => {
                                setEditingQRRowId(selectedProof.id);
                                setQrSearchQuery('');
                              }}
                              className="p-0.5 text-indigo-400 hover:text-indigo-600 transition-all"
                            >
                              <Pencil size={10} />
                            </button>
                          )}

                          {editingQRRowId === selectedProof.id && (
                            <div className="absolute z-[110] top-full left-0 mt-1 bg-white border border-indigo-200 rounded-xl shadow-2xl p-2 w-48 animate-in fade-in zoom-in duration-200">
                              <div className="relative mb-2">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search QR..."
                                  value={qrSearchQuery}
                                  onChange={(e) => setQrSearchQuery(e.target.value)}
                                  className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                {allQRs.filter(qr => qr.qr_name.toLowerCase().includes(qrSearchQuery.toLowerCase())).length === 0 ? (
                                  <p className="text-[10px] text-slate-400 text-center py-2">No QR found</p>
                                ) : (
                                  allQRs
                                    .filter(qr => qr.qr_name.toLowerCase().includes(qrSearchQuery.toLowerCase()))
                                    .map(qr => (
                                      <button
                                        key={qr.id}
                                        onClick={async () => {
                                          await handleQRUpdate(selectedProof.id, qr.id);
                                          // Update the selectedProof state as well to reflect change in modal
                                          setSelectedProof(prev => prev ? {
                                            ...prev,
                                            qr_id: qr.id,
                                            qr_history: { ...prev.qr_history, qr_name: qr.qr_name }
                                          } as any : null);
                                          setQrSearchQuery('');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-colors ${selectedProof.qr_id === qr.id
                                            ? 'bg-indigo-50 text-indigo-600'
                                            : 'hover:bg-slate-50 text-slate-600'
                                          }`}
                                      >
                                        {qr.qr_name}
                                      </button>
                                    ))
                                )}
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-50 flex justify-end">
                                <button
                                  onClick={() => {
                                    setEditingQRRowId(null);
                                    setQrSearchQuery('');
                                  }}
                                  className="text-[9px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                        <Clock size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Date & Time</p>
                        <p className="text-[11px] font-bold text-slate-900 whitespace-nowrap leading-tight">
                          {new Date(selectedProof.created_at).toLocaleDateString()} {new Date(selectedProof.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
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
