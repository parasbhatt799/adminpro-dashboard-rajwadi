import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search,
  Clock,
  User,
  Building2,
  AlertCircle,
  RotateCcw,
  Settings2,
  ListFilter,
  ArrowRight,
  ShieldCheck,
  History,
  Timer,
  Upload,
  File
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface PayoutRequest {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  amount: number;
  charge_amount: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  processing_started_at: string | null;
  transaction_id: string | null;
  remark: string | null;
  created_at: string;
  users_profiles?: {
    name: string;
    firm_name: string;
  };
}

interface PayoutSettings {
  id: number;
  fixed_charge: number;
  is_percentage: boolean;
  processing_time_1_mins: number;
  processing_time_2_mins: number;
  pending_time_mins: number;
  min_payout: number;
  max_payout: number;
  is_enabled: boolean;
}

export default function PayoutManagement() {
  const [activeTab, setActiveTab] = useState<'requests' | 'settings'>('requests');
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch Payout Settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  // Fetch Payout Requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payout_submissions')
        .select('*, users_profiles(name, firm_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchRequests();

    // Real-time subscription
    const channel = supabase
      .channel('payout_submissions_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payout_submissions' 
      }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStartProcessing = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('payout_submissions')
        .update({ 
          status: 'processing',
          processing_started_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Notify User
      const req = requests.find(r => r.id === id);
      if (req) {
        await supabase.from('notifications').insert([{
          user_id: req.user_id,
          target_role: 'user',
          title: 'Payout Processing Started',
          message: `Your payout of ₹${req.amount.toLocaleString()} is now being processed. This usually takes 45-55 minutes.`,
          link: '/user/reports'
        }]);

        // Trigger Push Notification
        try {
          const { data: userProfile } = await supabase
            .from('users_profiles')
            .select('onesignal_id')
            .eq('id', req.user_id)
            .single();

          if (userProfile?.onesignal_id) {
            const { data: osSettings } = await supabase.from('onesignal_settings').select('app_id, rest_api_key').eq('id', 1).single();
            if (osSettings?.app_id && osSettings?.rest_api_key) {
              await fetch('/api/send-push-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: 'Payout Processing Started',
                  message: `Your payout of ₹${req.amount.toLocaleString()} is now being processed.`,
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
      }
    } catch (err) {
      console.error('Error starting processing:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !rejectReason) return;
    setProcessingId(showRejectModal);
    try {
      const req = requests.find(r => r.id === showRejectModal);
      if (!req) throw new Error('Request not found');

      // 1. Return funds to User's Wallet (Amount + Charge)
      const { data: userProfile } = await supabase
        .from('users_profiles')
        .select('wallet_balance')
        .eq('id', req.user_id)
        .single();
      
      const currentBalance = Number(userProfile?.wallet_balance) || 0;
      const refundAmount = Number(req.amount) + Number(req.charge_amount);

      const { error: balanceError } = await supabase
        .from('users_profiles')
        .update({ 
          wallet_balance: currentBalance + refundAmount
        })
        .eq('id', req.user_id);

      if (balanceError) throw balanceError;

      // 2. Update Payout Status
      const { error: statusError } = await supabase
        .from('payout_submissions')
        .update({ 
          status: 'rejected',
          remark: rejectReason
        })
        .eq('id', showRejectModal);

      if (statusError) throw statusError;

      // 3. Notify User (In-app)
      await supabase.from('notifications').insert([{
        user_id: req.user_id,
        target_role: 'user',
        title: 'Payout Rejected',
        message: `Your payout of ₹${req.amount.toLocaleString()} was rejected. Reason: ${rejectReason}. Funds have been returned to your wallet.`,
        link: '/user/reports'
      }]);

      // 3.5 Trigger Push Notification
      try {
        const { data: userProfileData } = await supabase
          .from('users_profiles')
          .select('onesignal_id')
          .eq('id', req.user_id)
          .single();

        if (userProfileData?.onesignal_id) {
          const { data: osSettings } = await supabase.from('onesignal_settings').select('app_id, rest_api_key').eq('id', 1).single();
          if (osSettings?.app_id && osSettings?.rest_api_key) {
            await fetch('/api/send-push-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: 'Payout Rejected',
                message: `Your payout of ₹${req.amount.toLocaleString()} was rejected. Reason: ${rejectReason}`,
                player_ids: [userProfileData.onesignal_id],
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

      setShowRejectModal(null);
      setRejectReason('');
    } catch (err) {
      console.error('Error rejecting payout:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async () => {
    if (!showCompleteModal || !transactionId) return;
    setProcessingId(showCompleteModal);
    setIsUploading(true);
    try {
      const req = requests.find(r => r.id === showCompleteModal);
      if (!req) throw new Error('Request not found');

      let proofUrl = null;
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${req.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `payout-proofs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment_proofs')
          .upload(filePath, proofFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('payment_proofs')
          .getPublicUrl(filePath);
        
        proofUrl = urlData.publicUrl;
      }

      // 2. Update status to approved
      const { error } = await supabase
        .from('payout_submissions')
        .update({ 
          status: 'approved',
          transaction_id: transactionId,
          proof_url: proofUrl
        })
        .eq('id', showCompleteModal);

      if (error) throw error;

      // 2. Notify User (In-app)
      await supabase.from('notifications').insert([{
        user_id: req.user_id,
        target_role: 'user',
        title: 'Payout Completed',
        message: `Your payout of ₹${req.amount.toLocaleString()} has been completed successfully! Trans ID: ${transactionId}`,
        link: '/user/reports'
      }]);

      // 2.5 Trigger Push Notification
      try {
        const { data: userProfile } = await supabase
          .from('users_profiles')
          .select('onesignal_id')
          .eq('id', req.user_id)
          .single();

        if (userProfile?.onesignal_id) {
          const { data: osSettings } = await supabase.from('onesignal_settings').select('app_id, rest_api_key').eq('id', 1).single();
          if (osSettings?.app_id && osSettings?.rest_api_key) {
            await fetch('/api/send-push-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: 'Payout Completed',
                message: `Your payout of ₹${req.amount.toLocaleString()} has been completed!`,
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

      setShowCompleteModal(null);
      setTransactionId('');
      setProofFile(null);
    } catch (err) {
      console.error('Error completing payout:', err);
    } finally {
      setProcessingId(null);
      setIsUploading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('payout_settings')
        .update(settings)
        .eq('id', 1);

      if (error) throw error;
      setSuccess('Settings updated successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.account_holder_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.account_number.includes(searchQuery) ||
      (req.users_profiles?.firm_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getTimerDisplay = (req: PayoutRequest) => {
    if (req.status !== 'processing' || !req.processing_started_at || !settings) return null;

    const startTime = new Date(req.processing_started_at).getTime();
    const now = new Date().getTime();
    const elapsedMins = Math.floor((now - startTime) / 60000);
    
    const stage1Limit = settings.processing_time_1_mins;
    const stage2Limit = settings.processing_time_2_mins;

    if (elapsedMins < stage1Limit) {
      return {
        label: 'Stage 1: Beneficiary Adding',
        remaining: stage1Limit - elapsedMins,
        color: 'text-amber-600 bg-amber-50'
      };
    } else if (elapsedMins < stage1Limit + stage2Limit) {
      return {
        label: 'Stage 2: Final Processing',
        remaining: (stage1Limit + stage2Limit) - elapsedMins,
        color: 'text-indigo-600 bg-indigo-50'
      };
    } else {
      return {
        label: 'Timers Finished',
        remaining: 0,
        color: 'text-emerald-600 bg-emerald-50'
      };
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Payout Management</h2>
          <p className="text-slate-500 mt-1">Process withdrawal requests and configure payout settings.</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <History size={18} />
            Requests
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings2 size={18} />
            Settings
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'requests' ? (
          <motion.div 
            key="requests"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search by Bank, A/c, Name or Firm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                <ListFilter size={18} className="text-slate-400 mr-2 shrink-0" />
                {(['all', 'pending', 'processing', 'approved', 'rejected'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                      statusFilter === status 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-indigo-600" size={40} />
                  <p className="text-slate-500 font-medium">Loading payout requests...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-20 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <History size={40} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">No Requests Found</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mt-1">There are no payout requests matching your current filters.</p>
                  </div>
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const timer = getTimerDisplay(req);
                  return (
                    <motion.div 
                      key={req.id}
                      layout
                      className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-200 transition-all p-6"
                    >
                      <div className="flex flex-col lg:flex-row gap-8">
                        {/* User & Request Info */}
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                              <User size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">{req.users_profiles?.firm_name || 'Anonymous User'}</h3>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{new Date(req.created_at).toLocaleString()}</p>
                            </div>
                            <div className="ml-auto">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                                req.status === 'processing' ? 'bg-amber-50 text-amber-600' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {req.status === 'approved' ? 'Completed' : req.status}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                              <p className="text-lg font-black text-slate-900 flex items-center gap-1">
                                <IndianRupee size={16} />
                                {req.amount.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Charge</p>
                              <p className="text-lg font-black text-rose-500 flex items-center gap-1">
                                <IndianRupee size={16} />
                                {req.charge_amount.toLocaleString()}
                              </p>
                            </div>
                            <div className="col-span-2">
                              {timer && (
                                <div className={`p-3 rounded-2xl ${timer.color} flex items-center justify-between`}>
                                  <div className="flex items-center gap-2">
                                    <Timer size={18} />
                                    <span className="text-xs font-bold uppercase tracking-wider">{timer.label}</span>
                                  </div>
                                  <span className="text-sm font-black">{timer.remaining} mins left</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bank Details */}
                        <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                          <div className="flex items-center gap-3">
                            <Building2 size={18} className="text-slate-400" />
                            <p className="text-sm font-bold text-slate-900">{req.bank_name}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">A/c Holder</p>
                              <p className="text-xs font-bold text-slate-700">{req.account_holder_name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">A/c Number</p>
                              <p className="text-xs font-bold text-slate-700">{req.account_number}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IFSC Code</p>
                              <p className="text-xs font-bold text-slate-700">{req.ifsc_code}</p>
                            </div>
                            <div onClick={() => {
                              navigator.clipboard.writeText(`${req.account_holder_name}\n${req.account_number}\n${req.ifsc_code}`);
                            }} className="cursor-pointer hover:bg-slate-200 transition-colors p-1 rounded">
                              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Copy Final Info</p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col justify-center gap-3">
                          {req.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleStartProcessing(req.id)}
                                disabled={processingId === req.id}
                                className="w-full lg:w-40 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                              >
                                {processingId === req.id ? <Loader2 className="animate-spin" size={18} /> : <Clock size={18} />}
                                Start Process
                              </button>
                              <button 
                                onClick={() => setShowRejectModal(req.id)}
                                className="w-full lg:w-40 border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                              >
                                <XCircle size={18} />
                                Reject
                              </button>
                            </>
                          )}
                          {req.status === 'processing' && (
                            <>
                              <button 
                                onClick={() => setShowCompleteModal(req.id)}
                                className="w-full lg:w-40 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                              >
                                <CheckCircle2 size={18} />
                                Complete
                              </button>
                              <button 
                                onClick={() => setShowRejectModal(req.id)}
                                className="w-full lg:w-40 text-slate-400 hover:text-rose-600 px-4 py-1 text-xs font-bold transition-all"
                              >
                                Reject instead
                              </button>
                            </>
                          )}
                          {req.status === 'approved' && (
                            <div className="text-center p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Trans ID</p>
                              <p className="text-xs font-black text-emerald-900">{req.transaction_id}</p>
                            </div>
                          )}
                          {req.status === 'rejected' && (
                            <div className="max-w-[160px] p-2 bg-rose-50 rounded-xl border border-rose-100 overflow-hidden">
                              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Reason</p>
                              <p className="text-xs text-rose-900 truncate">{req.remark}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Payout Configuration</h3>
                  <p className="text-sm text-slate-500">Define charges and processing times for withdrawals.</p>
                </div>
              </div>

              {settings ? (
                <form onSubmit={handleUpdateSettings} className="space-y-6">
                  {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
                  {success && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-bold flex items-center gap-2"><CheckCircle2 size={18} /> {success}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Service Charge</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="number"
                          value={settings.fixed_charge}
                          onChange={e => setSettings({...settings, fixed_charge: Number(e.target.value)})}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Charge Type</label>
                      <select 
                        value={settings.is_percentage ? 'percent' : 'flat'}
                        onChange={e => setSettings({...settings, is_percentage: e.target.value === 'percent'})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      >
                        <option value="flat">Fixed Amount (₹)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Time to Approve (Minutes)
                        <Timer size={12} className="text-emerald-500" />
                      </label>
                      <input 
                        type="number"
                        value={settings.pending_time_mins || 15}
                        onChange={e => setSettings({...settings, pending_time_mins: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Timer 1 (Minutes)
                        <ShieldCheck size={12} className="text-amber-500" />
                      </label>
                      <input 
                        type="number"
                        value={settings.processing_time_1_mins}
                        onChange={e => setSettings({...settings, processing_time_1_mins: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-amber-50/50 border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Timer 2 (Minutes)
                        <Clock size={12} className="text-indigo-500" />
                      </label>
                      <input 
                        type="number"
                        value={settings.processing_time_2_mins}
                        onChange={e => setSettings({...settings, processing_time_2_mins: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min. Payout</label>
                      <input 
                        type="number"
                        value={settings.min_payout}
                        onChange={e => setSettings({...settings, min_payout: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Max. Payout</label>
                       <input 
                         type="number"
                         value={settings.max_payout}
                         onChange={e => setSettings({...settings, max_payout: Number(e.target.value)})}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                       />
                     </div>
 
                     <div className="flex flex-col justify-end pb-1">
                       <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                         <div className="pr-4">
                           <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Payout Status</h4>
                         </div>
                         <button
                           type="button"
                           onClick={() => setSettings({...settings, is_enabled: !settings.is_enabled})}
                           className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${settings.is_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                         >
                           <span
                             className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.is_enabled ? 'translate-x-6' : 'translate-x-1'}`}
                           />
                         </button>
                       </div>
                     </div>
                   </div>

                  <button 
                    type="submit"
                    disabled={savingSettings}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                  >
                    {savingSettings ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    Save Configuration
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center py-12"><Loader2 className="animate-spin text-slate-300" size={40} /></div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Reject Payout</h3>
              <p className="text-sm text-slate-500 mb-6">Explain why this payout is being rejected. This will be shown to the user.</p>
              <textarea 
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:outline-none focus:ring-rose-500/20 mb-6"
              />
              <div className="flex gap-4">
                <button onClick={() => setShowRejectModal(null)} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
                <button onClick={handleReject} disabled={!rejectReason || processingId !== null} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-100 flex items-center justify-center gap-2">
                  {processingId ? <Loader2 size={16} className="animate-spin" /> : null}
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Complete Payout</h3>
              <p className="text-sm text-slate-500 mb-6">Enter transaction details and upload payment proof.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Transaction ID</label>
                  <input 
                    type="text"
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value)}
                    placeholder="Enter Reference Number"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:outline-none focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Payment Proof (Optional)</label>
                  <label className="relative flex items-center justify-center w-full h-24 px-4 transition bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl appearance-none cursor-pointer hover:border-emerald-400 focus:outline-none group">
                    <div className="flex flex-col items-center space-y-1 text-center">
                      {proofFile ? (
                        <>
                          <CheckCircle2 className="text-emerald-500" size={20} />
                          <span className="text-[10px] font-bold text-slate-600 truncate max-w-[200px]">{proofFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />
                          <span className="text-[10px] font-bold text-slate-500">Upload Receipt</span>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => e.target.files && setProofFile(e.target.files[0])} 
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => { setShowCompleteModal(null); setProofFile(null); }} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
                <button 
                  onClick={handleComplete} 
                  disabled={!transactionId || processingId !== null || isUploading} 
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Complete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
