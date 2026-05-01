import React, { useState, useEffect, type ChangeEvent } from 'react';
import { 
  QrCode, Receipt, IndianRupee, ArrowRight, ShieldCheck, CreditCard, 
  Upload, Loader2, CheckCircle2, AlertCircle, FileText, Hash, 
  ExternalLink, X, ChevronUp, Search, RotateCcw, Clock, XCircle,
  Building2, User, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { sendAdminPushNotification } from '../../lib/notifications';

interface UserPaymentProps {
  userId: string;
}

export default function UserPayment({ userId }: UserPaymentProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'bill' | 'payout'>('qr');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [activeQrId, setActiveQrId] = useState<string | null>(null);
  const [qrName, setQrName] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(true);
  const [banks, setBanks] = useState<{ id: string; bank_name: string }[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  
  // QR Form state
  const [utrId, setUtrId] = useState('');
  const [qrCardNumber, setQrCardNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bill Form state
  const [billForm, setBillForm] = useState({
    customerMobile: '',
    cardBank: '',
    cardNumber: '',
    cardOwnerName: '',
    billAmount: ''
  });
  const [submittingBill, setSubmittingBill] = useState(false);

  // Payout Form state
  const [payoutForm, setPayoutForm] = useState({
    bankName: '',
    holderName: '',
    accountNumber: '',
    ifscCode: '',
    amount: ''
  });
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutSettings, setPayoutSettings] = useState<any>(null);
  const [payoutBanks, setPayoutBanks] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-clear banners after 6 seconds
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 6000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Request History state
  const [qrRequests, setQrRequests] = useState<any[]>([]);
  const [billRequests, setBillRequests] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [isBillEnabled, setIsBillEnabled] = useState(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  // QR Filters & Pagination
  const [qrSearch, setQrSearch] = useState('');
  const [qrStatus, setQrStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [qrStartDate, setQrStartDate] = useState('');
  const [qrEndDate, setQrEndDate] = useState('');
  const [qrPage, setQrPage] = useState(1);

  // Bill Filters & Pagination
  const [billSearch, setBillSearch] = useState('');
  const [billStatus, setBillStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');
  const [billStartDate, setBillStartDate] = useState('');
  const [billEndDate, setBillEndDate] = useState('');
  const [billPage, setBillPage] = useState(1);

  // Payout Filters & Pagination
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutStatus, setPayoutStatus] = useState<'all' | 'pending' | 'processing' | 'approved' | 'rejected'>('all');
  const [payoutStartDate, setPayoutStartDate] = useState('');
  const [payoutEndDate, setPayoutEndDate] = useState('');
  const [payoutPage, setPayoutPage] = useState(1);

  const itemsPerPage = 10;

  const clearQrFilters = () => {
    setQrSearch('');
    setQrStatus('all');
    setQrStartDate('');
    setQrEndDate('');
    setQrPage(1);
  };

  const clearBillFilters = () => {
    setBillSearch('');
    setBillStatus('all');
    setBillStartDate('');
    setBillEndDate('');
    setBillPage(1);
  };

  const clearPayoutFilters = () => {
    setPayoutSearch('');
    setPayoutStatus('all');
    setPayoutStartDate('');
    setPayoutEndDate('');
    setPayoutPage(1);
  };

  const [userBalance, setUserBalance] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [slabs, setSlabs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch User Profile
        const { data: userData, error: userError } = await supabase
          .from('users_profiles')
          .select('wallet_balance, service_charge_enabled, custom_service_charge, firm_name')
          .eq('id', userId)
          .single();
        
        if (!userError && userData) {
          setUserProfile(userData);
          setUserBalance(Number(userData.wallet_balance) || 0);
        }

        // Fetch Service Charge Slabs
        const { data: slabData } = await supabase
          .from('service_charge_slabs')
          .select('*')
          .eq('is_active', true)
          .order('min_amount', { ascending: true });
        setSlabs(slabData || []);

        // Fetch QR
        const { data: qrData, error: qrError } = await supabase
          .from('qr_settings')
          .select('qr_url, is_enabled')
          .eq('id', 1)
          .single();

        if (!qrError && qrData && qrData.is_enabled) {
          setQrUrl(qrData.qr_url);
        }

        // Fetch Current Active QR ID from History
        const { data: activeQR } = await supabase
          .from('qr_history')
          .select('id, qr_name')
          .eq('is_active', true)
          .single();
        
        if (activeQR) {
          setActiveQrId(activeQR.id);
          setQrName(activeQR.qr_name);
        }

        // Fetch Global Settings (QR & Bill status)
        const { data: globalSettings } = await supabase
          .from('qr_settings')
          .select('is_bill_enabled')
          .eq('id', 1)
          .single();
        
        if (globalSettings) {
          setIsBillEnabled(globalSettings.is_bill_enabled ?? true);
          // Auto-switch if bill is active but disabled
          if (!globalSettings.is_bill_enabled && activeTab === 'bill') {
            setActiveTab('qr');
          }
        }

        // Fetch Banks
        const { data: bankData, error: bankError } = await supabase
          .from('bank_details')
          .select('id, bank_name')
          .eq('is_active', true)
          .order('bank_name');

        if (!bankError) {
          setBanks(bankData || []);
        }

        // Fetch Initial Requests - Fetch more for pagination/filtering
        const { data: qrReqs } = await supabase
          .from('payment_submissions')
          .select('*, qr_history(qr_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        setQrRequests(qrReqs || []);

        const { data: billReqs } = await supabase
          .from('bill_submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        setBillRequests(billReqs || []);

        // Fetch Payout Banks
        const { data: pBankData } = await supabase
          .from('bank_details')
          .select('bank_name')
          .eq('show_in_payout', true)
          .eq('is_active', true)
          .order('bank_name');
        setPayoutBanks(pBankData || []);

        // Fetch Payout Settings
        const { data: pSettings } = await supabase
          .from('payout_settings')
          .select('*')
          .eq('id', 1)
          .single();
        setPayoutSettings(pSettings);

        // If payout is disabled and active tab is payout, switch to qr
        if (pSettings && !pSettings.is_enabled && activeTab === 'payout') {
          setActiveTab('qr');
        }

        // Fetch Payout Requests
        const { data: pReqs } = await supabase
          .from('payout_submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        setPayoutRequests(pReqs || []);

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoadingQr(false);
        setLoadingBanks(false);
      }
    };

    fetchData();

    // even more robust real-time handling with duplicate check
    const qrChannel = supabase
      .channel('qr_submissions_realtime_v3')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payment_submissions'
      }, async (payload: any) => {
        if (payload.new && payload.new.user_id === userId) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the full record with join for real-time updates too
            const { data: fullRecord } = await supabase
              .from('payment_submissions')
              .select('*, qr_history(qr_name)')
              .eq('id', payload.new.id)
              .single();
            
            const updatedRecord = fullRecord || payload.new;

            if (payload.eventType === 'INSERT') {
              setQrRequests(prev => {
                if (prev.some(req => req.id === updatedRecord.id)) return prev;
                return [updatedRecord, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              setQrRequests(prev => prev.map(req => req.id === updatedRecord.id ? updatedRecord : req));
            }
          } // closes: if (payload.eventType === 'INSERT' || 'UPDATE')
        } // closes: if (payload.new && payload.new.user_id === userId)
        if (payload.eventType === 'DELETE' && payload.old && payload.old.user_id === userId) {
          setQrRequests(prev => prev.filter(req => req.id !== payload.old.id));
        }
      })
      .subscribe();

    const billChannel = supabase
      .channel('bill_submissions_realtime_final')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bill_submissions'
      }, (payload: any) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          if (payload.new.user_id === userId) {
            setBillRequests(prev => prev.map(req => req.id === payload.new.id ? payload.new : req));
          }
        } 
        // Handle INSERT event
        else if (payload.eventType === 'INSERT' && payload.new) {
          if (payload.new.user_id === userId) {
            setBillRequests(prev => {
              if (prev.some(req => req.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          }
        }
        // Handle DELETE event
        else if (payload.eventType === 'DELETE' && payload.old) {
          setBillRequests(prev => prev.filter(req => req.id !== payload.old.id));
        }
      })
      .subscribe();

    const payoutChannel = supabase
      .channel('payout_submissions_realtime_v1')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payout_submissions'
      }, (payload: any) => {
        if (payload.new && payload.new.user_id === userId) {
          if (payload.eventType === 'INSERT') {
            setPayoutRequests(prev => {
              if (prev.some(req => req.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setPayoutRequests(prev => prev.map(req => req.id === payload.new.id ? payload.new : req));
          }
        }
        if (payload.eventType === 'DELETE' && payload.old && payload.old.user_id === userId) {
          setPayoutRequests(prev => prev.filter(req => req.id !== payload.old.id));
        }
      })
      .subscribe();

    const payoutSettingsChannel = supabase
      .channel('payout_settings_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payout_settings',
        filter: 'id=eq.1'
      }, (payload: any) => {
        console.log('Payout settings updated:', payload.new);
        setPayoutSettings(payload.new);
        if (payload.new && !payload.new.is_enabled && activeTab === 'payout') {
          setActiveTab('qr');
        }
      })
      .subscribe();

    const profileChannel = supabase
      .channel(`profile_realtime_payment_${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users_profiles',
        filter: `id=eq.${userId}`
      }, (payload) => {
        setUserProfile(payload.new);
        setUserBalance(Number(payload.new.wallet_balance) || 0);
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('qr_settings_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'qr_settings',
        filter: 'id=eq.1'
      }, (payload: any) => {
        const isEnabled = payload.new?.is_enabled;
        // Only update URL if enabled
        if (isEnabled) {
          setQrUrl(payload.new.qr_url);
        } else {
          setQrUrl(null);
        }

        // Sync Bill status
        const billEnabled = payload.new.is_bill_enabled ?? true;
        setIsBillEnabled(billEnabled);
        if (!billEnabled && activeTab === 'bill') {
          setActiveTab('qr');
        }
      })
      .subscribe();

    const historyChannel = supabase
      .channel('qr_history_realtime')
      .on('postgres_changes', {
        event: '*', // Listen for all changes to ensure we catch active status flips
        schema: 'public',
        table: 'qr_history'
      }, (payload: any) => {
        if (payload.new && payload.new.is_active) {
          setActiveQrId(payload.new.id);
          setQrUrl(payload.new.qr_url);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(qrChannel);
      supabase.removeChannel(billChannel);
      supabase.removeChannel(payoutChannel);
      supabase.removeChannel(payoutSettingsChannel);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [userId, activeTab]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const calculateBillCharge = (amount: number) => {
    if (!userProfile) return 0;
    
    if (userProfile.service_charge_enabled) {
      return Number(userProfile.custom_service_charge) || 0;
    }
    
    const slab = slabs.find(s => amount >= s.min_amount && amount <= s.max_amount);
    if (slab) {
      if (slab.is_percentage) {
        return (amount * slab.charge_amount) / 100;
      }
      return slab.charge_amount;
    }
    return 0;
  };

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billForm.customerMobile || !billForm.cardBank || !billForm.cardNumber || !billForm.cardOwnerName || !billForm.billAmount) {
      setError('Please fill all fields for bill payment.');
      return;
    }

    if (billForm.customerMobile.length !== 10) {
      setError('Customer mobile must be exactly 10 digits.');
      return;
    }

    if (billForm.cardNumber.length !== 4) {
      setError('Card number must be exactly 4 digits.');
      return;
    }

    setSubmittingBill(true);
    setError(null);
    setSuccess(null);

    const billAmountNum = parseFloat(billForm.billAmount);
    if (isNaN(billAmountNum) || billAmountNum <= 0) {
      setError('Please enter a valid bill amount greater than 0.');
      setSubmittingBill(false);
      return;
    }
    const serviceCharge = calculateBillCharge(billAmountNum);
    const totalDeduction = billAmountNum + serviceCharge;

    if (userBalance - totalDeduction < 250) {
      setError("Your balance is insufficient, make sure to keep more than 250 inr as a balance.");
      setSubmittingBill(false);
      return;
    }

    try {
      // 1. Atomic RPC call for submission (Deduct + Insert)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_bill_payment', {
        p_user_id: userId,
        p_customer_mobile: billForm.customerMobile,
        p_card_bank: billForm.cardBank,
        p_card_number: billForm.cardNumber,
        p_card_owner_name: billForm.cardOwnerName,
        p_amount: billAmountNum,
        p_charges: serviceCharge
      });

      if (rpcError) throw rpcError;
      if (!rpcResult.success) throw new Error(rpcResult.message);

      // Real-time subscription will update the list and wallet balance
      setSuccess('Bill payment submitted successfully! Total amount (including charges) has been debited from your wallet.');
      setBillForm({
        customerMobile: '',
        cardBank: '',
        cardNumber: '',
        cardOwnerName: '',
        billAmount: ''
      });

      // 3. Notify Admin about the new Bill Payment
      const { error: nError } = await supabase
        .from('notifications')
        .insert([{
          target_role: 'admin',
          title: 'New Bill Payment Request',
          message: `User ${userProfile?.firm_name || userProfile?.name || userId} submitted a bill payment of ₹${billAmountNum}.`,
          link: '/bill-payment-requests'
        }]);
      
      if (nError) {
        console.error('Bill Notification Error (Admin):', nError);
      } else {
        console.log('Bill Notification sent to admin!');
        // 4. Send Push Notification to Admin (Mobile)
        sendAdminPushNotification(
          'New Bill Payment Request 💳',
          `User ${userProfile?.firm_name || userProfile?.name || userId} submitted a bill payment of ₹${billAmountNum}.`,
          '/bill-payment-requests'
        );
      }
    } catch (err: any) {
      console.error('Error submitting bill:', err);
      setError(err.message || 'Failed to submit bill payment.');
    } finally {
      setSubmittingBill(false);
    }
  };

  const calculatePayoutCharge = (amount: number) => {
    if (!payoutSettings) return 0;
    if (payoutSettings.is_percentage) {
      return (amount * payoutSettings.fixed_charge) / 100;
    }
    return payoutSettings.fixed_charge;
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutForm.bankName || !payoutForm.holderName || !payoutForm.accountNumber || !payoutForm.ifscCode || !payoutForm.amount) {
      setError('Please fill all fields for payout.');
      return;
    }

    setSubmittingPayout(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(payoutForm.amount);
    if (payoutSettings && amountNum < payoutSettings.min_payout) {
      setError(`Minimum payout amount is ₹${payoutSettings.min_payout}.`);
      setSubmittingPayout(false);
      return;
    }
    if (payoutSettings && amountNum > payoutSettings.max_payout) {
      setError(`Maximum payout amount is ₹${payoutSettings.max_payout}.`);
      setSubmittingPayout(false);
      return;
    }

    const charge = calculatePayoutCharge(amountNum);
    const totalDeduction = amountNum + charge;

    // Fetch fresh balance and profiles to be safe
    const { data: currentProf } = await supabase.from('users_profiles').select('wallet_balance').eq('id', userId).single();
    const currentWallet = Number(currentProf?.wallet_balance) || 0;

    if (currentWallet - totalDeduction < 250) {
      setError("Your balance is insufficient. You must maintain at least ₹250 in your wallet.");
      setSubmittingPayout(false);
      return;
    }

    try {
      // 1. Atomic RPC call for payout (Deduct + Insert)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_payout_payment', {
        p_user_id: userId,
        p_bank_name: payoutForm.bankName,
        p_holder_name: payoutForm.holderName,
        p_account_number: payoutForm.accountNumber,
        p_ifsc_code: payoutForm.ifscCode,
        p_amount: amountNum,
        p_charges: charge
      });

      if (rpcError) throw rpcError;
      if (!rpcResult.success) throw new Error(rpcResult.message);

      setSuccess('Payout request submitted successfully! Total amount (including charges) has been debited from your wallet.');
      setPayoutForm({
        bankName: '',
        holderName: '',
        accountNumber: '',
        ifscCode: '',
        amount: ''
      });

      // 3. Notify Admin
      sendAdminPushNotification(
        'New Payout Request 💰',
        `User ${userProfile?.firm_name || userProfile?.name || userId} requested a payout of ₹${amountNum}.`,
        '/payout-requests'
      );
      
    } catch (err: any) {
      console.error('Error submitting payout:', err);
      setError(err.message || 'Failed to submit payout.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrId || !amount || !file) {
      setError('Please fill all fields and upload payment proof.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount);
    
    try {
      // 0. Check if UTR already exists and is pending or approved
      const { data: existingRequests, error: checkError } = await supabase
        .from('payment_submissions')
        .select('id, status')
        .eq('utr_id', utrId)
        .in('status', ['pending', 'approved'])
        .limit(1);

      if (checkError) throw checkError;
      if (existingRequests && existingRequests.length > 0) {
        const existingRequest = existingRequests[0];
        const message = existingRequest.status === 'pending' 
          ? 'A request with this UTR ID is already pending. Please wait for admin approval.'
          : 'A request with this UTR ID has already been approved.';
        setError(message);
        setSubmitting(false);
        return;
      }

      // 1. Upload proof
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `payment_proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment_proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment_proofs')
        .getPublicUrl(filePath);

      // 2. Insert record
      const { data: newPayment, error: dbError } = await supabase
        .from('payment_submissions')
        .insert([{
          user_id: userId,
          qr_id: activeQrId,
          utr_id: utrId,
          card_number: qrCardNumber,
          amount: parseFloat(amount),
          proof_url: publicUrl,
          status: 'pending'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      if (newPayment) {
        // Real-time subscription will handle adding this to the list
      }

      setSuccess('Payment submitted successfully! Our team will verify it soon.');
      setUtrId('');
      setQrCardNumber('');
      setAmount('');
      setFile(null);

      // 4. Notify Admin about the new QR Payment
      const { error: nError } = await supabase
        .from('notifications')
        .insert([{
          target_role: 'admin',
          title: 'New QR Payment Request',
          message: `User ${userProfile?.firm_name || userProfile?.name || userId} submitted a QR payment of ₹${amountNum}.`,
          link: '/qr-payment-requests'
        }]);
      
      if (nError) {
        console.error('QR Notification Error (Admin):', nError);
      } else {
        console.log('QR Notification sent to admin!');
        // 5. Send Push Notification to Admin (Mobile)
        sendAdminPushNotification(
          'New QR Payment Request 🔔',
          `User ${userProfile?.firm_name || userProfile?.name || userId} submitted ₹${amountNum}. Review now!`,
          '/qr-payment-requests'
        );
      }
    } catch (err: any) {
      console.error('Error submitting payment:', err);
      setError(err.message || 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Payments</h2>
        <p className="text-slate-500 mt-1">Make secure payments via QR or pay your bills.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm transition-all ${
              activeTab === 'qr' 
                ? 'text-emerald-600 bg-emerald-50/50 border-b-2 border-emerald-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <QrCode size={18} />
            QR Payment
          </button>
          <button
            onClick={() => setActiveTab('bill')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm transition-all ${
              activeTab === 'bill' 
                ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Receipt size={18} />
            Bill Payment
          </button>
          
          <button
            onClick={() => {
              if (payoutSettings?.is_enabled !== false) {
                setActiveTab('payout');
              }
            }}
            disabled={payoutSettings?.is_enabled === false}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm transition-all ${
              payoutSettings?.is_enabled === false 
                ? 'opacity-40 grayscale cursor-not-allowed text-slate-400' 
                : activeTab === 'payout' 
                  ? 'text-amber-600 bg-amber-50/50 border-b-2 border-amber-600' 
                  : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <History size={18} />
            Payout Request
            {payoutSettings?.is_enabled === false && (
              <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md border border-slate-200">OFF</span>
            )}
          </button>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'qr' ? (
              <motion.div
                key="qr-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-full space-y-12"
              >
                <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="flex flex-col items-center text-center">
                  <div className="w-full aspect-square bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center mb-6 overflow-hidden">
                    {loadingQr ? (
                      <Loader2 className="animate-spin text-slate-300" size={48} />
                    ) : qrUrl ? (
                      <img 
                        src={qrUrl} 
                        alt="Payment QR" 
                        className="w-full h-full object-contain p-4"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-4 text-slate-400">
                        <QrCode size={64} strokeWidth={1.5} />
                        <p className="text-sm font-medium">QR Not Available</p>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-1">{qrName || 'Scan QR to Pay'}</h3>
                  <h4 className="text-lg font-bold text-slate-900">Scan QR to Pay</h4>
                  <p className="text-sm text-slate-500 mt-2">Scan the QR code above and complete the payment using any UPI app.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">UTR ID / Transaction ID</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text"
                        inputMode="numeric" 
                        value={utrId}
                        onChange={(e) => setUtrId(e.target.value.replace(/\D/g, '').slice(0, 20))}
                        maxLength={20}
                        placeholder="Enter UTR"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Card Number (Last 4 Digits)</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text"
                        inputMode="numeric" 
                        value={qrCardNumber}
                        onChange={(e) => setQrCardNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        placeholder="Enter Last 4 Digits"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Amount Paid</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) return;
                          setAmount(val);
                        }}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Payment Screenshot</label>
                    <label className="relative flex items-center justify-center w-full h-32 px-4 transition bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl appearance-none cursor-pointer hover:border-emerald-400 focus:outline-none group">
                      <div className="flex flex-col items-center space-y-2">
                        {file ? (
                          <>
                            <CheckCircle2 className="text-emerald-500" size={24} />
                            <span className="text-xs font-medium text-slate-600 truncate max-w-[200px]">{file.name}</span>
                          </>
                        ) : (
                          <>
                            <Upload className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={24} />
                            <span className="text-xs font-medium text-slate-500">Click to upload screenshot</span>
                          </>
                        )}
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} required />
                    </label>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2"
                      >
                        <AlertCircle size={14} />
                        {error}
                      </motion.div>
                    )}
                    {success && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold flex items-center gap-2"
                      >
                        <CheckCircle2 size={14} />
                        {success}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
                </div>

                {/* Recent QR Requests */}
                <div className="mt-12 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-slate-900">QR Payment History</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Start</span>
                          <input 
                            type="date" 
                            value={qrStartDate}
                            onChange={(e) => setQrStartDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                          />
                        </div>
                        <div className="w-px h-6 bg-slate-100 mx-1"></div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">End</span>
                          <input 
                            type="date" 
                            value={qrEndDate}
                            onChange={(e) => setQrEndDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={clearQrFilters}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white"
                        title="Clear All Filters"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <select 
                        value={qrStatus}
                        onChange={(e) => setQrStatus(e.target.value as any)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search UTR..."
                          value={qrSearch}
                          onChange={(e) => setQrSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all w-48"
                        />
                      </div>
                    </div>
                  </div>
                  
                   <div className="hidden md:grid grid-cols-10 gap-4 px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">
                     <div className="col-span-1">Date / Time</div>
                     <div className="col-span-1">UTR ID</div>
                     <div className="col-span-1">Card No</div>
                     <div className="col-span-1">QR Name</div>
                     <div className="col-span-1">Amount</div>
                     <div className="col-span-1">Service Charge</div>
                     <div className="col-span-1">Credited Amount</div>
                     <div className="col-span-1">Reason</div>
                     <div className="col-span-1">Status</div>
                     <div className="col-span-1">Proof</div>
                   </div>

                  <div className="grid grid-cols-1 gap-3">
                    {(() => {
                      const filtered = qrRequests.filter(req => {
                        const matchesSearch = req.utr_id.toLowerCase().includes(qrSearch.toLowerCase());
                        const matchesStatus = qrStatus === 'all' || req.status === qrStatus;
                        
                        const reqDate = new Date(req.created_at);
                        reqDate.setHours(0, 0, 0, 0);
                        const start = qrStartDate ? new Date(qrStartDate) : null;
                        if (start) start.setHours(0, 0, 0, 0);
                        const end = qrEndDate ? new Date(qrEndDate) : null;
                        if (end) end.setHours(0, 0, 0, 0);
                        
                        const matchesStartDate = !start || reqDate >= start;
                        const matchesEndDate = !end || reqDate <= end;
                        
                        return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
                      });

                      const totalPages = Math.ceil(filtered.length / itemsPerPage);
                      const paginated = filtered.slice((qrPage - 1) * itemsPerPage, qrPage * itemsPerPage);

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                            <p className="text-sm text-slate-400 font-medium">No requests found</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {paginated.map((req) => (
                            <React.Fragment key={req.id}>
                              <div 
                                onClick={() => {
                                  if (req.status === 'rejected') {
                                    setExpandedRowId(expandedRowId === req.id ? null : req.id);
                                  }
                                }}
                               className={`bg-white p-4 md:px-6 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-10 gap-4 items-center group hover:border-emerald-200 transition-all ${req.status === 'rejected' ? 'cursor-pointer' : ''} ${expandedRowId === req.id ? 'border-rose-200 bg-rose-50/10' : ''}`}
                              >
                                {/* Date / Time */}
                                <div className="text-center">
                                  <p className="text-[11px] font-bold text-slate-900">{new Date(req.created_at).toLocaleDateString()}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                </div>

                                 {/* UTR ID */}
                                 <div className="text-center">
                                   <p className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                                     {req.utr_id}
                                   </p>
                                 </div>

                                 {/* Card No */}
                                 <div className="text-center">
                                   <p className="text-[11px] font-bold text-slate-900">
                                     {req.card_number || '****'}
                                   </p>
                                 </div>

                                {/* QR Name */}
                                <div className="text-center">
                                  <p className="text-[11px] font-bold text-slate-600">
                                    {(req as any).qr_history?.qr_name || 'N/A'}
                                  </p>
                                </div>

                                {/* Amount */}
                                <div className="text-center">
                                  <p className="text-sm font-bold text-slate-900">₹{Number(req.amount).toFixed(2)}</p>
                                </div>

                                {/* Charges */}
                                <div className="text-center">
                                  <p className="text-sm font-bold text-emerald-600">₹{Number(req.charges || 0).toFixed(2)}</p>
                                </div>

                                {/* Credited Amount */}
                                <div className="text-center">
                                  <p className="text-sm font-bold text-indigo-600">₹{(Number(req.amount) - Number(req.charges || 0)).toFixed(2)}</p>
                                </div>

                                {/* Reason */}
                                <div className="flex justify-center">
                                  {req.status === 'rejected' ? (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedRowId(expandedRowId === req.id ? null : req.id);
                                      }}
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1"
                                    >
                                      {expandedRowId === req.id ? 'Hide' : 'View'}
                                    </button>
                                  ) : (
                                    <p className="text-[11px] font-medium text-slate-500">-</p>
                                  )}
                                </div>

                                {/* Status */}
                                <div className="flex justify-center">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-500' :
                                    req.status === 'rejected' ? 'bg-rose-50 text-rose-500' :
                                    'bg-amber-50 text-amber-600'
                                  }`}>
                                    {req.status}
                                  </span>
                                </div>

                                {/* Proof */}
                                <div className="flex justify-center">
                                  {req.proof_url && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedProof(req.proof_url);
                                      }}
                                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg"
                                    >
                                      View
                                      <ExternalLink size={10} />
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
                                    <div className="mt-2 p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between gap-4">
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
                                        className="p-2 bg-white border border-rose-100 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-center shadow-sm"
                                        title="Shrink"
                                      >
                                        <ChevronUp size={16} />
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          ))}

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm mt-4">
                              <p className="text-xs text-slate-500 font-medium">
                                Showing <span className="text-slate-900 font-bold">{(qrPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(qrPage * itemsPerPage, filtered.length)}</span> of <span className="text-slate-900 font-bold">{filtered.length}</span>
                              </p>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setQrPage(prev => Math.max(prev - 1, 1))}
                                  disabled={qrPage === 1}
                                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  Prev
                                </button>
                                <button 
                                  onClick={() => setQrPage(prev => Math.min(prev + 1, totalPages))}
                                  disabled={qrPage === totalPages}
                                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'bill' ? (
              <motion.div
                key="bill-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-12"
              >
                {!isBillEnabled ? (
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-12 text-center max-w-4xl mx-auto">
                    <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6">
                      <Clock size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Service Temporarily Offline</h3>
                    <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                      Our Bill Payment service is currently under maintenance or temporarily disabled by the administrator. Please check back later or use QR payment for urgent transactions.
                    </p>
                    <div className="mt-8 flex justify-center">
                      <button 
                        onClick={() => setActiveTab('qr')}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                      >
                        <QrCode size={20} />
                        Use QR Payment Instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                  {/* Bill Form */}
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 md:p-12 relative overflow-hidden">
                <div className="max-w-4xl mx-auto">
                  <form onSubmit={handleBillSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Customer Mobile */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Customer Mobile:</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={billForm.customerMobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setBillForm({...billForm, customerMobile: val});
                        }}
                        placeholder="10-digit Mobile Number"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Card Bank */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Card Bank:</label>
                      <select 
                        value={billForm.cardBank}
                        onChange={(e) => setBillForm({...billForm, cardBank: e.target.value})}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                        required
                      >
                        <option value="">-- Select Bank --</option>
                        {banks.map(bank => (
                          <option key={bank.id} value={bank.bank_name}>{bank.bank_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Card Number */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Card Number (Last 4 Digits):</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={billForm.cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setBillForm({...billForm, cardNumber: val});
                        }}
                        placeholder="Last 4 Digits"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Card Owner Name */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Card Owner Name:</label>
                      <input 
                        type="text"
                        value={billForm.cardOwnerName}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                          setBillForm({...billForm, cardOwnerName: val});
                        }}
                        placeholder="Enter Name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Bill Amount */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Bill Amount:</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={billForm.billAmount}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          // Allow only one decimal point
                          const parts = val.split('.');
                          if (parts.length > 2) return;
                          setBillForm({...billForm, billAmount: val});
                        }}
                        placeholder="Enter Amount"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold flex items-center gap-2"
                      >
                        <AlertCircle size={18} />
                        {error}
                      </motion.div>
                    )}
                    {success && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold flex items-center gap-2"
                      >
                        <CheckCircle2 size={18} />
                        {success}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="submit"
                      disabled={submittingBill}
                      className="px-12 py-4 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 uppercase"
                    >
                      {submittingBill ? <Loader2 className="animate-spin" size={20} /> : null}
                      SUBMIT
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBillForm({
                        customerMobile: '',
                        cardBank: '',
                        cardNumber: '',
                        cardOwnerName: '',
                        billAmount: ''
                      })}
                      className="px-12 py-4 bg-[#1F2937] hover:bg-[#111827] text-white rounded-xl font-bold transition-all uppercase"
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
                </div>

                {/* Recent Bill Requests */}
                <div className="mt-12 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-slate-900">Bill Payment History</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Start</span>
                          <input 
                            type="date" 
                            value={billStartDate}
                            onChange={(e) => setBillStartDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                          />
                        </div>
                        <div className="w-px h-6 bg-slate-100 mx-1"></div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">End</span>
                          <input 
                            type="date" 
                            value={billEndDate}
                            onChange={(e) => setBillEndDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={clearBillFilters}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white"
                        title="Clear All Filters"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <select 
                        value={billStatus}
                        onChange={(e) => setBillStatus(e.target.value as any)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="refunded">Refund Policy</option>
                      </select>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search Mobile or Name..."
                          value={billSearch}
                          onChange={(e) => setBillSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-48"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:grid grid-cols-7 gap-4 px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">
                    <div className="col-span-1">Date / Time</div>
                    <div className="col-span-1">Bank / Mobile</div>
                    <div className="col-span-1">Card Info</div>
                    <div className="col-span-1">Amount</div>
                    <div className="col-span-1">Service Charge</div>
                    <div className="col-span-1">Debited Amount</div>
                    <div className="col-span-1">Status</div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {(() => {
                      const filtered = billRequests.filter(req => {
                        const matchesSearch = 
                          req.customer_mobile.includes(billSearch) ||
                          req.card_owner_name.toLowerCase().includes(billSearch.toLowerCase());
                        const matchesStatus = billStatus === 'all' || req.status === billStatus;
                        
                        const reqDate = new Date(req.created_at);
                        reqDate.setHours(0, 0, 0, 0);
                        const start = billStartDate ? new Date(billStartDate) : null;
                        if (start) start.setHours(0, 0, 0, 0);
                        const end = billEndDate ? new Date(billEndDate) : null;
                        if (end) end.setHours(0, 0, 0, 0);
                        
                        const matchesStartDate = !start || reqDate >= start;
                        const matchesEndDate = !end || reqDate <= end;
                        
                        return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
                      });

                      const totalPages = Math.ceil(filtered.length / itemsPerPage);
                      const paginated = filtered.slice((billPage - 1) * itemsPerPage, billPage * itemsPerPage);

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                            <p className="text-sm text-slate-400 font-medium">No requests found</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {paginated.map((req) => (
                            <React.Fragment key={req.id}>
                              <div 
                                onClick={() => {
                                  if (req.status === 'rejected') {
                                    setExpandedRowId(expandedRowId === req.id ? null : req.id);
                                  }
                                }}
                                className={`bg-white p-4 md:px-6 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-7 gap-4 items-center group hover:border-indigo-200 transition-all ${req.status === 'rejected' ? 'cursor-pointer' : ''} ${expandedRowId === req.id ? 'border-rose-200 bg-rose-50/10' : ''}`}
                              >
                                {/* Date / Time */}
                                <div className="text-center">
                                  <p className="text-[11px] font-bold text-slate-900">{new Date(req.created_at).toLocaleDateString()}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                </div>

                                {/* Bank / Mobile */}
                                <div className="text-center">
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

                                {/* Amount */}
                                <div className="text-center">
                                  <p className="text-sm font-bold text-slate-900">₹{Number(req.amount).toFixed(2)}</p>
                                </div>

                                {/* Service Charge */}
                                <div className="text-center">
                                  <p className="text-sm font-bold text-rose-600">₹{Number(req.charges || 0).toFixed(2)}</p>
                                </div>

                                {/* Debited Amount */}
                                <div className="text-center">
                                  <p className="text-sm font-bold text-indigo-600">₹{(Number(req.amount) + Number(req.charges || 0)).toFixed(2)}</p>
                                </div>

                                {/* Status */}
                                <div className="flex md:justify-center items-center gap-3">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-500' :
                                    req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                                    req.status === 'refunded' ? 'bg-indigo-50 text-indigo-600' :
                                    'bg-amber-50 text-amber-600'
                                  }`}>
                                    {req.status === 'refunded' ? 'Refund Policy' : req.status}
                                  </span>
                                  {req.status === 'rejected' && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedRowId(expandedRowId === req.id ? null : req.id);
                                      }}
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg"
                                    >
                                      {expandedRowId === req.id ? 'Hide' : 'View'}
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
                                    <div className="mt-2 p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between gap-4">
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
                                        className="p-2 bg-white border border-rose-100 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-center shadow-sm"
                                        title="Shrink"
                                      >
                                        <ChevronUp size={16} />
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          ))}

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm mt-4">
                              <p className="text-xs text-slate-500 font-medium">
                                Showing <span className="text-slate-900 font-bold">{(billPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(billPage * itemsPerPage, filtered.length)}</span> of <span className="text-slate-900 font-bold">{filtered.length}</span>
                              </p>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setBillPage(prev => Math.max(prev - 1, 1))}
                                  disabled={billPage === 1}
                                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  Prev
                                </button>
                                <button 
                                  onClick={() => setBillPage(prev => Math.min(prev + 1, totalPages))}
                                  disabled={billPage === totalPages}
                                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
            )}
          </motion.div>
        ) : (
              <motion.div
                key="payout-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-12"
              >
                <div className="max-w-4xl mx-auto">
                  <header className="mb-8 p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-center gap-6">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0 shadow-sm border border-amber-200">
                      <IndianRupee size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-amber-900">Withdraw Funds</h3>
                      <p className="text-sm text-amber-600/80 font-medium">Request to move your wallet balance to your bank account.</p>
                      {payoutSettings && (
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs font-bold text-amber-500 bg-white px-2 py-0.5 rounded-lg border border-amber-100">
                            Min: ₹{payoutSettings.min_payout}
                          </span>
                          <span className="text-xs font-bold text-amber-500 bg-white px-2 py-0.5 rounded-lg border border-amber-100">
                            Charge: {payoutSettings.is_percentage ? `${payoutSettings.fixed_charge}%` : `₹${payoutSettings.fixed_charge}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </header>

                  <form onSubmit={handlePayoutSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Bank Name:</label>
                        <select 
                          value={payoutForm.bankName}
                          onChange={(e) => setPayoutForm({...payoutForm, bankName: e.target.value})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all appearance-none"
                          required
                        >
                          <option value="">-- Select Bank --</option>
                          {payoutBanks.map(bank => (
                            <option key={bank.bank_name} value={bank.bank_name}>{bank.bank_name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">A/c Holder Name:</label>
                        <input 
                          type="text"
                          value={payoutForm.holderName}
                          onChange={(e) => setPayoutForm({...payoutForm, holderName: e.target.value})}
                          placeholder="Enter Holder Name"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Account Number:</label>
                        <input 
                          type="text"
                          value={payoutForm.accountNumber}
                          onChange={(e) => setPayoutForm({...payoutForm, accountNumber: e.target.value.replace(/\D/g, '')})}
                          placeholder="Enter Account Number"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">IFSC Code:</label>
                        <input 
                          type="text"
                          value={payoutForm.ifscCode}
                          onChange={(e) => setPayoutForm({...payoutForm, ifscCode: e.target.value.toUpperCase()})}
                          placeholder="Enter IFSC Code"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Amount:</label>
                        <input 
                          type="number"
                          value={payoutForm.amount}
                          onChange={(e) => setPayoutForm({...payoutForm, amount: e.target.value})}
                          placeholder="0.00"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-bold"
                          required
                        />
                      </div>
                      <div className="flex items-end pb-0.5">
                        <button 
                          type="submit"
                          disabled={submittingPayout}
                          className="w-full px-12 py-[13px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2 disabled:opacity-50 uppercase whitespace-nowrap"
                        >
                          {submittingPayout ? <Loader2 className="animate-spin" size={20} /> : null}
                          REQUEST PAYOUT
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold flex items-center gap-2"
                        >
                          <AlertCircle size={18} />
                          {error}
                        </motion.div>
                      )}
                      {success && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold flex items-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          {success}
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </form>
                </div>

                <div className="mt-12 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-slate-900">Payout History</h3>
                    <div className="flex flex-wrap items-center gap-2">
                       <select 
                        value={payoutStatus}
                        onChange={(e) => setPayoutStatus(e.target.value as any)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search Bank..."
                          value={payoutSearch}
                          onChange={(e) => setPayoutSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none transition-all w-48 focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {payoutRequests.filter(r => {
                      const mSearch = r.bank_name.toLowerCase().includes(payoutSearch.toLowerCase());
                      const mStatus = payoutStatus === 'all' || r.status === payoutStatus;
                      return mSearch && mStatus;
                    }).map((req) => (
                      <PayoutRequestCard 
                        key={req.id} 
                        req={req} 
                        settings={payoutSettings} 
                        onViewProof={setSelectedProof}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Proof Preview Modal */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-fit max-w-[95vw] max-h-[95vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => setSelectedProof(null)}
                  className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 bg-slate-50 flex items-center justify-center overflow-hidden p-2 md:p-4">
                <img 
                  src={selectedProof} 
                  alt="Payment Proof" 
                  className="max-w-full max-h-[calc(95vh-120px)] object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Payment Screenshot</h4>
                  <p className="text-xs text-slate-400 font-medium">Verification proof submitted by you</p>
                </div>
                <button 
                  onClick={() => setSelectedProof(null)}
                  className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PayoutRequestCard({ req, settings, onViewProof }: { req: any; settings: any; onViewProof: (url: string) => void; key?: any }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if ((req.status !== 'processing' && req.status !== 'pending') || !settings) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      if (req.status === 'pending') {
        const startTime = new Date(req.created_at).getTime();
        const elapsedSecs = (now - startTime) / 1000;
        const pendingLimitSecs = (settings.pending_time_mins || 15) * 60;
        
        setStage(1); 
        if (elapsedSecs < pendingLimitSecs) {
          setTimeLeft(Math.max(0, Math.floor(pendingLimitSecs - elapsedSecs)));
        } else {
          setTimeLeft(0);
        }
      } else if (req.status === 'processing' && req.processing_started_at) {
        const startTime = new Date(req.processing_started_at).getTime();
        const elapsedSecs = (now - startTime) / 1000;
        
        const stage1LimitSecs = settings.processing_time_1_mins * 60;
        const stage2LimitSecs = settings.processing_time_2_mins * 60;

        if (elapsedSecs < stage1LimitSecs) {
          setStage(1);
          setTimeLeft(Math.max(0, Math.floor(stage1LimitSecs - elapsedSecs)));
        } else if (elapsedSecs < stage1LimitSecs + stage2LimitSecs) {
          setStage(2);
          setTimeLeft(Math.max(0, Math.floor((stage1LimitSecs + stage2LimitSecs) - elapsedSecs)));
        } else {
          setStage(3);
          setTimeLeft(0);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [req.status, req.processing_started_at, req.created_at, settings]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:border-amber-200 transition-all ${req.status === 'processing' ? 'ring-2 ring-amber-500/5' : ''}`}>
      <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
            <Building2 size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{req.bank_name}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(req.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
           <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 text-right">Amount</p>
            <p className="text-base font-black text-slate-900 text-right">₹{req.amount.toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-slate-100"></div>
          <div className="flex flex-col items-end min-w-[100px]">
             <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
               req.status === 'approved' ? 'bg-emerald-50 text-emerald-500' :
               req.status === 'rejected' ? 'bg-rose-50 text-rose-500' :
               req.status === 'processing' ? 'bg-amber-50 text-amber-600' :
               'bg-slate-100 text-slate-600'
             }`}>
               {req.status === 'approved' ? 'Completed' : req.status}
             </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <User size={12} className="text-slate-300" />
          {req.account_holder_name}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <CreditCard size={12} className="text-slate-300" />
          ****{req.account_number.slice(-4)}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <ShieldCheck size={12} className="text-slate-300" />
          {req.ifsc_code}
        </div>
      </div>

      {(req.status === 'processing' || req.status === 'pending') && timeLeft !== null && (
        <div className={`p-4 ${req.status === 'pending' ? 'bg-indigo-50/50 border-indigo-100' : 'bg-amber-50/50 border-amber-100'} border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${req.status === 'pending' ? 'bg-indigo-100 text-indigo-600' : stage === 1 ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600 animate-pulse'}`}>
              <Clock size={16} />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${req.status === 'pending' ? 'text-indigo-500' : 'text-amber-500'}`}>
                {req.status === 'pending' ? 'Phase 0: Waiting for Admin Approval' : stage === 1 ? 'Phase 1: Beneficiary Adding' : stage === 2 ? 'Phase 2: Final Processing' : 'Awaiting Completion'}
              </p>
              <p className="text-sm font-bold text-slate-700">
                {req.status === 'pending' ? 'Estimated time to start processing.' : stage === 3 ? 'Almost done! Our team is finalizing your payment.' : 'Status will update automatically.'}
              </p>
            </div>
          </div>
          {((req.status === 'pending') || (req.status === 'processing' && stage < 3)) && (
            <div className="flex flex-col items-end">
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${req.status === 'pending' ? 'text-indigo-400' : 'text-amber-400'}`}>Time Remaining</p>
              <p className={`text-xl font-black tabular-nums ${req.status === 'pending' ? 'text-indigo-600' : 'text-amber-600'}`}>
                {formatTime(timeLeft)}
              </p>
            </div>
          )}
        </div>
      )}

      {req.status === 'rejected' && req.remark && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4">
          <AlertCircle className="text-rose-400 shrink-0" size={18} />
          <p className="text-xs font-bold text-rose-600">Rejection Reason: <span className="text-rose-900">{req.remark}</span></p>
        </div>
      )}

      {req.status === 'approved' && req.transaction_id && (
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
               <ShieldCheck size={16} />
             </div>
             <div>
               <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Transaction ID</p>
               <p className="text-sm font-black text-slate-800">{req.transaction_id}</p>
             </div>
           </div>
           
           <div className="flex items-center gap-3">
             {req.proof_url && (
               <button 
                 onClick={() => onViewProof(req.proof_url)}
                 className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center gap-2"
               >
                 <Upload size={12} />
                 View Proof
               </button>
             )}
             <CheckCircle2 className="text-emerald-500" size={24} />
           </div>
        </div>
      )}
    </div>
  );
}