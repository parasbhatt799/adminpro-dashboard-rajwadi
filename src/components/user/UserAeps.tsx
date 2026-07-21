import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Fingerprint,
  User,
  ShieldCheck,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building,
  Landmark,
  Search,
  DollarSign,
  Smartphone,
  CreditCard,
  FileText,
  Printer,
  X,
  History,
  Info
} from 'lucide-react';

interface UserAepsProps {
  userId: string;
}

const BANK_IIN_LIST = [
  { name: "State Bank of India (SBI)", iin: "602286" },
  { name: "Bank of Baroda", iin: "302222" },
  { name: "Punjab National Bank (PNB)", iin: "508534" },
  { name: "HDFC Bank", iin: "607152" },
  { name: "ICICI Bank", iin: "508532" },
  { name: "Axis Bank", iin: "607151" },
  { name: "Canara Bank", iin: "607189" },
  { name: "Union Bank of India", iin: "607106" },
  { name: "Kotak Mahindra Bank", iin: "607127" },
  { name: "Central Bank of India", iin: "607082" },
  { name: "Indian Bank", iin: "607105" },
  { name: "Bank of India", iin: "508505" },
  { name: "UCO Bank", iin: "607022" },
  { name: "Indian Overseas Bank", iin: "607099" },
  { name: "Yes Bank", iin: "607387" },
  { name: "Airtel Payments Bank", iin: "608001" },
  { name: "Fino Payments Bank", iin: "608003" },
  { name: "India Post Payments Bank (IPPB)", iin: "608006" }
];

