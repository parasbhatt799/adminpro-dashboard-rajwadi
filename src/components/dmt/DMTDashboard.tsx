import React, { useState, useEffect } from 'react';
import {
  Send,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Smartphone,
  Building2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Fingerprint,
  Wallet,
  ArrowRight,
  History,
  Info,
  Clock,
  Printer,
  ChevronRight,
  ShieldAlert,
  Sliders,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DMTDashboardProps {
  userId?: string;
  adminView?: boolean;
}

interface Recipient {
  recipientId: string;
  recipientName: string;
  mobileNumber?: string;
  bankCode: string;
  bankName?: string;
  bankAccountNumber: string;
  ifsc: string;
  isVerified?: string;
  verifiedName?: string;
  recipientStatus?: string;
}

interface SenderProfile {
  senderMobileNumber: string;
  senderName: string;
  senderCity?: string;
  totalLimit?: string;
  usedLimit?: string;
  availableLimit?: string;
  additionalLimitAvailable?: string;
  availableLimitBreakup?: { amtValue: string[] | string };
}

export default function DMTDashboard({ userId, adminView = false }: DMTDashboardProps) {
  // Config & Deposit State
  const [config, setConfig] = useState<any>(null);
  const [depositBalance, setDepositBalance] = useState<string>('50,000.00');
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<'ARTL' | 'FINO'>('ARTL');
  const [selectedTxnType, setSelectedTxnType] = useState<'IMPS' | 'NEFT'>('IMPS');
  const [isDmtServiceEnabled, setIsDmtServiceEnabled] = useState(true);
  const [isTogglingService, setIsTogglingService] = useState(false);

  // Sender Search & Details
  const [searchMobile, setSearchMobile] = useState('');
  const [isSearchingSender, setIsSearchingSender] = useState(false);
  const [sender, setSender] = useState<SenderProfile | null>(null);
  const [senderNotFound, setSenderNotFound] = useState(false);

  // Sender Registration Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    pincode: '380001',
    aadhar: '548963214589',
    bioType: 'FIR' as 'FIR' | 'FACE',
    bioPid: 'MOCK_UAT_FINGERPRINT_PID_DATA'
  });
  const [regStep, setRegStep] = useState<'details' | 'otp'>('details');
  const [regOtp, setRegOtp] = useState('');
  const [regAdditionalData, setRegAdditionalData] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Beneficiaries
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    name: '',
    mobile: '',
    bankCode: 'SBIN',
    bankName: 'State Bank of India',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: 'SBIN0001234'
  });
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [verifyingRecipientId, setVerifyingRecipientId] = useState<string | null>(null);

  // Transfer Modal (2-Step Flow)
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferStep, setTransferStep] = useState<'amount' | 'otp' | 'success'>('amount');
  const [transferAmount, setTransferAmount] = useState<string>('1000');
  const [convFee, setConvFee] = useState<number>(10);
  const [transferOtp, setTransferOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingTransfer, setIsVerifyingTransfer] = useState(false);
  const [lastTxnReceipt, setLastTxnReceipt] = useState<any>(null);

  // Transactions History & Refund
  const [historyTab, setHistoryTab] = useState<'recipients' | 'history'>('recipients');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusCheckingId, setStatusCheckingId] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<{ open: boolean; txn: any; otp: string; step: 'request' | 'verify'; loading: boolean }>({
    open: false,
    txn: null,
    otp: '',
    step: 'request',
    loading: false
  });

  // UI Feedback
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch initial config & deposit balance
  useEffect(() => {
    fetchConfig();
    fetchDeposit();
    // Default demo sender for quick UAT testing convenience
    setSearchMobile('9920010041');
  }, []);

  const showAlert = (type: 'success' | 'error' | 'info', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 6000);
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/dmt/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data);
        if (data.isEnabled !== undefined) {
          setIsDmtServiceEnabled(Boolean(data.isEnabled));
        }
      }
    } catch (e) {}
  };

  const handleToggleDmtService = async () => {
    setIsTogglingService(true);
    const newValue = !isDmtServiceEnabled;
    try {
      const res = await fetch('/api/dmt/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue })
      });
      const data = await res.json();
      if (data.success) {
        setIsDmtServiceEnabled(newValue);
        showAlert(newValue ? 'success' : 'info', `DMT Service has been ${newValue ? 'ENABLED (Visible in User Menu)' : 'DISABLED (Hidden from User Menu)'}`);
      } else {
        showAlert('error', data.error || 'Failed to toggle DMT status');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setIsTogglingService(false);
    }
  };

  const fetchDeposit = async () => {
    setLoadingDeposit(true);
    try {
      const res = await fetch('/api/dmt/deposit-balance');
      const data = await res.json();
      if (data.success && data.data) {
        setDepositBalance(Number(data.data.currentBalance || 50000).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
      }
    } catch (e) {
    } finally {
      setLoadingDeposit(false);
    }
  };

  // Search Sender
  const handleSearchSender = async (mobileToSearch?: string) => {
    const mobile = mobileToSearch || searchMobile;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      showAlert('error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSearchingSender(true);
    setSenderNotFound(false);
    setSender(null);
    setRecipients([]);

    try {
      const res = await fetch(`/api/dmt/sender/${mobile}?bankId=${selectedBankId}&txnType=${selectedTxnType}`);
      const data = await res.json();

      if (data.success && data.data && data.data.responseCode === '000') {
        const senderData: SenderProfile = {
          senderMobileNumber: data.data.senderMobileNumber || mobile,
          senderName: data.data.senderName || 'Sender',
          senderCity: data.data.senderCity || 'Ahmedabad',
          totalLimit: data.data.totalLimit || '25000.0',
          usedLimit: data.data.usedLimit || '0.0',
          availableLimit: data.data.availableLimit || '25000.0',
          additionalLimitAvailable: data.data.additionalLimitAvailable || 'false',
          availableLimitBreakup: data.data.availableLimitBreakup
        };
        setSender(senderData);
        loadRecipients(mobile);
      } else {
        setSenderNotFound(true);
      }
    } catch (err: any) {
      setSenderNotFound(true);
    } finally {
      setIsSearchingSender(false);
    }
  };

  // Load Recipients for Sender
  const loadRecipients = async (mobile: string) => {
    setLoadingRecipients(true);
    try {
      const res = await fetch(`/api/dmt/recipients/${mobile}?bankId=${selectedBankId}&txnType=${selectedTxnType}`);
      const data = await res.json();
      if (data.success && data.data) {
        let list: Recipient[] = [];
        const rawList = data.data.recipientList?.dmtRecipientList || data.data.recipientList?.dmtRecipient;
        if (Array.isArray(rawList)) {
          list = rawList;
        } else if (rawList) {
          list = [rawList];
        }
        setRecipients(list);
      }
    } catch (e) {
    } finally {
      setLoadingRecipients(false);
    }
  };

  // Register Sender Step 1: Submit Details & Trigger OTP
  const handleRegisterSenderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.pincode) {
      showAlert('error', 'Please fill all mandatory fields');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch('/api/dmt/sender/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNumber: searchMobile,
          senderName: regForm.name,
          senderPin: regForm.pincode,
          aadharNumber: regForm.aadhar,
          bioType: regForm.bioType,
          bioPid: regForm.bioPid,
          bankId: selectedBankId,
          txnType: selectedTxnType
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        showAlert('success', 'Sender details registered. OTP sent to customer mobile.');
        setRegAdditionalData(data.data.additionalRegData || '');
        setRegStep('otp');
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Sender registration failed');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  // Register Sender Step 2: Verify OTP
  const handleVerifySenderOtp = async () => {
    if (!regOtp || regOtp.length < 4) {
      showAlert('error', 'Please enter valid OTP received by sender');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch('/api/dmt/sender/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNumber: searchMobile,
          otp: regOtp,
          additionalRegData: regAdditionalData,
          bankId: selectedBankId,
          txnType: selectedTxnType,
          aadharNumber: regForm.aadhar,
          bioPid: regForm.bioPid,
          bioType: regForm.bioType
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        showAlert('success', 'Sender verified & onboarded successfully!');
        setShowRegisterModal(false);
        setRegStep('details');
        setRegOtp('');
        handleSearchSender(searchMobile);
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Invalid OTP');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  // Add Recipient
  const handleAddRecipientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.name || !newRecipient.accountNumber || !newRecipient.ifsc) {
      showAlert('error', 'Please fill all recipient details');
      return;
    }
    if (newRecipient.accountNumber !== newRecipient.confirmAccountNumber) {
      showAlert('error', 'Account numbers do not match');
      return;
    }

    setIsAddingRecipient(true);
    try {
      const res = await fetch('/api/dmt/recipient/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNumber: sender?.senderMobileNumber || searchMobile,
          recipientName: newRecipient.name,
          recipientMobileNumber: newRecipient.mobile || searchMobile,
          bankCode: newRecipient.bankCode,
          bankAccountNumber: newRecipient.accountNumber,
          ifsc: newRecipient.ifsc,
          bankId: selectedBankId,
          txnType: selectedTxnType
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        showAlert('success', 'Beneficiary added successfully!');
        setShowAddRecipientModal(false);
        setNewRecipient({
          name: '',
          mobile: '',
          bankCode: 'SBIN',
          bankName: 'State Bank of India',
          accountNumber: '',
          confirmAccountNumber: '',
          ifsc: 'SBIN0001234'
        });
        if (sender) loadRecipients(sender.senderMobileNumber);
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Failed to add recipient');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setIsAddingRecipient(false);
    }
  };

  // Penny Drop Verification
  const handleVerifyPennyDrop = async (rec: Recipient) => {
    setVerifyingRecipientId(rec.recipientId);
    try {
      const res = await fetch('/api/dmt/recipient/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNumber: sender?.senderMobileNumber || searchMobile,
          bankAccountNumber: rec.bankAccountNumber,
          ifsc: rec.ifsc,
          bankCode: rec.bankCode
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        showAlert('success', `Bank account verified! Name on Account: ${data.data.accountHolderName || rec.recipientName}`);
        if (sender) loadRecipients(sender.senderMobileNumber);
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Penny drop verification failed');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setVerifyingRecipientId(null);
    }
  };

  // Delete Recipient
  const handleDeleteRecipient = async (recipientId: string) => {
    if (!confirm('Are you sure you want to delete this beneficiary?')) return;

    try {
      const res = await fetch('/api/dmt/recipient/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNumber: sender?.senderMobileNumber || searchMobile,
          recipientId,
          bankId: selectedBankId,
          txnType: selectedTxnType
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        showAlert('success', 'Beneficiary deleted');
        if (sender) loadRecipients(sender.senderMobileNumber);
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Failed to delete recipient');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Fund Transfer Step 1: Send OTP
  const handleInitiateTransfer = async () => {
    const amt = Number(transferAmount);
    if (!amt || amt < 10) {
      showAlert('error', 'Minimum transfer amount is Rs. 10');
      return;
    }
    if (amt > 5000) {
      showAlert('error', 'Maximum limit per transaction is Rs. 5,000 as per BillAvenue DMT v1.7+');
      return;
    }
    if (sender && amt > Number(sender.availableLimit || 25000)) {
      showAlert('error', `Amount exceeds available monthly limit (Rs. ${sender.availableLimit})`);
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/dmt/transfer/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNo: sender?.senderMobileNumber || searchMobile,
          recipientId: selectedRecipient?.recipientId,
          amount: amt,
          convFee: convFee,
          txnType: selectedTxnType,
          bankId: selectedBankId
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        showAlert('success', 'Transfer OTP sent to sender mobile number');
        setTransferStep('otp');
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Failed to send transfer OTP');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Fund Transfer Step 2: Verify OTP & Pay
  const handleVerifyTransferOtp = async () => {
    if (!transferOtp || transferOtp.length < 4) {
      showAlert('error', 'Please enter valid OTP');
      return;
    }

    setIsVerifyingTransfer(true);
    try {
      const res = await fetch('/api/dmt/transfer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderMobileNo: sender?.senderMobileNumber || searchMobile,
          recipientId: selectedRecipient?.recipientId,
          amount: Number(transferAmount),
          convFee: convFee,
          txnType: selectedTxnType,
          otp: transferOtp,
          recipientDetails: selectedRecipient,
          userId: userId || null
        })
      });

      const data = await res.json();
      if (data.success && data.data && data.data.responseCode === '000') {
        const detail = data.data.fundTransferDetails?.fundDetail || {};
        setLastTxnReceipt({
          uniqueRefId: data.data.uniqueRefId || detail.uniqueRefId,
          bankTxnId: detail.bankTxnId,
          dmtTxnId: detail.DmtTxnId,
          refId: detail.refId,
          amount: transferAmount,
          recipientName: selectedRecipient?.recipientName,
          accountNumber: selectedRecipient?.bankAccountNumber,
          ifsc: selectedRecipient?.ifsc,
          bankName: selectedRecipient?.bankName || selectedRecipient?.bankCode,
          senderMobile: sender?.senderMobileNumber || searchMobile,
          timestamp: new Date().toLocaleString('en-IN'),
          status: detail.txnStatus || 'C'
        });
        setTransferStep('success');
        showAlert('success', `Transfer of Rs. ${transferAmount} was successful!`);
        // Refresh sender balance
        if (sender) handleSearchSender(sender.senderMobileNumber);
        fetchDeposit();
      } else {
        showAlert('error', data.error || data.data?.respDesc || 'Transfer failed');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setIsVerifyingTransfer(false);
    }
  };

  // Load Transactions History
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/dmt/history');
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (e) {
    } finally {
      setLoadingHistory(false);
    }
  };

  // Check Live Status
  const handleCheckStatus = async (uniqueRefId: string) => {
    setStatusCheckingId(uniqueRefId);
    try {
      const res = await fetch(`/api/dmt/transaction/status/${uniqueRefId}`);
      const data = await res.json();
      if (data.success && data.data) {
        const detail = data.data.fundTransferDetails?.fundDetail || {};
        showAlert('info', `Status: ${detail.txnStatus === 'C' ? 'Success (Credited)' : detail.txnStatus} | Bank UTR: ${detail.bankTxnId || 'N/A'}`);
      } else {
        showAlert('error', data.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setStatusCheckingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!adminView && !isDmtServiceEnabled) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">DMT Service Disabled</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Direct Money Transfer (DMT) service is currently turned off or undergoing maintenance by the administrator. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* TOP BANNER / UAT STATUS HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  BillAvenue DMT v1.9.3
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  UAT Sandbox Environment
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-white/10 text-white border border-white/20">
                  Agent ID: UF01
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Direct Money Transfer (DMT)
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl">
                Instant domestic money remittance via IMPS & NEFT with 2-step OTP security, Aadhaar biometric sender onboarding, and real-time bank account validation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              {/* Admin Master ON/OFF Service Toggle */}
              {adminView && (
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 flex items-center justify-between gap-4 shrink-0">
                  <div>
                    <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">User Panel DMT Status</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isDmtServiceEnabled ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Visible to Users
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Hidden from Users
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleDmtService}
                    disabled={isTogglingService}
                    title={isDmtServiceEnabled ? 'Click to Disable DMT for Users' : 'Click to Enable DMT for Users'}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isDmtServiceEnabled ? 'bg-emerald-500' : 'bg-rose-500/80'
                    } ${isTogglingService ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isDmtServiceEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Live Deposit Balance Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 flex items-center justify-between gap-6 shrink-0">
                <div>
                  <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">BillAvenue UAT Deposit</p>
                  <p className="text-2xl font-black text-white mt-0.5">₹{depositBalance}</p>
                  <p className="text-[11px] text-emerald-400 font-medium">Usepay Fintech Solution Pvt Ltd</p>
                </div>
                <button
                  onClick={fetchDeposit}
                  disabled={loadingDeposit}
                  className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95 disabled:opacity-50"
                  title="Refresh Deposit Balance"
                >
                  <RefreshCw className={`w-5 h-5 ${loadingDeposit ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Service Channel Selector */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-300 font-semibold">Service Bank Channel:</span>
              <div className="inline-flex rounded-lg bg-black/20 p-1 border border-white/10">
                <button
                  onClick={() => setSelectedBankId('ARTL')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    selectedBankId === 'ARTL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Airtel Payments Bank (ARTL)
                </button>
                <button
                  onClick={() => setSelectedBankId('FINO')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    selectedBankId === 'FINO' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Fino Payments Bank (FINO)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-300 font-semibold">Transfer Route:</span>
              <div className="inline-flex rounded-lg bg-black/20 p-1 border border-white/10">
                <button
                  onClick={() => setSelectedTxnType('IMPS')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    selectedTxnType === 'IMPS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  IMPS (Instant 24x7)
                </button>
                <button
                  onClick={() => setSelectedTxnType('NEFT')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    selectedTxnType === 'NEFT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  NEFT (Batch)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ALERT NOTIFICATION */}
        <AnimatePresence>
          {alertMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium shadow-md ${
                alertMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : alertMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {alertMsg.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                {alertMsg.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
                {alertMsg.type === 'info' && <Info className="w-5 h-5 text-indigo-600 shrink-0" />}
                <span>{alertMsg.text}</span>
              </div>
              <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: SENDER PROFILE / SEARCH BAR */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                Sender Lookup & KYC
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Check sender registration, available monthly limit, and beneficiary list by mobile number.
              </p>
            </div>

            {/* Mobile Search Input */}
            <div className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                  +91
                </span>
                <input
                  type="text"
                  maxLength={10}
                  value={searchMobile}
                  onChange={(e) => setSearchMobile(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSender()}
                  placeholder="Enter 10-digit sender mobile"
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium tracking-wide"
                />
              </div>
              <button
                onClick={() => handleSearchSender()}
                disabled={isSearchingSender || searchMobile.length !== 10}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSearchingSender ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
          </div>

          {/* SENDER FOUND CARD */}
          {sender && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5 p-5 rounded-xl bg-slate-50 border border-slate-200/80"
            >
              {/* Sender Details */}
              <div className="space-y-1 md:col-span-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <UserCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-base font-bold text-slate-900 leading-tight">{sender.senderName}</p>
                    <p className="text-xs text-slate-500 font-mono">+91 {sender.senderMobileNumber}</p>
                  </div>
                </div>
                <div className="pt-2 text-xs text-slate-600 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                    KYC Active
                  </span>
                  <span>City: {sender.senderCity || 'Ahmedabad'}</span>
                </div>
              </div>

              {/* Monthly Limit Progress */}
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Monthly Remittance Limit</span>
                  <span className="font-bold text-slate-900">
                    ₹{Number(sender.availableLimit || 25000).toLocaleString('en-IN')} Available / ₹{Number(sender.totalLimit || 25000).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (Number(sender.availableLimit || 25000) / Number(sender.totalLimit || 25000)) * 100
                      )}%`
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Used: ₹{Number(sender.usedLimit || 0).toLocaleString('en-IN')}</span>
                  <span className="text-indigo-600 font-medium">Max Limit per Txn: ₹5,000 (v1.7+)</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* SENDER NOT FOUND BANNER */}
          {senderNotFound && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 p-6 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Sender Not Registered (+91 {searchMobile})</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This sender mobile number was not found on BillAvenue. Complete quick Aadhaar e-KYC onboarding to enable DMT.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRegStep('details');
                  setShowRegisterModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition active:scale-95 shadow-sm shrink-0 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Register New Sender
              </button>
            </motion.div>
          )}
        </div>

        {/* TABS: RECIPIENTS (BENEFICIARIES) vs HISTORY */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryTab('recipients')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                historyTab === 'recipients'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Beneficiaries ({recipients.length})
            </button>
            <button
              onClick={() => {
                setHistoryTab('history');
                loadHistory();
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                historyTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              Recent Transfers & Refunds
            </button>
          </div>

          {historyTab === 'recipients' && sender && (
            <button
              onClick={() => setShowAddRecipientModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition active:scale-95 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Beneficiary
            </button>
          )}
        </div>

        {/* TAB CONTENT: BENEFICIARIES GRID */}
        {historyTab === 'recipients' && (
          <div>
            {!sender ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
                <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">Enter Sender Mobile to Begin</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Search with a 10-digit mobile number above to manage registered beneficiaries or perform a fund transfer.
                </p>
              </div>
            ) : loadingRecipients ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Loading registered beneficiaries...</p>
              </div>
            ) : recipients.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">No Beneficiaries Added Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Add a recipient bank account for this sender to initiate money transfers instantly.
                </p>
                <button
                  onClick={() => setShowAddRecipientModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition shadow-sm inline-flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add First Beneficiary
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {recipients.map((rec) => (
                  <div
                    key={rec.recipientId}
                    className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                            {rec.recipientName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">{rec.recipientName}</h4>
                            <p className="text-xs text-slate-500 font-medium">{rec.bankName || rec.bankCode}</p>
                          </div>
                        </div>

                        {rec.isVerified === 'Y' ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Verified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold uppercase">
                            Unverified
                          </span>
                        )}
                      </div>

                      {/* Account Details */}
                      <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-[11px] text-slate-400 font-sans">A/C Number:</span>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span>{rec.bankAccountNumber}</span>
                            <button
                              onClick={() => copyToClipboard(rec.bankAccountNumber, rec.recipientId)}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {copiedId === rec.recipientId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-[11px] text-slate-400 font-sans">IFSC Code:</span>
                          <span className="font-bold text-slate-800">{rec.ifsc}</span>
                        </div>
                        {rec.verifiedName && (
                          <div className="flex items-center justify-between text-emerald-700 pt-1 border-t border-slate-200/60 font-sans text-[11px]">
                            <span>Name on Bank:</span>
                            <span className="font-semibold">{rec.verifiedName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {rec.isVerified !== 'Y' && (
                          <button
                            onClick={() => handleVerifyPennyDrop(rec)}
                            disabled={verifyingRecipientId === rec.recipientId}
                            className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold transition disabled:opacity-50"
                            title="Verify via ₹1 Penny Drop"
                          >
                            {verifyingRecipientId === rec.recipientId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Penny Drop'
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRecipient(rec.recipientId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete Recipient"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedRecipient(rec);
                          setTransferStep('amount');
                          setShowTransferModal(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send Money
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: TRANSACTION HISTORY & REFUND */}
        {historyTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Direct Money Transfers</h3>
                <p className="text-xs text-slate-500">Live UTR status tracking and OTP-based refund facility</p>
              </div>
              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                Refresh History
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No recent transactions found in local history.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Date / Time</th>
                      <th className="py-3 px-4">Ref ID / UTR</th>
                      <th className="py-3 px-4">Beneficiary</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-slate-900">{t.unique_ref_id || 'N/A'}</p>
                          <p className="font-mono text-[11px] text-slate-400">UTR: {t.bank_txn_id || 'Pending'}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{t.recipient_name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{t.bank_account}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-slate-900 text-sm">₹{Number(t.amount).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block">+ ₹{t.charge_amount} fee</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {t.txn_status === 'C' && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                              Success
                            </span>
                          )}
                          {(t.txn_status === 'P' || t.txn_status === 'Q') && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                              Pending
                            </span>
                          )}
                          {t.txn_status === 'T' && (
                            <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-bold text-[10px] uppercase">
                              Refund Ready
                            </span>
                          )}
                          {t.txn_status === 'F' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] uppercase">
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleCheckStatus(t.unique_ref_id)}
                            disabled={statusCheckingId === t.unique_ref_id}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition"
                          >
                            {statusCheckingId === t.unique_ref_id ? 'Checking...' : 'Check Status'}
                          </button>

                          {t.txn_status === 'T' && (
                            <button
                              onClick={() => {
                                setRefundModal({
                                  open: true,
                                  txn: t,
                                  otp: '',
                                  step: 'request',
                                  loading: false
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
                            >
                              Claim Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: REGISTER SENDER (AADHAAR + BIOMETRIC e-KYC) */}
        {/* ========================================================= */}
        <AnimatePresence>
          {showRegisterModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-900">
                      {regStep === 'details' ? 'Sender Registration (KYC)' : 'Verify Sender OTP'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowRegisterModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                {regStep === 'details' ? (
                  <form onSubmit={handleRegisterSenderSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                      <input
                        type="text"
                        disabled
                        value={searchMobile}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-mono font-bold text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Full Name *</label>
                      <input
                        type="text"
                        required
                        value={regForm.name}
                        onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                        placeholder="As per Aadhaar Card"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode *</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={regForm.pincode}
                        onChange={(e) => setRegForm({ ...regForm, pincode: e.target.value.replace(/\D/g, '') })}
                        placeholder="6-digit Area Pincode"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Aadhaar Number *</label>
                      <input
                        type="text"
                        maxLength={12}
                        required
                        value={regForm.aadhar}
                        onChange={(e) => setRegForm({ ...regForm, aadhar: e.target.value.replace(/\D/g, '') })}
                        placeholder="12-digit Aadhaar Number"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                      />
                    </div>

                    {/* Biometric PID Simulation / Capture */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <Fingerprint className="w-4 h-4 text-indigo-600" />
                          Biometric Capture (UAT)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-200 text-indigo-800 font-bold uppercase">
                          {selectedBankId} Provider
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Compatible with Mantra MFS100 / Startek FM220. For UAT testing, standard test PID is simulated automatically.
                      </p>
                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 font-semibold text-xs shadow-sm hover:bg-indigo-50 transition"
                        >
                          Simulated Capture (Active)
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isRegistering}
                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        Continue & Send OTP
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      An OTP has been sent to <span className="font-bold text-slate-900">+91 {searchMobile}</span> for Aadhaar verification.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Enter Verification OTP</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={regOtp}
                        onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 4 or 6-digit OTP"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center tracking-widest text-lg font-bold font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRegStep('details')}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifySenderOtp}
                        disabled={isRegistering || regOtp.length < 4}
                        className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Verify & Complete
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ========================================================= */}
        {/* MODAL 2: ADD BENEFICIARY (RECIPIENT) */}
        {/* ========================================================= */}
        <AnimatePresence>
          {showAddRecipientModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-900">Add New Beneficiary</h3>
                  </div>
                  <button onClick={() => setShowAddRecipientModal(false)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddRecipientSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Beneficiary Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newRecipient.name}
                      onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                      placeholder="Account Holder Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Bank *</label>
                    <select
                      value={newRecipient.bankCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const name = e.target.options[e.target.selectedIndex].text;
                        const defaultIfscMap: any = {
                          SBIN: 'SBIN0001234',
                          HDFC: 'HDFC0000240',
                          ICIC: 'ICIC0000001',
                          BARB: 'BARB0NAJDEL',
                          PUNB: 'PUNB0123400',
                          KKBK: 'KKBK0000123',
                          AXIS: 'UTIB0000123'
                        };
                        setNewRecipient({
                          ...newRecipient,
                          bankCode: code,
                          bankName: name,
                          ifsc: defaultIfscMap[code] || `${code}0001234`
                        });
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="SBIN">State Bank of India</option>
                      <option value="HDFC">HDFC Bank</option>
                      <option value="ICIC">ICICI Bank</option>
                      <option value="BARB">Bank of Baroda</option>
                      <option value="PUNB">Punjab National Bank</option>
                      <option value="KKBK">Kotak Mahindra Bank</option>
                      <option value="AXIS">Axis Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Number *</label>
                    <input
                      type="text"
                      required
                      value={newRecipient.accountNumber}
                      onChange={(e) => setNewRecipient({ ...newRecipient, accountNumber: e.target.value.replace(/\D/g, '') })}
                      placeholder="Enter Account Number"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Account Number *</label>
                    <input
                      type="text"
                      required
                      value={newRecipient.confirmAccountNumber}
                      onChange={(e) => setNewRecipient({ ...newRecipient, confirmAccountNumber: e.target.value.replace(/\D/g, '') })}
                      placeholder="Re-enter Account Number"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code *</label>
                    <input
                      type="text"
                      required
                      value={newRecipient.ifsc}
                      onChange={(e) => setNewRecipient({ ...newRecipient, ifsc: e.target.value.toUpperCase() })}
                      placeholder="e.g. SBIN0001234"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isAddingRecipient}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAddingRecipient ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Add Beneficiary
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ========================================================= */}
        {/* MODAL 3: 2-STEP FUND TRANSFER MODAL (TXNSENDOTP & TXNVERIFYOTP) */}
        {/* ========================================================= */}
        <AnimatePresence>
          {showTransferModal && selectedRecipient && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {transferStep === 'amount' && 'Direct Money Transfer'}
                      {transferStep === 'otp' && 'Authorize Transaction'}
                      {transferStep === 'success' && 'Transfer Successful'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {transferStep === 'amount' && 'Step 1 of 2: Set Amount & Route'}
                      {transferStep === 'otp' && 'Step 2 of 2: Confirm with OTP'}
                      {transferStep === 'success' && 'Transaction Receipt'}
                    </p>
                  </div>
                  <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>

                {/* STEP 1: AMOUNT & DETAILS */}
                {transferStep === 'amount' && (
                  <div className="space-y-5">
                    {/* Recipient Snapshot */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Beneficiary</p>
                        <p className="text-sm font-bold text-slate-900">{selectedRecipient.recipientName}</p>
                        <p className="text-xs font-mono text-slate-500">
                          {selectedRecipient.bankAccountNumber} ({selectedRecipient.bankName || selectedRecipient.bankCode})
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold font-mono">
                        {selectedTxnType}
                      </span>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">Enter Transfer Amount (₹)</label>
                        <span className="text-[11px] text-slate-400">Max limit: ₹5,000 / txn</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          max={5000}
                          min={10}
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          placeholder="Amount in Rupees"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-2xl font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      {/* Quick Amount Chips */}
                      <div className="flex items-center gap-2 mt-2.5">
                        {[500, 1000, 2000, 5000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setTransferAmount(String(amt))}
                            className="flex-1 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 text-xs font-semibold text-slate-700 hover:bg-indigo-50/50 transition"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Transfer Amount:</span>
                        <span className="font-semibold text-slate-900">₹{Number(transferAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Customer Convenience Fee:</span>
                        <span className="font-semibold text-slate-900">₹{convFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-700 font-bold pt-1 border-t border-slate-200">
                        <span>Total Debit from Wallet:</span>
                        <span>₹{(Number(transferAmount || 0) + convFee).toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleInitiateTransfer}
                      disabled={isSendingOtp || !transferAmount || Number(transferAmount) <= 0 || Number(transferAmount) > 5000}
                      className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSendingOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Request Transfer OTP
                    </button>
                  </div>
                )}

                {/* STEP 2: VERIFY OTP */}
                {transferStep === 'otp' && (
                  <div className="space-y-5">
                    <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                      <p className="font-bold">Transaction OTP Dispatched!</p>
                      <p className="text-[11px] text-indigo-700">
                        A transaction authorization OTP was sent to sender's registered mobile number (+91 {sender?.senderMobileNumber || searchMobile}).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                        Enter 6-Digit Transfer OTP
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={transferOtp}
                        onChange={(e) => setTransferOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center tracking-[0.5em] text-2xl font-bold font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setTransferStep('amount')}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleVerifyTransferOtp}
                        disabled={isVerifyingTransfer || transferOtp.length < 4}
                        className="flex-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isVerifyingTransfer ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Authorize ₹{transferAmount}
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: TRANSACTION SUCCESS RECEIPT */}
                {transferStep === 'success' && lastTxnReceipt && (
                  <div className="space-y-4">
                    <div className="text-center py-3">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-black text-slate-900">Payment Transferred Successfully</h4>
                      <p className="text-2xl font-black text-slate-900 mt-1">₹{lastTxnReceipt.amount}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{lastTxnReceipt.timestamp}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">BillAvenue Ref ID:</span>
                        <span className="font-bold text-slate-900">{lastTxnReceipt.uniqueRefId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Bank Txn UTR:</span>
                        <span className="font-bold text-emerald-700">{lastTxnReceipt.bankTxnId || '928374182'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Beneficiary:</span>
                        <span className="font-bold text-slate-900">{lastTxnReceipt.recipientName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Account No:</span>
                        <span className="font-bold text-slate-900">{lastTxnReceipt.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">IFSC Code:</span>
                        <span className="font-bold text-slate-900">{lastTxnReceipt.ifsc}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        onClick={() => window.print()}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Receipt
                      </button>
                      <button
                        onClick={() => setShowTransferModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ========================================================= */}
        {/* MODAL 4: CLAIM REFUND MODAL */}
        {/* ========================================================= */}
        <AnimatePresence>
          {refundModal.open && refundModal.txn && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-orange-600" />
                    <h3 className="text-lg font-bold text-slate-900">Claim DMT Refund</h3>
                  </div>
                  <button
                    onClick={() => setRefundModal({ ...refundModal, open: false })}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-100 text-xs text-orange-900 space-y-1">
                  <p className="font-bold">Eligible for Immediate Refund (Status: T)</p>
                  <p className="text-[11px] text-orange-700">
                    Transaction ID #{refundModal.txn.dmt_txn_id || refundModal.txn.id}. BillAvenue will send a refund verification OTP to the sender.
                  </p>
                </div>

                {refundModal.step === 'request' ? (
                  <div className="space-y-4">
                    <button
                      onClick={async () => {
                        setRefundModal((prev) => ({ ...prev, loading: true }));
                        try {
                          const res = await fetch('/api/dmt/transaction/refund-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              dmtTxnId: refundModal.txn.dmt_txn_id || '2433'
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            showAlert('success', 'Refund OTP dispatched');
                            setRefundModal((prev) => ({ ...prev, step: 'verify', loading: false }));
                          } else {
                            showAlert('error', data.error || 'Failed to dispatch refund OTP');
                            setRefundModal((prev) => ({ ...prev, loading: false }));
                          }
                        } catch (e: any) {
                          showAlert('error', e.message);
                          setRefundModal((prev) => ({ ...prev, loading: false }));
                        }
                      }}
                      disabled={refundModal.loading}
                      className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {refundModal.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                      Send Refund OTP to Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Enter Refund OTP</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={refundModal.otp}
                        onChange={(e) => setRefundModal({ ...refundModal, otp: e.target.value.replace(/\D/g, '') })}
                        placeholder="Enter Refund OTP"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center tracking-widest text-lg font-bold font-mono focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <button
                      onClick={async () => {
                        setRefundModal((prev) => ({ ...prev, loading: true }));
                        try {
                          const res = await fetch('/api/dmt/transaction/verify-refund', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              dmtTxnId: refundModal.txn.dmt_txn_id || '2433',
                              uniqueRefId: refundModal.txn.unique_ref_id,
                              otp: refundModal.otp
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            showAlert('success', 'Refund processed successfully! Money credited back to wallet.');
                            setRefundModal((prev) => ({ ...prev, open: false, loading: false }));
                            loadHistory();
                            fetchDeposit();
                          } else {
                            showAlert('error', data.error || 'Refund verification failed');
                            setRefundModal((prev) => ({ ...prev, loading: false }));
                          }
                        } catch (e: any) {
                          showAlert('error', e.message);
                          setRefundModal((prev) => ({ ...prev, loading: false }));
                        }
                      }}
                      disabled={refundModal.loading || refundModal.otp.length < 4}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {refundModal.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                      Confirm & Process Refund
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
