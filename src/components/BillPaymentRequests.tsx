import React, { useState, useEffect } from 'react';
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  IndianRupee,
  Clock,
  User,
  CreditCard,
  Phone,
  AlertCircle,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface BillRequest {
  id: string;
  user_id: string;
  customer_mobile: string;
  card_bank: string;
  card_number: string;
  card_owner_name: string;
  amount: number;
  charges?: number;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
  };
}

export default function BillPaymentRequests() {
  const [requests, setRequests] = useState<BillRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionRowId, setRejectionRowId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [charges, setCharges] = useState('');
  const [showActionModal, setShowActionModal] = useState<{ id: string; type: 'approved' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isBillEnabled, setIsBillEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
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
        .from('bill_submissions')
        .select('*, users_profiles(name, firm_name)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching bill requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReasons = async () => {
    try {
      const { data, error } = await supabase
        .from('rejection_reasons')
        .select('*, rejection_categories!inner(show_in_bill)')
        .eq('is_active', true)
        .eq('rejection_categories.show_in_bill', true)
        .order('reason_text');
      if (error) throw error;
      setRejectionReasons(data || []);
    } catch (err) {
      console.error('Error fetching reasons:', err);
    }
  };

  const fetchBillSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_settings')
        .select('is_bill_enabled')
        .eq('id', 1)
        .single();
      if (!error && data) {
        setIsBillEnabled(data.is_bill_enabled ?? true);
      }
    } catch (err) {
      console.error('Error fetching bill settings:', err);
    }
  };

  const handleToggleBill = async () => {
    const newValue = !isBillEnabled;
    setIsBillEnabled(newValue);
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_bill_enabled: newValue })
        .eq('id', 1);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating bill setting:', err);
      setIsBillEnabled(!newValue); // revert on error
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchReasons();
    fetchBillSettings();
  }, [filter]);

  const handleRefund = async (id: string) => {
    setProcessingId(id);
    try {
      const targetRequest = requests.find(r => r.id === id);
      if (!targetRequest) throw new Error('Request not found');

      // 1. Deduct charges from admin balance (undo the credit)
      const { data: qrSettings } = await supabase.from('qr_settings').select('admin_balance').eq('id', 1).single();
      const currentAdminBalance = Number(qrSettings?.admin_balance) || 0;
      const requestCharges = targetRequest.charges || 0;

      await supabase
        .from('qr_settings')
        .update({ admin_balance: Math.max(0, currentAdminBalance - requestCharges) })
        .eq('id', 1);

      // 2. Update request status to refunded
      const { error } = await supabase
        .from('bill_submissions')
        .update({ status: 'refunded' })
        .eq('id', id);

      if (error) throw error;

      // 3. Notify User
      await supabase
        .from('notifications')
        .insert([{
          user_id: targetRequest.user_id,
          target_role: 'user',
          title: 'Bill Payment Status Updated',
          message: `Your bill payment of ₹${targetRequest.amount.toLocaleString()} is now under Refund Policy review.`,
          link: '/user/reports'
        }]);

      setRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'refunded' } : req));
    } catch (err) {
      console.error('Error moving to refund:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatusUpdate = async (id?: string, type?: 'approved' | 'rejected' | 'refunded', customReason?: string) => {
    const targetId = id || showActionModal?.id;
    const targetType = type || (showActionModal ? 'approved' : 'rejected');
    const targetReason = customReason || reason;

    if (!targetId) return;

    setProcessingId(targetId);
    try {
      const targetRequest = requests.find(r => r.id === targetId);
      if (!targetRequest) throw new Error('Request not found');

      const { data: currentReq, error: fetchError } = await supabase
        .from('bill_submissions')
        .select('status, amount, charges')
        .eq('id', targetId)
        .single();

      if (fetchError || !currentReq) throw new Error('Request not found');
      if (currentReq.status !== 'pending') throw new Error('This request has already been processed');

      const amount = currentReq.amount || 0;
      const requestCharges = currentReq.charges || 0;
      const updateData: any = { status: targetType };

      if (targetType === 'approved') {
        const { error: statusError } = await supabase
          .from('bill_submissions')
          .update(updateData)
          .eq('id', targetId)
          .eq('status', 'pending');

        if (statusError) throw statusError;

        const { data: qrSettings } = await supabase.from('qr_settings').select('admin_balance').eq('id', 1).single();
        const currentAdminBalance = Number(qrSettings?.admin_balance) || 0;

        await supabase
          .from('qr_settings')
          .update({ admin_balance: currentAdminBalance + requestCharges })
          .eq('id', 1);

      } else {
        updateData.rejection_reason = targetReason;
        const { error: statusError } = await supabase
          .from('bill_submissions')
          .update(updateData)
          .eq('id', targetId)
          .eq('status', 'pending');

        if (statusError) throw statusError;

        const { data: userData } = await supabase
          .from('users_profiles')
          .select('wallet_balance')
          .eq('id', targetRequest.user_id)
          .single();

        const currentUserBalance = Number(userData?.wallet_balance) || 0;
        await supabase
          .from('users_profiles')
          .update({ wallet_balance: currentUserBalance + amount + requestCharges })
          .eq('id', targetRequest.user_id);
      }

      // 3. Notify User (In-app)
      const { error: nError } = await supabase
        .from('notifications')
        .insert([{
          user_id: targetRequest.user_id,
          target_role: 'user',
          title: `Bill Payment ${targetType === 'approved' ? 'Approved' : 'Rejected'}`,
          message: targetType === 'approved'
            ? `Your bill payment of ₹${amount.toLocaleString()} has been approved!`
            : `Your bill payment of ₹${amount.toLocaleString()} was rejected. Reason: ${targetReason}`,
          link: '/user/reports'
        }]);

      if (nError) console.error('Bill Status Notification Error:', nError);

      // 3.5 Trigger Push Notification
      try {
        const { data: userProfile } = await supabase
          .from('users_profiles')
          .select('onesignal_id')
          .eq('id', targetRequest.user_id)
          .single();

        if (userProfile?.onesignal_id) {
          const { data: osSettings } = await supabase.from('onesignal_settings').select('app_id, rest_api_key').eq('id', 1).single();
          if (osSettings?.app_id && osSettings?.rest_api_key) {
            await fetch('/api/send-push-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `Bill Payment ${targetType === 'approved' ? 'Approved' : 'Rejected'}`,
                message: targetType === 'approved'
                  ? `Your bill payment of ₹${amount.toLocaleString()} has been approved!`
                  : `Your bill payment of ₹${amount.toLocaleString()} was rejected. Reason: ${targetReason}`,
                player_ids: [userProfile.onesignal_id],
                link: '/user/reports',
                credentials: {
                  app_id: osSettings.app_id,
                  rest_api_key: osSettings.rest_api_key
                }
              })
            });
          }
        }
      } catch (pushErr) {
        console.error('Push Notification Error:', pushErr);
      }

      setRequests(prev => prev.map(req => req.id === targetId ? { ...req, ...updateData } : req));
      setRejectionRowId(null);
      setReason('');
      setCharges('');
      setShowActionModal(null);
    } catch (err: any) {
      console.error('Error updating status:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch =
      req.customer_mobile.includes(searchQuery) ||
      req.card_owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
          <h2 className="text-2xl font-bold text-slate-900">Bill Payment Requests</h2>
          <p className="text-slate-500 mt-1">Manage and process user bill payment submissions.</p>
        </div>
        <div className="flex items-end gap-3">
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
              placeholder="Search Mobile, Name or Firm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-64"
            />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isBillEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                Bill Payments Service {isBillEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                onClick={handleToggleBill}
                disabled={savingSettings}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  isBillEnabled ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    isBillEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
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
              <option value="refunded">Refund Policy</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Firm / Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Customer Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Card Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Service Charge</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Debited Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
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
                    <Receipt className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No bill requests found</p>
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
                              {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            {req.customer_mobile}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">{req.card_owner_name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <CreditCard size={12} className="text-slate-400" />
                            {req.card_number.slice(-4)}
                          </p>
                          <p className="text-[12px] font-mono text-slate-900 font-bold">{req.card_bank}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900 flex items-center">
                          <IndianRupee size={14} className="mr-0.5" />
                          {req.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-emerald-600 flex items-center justify-end">
                          <IndianRupee size={14} className="mr-0.5" />
                          {(req.charges || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-indigo-600 flex items-center justify-end">
                          <IndianRupee size={14} className="mr-0.5" />
                          {(Number(req.amount) + Number(req.charges || 0)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                              req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                                req.status === 'refunded' ? 'bg-indigo-50 text-indigo-600' :
                                  'bg-amber-50 text-amber-600'
                            }`}>
                            {req.status === 'pending' && <Clock size={10} />}
                            {req.status === 'approved' && <CheckCircle2 size={10} />}
                            {req.status === 'rejected' && <XCircle size={10} />}
                            {req.status === 'refunded' && <RotateCcw size={10} />}
                            {req.status === 'refunded' ? 'Refund Policy' : req.status}
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
                              onClick={() => setShowActionModal({ id: req.id, type: 'approved' })}
                              disabled={processingId === req.id}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                          </div>
                        )}
                        {req.status === 'approved' && (
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => handleRefund(req.id)}
                              disabled={processingId === req.id}
                              className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Move to Refund Policy"
                            >
                              <RotateCcw size={20} />
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
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${currentPage === i + 1
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

      {/* Action Modal */}
      <AnimatePresence>
        {showActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  Approve Request
                </h3>
                <button
                  onClick={() => setShowActionModal(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Bill Amount</span>
                    <span className="text-lg font-bold text-indigo-900">₹{requests.find(r => r.id === showActionModal?.id)?.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Service Charge</span>
                    <span className="text-lg font-bold text-emerald-900">₹{Number(requests.find(r => r.id === showActionModal?.id)?.charges || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-indigo-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Debited</span>
                    <span className="text-lg font-bold text-slate-900">
                      ₹{(Number(requests.find(r => r.id === showActionModal?.id)?.amount || 0) +
                        Number(requests.find(r => r.id === showActionModal?.id)?.charges || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 text-center px-4">
                  Approving this will credit <span className="font-bold text-emerald-600">₹{Number(requests.find(r => r.id === showActionModal?.id)?.charges || 0).toFixed(2)}</span> to the admin wallet.
                </p>
              </div>

              <div className="p-6 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setShowActionModal(null)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusUpdate()}
                  disabled={processingId !== null}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {processingId ? <Loader2 className="animate-spin" size={16} /> : null}
                  Confirm Approval
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