export default function UserAeps({ userId }: UserAepsProps) {
  const toast = useToast();
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [agentStatus, setAgentStatus] = useState<any>(null); // status: 'not_registered', 'pending', 'submitted', 'verified'
  
  // Navigation & Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'withdrawal' | 'enquiry' | 'statement'>('withdrawal');

  // Form inputs
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    email: '',
    mobile: '',
    aadhaar: '',
    pan: '',
    dateOfBirth: '',
    gender: 'M',
    fullAddress: '',
    city: '',
    pincode: '',
    latitude: 26.9124,
    longitude: 75.7873
  });

  const [txForm, setTxForm] = useState({
    customerAadhaar: '',
    customerMobile: '',
    bankIin: '',
    bankName: '',
    amount: ''
  });

  // UI state
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [submittingOnboard, setSubmittingOnboard] = useState(false);
  const [submittingBiometric, setSubmittingBiometric] = useState(false);
  const [biometricStep, setBiometricStep] = useState<'idle' | 'scanning' | 'processing'>('idle');
  const [kycCheckParams, setKycCheckParams] = useState({ spkey: 'WAP', txnRef: '' });

  // API result states
  const [latestResult, setLatestResult] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Load geolocation on onboard form mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOnboardForm(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
        },
        () => console.warn('Could not retrieve geo-coordinates, using default जयपुर coordinates')
      );
    }
  }, []);

  // Check agent registration, KYC status & Daily Login status
  const checkStatus = async () => {
    setLoadingAgent(true);
    try {
      const res = await fetch(`/api/aeps/agent-status?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to load agent status');
      const data = await res.json();
      setAgentStatus(data);
    } catch (err: any) {
      console.error(err);
      toast.error('AEPS Agent સ્ટેટસ લોડ કરવામાં ભૂલ આવી.');
    } finally {
      setLoadingAgent(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  // RD Service capture helper to find active ports
  const captureFingerprint = async (timeout = 10000): Promise<string> => {
    const optionsXml = `
      <PidOptions ver="1.0">
        <Opts fCount="1" fType="2" iCount="0" iType="0" pCount="0" pType="0" format="0" pidVer="2.0" timeout="${timeout}" env="P" />
      </PidOptions>
    `.trim();

    const ports = Array.from({ length: 21 }, (_, i) => 11100 + i);
    let xmlResponse = "";

    for (const port of ports) {
      try {
        const url = `http://127.0.0.1:${port}/rd/capture`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml",
            "Accept": "text/xml"
          },
          body: optionsXml
        });
        if (res.ok) {
          xmlResponse = await res.text();
          break;
        }
      } catch (e) {
        // Continue scanning ports
      }
    }

    if (!xmlResponse) {
      throw new Error("કોઈ પણ બાયોમેટ્રિક ફિંગરપ્રિન્ટ ડિવાઇસ મળ્યું નથી. મહેરબાની કરીને ખાતરી કરો કે Mantra/Morpho RD Service બેકગ્રાઉન્ડમાં ચાલુ છે.");
    }

    // Handle RD device failure messages
    if (xmlResponse.includes("errCode") || xmlResponse.includes("errInfo")) {
      const errMatch = xmlResponse.match(/errInfo="([^"]+)"/);
      const errCodeMatch = xmlResponse.match(/errCode="([^"]+)"/);
      const errCode = errCodeMatch ? errCodeMatch[1] : "";
      const errInfo = errMatch ? errMatch[1] : "";
      if (errCode !== "0" && errCode !== "SUCCESS") {
        throw new Error(errInfo || "બાયોમેટ્રિક ફિંગરપ્રિન્ટ લેવામાં ભૂલ આવી.");
      }
    }

    return xmlResponse;
  };

  // Submit Outlet Onboarding
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOnboard(true);

    try {
      const onboardPayload = {
        userId,
        name: onboardForm.name,
        email: onboardForm.email,
        mobile: onboardForm.mobile,
        aadhaar: onboardForm.aadhaar,
        pan: onboardForm.pan,
        dateOfBirth: onboardForm.dateOfBirth,
        gender: onboardForm.gender,
        latitude: onboardForm.latitude,
        longitude: onboardForm.longitude,
        address: {
          full: onboardForm.fullAddress,
          city: onboardForm.city,
          pincode: onboardForm.pincode
        }
      };

      const res = await fetch('/api/aeps/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardPayload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'રજીસ્ટ્રેશન નિષ્ફળ રહ્યું.');
      }

      const resData = await res.json();
      toast.success('Outlet રજીસ્ટ્રેશન સફળતાપૂર્વક સબમિટ થયું!');
      
      // Update check parameters for status polling
      const txnRefId = resData.apiResponse?.txnRef || '';
      setKycCheckParams({ spkey: 'WAP', txnRef: txnRefId });

      await checkStatus();
    } catch (err: any) {
      toast.error(err.message || 'રજીસ્ટ્રેશનમાં ભૂલ આવી.');
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Submit Biometric KYC
  const handleBiometricKyc = async () => {
    setSubmittingBiometric(true);
    setBiometricStep('scanning');

    try {
      const pidDataXml = await captureFingerprint();
      setBiometricStep('processing');

      const payload = {
        userId,
        referenceKey: agentStatus.referenceKey,
        latitude: onboardForm.latitude,
        longitude: onboardForm.longitude,
        externalRef: "KYC" + Date.now(),
        captureType: "finger",
        biometricData: pidDataXml
      };

      const res = await fetch('/api/aeps/biometric-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'KYC સબમિશન નિષ્ફળ ગયું.');
      }

      toast.success('બાયોમેટ્રિક KYC સફળતાપૂર્વક સબમિટ થયું! હવે સ્ટેટસ વેરીફાય કરી શકો છો.');
      await checkStatus();
    } catch (err: any) {
      toast.error(err.message || 'KYC પ્રક્રિયામાં ભૂલ આવી.');
    } finally {
      setSubmittingBiometric(false);
      setBiometricStep('idle');
    }
  };

  // Poll for KYC Status
  const handleCheckKycStatus = async () => {
    if (!kycCheckParams.txnRef) {
      toast.error('કોઈ એક્ટિવ KYC ટ્રાન્ઝેક્શન મળ્યું નથી.');
      return;
    }

    setSubmittingOnboard(true);
    try {
      const res = await fetch('/api/aeps/kyc-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          spkey: kycCheckParams.spkey,
          txnRef: kycCheckParams.txnRef
        })
      });

      const data = await res.json();
      if (data.kycStatus === 'verified' || data.status === 'success') {
        toast.success('અભિનંદન! તમારું KYC સફળતાપૂર્વક વેરિફાય થઈ ગયું છે.');
      } else {
        toast.info(`KYC સ્ટેટસ: ${data.message || data.status || 'પ્રોસેસિંગમાં છે'}`);
      }
      await checkStatus();
    } catch (err: any) {
      toast.error('સ્ટેટસ વેરિફિકેશનમાં ભૂલ આવી.');
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Submit Daily Biometric Login
  const handleDailyLogin = async () => {
    setSubmittingBiometric(true);
    setBiometricStep('scanning');

    try {
      const pidDataXml = await captureFingerprint();
      setBiometricStep('processing');

      const payload = {
        userId,
        referenceKey: agentStatus.referenceKey,
        latitude: onboardForm.latitude,
        longitude: onboardForm.longitude,
        externalRef: "LGN" + Date.now(),
        captureType: "finger",
        biometricData: pidDataXml
      };

      const res = await fetch('/api/aeps/daily-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'ડેઈલી લોગિન નિષ્ફળ ગયું.');
      }

      toast.success('ડેઈલી ફિંગરપ્રિન્ટ લોગિન સફળ થયું!');
      await checkStatus();
    } catch (err: any) {
      toast.error(err.message || 'ડેઈલી લોગિન પ્રક્રિયામાં ભૂલ આવી.');
    } finally {
      setSubmittingBiometric(false);
      setBiometricStep('idle');
    }
  };

  // Execute Transaction (Cash Withdrawal, Balance Enquiry, Mini Statement)
  const handleExecuteTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.bankIin) {
      toast.error('મહેરબાની કરીને લિસ્ટમાંથી બેંક સિલેક્ટ કરો.');
      return;
    }
    if (activeSubTab === 'withdrawal' && (!txForm.amount || Number(txForm.amount) <= 0)) {
      toast.error('મહેરબાની કરીને ઉપાડની સાચી રકમ લખો.');
      return;
    }

    setSubmittingBiometric(true);
    setBiometricStep('scanning');

    try {
      const pidDataXml = await captureFingerprint();
      setBiometricStep('processing');

      const basePayload = {
        userId,
        mobile: txForm.customerMobile,
        bankiin: txForm.bankIin,
        latitude: onboardForm.latitude,
        longitude: onboardForm.longitude,
        captureType: 'finger',
        biometricData: pidDataXml
      };

      let endpoint = '';
      let body: any = { ...basePayload };

      if (activeSubTab === 'withdrawal') {
        endpoint = '/api/aeps/cash-withdrawal';
        body.amount = txForm.amount;
      } else if (activeSubTab === 'enquiry') {
        endpoint = '/api/aeps/balance-enquiry';
      } else if (activeSubTab === 'statement') {
        endpoint = '/api/aeps/mini-statement';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'ટ્રાન્ઝેક્શન નિષ્ફળ રહ્યું.');
      }

      const isSuccess = resData.status === 'success' || resData.responseCode === '0000' || resData.responseCode === '00' || resData.success === true;

      if (isSuccess) {
        toast.success('ટ્રાન્ઝેક્શન સફળતાપૂર્વક પૂર્ણ થયું!');
        setLatestResult({
          type: activeSubTab,
          bankName: txForm.bankName,
          aadhaar: txForm.customerAadhaar,
          mobile: txForm.customerMobile,
          amount: txForm.amount,
          date: new Date().toLocaleString(),
          ...resData
        });
        setShowReceiptModal(true);

        // Reset Form
        setTxForm({
          customerAadhaar: '',
          customerMobile: '',
          bankIin: '',
          bankName: '',
          amount: ''
        });
      } else {
        throw new Error(resData.message || resData.responseReason || 'બેંક તરફથી ટ્રાન્ઝેક્શન અસ્વીકાર કરવામાં આવ્યું.');
      }
    } catch (err: any) {
      toast.error(err.message || 'ટ્રાન્ઝેક્શન નિષ્ફળ ગયું.');
    } finally {
      setSubmittingBiometric(false);
      setBiometricStep('idle');
    }
  };

  // Generate Receipt PDF
  const downloadReceiptPdf = async () => {
    if (!latestResult) return;
    const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;
      const doc = new JsPDFClass();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('USEPAY AEPS RECEIPT', 15, 25);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.text(`તારીખ & સમય: ${latestResult.date}`, 15, 55);
    doc.text(`સેવા પ્રકાર: ${latestResult.type.toUpperCase()}`, 15, 63);
    doc.text(`ગ્રાહક આધાર નંબર: XXXX-XXXX-${latestResult.aadhaar.slice(-4)}`, 15, 71);
    doc.text(`બેંકનું નામ: ${latestResult.bankName}`, 15, 79);

    const rows = [
      ['રકમ (રૂપિયા)', `INR ${latestResult.amount || '0.00'}`],
      ['ઉપલબ્ધ બેલેન્સ', `INR ${latestResult.balance || latestResult.availBalance || '0.00'}`],
      ['ટ્રાન્ઝેક્શન આઈડી / UTR', latestResult.txnRefId || latestResult.rrn || 'N/A'],
      ['સ્ટેટસ', 'સફળ (SUCCESS)']
    ];

    autoTable(doc, {
      startY: 90,
      head: [['ટ્રાન્ઝેક્શન વિગત', 'મૂલ્ય']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175);
    doc.text('UsePay ફિનટેક સોલ્યુશન્સ - આધાર ATM પાવર્ડ દ્વારા', 15, doc.internal.pageSize.height - 20);

    doc.save(`aeps_receipt_${Date.now()}.pdf`);
  };

  // Render Loader
  if (loadingAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">AEPS એજન્ટ સ્ટેટસ લોડ થઈ રહ્યું છે...</p>
      </div>
    );
  }

  // FLOW 1: Agent Not Registered -> Onboarding Form
  if (agentStatus?.status === 'not_registered') {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl mt-4">
        <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <Fingerprint className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">AEPS આધાર ATM નોંધણી</h2>
            <p className="text-slate-400 text-sm mt-1">આધાર દ્વારા પૈસા ઉપાડવા માટે Business Correspondent (BC) એજન્ટ તરીકે ઓનબોર્ડ થાઓ</p>
          </div>
        </div>

        <form onSubmit={handleOnboardSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">એજન્ટનું પૂરું નામ (આધાર પ્રમાણે)</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={onboardForm.name}
                  onChange={e => setOnboardForm({ ...onboardForm, name: e.target.value })}
                  placeholder="Rahul Sharma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ઈમેલ એડ્રેસ</label>
              <div className="relative">
                <FileText className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={onboardForm.email}
                  onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                  placeholder="rahul@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">મોબાઈલ નંબર</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={onboardForm.mobile}
                  onChange={e => setOnboardForm({ ...onboardForm, mobile: e.target.value })}
                  placeholder="9876543210"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">આધાર નંબર</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  pattern="[0-9]{12}"
                  maxLength={12}
                  value={onboardForm.aadhaar}
                  onChange={e => setOnboardForm({ ...onboardForm, aadhaar: e.target.value })}
                  placeholder="12-digit Aadhaar Number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">PAN કાર્ડ નંબર</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={onboardForm.pan}
                  onChange={e => setOnboardForm({ ...onboardForm, pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">જન્મ તારીખ</label>
              <input
                type="date"
                required
                value={onboardForm.dateOfBirth}
                onChange={e => setOnboardForm({ ...onboardForm, dateOfBirth: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">જેન્ડર</label>
              <select
                value={onboardForm.gender}
                onChange={e => setOnboardForm({ ...onboardForm, gender: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
              >
                <option value="M">પુરુષ (Male)</option>
                <option value="F">સ્ત્રી (Female)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">સરનામાની વિગતો</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">પૂરું સરનામું (દુકાન/ઘર)</label>
                <textarea
                  required
                  rows={2}
                  value={onboardForm.fullAddress}
                  onChange={e => setOnboardForm({ ...onboardForm, fullAddress: e.target.value })}
                  placeholder="Shop No 10, Main Market..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">શહેર (City)</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.city}
                    onChange={e => setOnboardForm({ ...onboardForm, city: e.target.value })}
                    placeholder="Ahmedabad"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">પિનકોડ (Pincode)</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={onboardForm.pincode}
                    onChange={e => setOnboardForm({ ...onboardForm, pincode: e.target.value })}
                    placeholder="380001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingOnboard}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {submittingOnboard ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                પ્રોસેસિંગ થઈ રહ્યું છે...
              </>
            ) : (
              <>
                <Fingerprint className="w-5 h-5" />
                ઓનબોર્ડિંગ સબમિટ કરો
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // FLOW 2: Agent Registered but KYC Pending -> Biometric KYC Verification
  if (agentStatus?.kycStatus !== 'verified') {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl mt-8 text-center">
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Fingerprint className="w-10 h-10 text-amber-500 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">બાયોમેટ્રિક KYC વેરિફિકેશન જરૂરી</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          તમારું ઓનબોર્ડિંગ ફોર્મ મંજૂર થઈ ગયું છે. હવે સેવા શરૂ કરવા માટે તમારા કનેક્ટ કરેલા ફિંગરપ્રિન્ટ ડિવાઇસ દ્વારા બાયોમેટ્રિક ફિંગર સ્કેન કરી KYC વેરિફાય કરો.
        </p>

        <div className="space-y-4 max-w-md mx-auto">
          {biometricStep === 'scanning' ? (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
              <p className="text-white font-semibold">કૃપા કરીને ડિવાઇસ પર તમારી આંગળી મૂકો...</p>
              <p className="text-slate-500 text-xs mt-1">બાયોમેટ્રિક ફિંગરપ્રિન્ટ સ્કેન થઈ રહી છે</p>
            </div>
          ) : biometricStep === 'processing' ? (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
              <p className="text-white font-semibold">સર્વર સાથે વેરિફિકેશન થઈ રહ્યું છે...</p>
              <p className="text-slate-500 text-xs mt-1">બાયોમેટ્રિક ડેટા સેન્ડ થઈ રહ્યો છે</p>
            </div>
          ) : (
            <>
              <button
                onClick={handleBiometricKyc}
                disabled={submittingBiometric}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Fingerprint className="w-5 h-5" />
                ફિંગરપ્રિન્ટ સ્કેન કરી KYC કરો
              </button>

              <div className="border-t border-slate-800/60 pt-4 flex gap-4">
                <button
                  onClick={handleCheckKycStatus}
                  disabled={submittingOnboard}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-xl text-sm font-medium transition-all"
                >
                  KYC વેરિફિકેશન સ્ટેટસ ચેક કરો
                </button>
                <button
                  onClick={checkStatus}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-400 py-3 px-4 rounded-xl text-sm font-medium"
                >
                  રીફ્રેશ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // FLOW 3: KYC Verified but Daily Login Pending -> Biometric Daily Login
  if (!agentStatus?.dailyLoginDone) {
    return (
      <div className="max-w-md mx-auto p-8 bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl mt-12 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">ડેઈલી લોગિન જરૂરી</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          NPCI ગાઈડલાઈન મુજબ AEPS ટ્રાન્ઝેક્શન કરતા પહેલાં એજન્ટનું રોજ બાયોમેટ્રિક ઓથેન્ટિકેશન કરવું ફરજિયાત છે.
        </p>

        {biometricStep === 'scanning' ? (
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
            <p className="text-white font-semibold">ડિવાઇસ પર આંગળી સ્કેન કરો...</p>
          </div>
        ) : biometricStep === 'processing' ? (
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
            <p className="text-white font-semibold">પ્રમાણીકરણ થઈ રહ્યું છે...</p>
          </div>
        ) : (
          <button
            onClick={handleDailyLogin}
            disabled={submittingBiometric}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg"
          >
            <Fingerprint className="w-5 h-5" />
            સ્કેન અને ડેઈલી લોગિન
          </button>
        )}
      </div>
    );
  }

  // FLOW 4: KYC Completed & Logged in -> AEPS Transaction Panel
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 mt-4">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <Fingerprint className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">આધાર ATM (AEPS) પોર્ટલ</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                KYC વેરિફાઈડ
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                ડેઈલી લોગિન OK
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">એજન્ટ આઈડી</p>
            <p className="text-sm font-semibold text-white">{agentStatus.referenceKey}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 bg-slate-900 p-2 rounded-2xl gap-2">
        <button
          onClick={() => { setActiveSubTab('withdrawal'); setLatestResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
            activeSubTab === 'withdrawal'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:bg-slate-850 hover:text-white'
          }`}
        >
          <DollarSign size={18} />
          Cash Withdrawal
        </button>
        <button
          onClick={() => { setActiveSubTab('enquiry'); setLatestResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
            activeSubTab === 'enquiry'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:bg-slate-850 hover:text-white'
          }`}
        >
          <Building2 size={18} />
          Balance Enquiry
        </button>
        <button
          onClick={() => { setActiveSubTab('statement'); setLatestResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
            activeSubTab === 'statement'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:bg-slate-850 hover:text-white'
          }`}
        >
          <History size={18} />
          Mini Statement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <form onSubmit={handleExecuteTransaction} className="space-y-6">
            {/* Searchable Bank Selector */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">બેંક પસંદ કરો</label>
              <div className="relative">
                <Building className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="બેંકનું નામ સર્ચ કરો..."
                  value={txForm.bankName || bankSearch}
                  onChange={(e) => {
                    setBankSearch(e.target.value);
                    setTxForm(prev => ({ ...prev, bankName: '', bankIin: '' }));
                    setShowBankDropdown(true);
                  }}
                  onFocus={() => setShowBankDropdown(true)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
                {txForm.bankIin && (
                  <span className="absolute right-4 top-3.5 text-xs text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    IIN: {txForm.bankIin}
                  </span>
                )}
              </div>

              {/* Dropdown list */}
              {showBankDropdown && (
                <div className="absolute z-30 w-full mt-2 bg-slate-950 border border-slate-800 rounded-2xl max-h-60 overflow-y-auto shadow-2xl p-2 no-scrollbar">
                  {BANK_IIN_LIST.filter(bank =>
                    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
                  ).length > 0 ? (
                    BANK_IIN_LIST.filter(bank =>
                      bank.name.toLowerCase().includes(bankSearch.toLowerCase())
                    ).map((bank) => (
                      <button
                        key={bank.iin}
                        type="button"
                        onClick={() => {
                          setTxForm(prev => ({
                            ...prev,
                            bankIin: bank.iin,
                            bankName: bank.name
                          }));
                          setBankSearch('');
                          setShowBankDropdown(false);
                        }}
                        className="w-full flex items-center justify-between text-left px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors text-sm text-slate-200"
                      >
                        <span>{bank.name}</span>
                        <span className="text-xs text-slate-500 font-bold">IIN: {bank.iin}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500">બેંક મળી નથી</div>
                  )}
                </div>
              )}
            </div>

            {/* Aadhaar Number */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ગ્રાહકનો આધાર નંબર</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  pattern="[0-9]{12}"
                  maxLength={12}
                  value={txForm.customerAadhaar}
                  onChange={e => setTxForm({ ...txForm, customerAadhaar: e.target.value })}
                  placeholder="12-digit Aadhaar Number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            {/* Customer Mobile */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ગ્રાહકનો મોબાઈલ નંબર</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={txForm.customerMobile}
                  onChange={e => setTxForm({ ...txForm, customerMobile: e.target.value })}
                  placeholder="10-digit Mobile Number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            {/* Amount (Only for Cash Withdrawal) */}
            {activeSubTab === 'withdrawal' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ઉપાડવાની રકમ (રૂપિયામાં)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="number"
                    required
                    min={100}
                    max={10000}
                    step={100}
                    value={txForm.amount}
                    onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                    placeholder="રકમ લખો (દા.ત. 1000)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 text-sm transition-all"
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            {biometricStep === 'scanning' ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-2" />
                <p className="text-white text-sm font-semibold">ડિવાઇસ લાઈટ ચાલુ છે, આંગળી મૂકો...</p>
              </div>
            ) : biometricStep === 'processing' ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-2" />
                <p className="text-white text-sm font-semibold">ટ્રાન્ઝેક્શન બેંક સર્વર સાથે પ્રક્રિયામાં છે...</p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={submittingBiometric}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Fingerprint className="w-5 h-5" />
                {activeSubTab === 'withdrawal' && 'સ્કેન અને રોકડ ઉપાડ'}
                {activeSubTab === 'enquiry' && 'સ્કેન અને બેલેન્સ ચેક'}
                {activeSubTab === 'statement' && 'સ્કેન અને મિની સ્ટેટમેન્ટ'}
              </button>
            )}
          </form>
        </div>

        {/* Support Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
              <Info className="text-emerald-500 w-5 h-5" />
              માહિતી & ગાઈડલાઈન
            </h3>
            <ul className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                એક આધાર ટ્રાન્ઝેક્શનમાં વધુમાં વધુ ₹10,000 સુધીની લિમિટ છે.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                ડિવાઇસ સ્કેન ન થાય તો ડ્રાઈવર અપડેટ ચેક કરો અથવા RD Service રીસ્ટાર્ટ કરો.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                ગ્રાહકના ખાતામાંથી ડેબિટ થાય અને વોલેટ ક્રેડિટ ન થાય તો તે ટ્રાન્ઝેક્શન 72 કલાકમાં રિવર્સલ થઈ જશે.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      <AnimatePresence>
        {showReceiptModal && latestResult && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-100"
            >
              {/* Header */}
              <div className="bg-slate-950 p-6 flex justify-between items-center border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Fingerprint className="text-emerald-500 w-6 h-6 animate-pulse" />
                  <span className="font-bold text-lg text-white">ટ્રાન્ઝેક્શન રસીદ</span>
                </div>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 text-sm">
                <div className="text-center pb-4 border-b border-slate-800/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">ટ્રાન્ઝેક્શન પ્રકાર</p>
                  <p className="text-lg font-black text-white uppercase mt-1">{latestResult.type}</p>
                  <p className="text-slate-400 text-xs mt-1">{latestResult.date}</p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">બેંકનું નામ:</span>
                    <span className="font-semibold text-white">{latestResult.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">આધાર નંબર:</span>
                    <span className="font-semibold text-white">XXXX-XXXX-{latestResult.aadhaar.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">મોબાઈલ નંબર:</span>
                    <span className="font-semibold text-white">{latestResult.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">રકમ:</span>
                    <span className="font-bold text-emerald-400">₹{latestResult.amount || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">બેંક સિલક (Balance):</span>
                    <span className="font-bold text-white">₹{latestResult.balance || latestResult.availBalance || '0.00'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-850 pt-3">
                    <span className="text-slate-400">RRN / Transaction ID:</span>
                    <span className="font-mono text-xs text-white break-all">{latestResult.txnRefId || latestResult.rrn || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">સ્ટેટસ:</span>
                    <span className="font-semibold text-emerald-400">સફળ (SUCCESS)</span>
                  </div>
                </div>

                {/* Mini Statement Display if Statement result is available */}
                {latestResult.type === 'statement' && latestResult.miniStatement && (
                  <div className="border-t border-slate-800/80 pt-4">
                    <p className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">છેલ્લા ટ્રાન્ઝેક્શન્સ (Mini Statement)</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-850 max-h-40 overflow-y-auto no-scrollbar">
                      <table className="w-full text-left border-collapse text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-500 font-bold uppercase">
                          <tr>
                            <th className="p-2.5">તારીખ</th>
                            <th className="p-2.5">પ્રકાર</th>
                            <th className="p-2.5 text-right">રકમ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {Array.isArray(latestResult.miniStatement) ? (
                            latestResult.miniStatement.map((st: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-850/50">
                                <td className="p-2.5">{st.date || 'N/A'}</td>
                                <td className="p-2.5 uppercase font-medium">{st.type || 'N/A'}</td>
                                <td className="p-2.5 text-right font-bold text-white">₹{st.amount || '0.00'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="p-3 text-center text-slate-500">કોઈ ડેટા નથી</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="bg-slate-950 p-6 flex gap-4 border-t border-slate-800/80">
                <button
                  onClick={downloadReceiptPdf}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all"
                >
                  <FileText size={16} />
                  PDF ડાઉનલોડ
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl transition-all"
                >
                  <Printer size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
