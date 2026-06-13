import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  X,
  Search,
  ArrowLeft,
  AlertTriangle,
  Send,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Smartphone,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../context/ToastContext';
import { format, parseISO } from 'date-fns';

interface UserBBPSComplaintsProps {
  userId: string;
}

export default function UserBBPSComplaints({ userId }: UserBBPSComplaintsProps) {
  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [customerMobile, setCustomerMobile] = useState<string>('');

  // Complaints List
  const [complaints, setComplaints] = useState<any[]>([]);

  // Toggle View State: 'list' | 'lodge'
  const [viewState, setViewState] = useState<'list' | 'lodge'>('list');

  // Form tab selection state inside 'lodge' view: 'lodge' | 'track'
  const [activeFormTab, setActiveFormTab] = useState<'lodge' | 'track'>('lodge');

  // Form State
  const [complaintType, setComplaintType] = useState<string>('Transaction');
  const [complaintIdentifyMethod, setComplaintIdentifyMethod] = useState<'txnId' | 'mobileDate'>('txnId');
  const [complaintTxnRef, setComplaintTxnRef] = useState<string>('');
  const [complaintMobile, setComplaintMobile] = useState<string>('');
  const [complaintStartDate, setComplaintStartDate] = useState<string>('');
  const [complaintEndDate, setComplaintEndDate] = useState<string>('');
  const [complaintDisposition, setComplaintDisposition] = useState<string>(
    'Transaction Successful, Amount Debited but services not received'
  );
  const [complaintText, setComplaintText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Tracking state for individual complaints
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // Manual Tracking State
  const [manualComplaintId, setManualComplaintId] = useState<string>('');
  const [trackingManual, setTrackingManual] = useState<boolean>(false);
  const [manualTrackResult, setManualTrackResult] = useState<any>(null);

  const BBPS_DISPOSITIONS = [
    'Transaction Successful, Amount Debited but services not received',
    'Transaction Successful, Amount Debited but Service Disconnected or Service Stopped',
    'Transaction Successful, Amount Debited but Late Payment Surcharge Charges add in next bill',
    'Erroneously paid in wrong account',
    'Duplicate Payment',
    'Erroneously paid the wrong amount',
    'Payment information not received from Biller or Delay in receiving payment information from the Biller',
    'Bill Paid but Amount not adjusted or still showing due amount'
  ];

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (customerMobile) {
      fetchUserComplaints();
    }
  }, [customerMobile]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('mobile_number')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setCustomerMobile(data.mobile_number || '');
        setComplaintMobile(data.mobile_number || '');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchUserComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('billavenue_complaints')
        .select('*')
        .eq('customer_mobile', customerMobile)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (err) {
      console.error('Error fetching complaints:', err);
      toast.error('Failed to load complaints history.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterComplaint = async (e: React.FormEvent) => {
    e.preventDefault();

    const txnRef = complaintTxnRef.trim();
    const hasTxnId = txnRef.length > 0;
    const hasMobileDate = complaintMobile.trim().length === 10 && complaintStartDate && complaintEndDate;

    if (!hasTxnId && !hasMobileDate) {
      toast.error('Please enter either a B-Connect Transaction ID starting with CC01, or enter Mobile Number + Date Range.');
      return;
    }

    if (hasTxnId && !txnRef.startsWith('CC01')) {
      toast.error('B-Connect Transaction ID must start with CC01.');
      return;
    }

    if (!complaintText.trim()) {
      toast.error('Please enter a complaint description.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        complaintType: 'Transaction',
        complaintDesc: `[Disposition: ${complaintDisposition}] ${complaintText}`,
        mobile: complaintMobile.trim() || customerMobile
      };

      if (hasTxnId) {
        payload.txnRefId = txnRef;
      } else {
        payload.dateRange = {
          startDate: complaintStartDate,
          endDate: complaintEndDate
        };
      }

      const res = await fetch('/api/bbps/complaint/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const registerResp = data?.complaintResponse || data?.complaintRegistrationResp;
      const cId = registerResp?.complaintId;
      if (cId) {
        toast.success(`Complaint registered successfully! ID: ${cId}`);
        setViewState('list');
        setComplaintText('');
        setComplaintTxnRef('');
        setComplaintStartDate('');
        setComplaintEndDate('');
        fetchUserComplaints();
      } else {
        const errorMsg = registerResp?.desc || registerResp?.errorReason || data.message || 'Failed to lodge complaint.';
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error('Error submitting complaint request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackComplaint = async (complaintId: string) => {
    setTrackingId(complaintId);

    try {
      const res = await fetch('/api/bbps/complaint/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId,
          mobile: customerMobile
        })
      });

      const data = await res.json();
      const trackResp = data?.complaintTrackingResp || data?.complaintTrackResponse;
      if (trackResp) {
        toast.success(`Complaint status: ${trackResp.status || 'Updated'}`);
        fetchUserComplaints();
      } else {
        toast.error(data.message || 'Failed to track complaint.');
      }
    } catch (err) {
      toast.error('Error tracking complaint.');
    } finally {
      setTrackingId(null);
    }
  };

  const handleManualTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualComplaintId.trim()) {
      toast.error('Please enter a Complaint ID.');
      return;
    }

    setTrackingManual(true);
    setManualTrackResult(null);

    try {
      const res = await fetch('/api/bbps/complaint/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId: manualComplaintId.trim(),
          mobile: customerMobile
        })
      });

      const data = await res.json();
      const trackResp = data?.complaintTrackingResp || data?.complaintTrackResponse;
      if (trackResp) {
        setManualTrackResult(trackResp);
        toast.success(`Complaint status retrieved successfully!`);
      } else {
        toast.error(data.message || 'Failed to track complaint.');
      }
    } catch (err) {
      toast.error('Error tracking complaint.');
    } finally {
      setTrackingManual(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4">
      {/* Header card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 rounded-[32px] border border-slate-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <ShieldCheck size={12} />
            Support Gateway
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Complaint Center
          </h2>
          <p className="text-slate-400 max-w-md text-sm leading-relaxed">
            Register and track complaints for your utility bill payments securely with direct Bharat Connect settlement.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
          {viewState === 'list' ? (
            <button
              onClick={() => {
                setViewState('lodge');
                setActiveFormTab('lodge');
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-3xl border border-indigo-500 shadow-lg shadow-indigo-500/20 transition-all text-xs font-bold uppercase tracking-wider active:scale-95"
            >
              <Plus size={16} />
              Lodge & Track
            </button>
          ) : (
            <button
              onClick={() => setViewState('list')}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-4 rounded-3xl border border-slate-700 transition-all text-xs font-bold uppercase tracking-wider active:scale-95"
            >
              <ArrowLeft size={16} />
              Back to History
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[36px] border border-slate-200 shadow-md overflow-hidden min-h-[500px]">
        {/* Step Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-4 flex items-center justify-between gap-3">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
            {viewState === 'list' ? 'Your Complaints History' : 'Complaint Center'}
          </span>
          <img
            src="/bharat_connect.png"
            alt="Bharat Connect"
            style={{ width: '130px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {viewState === 'list' ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Complaints...</p>
                  </div>
                ) : complaints.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-[32px] max-w-lg mx-auto">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4 shadow-inner">
                      <MessageSquare size={28} />
                    </div>
                    <h3 className="text-base font-black text-slate-700 tracking-tight">No Bharat Connect complaints registered</h3>
                    <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">If you have any issues with bill payments, you can register a formal dispute here.</p>
                    <button
                      onClick={() => {
                        setViewState('lodge');
                        setActiveFormTab('lodge');
                      }}
                      className="mt-6 px-5 py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                    >
                      Lodge Complaint Now
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {complaints.map((c) => {
                      const resp = c.response?.complaintResponse || c.response?.complaintRegistrationResp || c.response?.complaintTrackResponse || {};
                      return (
                        <div key={c.id} className="bg-slate-50 border border-slate-200/60 p-6 rounded-[28px] hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-[11px] font-black text-slate-900 bg-slate-200/60 px-3 py-1 rounded-full border border-slate-300/40 select-all font-mono">
                                ID: {c.complaint_id}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${c.status === 'resolved' || c.status === 'success'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : c.status === 'failed' || c.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                  : 'bg-amber-50 text-amber-600 border border-amber-200'
                                }`}>
                                {c.status}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                <Clock size={12} />
                                {format(parseISO(c.created_at), 'dd MMM yyyy, hh:mm a')}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-slate-700 leading-relaxed max-w-2xl">
                              {resp.desc || c.response?.message || 'Complaint details registered.'}
                            </p>
                          </div>

                          <div className="shrink-0">
                            <button
                              disabled={trackingId === c.complaint_id}
                              onClick={() => handleTrackComplaint(c.complaint_id)}
                              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-2xl border border-slate-200 hover:text-slate-900 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                            >
                              <RefreshCw size={14} className={trackingId === c.complaint_id ? 'animate-spin' : ''} />
                              {trackingId === c.complaint_id ? 'Tracking...' : 'Refresh Status'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="lodge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                {/* Tab Selector */}
                <div className="flex border-b border-slate-200 gap-6">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFormTab('lodge');
                      setManualTrackResult(null);
                    }}
                    className={`flex-1 pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeFormTab === 'lodge'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    Lodge Complaint
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFormTab('track');
                      setManualTrackResult(null);
                    }}
                    className={`flex-1 pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeFormTab === 'track'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    Track Complaint
                  </button>
                </div>

                {activeFormTab === 'lodge' ? (
                  <form onSubmit={handleRegisterComplaint} className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-4 rounded-2xl text-xs flex gap-2 mb-2">
                      <Info size={16} className="shrink-0 mt-0.5" />
                      <p className="leading-relaxed font-semibold">
                        To lodge a complaint, please provide either a valid <strong>B-Connect Transaction ID</strong> (starting with CC01) OR enter both the <strong>Customer Mobile Number</strong> and <strong>Date Range</strong>.
                      </p>
                    </div>

                    {/* 1. Transaction ID */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        B-Connect Transaction ID <span className="text-slate-400 font-normal">(Starting with CC01)</span>
                      </label>
                      <input
                        type="text"
                        value={complaintTxnRef}
                        onChange={(e) => setComplaintTxnRef(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all bg-white"
                        placeholder="e.g. CC018473950284759281 (optional if Mobile & Date Range is provided)"
                      />
                    </div>

                    {/* 2. Mobile & Date Range Group */}
                    <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-[24px] space-y-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Or Provide Customer details</span>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Mobile Number</label>
                          <input
                            type="tel"
                            maxLength={10}
                            value={complaintMobile}
                            onChange={(e) => setComplaintMobile(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all bg-white"
                            placeholder="Enter 10-digit mobile"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Start Date</label>
                          <input
                            type="date"
                            value={complaintStartDate}
                            onChange={(e) => setComplaintStartDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">End Date</label>
                          <input
                            type="date"
                            value={complaintEndDate}
                            onChange={(e) => setComplaintEndDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Complaint Disposition */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Complaint Disposition</label>
                      <select
                        value={complaintDisposition}
                        onChange={(e) => setComplaintDisposition(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all"
                      >
                        {BBPS_DISPOSITIONS.map((disp, idx) => (
                          <option key={idx} value={disp}>{disp}</option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Complaint Description</label>
                      <textarea
                        required
                        rows={4}
                        value={complaintText}
                        onChange={(e) => setComplaintText(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all resize-none"
                        placeholder="Provide details about the transaction issue..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 active:scale-98 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Registering Complaint...' : 'Register Bharat Connect Complaint'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleManualTrack} className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Complaint ID</label>
                      <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Enter Complaint ID (e.g. COM123456789012)"
                          value={manualComplaintId}
                          onChange={(e) => setManualComplaintId(e.target.value)}
                          className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={trackingManual}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-98"
                    >
                      {trackingManual ? 'Tracking Complaint...' : 'Track Complaint Status'}
                    </button>

                    {/* Track Status Result Display */}
                    {manualTrackResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-slate-50 rounded-[24px] border border-slate-200 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complaint Status Details</h4>
                          <button
                            type="button"
                            onClick={() => setManualTrackResult(null)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Status</span>
                            <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full mt-1 ${manualTrackResult.status === 'RESOLVED' || manualTrackResult.status === 'SUCCESS' || manualTrackResult.status?.toString().toLowerCase() === 'resolved'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : manualTrackResult.status === 'FAILED' || manualTrackResult.status === 'REJECTED' || manualTrackResult.status?.toString().toLowerCase() === 'failed'
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}>
                              {manualTrackResult.status || 'PENDING'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Assigned To</span>
                            <span className="text-xs font-bold text-slate-700 mt-1 block">{manualTrackResult.complaintAssigned || 'N/A'}</span>
                          </div>
                          <div className="col-span-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Remarks / Description</span>
                            <span className="text-xs font-semibold text-slate-600 mt-1 block leading-relaxed">{manualTrackResult.desc || manualTrackResult.complaintRemarks || 'No remarks available.'}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
